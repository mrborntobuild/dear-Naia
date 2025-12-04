import React from 'react';
import { VideoEntry } from '../types';
import { Play, Clock, Heart } from 'lucide-react';
import { formatDuration } from '../utils/videoHelpers';

interface MessagesProps {
  videos: VideoEntry[];
  selectedVideoId: string | null;
  onSelectVideo: (video: VideoEntry) => void;
}

export const Messages: React.FC<MessagesProps> = ({ videos, selectedVideoId, onSelectVideo }) => {
  if (videos.length === 0) {
    return (
      <div className="h-48 w-full border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-600 bg-zinc-900/30">
        <p>No messages yet</p>
        <p className="text-sm mt-2">Be the first to add a memory</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
      <div className="flex gap-4 min-w-full pb-2">
        {videos.map((video) => (
          <div 
            key={video.id}
            onClick={() => onSelectVideo(video)}
            className={`
              flex-none w-64 group cursor-pointer relative rounded-xl overflow-hidden transition-all duration-300
              ${selectedVideoId === video.id 
                ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-[#0f0f10] scale-[1.02] shadow-lg shadow-rose-500/20' 
                : 'hover:scale-[1.02] hover:shadow-xl hover:shadow-black/50 border border-white/5'
              }
            `}
          >
            {/* Thumbnail Container */}
            <div className="aspect-video bg-zinc-900 relative">
              {video.thumbnail ? (
                <img 
                  src={video.thumbnail} 
                  alt={video.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    // If image fails to load, hide it so the fallback shows
                    e.currentTarget.style.display = 'none';
                    // Show the fallback container
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const fallback = document.createElement('div');
                      fallback.className = "w-full h-full flex items-center justify-center bg-zinc-800 absolute inset-0";
                      // Render heart icon html
                      fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#a855f7" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart w-8 h-8 text-purple-500 fill-current"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
                      parent.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                  <Heart className="w-8 h-8 text-purple-500 fill-current" />
                </div>
              )}
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
              
              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
                <div className="w-10 h-10 rounded-full bg-rose-500/90 flex items-center justify-center backdrop-blur-sm shadow-lg">
                  <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                </div>
              </div>

              {/* Duration Badge */}
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-medium text-white flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {video.durationString || "0:00"}
              </div>
            </div>

            {/* Info Section */}
            <div className="p-3 bg-zinc-900/80 backdrop-blur-sm border-t border-white/5">
              <h3 className="font-medium text-zinc-100 truncate pr-2 group-hover:text-rose-400 transition-colors">
                {video.title}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2 h-8 leading-4">
                {video.transcription || video.description || "No description available"}
              </p>
              <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
                <span>{new Date(video.timestamp).toLocaleDateString()}</span>
                <Heart className="w-3 h-3 hover:text-rose-500 transition-colors cursor-pointer" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
