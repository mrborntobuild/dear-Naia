import React, { useRef, useEffect } from 'react';
import { VideoEntry } from '../types';
import { PlayCircle, Clock } from 'lucide-react';

interface TimelineProps {
  videos: VideoEntry[];
  selectedVideoId: string | null;
  onSelectVideo: (video: VideoEntry) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ videos, selectedVideoId, onSelectVideo }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to end when new video added
  useEffect(() => {
    if (scrollContainerRef.current) {
        // Smooth scroll to left (start) because we prepend new videos usually, 
        // but if we append, we'd scrollWidth. 
        // Let's assume chronological order: newest first (left) or last (right).
        // For a timeline, usually newest is at the end or beginning. 
        // Let's stick to simple list behavior.
    }
  }, [videos.length]);

  if (videos.length === 0) {
    return (
        <div className="h-48 w-full border-2 border-dashed border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600">
            <p>Timeline is empty</p>
        </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0f0f10] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0f0f10] to-transparent z-10 pointer-events-none" />
      
      <div 
        ref={scrollContainerRef}
        className="timeline-scroll flex overflow-x-auto gap-4 py-4 px-4 snap-x snap-mandatory scroll-smooth"
      >
        {videos.map((video) => {
            const isSelected = video.id === selectedVideoId;
            return (
                <div
                    key={video.id}
                    onClick={() => onSelectVideo(video)}
                    className={`
                        snap-start shrink-0 w-64 cursor-pointer group relative rounded-xl overflow-hidden transition-all duration-300
                        ${isSelected ? 'ring-2 ring-indigo-500 scale-105 shadow-lg shadow-indigo-500/20' : 'opacity-70 hover:opacity-100 hover:scale-[1.02]'}
                    `}
                >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-zinc-800 w-full relative">
                        <img 
                            src={video.thumbnail} 
                            alt={video.title} 
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                        
                        {/* Play Overlay */}
                        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full">
                                <PlayCircle className="w-8 h-8 text-white" />
                            </div>
                        </div>

                        {/* Duration Badge */}
                        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white font-medium flex items-center gap-1">
                             <Clock className="w-3 h-3" />
                             {video.durationString}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="bg-zinc-900 p-3 border-t border-white/5 h-full">
                        <h3 className="text-sm font-semibold text-zinc-100 truncate mb-1" title={video.title}>
                            {video.title}
                        </h3>
                        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                            {video.description}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-2 font-mono uppercase tracking-wider">
                            {new Date(video.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                    </div>
                    
                    {/* Connection Line (Visual styling for timeline) */}
                    <div className="absolute top-1/2 -left-4 w-4 h-[2px] bg-zinc-800 -z-10" />
                    <div className="absolute top-1/2 -right-4 w-4 h-[2px] bg-zinc-800 -z-10" />
                </div>
            );
        })}
      </div>
    </div>
  );
};
