import React, { useState } from 'react';
import { UploadButton } from './components/UploadButton';
import { Timeline } from './components/Timeline';
import { VideoPlayer } from './components/VideoPlayer';
import { VideoEntry } from './types';
import { extractFrameFromVideo } from './utils/videoHelpers';
import { Heart } from 'lucide-react';

const App: React.FC = () => {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoEntry | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      const id = crypto.randomUUID();
      const url = URL.createObjectURL(file);
      
      // 1. Extract a frame for the thumbnail (local only)
      const frameDataUrl = await extractFrameFromVideo(file, 1.0); // snapshot at 1s
      
      const newVideo: VideoEntry = {
        id,
        url,
        thumbnail: frameDataUrl,
        title: file.name.replace(/\.[^/.]+$/, ""), // Use filename without extension
        description: "", // No description since we aren't using AI
        timestamp: Date.now(),
        durationString: "00:00" // Placeholder
      };

      setVideos((prev) => [newVideo, ...prev]);
      // Automatically select the new video to play it immediately (optional, but standard UX)
      // If strictly "only show when selected", uploading counts as a user intent to view usually.
      setSelectedVideo(newVideo);
      
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to process video. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f10] text-zinc-100 flex flex-col font-sans selection:bg-rose-500/30">
      
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
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:py-8 flex flex-col gap-6 md:gap-12">
        
        {/* Mobile: Flex Col (Player -> Timeline -> Upload) 
            Desktop: Grid (Row 1: Player | Upload, Row 2: Timeline)
        */}
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
                        <UploadButton onUpload={handleUpload} isProcessing={isProcessing} />
                    </div>
                </div>
            </div>

            {/* Timeline Section */}
            <div className="order-2 lg:order-3 lg:col-span-3 w-full">
                 <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-lg md:text-xl font-semibold text-white">Timeline</h2>
                    <span className="text-xs md:text-sm text-zinc-500">{videos.length} memories</span>
                 </div>
                 <Timeline 
                    videos={videos} 
                    selectedVideoId={selectedVideo?.id || null} 
                    onSelectVideo={setSelectedVideo}
                 />
            </div>
        </div>

      </main>
    </div>
  );
};

export default App;