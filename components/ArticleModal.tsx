import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';

interface ArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  link: string;
  title: string;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({ isOpen, onClose, link, title }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setHasError(false);
    }
  }, [isOpen, link]);

  // Handle iframe load timeout
  useEffect(() => {
    if (isOpen && isLoading) {
      const timeout = setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          // Don't set error immediately - let iframe try to load
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isOpen, isLoading]);

  if (!isOpen) return null;

  const handleIframeLoad = () => {
    setIsLoading(false);
    
    // Check if iframe actually loaded content
    // Note: CSP violations won't trigger onError, so we check after load
    setTimeout(() => {
      if (iframeRef.current) {
        try {
          // Try to detect if content is blocked
          // Most sites will block access due to same-origin policy anyway
          // So we just hide loading and let user see if content appears
        } catch (e) {
          // Expected for cross-origin - not necessarily an error
        }
      }
    }, 1000);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-6">
      <div className="bg-zinc-900 w-full h-full max-w-6xl rounded-2xl border border-zinc-800 flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900 shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <h3 className="text-zinc-200 font-medium truncate">{title}</h3>
                <span className="hidden md:inline text-xs text-zinc-500 px-2 py-1 bg-zinc-800/50 rounded">
                    Some sites may not embed
                </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <a 
                    href={link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm flex items-center gap-2 font-medium"
                >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden md:inline">Open in Browser</span>
                    <span className="md:hidden">Open</span>
                </a>
                <button 
                    onClick={onClose}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative bg-white overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                        <p className="text-zinc-500 text-sm">Loading article...</p>
                    </div>
                </div>
            )}
            
            {hasError ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-0">
                    <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
                        <AlertCircle className="w-12 h-12 text-zinc-600" />
                        <h4 className="text-zinc-300 font-medium text-lg">Unable to embed this site</h4>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            This website uses Content Security Policy (CSP) to prevent being displayed in embedded frames. This is a security feature that protects the site.
                        </p>
                        <a 
                            href={link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors font-medium text-sm flex items-center gap-2"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Open in New Tab
                        </a>
                    </div>
                </div>
            ) : (
                <iframe
                    ref={iframeRef}
                    key={link} // Force re-render when link changes
                    src={link}
                    className="w-full h-full border-0"
                    onLoad={handleIframeLoad}
                    onError={handleIframeError}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation-by-user-activation"
                    title={title}
                />
            )}
        </div>
      </div>
    </div>
  );
};
