import React, { useRef, useEffect, useState } from 'react';
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

  // Handle scroll to determine which video is in view
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
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [videos, isScrolling]);

  // Auto-play/pause videos based on visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoId = entry.target.getAttribute('data-video-id');
          if (!videoId) return;
          
          const video = videoRefs.current.get(videoId);
          if (!video) return;

          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            video.play().catch((err) => {
              console.log('Auto-play prevented:', err);
            });
          } else {
            video.pause();
          }
        });
      },
      {
        threshold: [0, 0.5, 1],
        rootMargin: '-10% 0px -10% 0px', // Only consider videos that are mostly visible
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
  }, [videos]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsScrolling(true);
        
        const nextIndex = e.key === 'ArrowDown' 
          ? Math.min(currentIndex + 1, videos.length - 1)
          : Math.max(currentIndex - 1, 0);
        
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
  }, [currentIndex, videos.length]);

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
          {/* Video */}
          <video
            ref={(el) => {
              if (el) {
                videoRefs.current.set(video.id, el);
              } else {
                videoRefs.current.delete(video.id);
              }
            }}
            src={video.url}
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover"
            onClick={(e) => {
              const video = e.currentTarget;
              if (video.paused) {
                video.play();
              } else {
                video.pause();
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

