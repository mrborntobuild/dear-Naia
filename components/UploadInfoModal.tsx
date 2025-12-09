import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

interface UploadInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (personName: string, description: string, link?: string, articleTitle?: string) => void;
  fileName: string;
  type?: 'video' | 'article' | 'image';
}

export const UploadInfoModal: React.FC<UploadInfoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  fileName,
  type = 'video'
}) => {
  const [personName, setPersonName] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPersonName('');
      setDescription('');
      setLink('');
      setArticleTitle('');
      setIsFetchingMetadata(false);
    }
  }, [isOpen]);

  // Fetch metadata when link changes (for articles)
  useEffect(() => {
    if (type === 'article' && link.trim()) {
      const urlPattern = /^https?:\/\/.+/;
      if (urlPattern.test(link.trim())) {
        // Debounce the API call
        const timeoutId = setTimeout(() => {
          setIsFetchingMetadata(true);
          fetch(`https://api.microlink.io/?url=${encodeURIComponent(link.trim())}`)
            .then(res => res.json())
            .then(json => {
              if (json.status === 'success' && json.data) {
                // Auto-populate title from metadata
                const metaTitle = json.data.title || '';
                if (metaTitle) {
                  setArticleTitle(metaTitle);
                }
                
                // Auto-populate description from metadata (subtitle or description)
                const metaDescription = json.data.description || json.data.subtitle || '';
                if (metaDescription) {
                  setDescription(metaDescription);
                }
              }
            })
            .catch(err => {
              console.error('Error fetching metadata:', err);
            })
            .finally(() => {
              setIsFetchingMetadata(false);
            });
        }, 500); // Wait 500ms after user stops typing

        return () => clearTimeout(timeoutId);
      }
    }
  }, [link, type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (personName.trim()) {
      // Validate based on type
      if (type === 'video' && !description.trim()) return;
      if (type === 'article' && !link.trim()) return;
      
      // For articles, use description from metadata or allow empty
      const finalDescription = type === 'article' 
        ? (description.trim() || 'Article link') 
        : description.trim();
      
      // For articles, pass the article title if available
      onSubmit(personName.trim(), finalDescription, link.trim(), articleTitle.trim() || undefined);
      setPersonName('');
      setDescription('');
      setLink('');
      setArticleTitle('');
    }
  };

  const getTitle = () => {
    switch(type) {
      case 'image': return 'Tell us about this image';
      case 'article': return 'Tell us about this article';
      default: return 'Tell us about this video';
    }
  };

  const getDescriptionLabel = () => {
    switch(type) {
        case 'image': return "Add a description";
        case 'article': return "What's this article about? *";
        default: return "Who's in this video? *";
    }
  };

  const getDescriptionPlaceholder = () => {
    switch(type) {
        case 'image': return "e.g., Family vacation, Birthday party...";
        case 'article': return "e.g., A letter to Naia, A poem...";
        default: return "e.g., Just me, Me and my family, Naia and I...";
    }
  };

  const getSubmitLabel = () => {
      switch(type) {
          case 'image': return 'Upload Image';
          case 'article': return 'Upload Article';
          default: return 'Upload Video';
      }
  };

  const getTipText = () => {
      if (type === 'video') {
          return "If your video is large (over 50MB), the upload might take a few minutes. Please keep this window open until it finishes.";
      }
      return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 p-6 md:p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-zinc-100">{getTitle()}</h2>
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
              {type === 'article' 
                ? 'Your name will be associated with this article'
                : `This ${type} will be titled "${personName || 'Your Name'}'s Message"`
              }
            </p>
          </div>

          {type !== 'article' && (
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-2">
                {getDescriptionLabel()}
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={getDescriptionPlaceholder()}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                required={type === 'video'}
              />
              <p className="mt-1 text-xs text-zinc-500">
                 {type === 'video' ? 'Let us know who appears in this video' : 'Add a short description'}
              </p>
            </div>
          )}

          {type === 'article' && (
            <div>
              <label htmlFor="link" className="block text-sm font-medium text-zinc-300 mb-2">
                Article Link *
              </label>
              <div className="relative">
                <input
                  id="link"
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 pr-10"
                  required
                />
                {isFetchingMetadata && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                We'll automatically fetch the article details
              </p>
            </div>
          )}

          {type === 'article' && (
            <div>
              <label htmlFor="articleTitle" className="block text-sm font-medium text-zinc-300 mb-2">
                Article Title
                <span className="text-zinc-500 font-normal ml-1">(auto-filled from link)</span>
              </label>
              <input
                id="articleTitle"
                type="text"
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="Fetching title..."
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              <p className="mt-1 text-xs text-zinc-500">
                The article's title from the link
              </p>
            </div>
          )}

          {type === 'article' && (
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-2">
                Description / Subtitle
                <span className="text-zinc-500 font-normal ml-1">(auto-filled from link)</span>
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Fetching description..."
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Article description or subtitle - you can edit this if needed
              </p>
            </div>
          )}

          {getTipText() && (
            <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50">
                <h4 className="text-xs font-medium text-zinc-300 mb-1">💡 Tips for large uploads</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                {getTipText()}
                </p>
            </div>
          )}

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
              disabled={!personName.trim() || (type === 'video' && !description.trim()) || (type === 'article' && !link.trim()) || isFetchingMetadata}
              className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              {isFetchingMetadata ? 'Fetching...' : getSubmitLabel()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


