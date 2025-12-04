import React, { useState, useEffect } from 'react';
import { UploadButton } from './components/UploadButton';
import { Timeline } from './components/Timeline';
import { VideoPlayer } from './components/VideoPlayer';
import { WelcomeModal } from './components/WelcomeModal';
import { UploadInfoModal } from './components/UploadInfoModal';
import { PasswordModal } from './components/PasswordModal';
import { NaiasView } from './components/NaiasView';
import { VideoEntry } from './types';
import { extractFrameFromVideo } from './utils/videoHelpers';
import { fetchVideos, insertVideo, updateVideo, uploadVideoToStorage, uploadThumbnailToStorage } from './services/supabaseService';
import { transcribeVideo } from './services/transcriptionService';
import { Heart, Grid3x3 } from 'lucide-react';

const FIRST_VISIT_KEY = 'dear-naia-first-visit';

const App: React.FC = () => {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoEntry | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showNaiasView, setShowNaiasView] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Check if this is the first visit
  useEffect(() => {
    const hasVisited = localStorage.getItem(FIRST_VISIT_KEY);
    if (!hasVisited) {
      setShowWelcome(true);
    }
  }, []);

  // Load videos from database on mount
  useEffect(() => {
    const loadVideos = async () => {
      setIsLoading(true);
      try {
        const loadedVideos = await fetchVideos();
        setVideos(loadedVideos);
        // Note: Videos loaded from DB will have URLs that may not work if they were blob URLs
        // For production, videos should be stored in Supabase Storage
      } catch (error) {
        console.error('Failed to load videos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVideos();
  }, []);

  const handleWelcomeClose = () => {
    setShowWelcome(false);
    localStorage.setItem(FIRST_VISIT_KEY, 'true');
  };

  const handleFileSelect = (file: File) => {
    setPendingFile(file);
    setShowUploadModal(true);
  };

  const handleUploadModalClose = () => {
    setShowUploadModal(false);
    setPendingFile(null);
  };

  const handleNaiaViewClick = () => {
    if (showNaiasView) {
      // If already showing Naia's View, just toggle it off
      setShowNaiasView(false);
    } else {
      // If not showing, check password first
      setShowPasswordModal(true);
    }
  };

  const handlePasswordSuccess = () => {
    setShowPasswordModal(false);
    setShowNaiasView(true);
  };

  const handlePasswordModalClose = () => {
    setShowPasswordModal(false);
  };

  const handleUpload = async (file: File, personName: string, whoInVideo: string) => {
    setShowUploadModal(false);
    setIsProcessing(true);
    try {
      const id = crypto.randomUUID();
      
      // Create blob URL for immediate playback while uploading
      const blobUrl = URL.createObjectURL(file);
      
      // 1. Extract a frame for the thumbnail
      const frameDataUrl = await extractFrameFromVideo(file, 1.0); // snapshot at 1s
      
      // 2. Upload video to Supabase Storage
      console.log('Uploading video to storage...');
      const storageUrl = await uploadVideoToStorage(file, id);
      
      if (!storageUrl) {
        throw new Error('Failed to upload video to storage');
      }

      // 3. Upload thumbnail to Supabase Storage
      console.log('Uploading thumbnail to storage...');
      const thumbnailUrl = await uploadThumbnailToStorage(frameDataUrl, id) || frameDataUrl;
      
      // Use person's name as the title
      const videoTitle = `${personName}'s Message`;
      
      const newVideo: VideoEntry = {
        id,
        url: storageUrl, // Use storage URL instead of blob URL
        thumbnail: thumbnailUrl,
        title: videoTitle,
        description: `Who's in the video: ${whoInVideo}`, // Store who's in the video
        timestamp: Date.now(),
        durationString: "00:00" // Placeholder
      };

      // 4. Save to database
      const savedVideo = await insertVideo(newVideo);
      if (savedVideo) {
        // Use the saved video with storage URLs
        setVideos((prev) => [savedVideo, ...prev]);
        setSelectedVideo(savedVideo);
        
        // Clean up blob URL
        URL.revokeObjectURL(blobUrl);

        // Transcribe video in the background (non-blocking)
        setIsTranscribing(true);
        transcribeVideo(file)
          .then(async (transcription) => {
            if (transcription && savedVideo) {
              // Update video with transcription
              const updatedVideo = { ...savedVideo, transcription };
              const dbUpdatedVideo = await updateVideo(updatedVideo);
              
              if (dbUpdatedVideo) {
                // Update local state
                setVideos((prev) =>
                  prev.map((v) => (v.id === savedVideo.id ? dbUpdatedVideo : v))
                );
                // Update selected video if it's the one we just transcribed
                setSelectedVideo((current) =>
                  current?.id === savedVideo.id ? dbUpdatedVideo : current
                );
              }
            }
          })
          .catch((error) => {
            console.error('Transcription failed:', error);
            // Don't show error to user, transcription is optional
          })
          .finally(() => {
            setIsTranscribing(false);
          });
      } else {
        // If DB save fails, still add locally but show warning
        console.warn('Failed to save video to database, but added locally');
        setVideos((prev) => [newVideo, ...prev]);
        setSelectedVideo(newVideo);
      }
      
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to process video. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f10] text-zinc-100 flex flex-col font-sans selection:bg-rose-500/30">
      
      {/* Welcome Modal - Shows on first visit */}
      {showWelcome && <WelcomeModal onClose={handleWelcomeClose} />}
      
      {/* Upload Info Modal - Shows before uploading */}
      {showUploadModal && pendingFile && (
        <UploadInfoModal
          isOpen={showUploadModal}
          onClose={handleUploadModalClose}
          onSubmit={(personName, whoInVideo) => handleUpload(pendingFile, personName, whoInVideo)}
          fileName={pendingFile.name}
        />
      )}

      {/* Password Modal - Shows before accessing Naia's View */}
      {showPasswordModal && (
        <PasswordModal
          isOpen={showPasswordModal}
          onClose={handlePasswordModalClose}
          onSuccess={handlePasswordSuccess}
        />
      )}
      
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0f0f10]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-rose-500/10 p-2 rounded-lg">
                <Heart className="w-5 h-5 text-rose-500 fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tight text-zinc-100">
              Dear Naia
            </span>
          </div>
          <button
            onClick={handleNaiaViewClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/5 transition-colors text-sm font-medium text-zinc-200 hover:text-white"
          >
            <Grid3x3 className="w-4 h-4" />
            <span>{showNaiasView ? 'Timeline View' : "Naia's View"}</span>
          </button>
        </div>
      </header>

      <main className={`flex-1 ${showNaiasView ? 'w-full max-w-full mx-0 px-0' : 'max-w-7xl mx-auto w-full px-4 py-6 md:py-8'} flex flex-col gap-6 md:gap-12`}>
        {showNaiasView ? (
          /* Naia's View - TikTok-like vertical feed */
          <div className="flex-1 w-full">
            {isLoading ? (
              <div className="h-[calc(100vh-4rem)] w-full flex items-center justify-center text-zinc-500">
                <p>Loading memories...</p>
              </div>
            ) : (
              <NaiasView videos={videos} onSelectVideo={setSelectedVideo} />
            )}
          </div>
        ) : (
          /* Normal Timeline View */
          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8">
            
            {/* Player Section - Only renders if a video is selected */}
            {selectedVideo && (
              <div className="order-1 lg:col-span-2 space-y-8 animate-in fade-in zoom-in-95 duration-300">
                  <VideoPlayer video={selectedVideo} />
              </div>
            )}

            {/* Upload Section */}
            <div className={`order-3 lg:order-2 lg:col-span-1 ${!selectedVideo ? 'lg:col-span-3 lg:max-w-md lg:mx-auto w-full' : ''}`}>
                <div className="lg:sticky lg:top-24 space-y-6">
                    <div>
                        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4 hidden lg:block">Add Memory</h2>
                        <UploadButton onUpload={handleFileSelect} isProcessing={isProcessing} isTranscribing={isTranscribing} />
                    </div>
                </div>
            </div>

            {/* Timeline Section */}
            <div className="order-2 lg:order-3 lg:col-span-3 w-full">
                 <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-lg md:text-xl font-semibold text-white">Timeline</h2>
                    <span className="text-xs md:text-sm text-zinc-500">
                      {isLoading ? 'Loading...' : `${videos.length} memories`}
                    </span>
                 </div>
                 {isLoading ? (
                   <div className="h-48 w-full border-2 border-dashed border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600">
                     <p>Loading memories...</p>
                   </div>
                 ) : (
                   <Timeline 
                      videos={videos} 
                      selectedVideoId={selectedVideo?.id || null} 
                      onSelectVideo={setSelectedVideo}
                   />
                 )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;