import React, { useState } from 'react';
import { X } from 'lucide-react';

interface UploadInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (personName: string, whoInVideo: string) => void;
  fileName: string;
}

export const UploadInfoModal: React.FC<UploadInfoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  fileName,
}) => {
  const [personName, setPersonName] = useState('');
  const [whoInVideo, setWhoInVideo] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (personName.trim() && whoInVideo.trim()) {
      onSubmit(personName.trim(), whoInVideo.trim());
      setPersonName('');
      setWhoInVideo('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 p-6 md:p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-zinc-100">Tell us about this video</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="personName" className="block text-sm font-medium text-zinc-300 mb-2">
              What's your name? *
            </label>
            <input
              id="personName"
              type="text"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              required
              autoFocus
            />
            <p className="mt-1 text-xs text-zinc-500">
              This video will be titled "{personName || 'Your Name'}'s Message"
            </p>
          </div>

          <div>
            <label htmlFor="whoInVideo" className="block text-sm font-medium text-zinc-300 mb-2">
              Who's in this video? *
            </label>
            <input
              id="whoInVideo"
              type="text"
              value={whoInVideo}
              onChange={(e) => setWhoInVideo(e.target.value)}
              placeholder="e.g., Just me, Me and my family, Naia and I..."
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              required
            />
            <p className="mt-1 text-xs text-zinc-500">
              Let us know who appears in this video
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!personName.trim() || !whoInVideo.trim()}
              className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              Upload Video
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


