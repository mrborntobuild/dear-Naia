import React, { useState, useEffect } from 'react';
import { UploadButton } from './components/UploadButton';
import { Messages } from './components/Messages';
import { VideoPlayer } from './components/VideoPlayer';
import { WelcomeModal } from './components/WelcomeModal';
import { UploadInfoModal } from './components/UploadInfoModal';
import { NaiasView } from './components/NaiasView';
import { ArticleCard } from './components/ArticleCard';
import { ArticleModal } from './components/ArticleModal';
import { VideoEntry, ArticleEntry, ImageEntry, EventEntry } from './types';
import { extractFrameFromVideo } from './utils/videoHelpers';
import { PLACEHOLDER_THUMBNAIL } from './utils/constants';
import { 
  fetchVideos, insertVideo, updateVideo, uploadVideoToStorage, uploadThumbnailToStorage, triggerVideoProcessing, supabase,
  fetchArticles, insertArticle,
  fetchImages, insertImage, uploadImageToStorage,
  fetchEvents
} from './services/supabaseService';
import { Heart, Grid3x3, Video, BookOpen, Image as ImageIcon, Calendar, Plus } from 'lucide-react';
import { Events } from './components/Events';
import { EventsWall } from './components/EventsWall';

const FIRST_VISIT_KEY = 'dear-naia-first-visit';

const App: React.FC = () => {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [articles, setArticles] = useState<ArticleEntry[]>([]);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'videos' | 'articles' | 'images' | 'events'>('videos');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showNaiasView, setShowNaiasView] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  
  // Article Modal State
  const [previewArticle, setPreviewArticle] = useState<ArticleEntry | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);

  // Check if this is the first visit
  useEffect(() => {
    const hasVisited = localStorage.getItem(FIRST_VISIT_KEY);
    if (!hasVisited) {
      setShowWelcome(true);
    }
  }, []);

  // Load data from database on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [loadedVideos, loadedArticles, loadedImages, loadedEvents] = await Promise.all([
          fetchVideos(),
          fetchArticles(),
          fetchImages(),
          fetchEvents()
        ]);
        setVideos(loadedVideos);
        setArticles(loadedArticles);
        setImages(loadedImages);
        setEvents(loadedEvents);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Reload events when needed
  const handleEventsChange = async () => {
    try {
      const loadedEvents = await fetchEvents();
      setEvents(loadedEvents);
    } catch (error) {
      console.error('Failed to reload events:', error);
    }
  };

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

  const handleAddClick = () => {
    setShowNaiasView(false);
  };

  const handleArticleClick = () => {
    setShowUploadModal(true);
  };

  const handlePreviewArticle = (article: ArticleEntry) => {
    setPreviewArticle(article);
    setShowArticleModal(true);
  };

  const handleCloseArticleModal = () => {
    setShowArticleModal(false);
    setPreviewArticle(null);
  };

  const handleUpload = async (file: File | null, personName: string, description: string, link?: string, articleTitle?: string) => {
    setShowUploadModal(false);
    setIsProcessing(true);
    let blobUrl: string | null = null;
    
    try {
      const id = crypto.randomUUID();
      const timestamp = Date.now();
      // Use person's name as the title
      const title = `${personName}'s Message`;

      // --- Article Upload ---
      if (activeTab === 'articles') {
          if (!link) throw new Error("Link is required for articles");
          
          // Use article title from metadata if available, otherwise use person's name format
          const finalTitle = articleTitle || title;
          
          const newArticle: ArticleEntry = {
              id,
              link,
              title: finalTitle,
              description,
              timestamp,
              posted_by: personName
          };
          
          const savedArticle = await insertArticle(newArticle);
          if (savedArticle) {
              setArticles(prev => [savedArticle, ...prev]);
              // alert('Article saved successfully!');
          } else {
              throw new Error("Failed to save article to database");
          }
          return;
      } 
      
      // --- Image Upload ---
      if (activeTab === 'images') {
          if (!file) throw new Error("Image file is required");
          
          const storageUrl = await uploadImageToStorage(file, id);
          if (!storageUrl) throw new Error("Failed to upload image");
          
          const newImage: ImageEntry = {
              id,
              url: storageUrl,
              title,
              description,
              timestamp
          };
          
          const savedImage = await insertImage(newImage);
          if (savedImage) {
              setImages(prev => [savedImage, ...prev]);
              // alert('Image saved successfully!');
          } else {
              throw new Error("Failed to save image to database");
          }
          return;
      }

      // --- Video Upload ---
      if (!file) return;

      // Create blob URL for immediate playback while uploading
      blobUrl = URL.createObjectURL(file);
      
      // 1. Use default purple heart thumbnail (skip extraction to be safe/faster)
      console.log('Using default thumbnail...');
      // Default thumbnail: Purple heart on dark background
      let thumbnailUrl: string = PLACEHOLDER_THUMBNAIL;
      
      // 2. Upload original video to Supabase Storage (preserves audio)
      console.log('Uploading video to storage...');
      // No timeout for upload to allow large files
      const storageUrl = await uploadVideoToStorage(file, id);
      
      if (!storageUrl) {
        throw new Error('Failed to upload video to storage');
      }
      
      const newVideo: VideoEntry = {
        id,
        url: storageUrl, // Use storage URL instead of blob URL
        thumbnail: thumbnailUrl,
        title: title,
        description: `Who's in the video: ${description}`, // Store who's in the video
        timestamp: timestamp,
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
        blobUrl = null;

        // Trigger background processing (transcription) via Supabase Edge Function
        // This runs asynchronously and doesn't block the user
        console.log('🎬 Starting background transcription via Supabase Edge Function...', {
          videoId: savedVideo.id,
          videoUrl: storageUrl.substring(0, 50) + '...'
        });
        triggerVideoProcessing(savedVideo.id, storageUrl);
      } else {
        // If DB save fails, still add locally but show warning
        console.warn('Failed to save video to database, but added locally');
        setVideos((prev) => [newVideo, ...prev]);
        setSelectedVideo(newVideo);
      }
      
    } catch (error) {
      console.error("Upload failed", error);
      
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
          alert(`Failed to process: ${error.message}\n\nPlease try again.`);
        }
      } else {
        alert("Failed to process. Please try again.");
      }
    } finally {
      if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
      }
      setIsProcessing(false);
      setPendingFile(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f10] text-zinc-100 flex flex-col font-sans selection:bg-purple-500/30">
      
      {/* Welcome Modal - Shows on first visit */}
      {showWelcome && <WelcomeModal onClose={handleWelcomeClose} />}
      
      {/* Upload Info Modal - Shows before uploading */}
      {showUploadModal && (
        <UploadInfoModal
          isOpen={showUploadModal}
          onClose={handleUploadModalClose}
          onSubmit={(personName, description, link, articleTitle) => handleUpload(pendingFile, personName, description, link, articleTitle)}
          fileName={pendingFile?.name || 'Article Link'}
          type={activeTab === 'articles' ? 'article' : activeTab === 'images' ? 'image' : 'video'}
        />
      )}

      {/* Article Preview Modal */}
      {showArticleModal && previewArticle && (
        <ArticleModal
          isOpen={showArticleModal}
          onClose={handleCloseArticleModal}
          link={previewArticle.link}
          title={previewArticle.title}
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
          {showNaiasView && (
            <button
              onClick={handleAddClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 border border-purple-500/20 transition-colors text-sm font-medium text-white"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          )}
          {!showNaiasView && (
            <button
              onClick={() => setShowNaiasView(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/5 transition-colors text-sm font-medium text-zinc-200 hover:text-white"
            >
              <Grid3x3 className="w-4 h-4" />
              <span>Naia's View</span>
            </button>
          )}
        </div>
      </header>

      <main className={`flex-1 ${showNaiasView ? 'w-full max-w-full mx-0 px-0' : 'max-w-7xl mx-auto w-full px-4 py-6 md:py-8'} flex flex-col gap-6 md:gap-12`}>
        {showNaiasView ? (
          /* Naia's View - TikTok-like vertical feed */
          <div className="flex-1 w-full relative">
            <div className="absolute top-4 left-0 right-0 z-20 flex justify-center pointer-events-none">
                <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10 pointer-events-auto shadow-lg">
                    <button
                        onClick={() => setActiveTab('videos')}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'videos' ? 'bg-white text-black shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                    >
                        <Video className="w-3 h-3" />
                        Videos
                    </button>
                    <button
                        onClick={() => setActiveTab('articles')}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'articles' ? 'bg-white text-black shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                    >
                        <BookOpen className="w-3 h-3" />
                        Articles
                    </button>
                    <button
                        onClick={() => setActiveTab('images')}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'images' ? 'bg-white text-black shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                    >
                        <ImageIcon className="w-3 h-3" />
                        Images
                    </button>
                    <button
                        onClick={() => setActiveTab('events')}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'events' ? 'bg-white text-black shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                    >
                        <Calendar className="w-3 h-3" />
                        Events
                    </button>
                </div>
            </div>

            {activeTab === 'videos' ? (
                isLoading ? (
                    <div className="h-[calc(100vh-4rem)] w-full flex items-center justify-center text-zinc-500">
                        <p>Loading Messages...</p>
                    </div>
                ) : (
                    <NaiasView videos={videos} onSelectVideo={setSelectedVideo} />
                )
            ) : activeTab === 'articles' ? (
                <div className="h-[calc(100vh-4rem)] w-full overflow-y-auto bg-black p-4 pb-20">
                    {articles.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                            <BookOpen className="w-16 h-16 text-zinc-700 mb-4" />
                            <h3 className="text-2xl font-bold text-zinc-400">Articles</h3>
                            <p className="text-zinc-600 mt-2">No articles to display yet.</p>
                        </div>
                    ) : (
                        <div className="max-w-2xl mx-auto space-y-4 pt-16">
                             {articles.map((article) => (
                                <ArticleCard 
                                    key={article.id} 
                                    article={article} 
                                    onPreview={handlePreviewArticle} 
                                />
                            ))}
                        </div>
                    )}
                </div>
            ) : activeTab === 'images' ? (
                <div className="h-[calc(100vh-4rem)] w-full overflow-y-auto bg-black p-4 pb-20">
                     {images.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                            <ImageIcon className="w-16 h-16 text-zinc-700 mb-4" />
                            <h3 className="text-2xl font-bold text-zinc-400">Images</h3>
                            <p className="text-zinc-600 mt-2">No images to display yet.</p>
                        </div>
                     ) : (
                        <div className="max-w-2xl mx-auto columns-1 md:columns-2 gap-4 space-y-4 pt-16">
                            {images.map((image) => (
                                <div key={image.id} className="relative break-inside-avoid group rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                                    <img 
                                        src={image.url} 
                                        alt={image.title}
                                        className="w-full h-auto object-cover"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                                        <h3 className="text-white font-medium text-sm line-clamp-1">{image.title}</h3>
                                        <p className="text-zinc-300 text-xs line-clamp-2 mt-1">{image.description}</p>
                                        <span className="text-zinc-500 text-[10px] mt-2">
                                            {new Date(image.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                     )}
                </div>
            ) : activeTab === 'events' ? (
                <div className="h-[calc(100vh-4rem)] w-full overflow-y-auto bg-black">
                    <EventsWall events={events} />
                </div>
            ) : null}
          </div>
        ) : (
          /* Normal Messages View */
          <div className="flex flex-col gap-6">
              {/* Info Breakdown */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4 md:p-6">
                  <div className="flex items-start gap-3">
                      <div className="bg-purple-500/20 p-2 rounded-lg shrink-0">
                          <Heart className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="flex-1 space-y-2">
                          <h3 className="text-lg font-semibold text-zinc-100">Celebrate Naia's Graduation! 🎓</h3>
                          <div className="text-sm text-zinc-300 space-y-1">
                              <p><strong>When:</strong> December 11th at 4 PM</p>
                              <p><strong>What:</strong> Share video messages, articles, or images to surprise her at graduation dinner</p>
                              <p className="text-purple-400/90 font-medium mt-2">Let's make her celebration unforgettable!</p>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl w-fit border border-zinc-800/50 self-start">
                  <button
                      onClick={() => setActiveTab('videos')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'videos' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  >
                      <Video className="w-4 h-4" />
                      Videos
                  </button>
                  <button
                      onClick={() => setActiveTab('articles')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'articles' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  >
                      <BookOpen className="w-4 h-4" />
                      Articles
                  </button>
                  <button
                      onClick={() => setActiveTab('images')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'images' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  >
                      <ImageIcon className="w-4 h-4" />
                      Images
                  </button>
                  <button
                      onClick={() => setActiveTab('events')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'events' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  >
                      <Calendar className="w-4 h-4" />
                      Events
                  </button>
              </div>

              {activeTab === 'videos' ? (
                <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8">
                    
                    {/* Player Section - Only renders if a video is selected */}
                    {selectedVideo && (
                    <div className="order-2 lg:order-1 lg:col-span-2 space-y-8 animate-in fade-in zoom-in-95 duration-300">
                        <VideoPlayer video={selectedVideo} />
                    </div>
                    )}

                    {/* Upload Section */}
                    <div className={`order-1 lg:order-2 lg:col-span-1 ${!selectedVideo ? 'lg:col-span-3 lg:max-w-md lg:mx-auto w-full' : ''}`}>
                        <div className="lg:sticky lg:top-24 space-y-6">
                            <div>
                                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4 hidden lg:block">Add Memory</h2>
                                <UploadButton type="video" onUpload={handleFileSelect} isProcessing={isProcessing} multiple={true} />
                            </div>
                        </div>
                    </div>

                    {/* Messages Section */}
                    <div className="order-3 lg:order-3 lg:col-span-3 w-full">
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
              ) : activeTab === 'articles' ? (
                  <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8">
                      {/* Upload Section */}
                      <div className="order-1 lg:col-span-3 lg:max-w-md lg:mx-auto w-full mb-8">
                          <UploadButton 
                              type="article" 
                              onUpload={() => {}} 
                              onClick={handleArticleClick}
                              isProcessing={isProcessing} 
                          />
                      </div>
                      
                      {/* Articles List */}
                      {articles.length === 0 ? (
                        <div className="order-2 lg:col-span-3 w-full text-center py-20 border-2 border-dashed border-zinc-800/50 rounded-2xl bg-zinc-900/20">
                            <BookOpen className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                            <h3 className="text-xl font-medium text-zinc-500">No Articles Yet</h3>
                            <p className="text-zinc-600 mt-2">Add a link to an article to see it here.</p>
                        </div>
                      ) : (
                        <div className="order-2 lg:col-span-3 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {articles.map((article) => (
                                <ArticleCard 
                                    key={article.id} 
                                    article={article} 
                                    onPreview={handlePreviewArticle} 
                                />
                            ))}
                        </div>
                      )}
                  </div>
              ) : activeTab === 'images' ? (
                  <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8">
                      {/* Upload Section */}
                      <div className="order-1 lg:col-span-3 lg:max-w-md lg:mx-auto w-full mb-8">
                          <UploadButton 
                              type="image" 
                              onUpload={handleFileSelect} 
                              isProcessing={isProcessing}
                              multiple={true}
                          />
                      </div>
                      
                      {/* Images Grid */}
                      {images.length === 0 ? (
                        <div className="order-2 lg:col-span-3 w-full text-center py-20 border-2 border-dashed border-zinc-800/50 rounded-2xl bg-zinc-900/20">
                            <ImageIcon className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                            <h3 className="text-xl font-medium text-zinc-500">No Images Yet</h3>
                            <p className="text-zinc-600 mt-2">Upload photos to see them here.</p>
                        </div>
                      ) : (
                        <div className="order-2 lg:col-span-3 w-full columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                            {images.map((image) => (
                                <div key={image.id} className="relative break-inside-avoid group rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                                    <img 
                                        src={image.url} 
                                        alt={image.title}
                                        className="w-full h-auto object-cover"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                                        <h3 className="text-white font-medium text-sm line-clamp-1">{image.title}</h3>
                                        <p className="text-zinc-300 text-xs line-clamp-2 mt-1">{image.description}</p>
                                        <span className="text-zinc-500 text-[10px] mt-2">
                                            {new Date(image.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                      )}
                  </div>
              ) : activeTab === 'events' ? (
                  <div className="w-full">
                      <Events events={events} onEventsChange={handleEventsChange} />
                  </div>
              ) : null}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;