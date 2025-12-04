import React, { useRef, useState } from 'react';
import { Upload, Loader2, Video } from 'lucide-react';

interface UploadButtonProps {
  onUpload: (file: File) => Promise<void>;
  isProcessing: boolean;
}

export const UploadButton: React.FC<UploadButtonProps> = ({ onUpload, isProcessing }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await onUpload(e.target.files[0]);
      // Reset input
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/')) {
            await onUpload(file);
        }
    }
  };

  return (
    <div 
        className={`
            relative group rounded-2xl border-2 border-dashed transition-all duration-300
            ${dragActive ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'}
            ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        disabled={isProcessing}
      />
      
      <div className="p-6 md:p-8 flex flex-col items-center justify-center text-center">
        {isProcessing ? (
           <div className="flex flex-col items-center gap-3">
             <div className="relative">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
             </div>
             <p className="text-sm font-medium text-zinc-300">Uploading video...</p>
             <p className="text-xs text-zinc-500">Transcription will happen in the background</p>
           </div>
        ) : (
            <>
                <div className={`p-4 rounded-full mb-3 transition-colors ${dragActive ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200'}`}>
                    <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-200">Upload Memory</h3>
                <p className="text-sm text-zinc-500 mt-1 max-w-xs">
                    <span className="hidden md:inline">Drag and drop or click to upload.</span>
                    <span className="md:hidden">Tap to upload a video.</span>
                    <span className="block text-zinc-600 text-xs mt-2 flex items-center justify-center gap-1">
                        <Video className="w-3 h-3" /> Supports MP4, MOV, WebM
                    </span>
                </p>
            </>
        )}
      </div>
    </div>
  );
};