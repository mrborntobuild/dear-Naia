import React, { useRef, useEffect, useState, useMemo } from 'react';
import { EventEntry, EventMediaEntry } from '../types';
import { Video, Calendar, MessageSquare, Info, Volume2, VolumeX } from 'lucide-react';

interface EventsWallProps {
  events: EventEntry[];
}

interface MediaWithEvent extends EventMediaEntry {
  eventTitle: string;
  eventDate: string;
  eventId: string;
  eventDescription?: string;
  uploaded_by?: string;
}

export const EventsWall: React.FC<EventsWallProps> = ({ events }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const imageRefs = useRef<Map<string, HTMLImageElement>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loadedVideos, setLoadedVideos] = useState<Set<string>>(new Set());
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // Collect all media from all events
  const allMedia: MediaWithEvent[] = events.flatMap(event => 
    (event.media || []).map(media => ({
      ...media,
      eventTitle: event.title,
      eventDate: event.date,
      eventId: event.id,
      eventDescription: event.description,
      uploaded_by: media.uploaded_by
    }))
  );

  // Detect connection quality for adaptive preloading
  const { connectionQuality, preloadCount } = useMemo(() => {
    const getConnectionQuality = (): 'slow' | 'medium' | 'fast' => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      
      if (connection) {
        const effectiveType = connection.effectiveType;
        if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
        if (effectiveType === '3g') return 'medium';
        if (effectiveType === '4g') return 'fast';
        
        if (connection.type === 'cellular' && (connection.downlink || 0) < 2) {
          return 'slow';
        }
        if (connection.type === 'cellular') {
          return 'medium';
        }
        
        if (connection.downlink) {
          if (connection.downlink < 1.5) return 'slow';
          if (connection.downlink < 5) return 'medium';
          return 'fast';
        }
      }
      
      return 'medium';
    };
    
    const quality = getConnectionQuality();
    const count = quality === 'fast' ? 3 : quality === 'medium' ? 2 : 1;
    
    return { connectionQuality: quality, preloadCount: count };
  }, []);

  // Load first media item immediately on mount (video OR image)
  useEffect(() => {
    if (allMedia.length > 0) {
      requestAnimationFrame(() => {
        const firstMedia = allMedia[0];
        
        // Load first video immediately
        if (firstMedia.media_type === 'video') {
          const videoElement = videoRefs.current.get(firstMedia.id);
          if (videoElement && !videoElement.src) {
            videoElement.preload = 'auto';
            videoElement.src = firstMedia.media_url;
            setLoadedVideos(prev => new Set(prev).add(firstMedia.id));
            
            const playWhenReady = () => {
              if (videoElement.readyState >= 3) {
                videoElement.play().catch(() => {});
              } else {
                videoElement.addEventListener('canplay', () => {
                  videoElement.play().catch(() => {});
                }, { once: true });
              }
            };
            
            playWhenReady();
            videoElement.addEventListener('loadeddata', playWhenReady, { once: true });
          }
        } else {
          // Load first image immediately
          const imageElement = imageRefs.current.get(firstMedia.id);
          if (imageElement && !imageElement.src) {
            imageElement.src = firstMedia.media_url;
            setLoadedImages(prev => new Set(prev).add(firstMedia.id));
          }
        }
        
        // Preload next media items based on connection quality
        for (let i = 1; i <= preloadCount && i < allMedia.length; i++) {
          const nextMedia = allMedia[i];
          if (nextMedia.media_type === 'video') {
            const nextVideoElement = videoRefs.current.get(nextMedia.id);
            if (nextVideoElement && !nextVideoElement.src) {
              nextVideoElement.preload = connectionQuality === 'fast' ? 'auto' : 'metadata';
              nextVideoElement.src = nextMedia.media_url;
              setLoadedVideos(prev => new Set(prev).add(nextMedia.id));
            }
          } else {
            // Preload next images too
            const nextImageElement = imageRefs.current.get(nextMedia.id);
            if (nextImageElement && !nextImageElement.src && i <= 2) { // Preload first 2 images
              nextImageElement.src = nextMedia.media_url;
              setLoadedImages(prev => new Set(prev).add(nextMedia.id));
            }
          }
        }
      });
    }
  }, [allMedia, connectionQuality, preloadCount]);

  // Handle scroll to determine which media is in view
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrolling) return;
      
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;
      
      let closestIndex = 0;
      let closestDistance = Infinity;

      allMedia.forEach((media, index) => {
        const mediaElement = container.children[index] as HTMLElement;
        if (mediaElement) {
          const mediaRect = mediaElement.getBoundingClientRect();
          const mediaCenter = mediaRect.top + mediaRect.height / 2;
          const distance = Math.abs(containerCenter - mediaCenter);
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        }
      });

      setCurrentIndex(closestIndex);
      
      // Preload media around the current one (both videos and images)
      const preloadMedia = (index: number, useAuto: boolean = false) => {
        if (index >= 0 && index < allMedia.length) {
          const media = allMedia[index];
          if (media.media_type === 'video') {
            const videoElement = videoRefs.current.get(media.id);
            if (videoElement && !videoElement.src && !loadedVideos.has(media.id)) {
              videoElement.preload = useAuto ? 'auto' : 'metadata';
              videoElement.src = media.media_url;
              setLoadedVideos(prev => new Set(prev).add(media.id));
            }
          } else {
            // Preload images too
            const imageElement = imageRefs.current.get(media.id);
            if (imageElement && !imageElement.src && !loadedImages.has(media.id)) {
              imageElement.src = media.media_url;
              setLoadedImages(prev => new Set(prev).add(media.id));
            }
          }
        }
      };
      
      const shouldUseAutoPreload = connectionQuality === 'fast';
      preloadMedia(closestIndex, shouldUseAutoPreload);
      
      // Preload ahead
      for (let i = 1; i <= preloadCount && closestIndex + i < allMedia.length; i++) {
        preloadMedia(closestIndex + i, shouldUseAutoPreload);
      }
      
      // Preload previous on fast connections
      if (connectionQuality === 'fast' && closestIndex > 0) {
        preloadMedia(closestIndex - 1, true);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [allMedia, isScrolling, loadedVideos, loadedImages, connectionQuality, preloadCount]);

  // Auto-play/pause videos based on visibility AND aggressive lazy loading (matching NaiasView)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const mediaId = entry.target.getAttribute('data-media-id');
          if (!mediaId) return;
          
          const media = allMedia.find(m => m.id === mediaId);
          if (!media) return;
          
          // Aggressive lazy load: set src when media is approaching viewport
          if (entry.isIntersecting && !loadedVideos.has(mediaId) && !loadedImages.has(mediaId)) {
            if (media.media_type === 'video') {
              const video = videoRefs.current.get(mediaId);
              if (video && !video.src) {
                video.preload = 'auto';
                video.src = media.media_url;
                setLoadedVideos(prev => new Set(prev).add(mediaId));
                
                // Preload adjacent videos aggressively (like NaiasView)
                const currentMediaIndex = allMedia.findIndex(m => m.id === mediaId);
                const preloadAhead = Math.max(1, preloadCount - 1);
                
                for (let i = 1; i <= preloadAhead && currentMediaIndex + i < allMedia.length; i++) {
                  const nextMedia = allMedia[currentMediaIndex + i];
                  if (nextMedia.media_type === 'video') {
                    const nextVideoElement = videoRefs.current.get(nextMedia.id);
                    if (nextVideoElement && !nextVideoElement.src && !loadedVideos.has(nextMedia.id)) {
                      nextVideoElement.preload = connectionQuality === 'fast' ? 'auto' : 'metadata';
                      nextVideoElement.src = nextMedia.media_url;
                      setLoadedVideos(prev => new Set(prev).add(nextMedia.id));
                    }
                  } else if (i <= 2) {
                    // Also preload next images
                    const nextImageElement = imageRefs.current.get(nextMedia.id);
                    if (nextImageElement && !nextImageElement.src && !loadedImages.has(nextMedia.id)) {
                      nextImageElement.src = nextMedia.media_url;
                      setLoadedImages(prev => new Set(prev).add(nextMedia.id));
                    }
                  }
                }
              }
            } else {
              // Load images immediately when intersecting
              const image = imageRefs.current.get(mediaId);
              if (image && !image.src) {
                image.src = media.media_url;
                setLoadedImages(prev => new Set(prev).add(mediaId));
              }
            }
          }

          // Auto-play/pause logic for videos
          if (media.media_type === 'video') {
            const video = videoRefs.current.get(mediaId);
            if (!video) return;

            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
              if (video.src) {
                const tryPlay = () => {
                  if (video.readyState >= 3) {
                    video.play().catch((err) => {
                      console.log('Auto-play prevented:', err);
                    });
                  } else {
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
          }
        });
      },
      {
        threshold: [0, 0.3, 0.5, 0.7, 1],
        // Match NaiasView's aggressive rootMargin
        rootMargin: connectionQuality === 'fast' ? '50% 0px 50% 0px' : 
                    connectionQuality === 'medium' ? '30% 0px 30% 0px' : 
                    '10% 0px 10% 0px',
      }
    );

    allMedia.forEach((media) => {
      const mediaElement = containerRef.current?.querySelector(`[data-media-id="${media.id}"]`);
      if (mediaElement) {
        observer.observe(mediaElement);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [allMedia, loadedVideos, loadedImages, connectionQuality, preloadCount]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsScrolling(true);
        
        const nextIndex = e.key === 'ArrowDown' 
          ? Math.min(currentIndex + 1, allMedia.length - 1)
          : Math.max(currentIndex - 1, 0);
        
        const nextMedia = allMedia[nextIndex];
        if (nextMedia) {
          if (nextMedia.media_type === 'video') {
            const nextVideoElement = videoRefs.current.get(nextMedia.id);
            if (nextVideoElement && !nextVideoElement.src && !loadedVideos.has(nextMedia.id)) {
              nextVideoElement.preload = connectionQuality === 'fast' ? 'auto' : 'metadata';
              nextVideoElement.src = nextMedia.media_url;
              setLoadedVideos(prev => new Set(prev).add(nextMedia.id));
            }
          } else {
            // Also preload images on keyboard navigation
            const nextImageElement = imageRefs.current.get(nextMedia.id);
            if (nextImageElement && !nextImageElement.src && !loadedImages.has(nextMedia.id)) {
              nextImageElement.src = nextMedia.media_url;
              setLoadedImages(prev => new Set(prev).add(nextMedia.id));
            }
          }
        }
        
        const mediaElement = containerRef.current?.children[nextIndex] as HTMLElement;
        if (mediaElement) {
          mediaElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setCurrentIndex(nextIndex);
        }
        
        setTimeout(() => setIsScrolling(false), 500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, allMedia, loadedVideos, loadedImages, connectionQuality]);

  if (allMedia.length === 0) {
    return (
      <div className="h-[calc(100vh-4rem)] w-full flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <Calendar className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-zinc-400">No Event Media Yet</h3>
          <p className="text-zinc-600 mt-2">Add pictures and videos to events to see them here.</p>
        </div>
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
      
      {allMedia.map((media, index) => (
        <div
          key={media.id}
          data-media-id={media.id}
          className="h-[calc(100vh-4rem)] w-full snap-start snap-always relative bg-black flex items-center justify-center"
        >
          {media.media_type === 'video' ? (
            <video
              ref={(el) => {
                if (el) {
                  videoRefs.current.set(media.id, el);
                } else {
                  videoRefs.current.delete(media.id);
                }
              }}
              loop
              muted={isMuted}
              playsInline
              preload="none"
              data-media-id={media.id}
              className="w-full h-full object-contain"
              onLoadedData={(e) => {
                const videoEl = e.currentTarget;
                if (videoEl.readyState >= 3) {
                  videoEl.pause();
                }
              }}
              onCanPlay={(e) => {
                const videoEl = e.currentTarget;
                if (videoEl.currentTime > 0.1) {
                  videoEl.currentTime = 0;
                }
              }}
              onError={(e) => {
                console.warn(`Video ${media.id} failed to load:`, e);
                const videoEl = e.currentTarget;
                setTimeout(() => {
                  if (!videoEl.src || videoEl.error) {
                    const mediaData = allMedia.find(m => m.id === media.id);
                    if (mediaData) {
                      videoEl.load();
                    }
                  }
                }, 2000);
              }}
              onClick={(e) => {
                const videoEl = e.currentTarget;
                if (!videoEl.src) {
                  const mediaData = allMedia.find(m => m.id === media.id);
                  if (mediaData) {
                    videoEl.preload = 'auto';
                    videoEl.src = mediaData.media_url;
                    setLoadedVideos(prev => new Set(prev).add(media.id));
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
          ) : (
            <img
              ref={(el) => {
                if (el) {
                  imageRefs.current.set(media.id, el);
                } else {
                  imageRefs.current.delete(media.id);
                }
              }}
              src={loadedImages.has(media.id) ? media.media_url : undefined}
              alt={media.title || 'Event image'}
              className="w-full h-full object-contain"
              loading={index < 3 ? "eager" : "lazy"}
              onLoad={() => {
                setLoadedImages(prev => new Set(prev).add(media.id));
              }}
              onError={(e) => {
                console.warn(`Image ${media.id} failed to load:`, e);
                // Retry loading
                const img = e.currentTarget;
                setTimeout(() => {
                  if (!img.src) {
                    img.src = media.media_url;
                  }
                }, 2000);
              }}
            />
          )}

          {/* Overlay with metadata */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 md:p-6 lg:p-8 pointer-events-none">
            <div className="max-w-2xl mx-auto pointer-events-auto relative">
              {/* Volume Control (only for videos) */}
              {media.media_type === 'video' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  className="absolute right-0 top-0 p-3 rounded-full bg-black/20 backdrop-blur-md hover:bg-black/40 transition-colors text-white/90 hover:text-white"
                >
                  {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </button>
              )}

              {/* Media Type and Event Title */}
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2 md:mb-3 tracking-tight drop-shadow-lg">
                {media.media_type === 'image' ? 'Image' : 'Video'} from {media.eventTitle}
              </h2>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-zinc-200 mb-3 md:mb-4">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                  {new Date(media.eventDate).toLocaleDateString()}
                </span>
                {media.eventDescription && (
                  <>
                    <span className="w-1 h-1 bg-zinc-500 rounded-full" />
                    <span className="flex items-center gap-1.5">
                      <Info className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="line-clamp-1">{media.eventDescription}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Uploader name */}
              {media.uploaded_by && (
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/10">
                  <div className="flex items-start gap-2 text-zinc-100">
                    <MessageSquare className="w-4 h-4 md:w-5 md:h-5 mt-0.5 text-purple-400 shrink-0" />
                    <p className="text-xs md:text-sm lg:text-base leading-relaxed line-clamp-2 md:line-clamp-3 drop-shadow-md">
                      From {media.uploaded_by}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scroll indicator */}
          {index < allMedia.length - 1 && (
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