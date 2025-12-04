import React, { useState, useEffect } from 'react';
import { UploadButton } from './components/UploadButton';
import { Messages } from './components/Messages';
import { VideoPlayer } from './components/VideoPlayer';
import { WelcomeModal } from './components/WelcomeModal';
import { UploadInfoModal } from './components/UploadInfoModal';
import { PasswordModal } from './components/PasswordModal';
import { NaiasView } from './components/NaiasView';
import { VideoEntry } from './types';
import { extractFrameFromVideo } from './utils/videoHelpers';
import { fetchVideos, insertVideo, updateVideo, uploadVideoToStorage, uploadThumbnailToStorage, triggerVideoProcessing, supabase } from './services/supabaseService';
import { Heart, Grid3x3 } from 'lucide-react';

const FIRST_VISIT_KEY = 'dear-naia-first-visit';

const App: React.FC = () => {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoEntry | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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

  // Subscribe to realtime updates for video transcriptions
  useEffect(() => {
    const channel = supabase
      .channel('video-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: 'transcription=not.is.null',
        },
        (payload: any) => {
          console.log('Video transcription updated:', payload.new);
          // Update the video in local state when transcription completes
          setVideos((prev: VideoEntry[]) =>
            prev.map((v) =>
              v.id === payload.new.id
                ? { ...v, transcription: payload.new.transcription }
                : v
            )
          );
          // Update selected video if it's the one being updated
          setSelectedVideo((current) =>
            current?.id === payload.new.id
              ? { ...current, transcription: payload.new.transcription }
              : current
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    let blobUrl: string | null = null;
    
    try {
      const id = crypto.randomUUID();
      
      // Create blob URL for immediate playback while uploading
      blobUrl = URL.createObjectURL(file);
      
      // 1. Extract a frame for the thumbnail (non-blocking - continue even if it fails)
      console.log('Extracting thumbnail...');
      let frameDataUrl: string | null = null;
      try {
        frameDataUrl = await Promise.race([
          extractFrameFromVideo(file, 1.0), // snapshot at 1s
          new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error('Thumbnail extraction timeout')), 60000) // Increased to 60s
          )
        ]) as string;
        console.log('✅ Thumbnail extracted successfully');
      } catch (thumbnailError) {
        console.warn('⚠️ Thumbnail extraction failed, continuing without thumbnail:', thumbnailError);
        // Create a placeholder thumbnail
        frameDataUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCIgZmlsbD0iIzE4MTgxYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM3MzczNzMiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5WaWRlbzwvdGV4dD48L3N2Zz4=';
      }
      
      // 2. Upload original video to Supabase Storage (preserves audio)
      console.log('Uploading video to storage...');
      const storageUrl = await Promise.race([
        uploadVideoToStorage(file, id),
        new Promise<string | null>((_, reject) => 
          setTimeout(() => reject(new Error('Video upload timeout')), 600000) // 10 min timeout for large files
        )
      ]) as string | null;
      
      if (!storageUrl) {
        throw new Error('Failed to upload video to storage');
      }

      // 3. Upload thumbnail to Supabase Storage (if we have one)
      let thumbnailUrl = frameDataUrl;
      if (frameDataUrl && frameDataUrl.startsWith('data:')) {
        console.log('Uploading thumbnail to storage...');
        try {
          const uploadedThumbnail = await uploadThumbnailToStorage(frameDataUrl, id);
          if (uploadedThumbnail) {
            thumbnailUrl = uploadedThumbnail;
          }
        } catch (thumbError) {
          console.warn('⚠️ Thumbnail upload failed, using data URL:', thumbError);
        }
      }
      
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

        // Trigger background processing (transcription) via Supabase Edge Function
        // This runs asynchronously and doesn't block the user
        console.log('🎬 Starting background transcription via Supabase Edge Function...', {
          videoId: savedVideo.id,
          videoUrl: storageUrl.substring(0, 50) + '...'
        });
        triggerVideoProcessing(savedVideo.id, storageUrl);
        
        // Note: Transcription happens in the Edge Function (process-video)
        // The Edge Function downloads the video, transcribes it via Hugging Face Whisper,
        // and updates the database. The UI updates automatically via Supabase Realtime.
      } else {
        // If DB save fails, still add locally but show warning
        console.warn('Failed to save video to database, but added locally');
        setVideos((prev) => [newVideo, ...prev]);
        setSelectedVideo(newVideo);
      }
      
    } catch (error) {
      console.error("Upload failed", error);
      
      // Clean up blob URL if it exists
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      
      // Show more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          alert(
            `⏱️ Upload timeout!\n\n` +
            `The upload is taking too long. This might be due to:\n` +
            `- Large file size\n` +
            `- Slow internet connection\n` +
            `- Server issues\n\n` +
            `Please try again with a smaller file or check your connection.`
          );
        } else if (error.message.includes('exceeded the maximum allowed size') || error.message.includes('Failed to upload video to storage')) {
          // Try to extract file size from error or use a default message
          const fileSizeMatch = error.message.match(/(\d+\.?\d*)\s*MB/);
          const fileSizeText = fileSizeMatch ? `${fileSizeMatch[1]} MB` : 'your video';
          
          alert(
            `❌ File size too large!\n\n` +
            `Your video (${fileSizeText}) exceeds the Supabase Storage file size limit.\n\n` +
            `📋 TO FIX:\n` +
            `1. Open: https://supabase.com/dashboard/project/dszvvagszjltrssjivmu/storage/settings\n` +
            `2. Scroll to "Global file size limit"\n` +
            `3. Increase it to at least 150 MB (or higher)\n` +
            `4. Click Save\n` +
            `5. Try uploading again\n\n` +
            `💡 If you upgraded to Pro, you can set it up to 500 GB!`
          );
        } else {
          alert(`Failed to process video: ${error.message}\n\nPlease try again.`);
        }
      } else {
        alert("Failed to process video. Please try again.");
      }
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
            <div className="bg-purple-500/10 p-2 rounded-lg">
                <Heart className="w-5 h-5 text-purple-500 fill-current" />
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
            <span>{showNaiasView ? 'Messages View' : "Naia's View"}</span>
          </button>
        </div>
      </header>

      <main className={`flex-1 ${showNaiasView ? 'w-full max-w-full mx-0 px-0' : 'max-w-7xl mx-auto w-full px-4 py-6 md:py-8'} flex flex-col gap-6 md:gap-12`}>
        {showNaiasView ? (
          /* Naia's View - TikTok-like vertical feed */
          <div className="flex-1 w-full">
            {isLoading ? (
              <div className="h-[calc(100vh-4rem)] w-full flex items-center justify-center text-zinc-500">
                <p>Loading Messages...</p>
              </div>
            ) : (
              <NaiasView videos={videos} onSelectVideo={setSelectedVideo} />
            )}
          </div>
        ) : (
          /* Normal Messages View */
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
                        <UploadButton onUpload={handleFileSelect} isProcessing={isProcessing} />
                    </div>
                </div>
            </div>

            {/* Messages Section */}
            <div className="order-2 lg:order-3 lg:col-span-3 w-full">
                 <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-lg md:text-xl font-semibold text-white">Messages</h2>
                    <span className="text-xs md:text-sm text-zinc-500">
                      {isLoading ? 'Loading...' : `${videos.length} Messages`}
                    </span>
                 </div>
                 {isLoading ? (
                   <div className="h-48 w-full border-2 border-dashed border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600">
                     <p>Loading Messages...</p>
                   </div>
                 ) : (
                   <Messages 
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