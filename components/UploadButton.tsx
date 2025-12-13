import React, { useRef, useState } from 'react';
import { Upload, Loader2, Video, FileText, Image as ImageIcon } from 'lucide-react';

interface UploadButtonProps {
  onUpload: (file: File) => Promise<void> | void;
  onClick?: () => void;
  isProcessing: boolean;
  type?: 'video' | 'article' | 'image';
  multiple?: boolean;
}

export const UploadButton: React.FC<UploadButtonProps> = ({ onUpload, onClick, isProcessing, type = 'video', multiple = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const getAcceptType = () => {
    switch (type) {
      case 'image': return 'image/*';
      case 'article': return '.pdf,.doc,.docx,.txt';
      default: return 'video/*';
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'image': return 'Upload Image';
      case 'article': return 'Add Article Link';
      default: return 'Upload Memory';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'image': return <ImageIcon className="w-3 h-3" />;
      case 'article': return <FileText className="w-3 h-3" />;
      default: return <Video className="w-3 h-3" />;
    }
  };

  const getFormatText = () => {
    switch (type) {
      case 'image': return 'Supports JPG, PNG, WebP';
      case 'article': return 'Paste a link to an article';
      default: return 'Supports MP4, MOV, WebM';
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      for (const file of files) {
        await onUpload(file);
      }
      // Reset input
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    if (type === 'article') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (type === 'article') return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        
        // Filter valid files
        const validFiles = files.filter(file => {
            if (type === 'video' && file.type.startsWith('video/')) return true;
            if (type === 'image' && file.type.startsWith('image/')) return true;
            return false;
        });
        
        // Upload all valid files
        for (const file of validFiles) {
            await onUpload(file);
        }
    }
  };

  const handleClick = () => {
      if (type === 'article' && onClick) {
          onClick();
      }
      // For other types, the input label/absolute input handles the click, but we can also trigger it programmatically if we wanted to be safer,
      // but the current CSS "absolute inset-0" input method works well.
  };

  return (
    <div 
        className={`
            relative group rounded-2xl border-2 border-dashed transition-all duration-300
            ${dragActive ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'}
            ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
            ${type === 'article' ? 'cursor-pointer hover:bg-zinc-800' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
    >
      {type !== 'article' && (
        <input
            ref={inputRef}
            type="file"
            accept={getAcceptType()}
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={isProcessing}
            multiple={multiple}
        />
      )}
      
      <div className="p-6 md:p-8 flex flex-col items-center justify-center text-center">
        {isProcessing ? (
           <div className="flex flex-col items-center gap-3">
             <div className="relative">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
             </div>
             <p className="text-sm font-medium text-zinc-300">Uploading...</p>
             <p className="text-xs text-zinc-500 max-w-[200px]">
               Please don't close this page.
             </p>
           </div>
        ) : (
            <>
                <div className={`p-4 rounded-full mb-3 transition-colors ${dragActive ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200'}`}>
                    <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-200">{getLabel()}</h3>
                <p className="text-sm text-zinc-500 mt-1 max-w-xs">
                    {type === 'article' ? (
                         <span>Click to add a link.</span>
                    ) : (
                        <>
                            <span className="hidden md:inline">
                                {multiple ? 'Drag and drop or click to upload multiple files.' : 'Drag and drop or click to upload.'}
                            </span>
                            <span className="md:hidden">
                                {multiple ? 'Tap to upload multiple files.' : 'Tap to upload.'}
                            </span>
                        </>
                    )}
                    <span className="block text-zinc-600 text-xs mt-2 flex items-center justify-center gap-1">
                        {getIcon()} {getFormatText()}
                        {multiple && type !== 'article' && <span className="ml-1 text-purple-400">(Multiple)</span>}
                    </span>
                </p>
            </>
        )}
      </div>
    </div>
  );
};