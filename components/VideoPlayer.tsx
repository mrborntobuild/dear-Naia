import React from 'react';
import { VideoEntry } from '../types';
import { Play, Calendar, Info } from 'lucide-react';

interface VideoPlayerProps {
  video: VideoEntry | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video }) => {
  if (!video) {
    return (
      <div className="w-full aspect-video bg-zinc-900/50 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-zinc-500 shadow-2xl backdrop-blur-sm">
        <div className="bg-zinc-800 p-4 rounded-full mb-4 opacity-50">
           <Play className="w-10 h-10 md:w-12 md:h-12 text-zinc-400 fill-current" />
        </div>
        <p className="text-base md:text-lg font-medium text-center px-4">Select a memory or upload one to begin</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4 md:gap-6 animate-in fade-in duration-500">
      {/* Main Player */}
      <div className="relative w-full aspect-video bg-black rounded-xl md:rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 group">
        <video
          key={video.id} // Force re-render on video change
          src={video.url}
          controls
          autoPlay
          className="w-full h-full object-contain"
        />
      </div>

      {/* Meta Info */}
      <div className="bg-zinc-900/40 border border-white/5 p-4 md:p-6 rounded-xl md:rounded-2xl backdrop-blur-md">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">{video.title}</h1>
        <div className="flex items-center gap-4 text-xs md:text-sm text-zinc-400 mb-4">
            <span className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                {new Date(video.timestamp).toLocaleDateString()}
            </span>
            <span className="w-1 h-1 bg-zinc-600 rounded-full" />
            <span>{video.durationString}</span>
        </div>
        <div className="flex items-start gap-2 text-zinc-300 leading-relaxed text-sm md:text-base">
            <Info className="w-4 h-4 md:w-5 md:h-5 mt-0.5 text-rose-400 shrink-0" />
            <p>{video.description}</p>
        </div>
      </div>
    </div>
  );
};