import React, { useState, useEffect } from 'react';
import { BookOpen, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { ArticleEntry } from '../types';

interface ArticleCardProps {
  article: ArticleEntry;
  onPreview?: (article: ArticleEntry) => void; // Optional, kept for compatibility
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onPreview }) => {
  const [imageError, setImageError] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  
  useEffect(() => {
    // Fetch metadata (publisher, logo, better image) from Microlink
    fetch(`https://api.microlink.io/?url=${encodeURIComponent(article.link)}`)
      .then(res => res.json())
      .then(json => {
          if (json.status === 'success') {
              setMetadata(json.data);
          }
      })
      .catch(err => console.error('Error fetching metadata', err));
  }, [article.link]);

  // Use metadata image if available (it's usually the best OG image), fallback to screenshot
  const displayImage = metadata?.image?.url || `https://api.microlink.io/?url=${encodeURIComponent(article.link)}&screenshot=true&meta=false&embed=screenshot.url`;
  const publisher = metadata?.publisher;
  const logo = metadata?.logo?.url;

  return (
    <div className="group relative bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 rounded-xl overflow-hidden transition-all hover:bg-zinc-800/40 flex flex-col h-full">
        {/* Preview Image Section */}
        <div className="aspect-[1.91/1] w-full bg-zinc-900/50 relative overflow-hidden border-b border-zinc-800/50">
            {!imageError ? (
                <img 
                    src={displayImage}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={() => setImageError(true)}
                    loading="lazy"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                    <ImageIcon className="w-12 h-12 opacity-20" />
                </div>
            )}
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                <a 
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"
                    title="Open Article"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ExternalLink className="w-5 h-5" />
                </a>
            </div>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {logo ? (
                        <img src={logo} alt={publisher} className="w-5 h-5 rounded-full object-contain bg-white/10" />
                    ) : (
                        <div className="p-1.5 bg-purple-500/10 rounded-md text-purple-400">
                            <BookOpen className="w-3 h-3" />
                        </div>
                    )}
                    {publisher && (
                        <span className="text-xs font-medium text-zinc-400 truncate max-w-[120px]">
                            {publisher}
                        </span>
                    )}
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                    {new Date(article.timestamp).toLocaleDateString()}
                </span>
            </div>
            
            <h3 className="text-lg font-semibold text-zinc-200 mb-2 group-hover:text-white line-clamp-2 leading-tight">
                {article.title}
            </h3>
            
            <p className="text-sm text-zinc-400 line-clamp-3 mb-4 flex-1">
                {article.description}
            </p>
            
            <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700/50 hover:border-zinc-600 text-center"
            >
                Read Article
            </a>
            
            {article.posted_by && (
                <p className="mt-3 text-xs text-zinc-500 text-center">
                    (posted by {article.posted_by})
                </p>
            )}
        </div>
    </div>
  );
};
