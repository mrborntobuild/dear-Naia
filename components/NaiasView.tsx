import React, { useRef, useEffect, useState, useMemo } from 'react';
import { VideoEntry } from '../types';
import { Calendar, MessageSquare, Info, Volume2, VolumeX } from 'lucide-react';

interface NaiasViewProps {
  videos: VideoEntry[];
  onSelectVideo?: (video: VideoEntry) => void;
}

export const NaiasView: React.FC<NaiasViewProps> = ({ videos, onSelectVideo }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Default to unmuted so she can hear audio
  const [loadedVideos, setLoadedVideos] = useState<Set<string>>(new Set()); // Track which videos are loaded
  
  // Detect connection quality for adaptive preloading (memoized to avoid recalculation)
  const { connectionQuality, preloadCount } = useMemo(() => {
    const getConnectionQuality = (): 'slow' | 'medium' | 'fast' => {
      // Use Network Information API if available
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      
      if (connection) {
        // Check effective connection type
        const effectiveType = connection.effectiveType;
        if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
        if (effectiveType === '3g') return 'medium';
        if (effectiveType === '4g') return 'fast';
        
        // Check if on cellular (more conservative preloading)
        if (connection.type === 'cellular' && (connection.downlink || 0) < 2) {
          return 'slow';
        }
        if (connection.type === 'cellular') {
          return 'medium';
        }
        
        // Check downlink speed
        if (connection.downlink) {
          if (connection.downlink < 1.5) return 'slow';
          if (connection.downlink < 5) return 'medium';
          return 'fast';
        }
      }
      
      // Default to medium (balanced approach)
      return 'medium';
    };
    
    const quality = getConnectionQuality();
    
    // Adaptive preload count based on connection
    const count = quality === 'fast' ? 3 : quality === 'medium' ? 2 : 1;
    
    return { connectionQuality: quality, preloadCount: count };
  }, []); // Only calculate once on mount

  // Load first video immediately on mount (after DOM is ready) with aggressive preloading
  useEffect(() => {
    if (videos.length > 0) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const firstVideo = videoRefs.current.get(videos[0].id);
        if (firstVideo && !firstVideo.src) {
          firstVideo.preload = 'auto'; // Preload fully for instant playback
          firstVideo.src = videos[0].url;
          setLoadedVideos(prev => new Set(prev).add(videos[0].id));
          
          // Auto-play first video when it's ready
          const playWhenReady = () => {
            if (firstVideo.readyState >= 3) {
              firstVideo.play().catch(() => {
                // Auto-play might be blocked, that's okay
              });
            } else {
              firstVideo.addEventListener('canplay', () => {
                firstVideo.play().catch(() => {});
              }, { once: true });
            }
          };
          
          // Try immediately and also listen for ready events
          playWhenReady();
          firstVideo.addEventListener('loadeddata', playWhenReady, { once: true });
          
          // Preload videos based on connection quality
          for (let i = 1; i <= preloadCount && i < videos.length; i++) {
            const nextVideo = videoRefs.current.get(videos[i].id);
            if (nextVideo && !nextVideo.src) {
              // Use 'auto' for fast connections, 'metadata' for slower ones
              nextVideo.preload = connectionQuality === 'fast' ? 'auto' : 'metadata';
              nextVideo.src = videos[i].url;
              setLoadedVideos(prev => new Set(prev).add(videos[i].id));
            }
          }
        }
      });
    }
  }, [videos, connectionQuality, preloadCount]); // Only run when videos change

  // Handle scroll to determine which video is in view and preload adjacent videos
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrolling) return;
      
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;
      
      let closestIndex = 0;
      let closestDistance = Infinity;

      videos.forEach((video, index) => {
        const videoElement = container.children[index] as HTMLElement;
        if (videoElement) {
          const videoRect = videoElement.getBoundingClientRect();
          const videoCenter = videoRect.top + videoRect.height / 2;
          const distance = Math.abs(containerCenter - videoCenter);
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        }
      });

      setCurrentIndex(closestIndex);
      
      // Preload videos around the current one based on connection quality
      const preloadVideo = (index: number, useAuto: boolean = false) => {
        if (index >= 0 && index < videos.length) {
          const video = videos[index];
          const videoElement = videoRefs.current.get(video.id);
          if (videoElement && !videoElement.src && !loadedVideos.has(video.id)) {
            videoElement.preload = useAuto ? 'auto' : 'metadata';
            videoElement.src = video.url;
            setLoadedVideos(prev => new Set(prev).add(video.id));
          }
        }
      };
      
      const shouldUseAutoPreload = connectionQuality === 'fast';
      
      // Preload current video
      preloadVideo(closestIndex, shouldUseAutoPreload);
      
      // Preload next videos based on connection quality
      for (let i = 1; i <= preloadCount && closestIndex + i < videos.length; i++) {
        preloadVideo(closestIndex + i, shouldUseAutoPreload);
      }
      
      // Preload previous video only on fast connections
      if (connectionQuality === 'fast' && closestIndex > 0) {
        preloadVideo(closestIndex - 1, true);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [videos, isScrolling, loadedVideos]);

  // Auto-play/pause videos based on visibility AND aggressive lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoId = entry.target.getAttribute('data-video-id');
          if (!videoId) return;
          
          const video = videoRefs.current.get(videoId);
          if (!video) return;

          // Aggressive lazy load: set src when video is approaching viewport (negative margin = earlier loading)
          if (entry.isIntersecting && !loadedVideos.has(videoId)) {
            const videoData = videos.find(v => v.id === videoId);
            if (videoData && !video.src) {
              video.preload = 'auto'; // Full preload for instant playback
              video.src = videoData.url;
              setLoadedVideos(prev => new Set(prev).add(videoId));
              
              // Preload adjacent videos based on connection quality
              const currentVideoIndex = videos.findIndex(v => v.id === videoId);
              const preloadAhead = Math.max(1, preloadCount - 1); // Preload 1-2 videos ahead
              
              for (let i = 1; i <= preloadAhead && currentVideoIndex + i < videos.length; i++) {
                const nextVideoId = videos[currentVideoIndex + i].id;
                const nextVideoElement = videoRefs.current.get(nextVideoId);
                const nextVideoData = videos[currentVideoIndex + i];
                if (nextVideoElement && nextVideoData && !nextVideoElement.src && !loadedVideos.has(nextVideoId)) {
                  // Use 'auto' for fast connections, 'metadata' for slower ones
                  nextVideoElement.preload = connectionQuality === 'fast' ? 'auto' : 'metadata';
                  nextVideoElement.src = nextVideoData.url;
                  setLoadedVideos(prev => new Set(prev).add(nextVideoId));
                }
              }
            }
          }

          // Auto-play/pause logic - wait for video to be ready
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            if (video.src) {
              // Wait for video to have enough data buffered before playing
              const tryPlay = () => {
                if (video.readyState >= 3) { // HAVE_FUTURE_DATA - enough data to play
                  video.play().catch((err) => {
                    console.log('Auto-play prevented:', err);
                  });
                } else {
                  // Wait for canplay event if not ready yet
                  const canPlayHandler = () => {
                    video.play().catch((err) => {
                      console.log('Auto-play prevented:', err);
                    });
                    video.removeEventListener('canplay', canPlayHandler);
                  };
                  video.addEventListener('canplay', canPlayHandler, { once: true });
                }
              };
              tryPlay();
            }
          } else {
            video.pause();
          }
        });
      },
      {
        threshold: [0, 0.3, 0.5, 0.7, 1],
        // Adaptive rootMargin: earlier for fast connections, closer for slow
        rootMargin: connectionQuality === 'fast' ? '50% 0px 50% 0px' : 
                    connectionQuality === 'medium' ? '30% 0px 30% 0px' : 
                    '10% 0px 10% 0px',
      }
    );

    videos.forEach((video) => {
      const videoElement = containerRef.current?.querySelector(`[data-video-id="${video.id}"]`);
      if (videoElement) {
        observer.observe(videoElement);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [videos, loadedVideos, connectionQuality, preloadCount]);

  // Handle keyboard navigation with aggressive preloading
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsScrolling(true);
        
        const nextIndex = e.key === 'ArrowDown' 
          ? Math.min(currentIndex + 1, videos.length - 1)
          : Math.max(currentIndex - 1, 0);
        
        // Preload video at next index before scrolling (adaptive based on connection)
        const nextVideo = videos[nextIndex];
        if (nextVideo) {
          const nextVideoElement = videoRefs.current.get(nextVideo.id);
          if (nextVideoElement && !nextVideoElement.src && !loadedVideos.has(nextVideo.id)) {
            nextVideoElement.preload = connectionQuality === 'fast' ? 'auto' : 'metadata';
            nextVideoElement.src = nextVideo.url;
            setLoadedVideos(prev => new Set(prev).add(nextVideo.id));
          }
          
          // Preload adjacent videos based on connection quality
          const preloadAhead = connectionQuality === 'fast' ? 2 : connectionQuality === 'medium' ? 1 : 0;
          
          for (let i = 1; i <= preloadAhead && nextIndex + i < videos.length; i++) {
            const afterNextVideo = videos[nextIndex + i];
            const afterNextVideoElement = videoRefs.current.get(afterNextVideo.id);
            if (afterNextVideoElement && !afterNextVideoElement.src && !loadedVideos.has(afterNextVideo.id)) {
              afterNextVideoElement.preload = connectionQuality === 'fast' ? 'auto' : 'metadata';
              afterNextVideoElement.src = afterNextVideo.url;
              setLoadedVideos(prev => new Set(prev).add(afterNextVideo.id));
            }
          }
          
          // Only preload previous on fast connections
          if (connectionQuality === 'fast' && nextIndex > 0) {
            const prevVideo = videos[nextIndex - 1];
            const prevVideoElement = videoRefs.current.get(prevVideo.id);
            if (prevVideoElement && !prevVideoElement.src && !loadedVideos.has(prevVideo.id)) {
              prevVideoElement.preload = 'auto';
              prevVideoElement.src = prevVideo.url;
              setLoadedVideos(prev => new Set(prev).add(prevVideo.id));
            }
          }
        }
        
        const videoElement = containerRef.current?.children[nextIndex] as HTMLElement;
        if (videoElement) {
          videoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setCurrentIndex(nextIndex);
        }
        
        setTimeout(() => setIsScrolling(false), 500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, videos, loadedVideos]);

  if (videos.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-zinc-500">
        <p className="text-lg">No videos to display</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-[calc(100vh-4rem)] w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      
      {videos.map((video, index) => (
        <div
          key={video.id}
          data-video-id={video.id}
          className="h-[calc(100vh-4rem)] w-full snap-start snap-always relative bg-black flex items-center justify-center"
        >
          {/* Video - Lazy loaded when visible */}
          <video
            ref={(el) => {
              if (el) {
                videoRefs.current.set(video.id, el);
              } else {
                videoRefs.current.delete(video.id);
              }
            }}
            // Don't set src here - lazy load it in IntersectionObserver
            loop
            muted={isMuted}
            playsInline
            preload="none"
            data-video-id={video.id}
            className="w-full h-full object-contain"
            onLoadedData={(e) => {
              // Video has loaded enough data - ensure it's ready to play
              const videoEl = e.currentTarget;
              if (videoEl.readyState >= 3) {
                // Video is ready, pause it (will auto-play when visible)
                videoEl.pause();
              }
            }}
            onCanPlay={(e) => {
              // Video can start playing - ensure currentTime is at start
              const videoEl = e.currentTarget;
              if (videoEl.currentTime > 0.1) {
                videoEl.currentTime = 0;
              }
            }}
            onError={(e) => {
              // Handle video loading errors gracefully
              console.warn(`Video ${video.id} failed to load:`, e);
              const videoEl = e.currentTarget;
              // Try reloading once after a delay
              setTimeout(() => {
                if (!videoEl.src || videoEl.error) {
                  const videoData = videos.find(v => v.id === video.id);
                  if (videoData) {
                    videoEl.load(); // Reload the video
                  }
                }
              }, 2000);
            }}
            onClick={(e) => {
              const videoEl = e.currentTarget;
              // Load video if not already loaded and user clicks
              if (!videoEl.src) {
                const videoData = videos.find(v => v.id === video.id);
                if (videoData) {
                  videoEl.preload = 'auto';
                  videoEl.src = videoData.url;
                  setLoadedVideos(prev => new Set(prev).add(video.id));
                  // Wait for video to be ready before playing
                  videoEl.addEventListener('canplay', () => {
                    videoEl.play().catch(() => {});
                  }, { once: true });
                  return;
                }
              }
              if (videoEl.paused) {
                videoEl.play().catch(() => {});
              } else {
                videoEl.pause();
              }
            }}
          />

          {/* Overlay with metadata */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 md:p-6 lg:p-8 pointer-events-none">
            <div className="max-w-2xl mx-auto pointer-events-auto relative">
              {/* Volume Control */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                className="absolute right-0 top-0 p-3 rounded-full bg-black/20 backdrop-blur-md hover:bg-black/40 transition-colors text-white/90 hover:text-white"
              >
                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>

              {/* Title */}
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2 md:mb-3 tracking-tight drop-shadow-lg">
                {video.title}
              </h2>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-zinc-200 mb-3 md:mb-4">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                  {new Date(video.timestamp).toLocaleDateString()}
                </span>
                {(video.transcription || video.description) && (
                  <>
                    <span className="w-1 h-1 bg-zinc-500 rounded-full" />
                    <span className="flex items-center gap-1.5">
                      <Info className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="line-clamp-1">{video.transcription || video.description}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Transcription */}
              {video.transcription && (
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/10">
                  <div className="flex items-start gap-2 text-zinc-100">
                    <MessageSquare className="w-4 h-4 md:w-5 md:h-5 mt-0.5 text-purple-400 shrink-0" />
                    <p className="text-xs md:text-sm lg:text-base leading-relaxed line-clamp-2 md:line-clamp-3 drop-shadow-md">
                      {video.transcription}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scroll indicator */}
          {index < videos.length - 1 && (
            <div className="absolute bottom-24 md:bottom-28 left-1/2 transform -translate-x-1/2 animate-bounce pointer-events-none">
              <div className="w-6 h-10 border-2 border-white/60 rounded-full flex items-start justify-center p-2 backdrop-blur-sm bg-black/20">
                <div className="w-1 h-3 bg-white/70 rounded-full" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

