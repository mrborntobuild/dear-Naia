import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Image as ImageIcon, Video, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { EventEntry, EventMediaEntry } from '../types';
import { 
  insertEventMedia, 
  uploadEventMediaToStorage,
  deleteEventMedia,
  updateEvent
} from '../services/supabaseService';
import { PLACEHOLDER_THUMBNAIL } from '../utils/constants';

interface AddEventMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventEntry;
  onMediaAdded: () => void;
}

export const AddEventMediaModal: React.FC<AddEventMediaModalProps> = ({
  isOpen,
  onClose,
  event,
  onMediaAdded
}) => {
  const [mediaFiles, setMediaFiles] = useState<Array<{ file: File; type: 'video' | 'image'; preview?: string }>>([]);
  const [existingMedia, setExistingMedia] = useState<EventMediaEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploaderName, setUploaderName] = useState('Henry Moses');
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // Load existing media when modal opens
  useEffect(() => {
    if (isOpen && event) {
      setExistingMedia(event.media || []);
      setMediaFiles([]);
      setUploadProgress({});
      setUploaderName('Henry Moses'); // Default name
      setCurrentMediaIndex(0); // Reset carousel to first item
      isScrollingRef.current = false;
      
      // Scroll to first item after a brief delay to ensure DOM is ready
      setTimeout(() => {
        if (carouselRef.current && event.media && event.media.length > 0) {
          carouselRef.current.scrollTo({ left: 0, behavior: 'auto' });
        }
      }, 100);
    }
  }, [isOpen, event]);

  // Scroll carousel to current index
  useEffect(() => {
    if (carouselRef.current && existingMedia.length > 0 && !isScrollingRef.current) {
      isScrollingRef.current = true;
      const container = carouselRef.current;
      const item = container.children[currentMediaIndex] as HTMLElement;
      if (item) {
        const containerRect = container.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        const scrollLeft = container.scrollLeft + (itemRect.left - containerRect.left) - (containerRect.width / 2) + (itemRect.width / 2);
        
        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
        
        // Reset flag after scroll completes
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 500);
      } else {
        isScrollingRef.current = false;
      }
    }
  }, [currentMediaIndex, existingMedia.length]);

  const scrollToMedia = (index: number) => {
    if (index >= 0 && index < existingMedia.length) {
      isScrollingRef.current = true;
      setCurrentMediaIndex(index);
    }
  };

  const scrollPrevious = () => {
    if (currentMediaIndex > 0) {
      scrollToMedia(currentMediaIndex - 1);
    }
  };

  const scrollNext = () => {
    if (currentMediaIndex < existingMedia.length - 1) {
      scrollToMedia(currentMediaIndex + 1);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image') => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const preview = type === 'image' ? URL.createObjectURL(file) : undefined;
      setMediaFiles(prev => [...prev, { file, type, preview }]);
    });
    e.target.value = ''; // Reset input
  };

  const removeMediaFile = (index: number) => {
    const item = mediaFiles[index];
    if (item.preview) {
      URL.revokeObjectURL(item.preview);
    }
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingMedia = async (mediaId: string) => {
    const success = await deleteEventMedia(mediaId);
    if (success) {
      setExistingMedia(prev => prev.filter(m => m.id !== mediaId));
      onMediaAdded(); // Refresh the event list
    }
  };

  const handleUpload = async () => {
    if (mediaFiles.length === 0) {
      onClose();
      return;
    }

    setIsUploading(true);

    try {
      // Upload new media files
      for (let i = 0; i < mediaFiles.length; i++) {
        const mediaItem = mediaFiles[i];
        const mediaId = crypto.randomUUID();
        const progressKey = `${i}-${mediaItem.file.name}`;
        
        setUploadProgress(prev => ({ ...prev, [progressKey]: 0 }));

        try {
          // Upload the file
          const mediaUrl = await uploadEventMediaToStorage(
            mediaItem.file,
            event.id,
            mediaId,
            mediaItem.type
          );

          if (!mediaUrl) {
            throw new Error(`Failed to upload ${mediaItem.type}`);
          }

          // For videos, use placeholder thumbnail
          let thumbnailUrl: string | undefined;
          if (mediaItem.type === 'video') {
            thumbnailUrl = PLACEHOLDER_THUMBNAIL;
          }

          // Save media entry to database
          const savedMedia = await insertEventMedia({
            event_id: event.id,
            media_type: mediaItem.type,
            media_url: mediaUrl,
            thumbnail: thumbnailUrl,
            title: mediaItem.file.name,
            uploaded_by: uploaderName.trim() || 'Henry Moses',
          });

          if (savedMedia) {
            setExistingMedia(prev => [...prev, savedMedia]);
          }

          setUploadProgress(prev => {
            const next = { ...prev };
            delete next[progressKey];
            return next;
          });
        } catch (error) {
          console.error(`Error uploading ${mediaItem.type}:`, error);
          setUploadProgress(prev => {
            const next = { ...prev };
            delete next[progressKey];
            return next;
          });
        }
      }

      // Clean up preview URLs
      mediaFiles.forEach(item => {
        if (item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      });

      // Reset and close
      setMediaFiles([]);
      setUploaderName('Henry Moses');
      setUploadProgress({});
      
      // Close modal first
      onClose();
      
      // Then refresh the event list with a small delay
      setTimeout(() => {
        onMediaAdded();
      }, 100);
    } catch (error) {
      console.error('Error uploading media:', error);
      alert('Failed to upload some media. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto p-2 sm:p-4">
      <div className="bg-zinc-900 rounded-xl sm:rounded-2xl border border-zinc-700 p-4 sm:p-6 md:p-8 max-w-3xl w-full mx-auto my-4 sm:my-8 shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-zinc-100 truncate">
              Add Media to {event.title}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Upload pictures and videos for this event
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 shrink-0"
            disabled={isUploading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Media Carousel */}
        {existingMedia.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <label className="block text-sm font-medium text-zinc-300">
                Current Media ({existingMedia.length})
              </label>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span>{currentMediaIndex + 1}</span>
                <span>/</span>
                <span>{existingMedia.length}</span>
              </div>
            </div>
            
            {/* Carousel Container */}
            <div className="relative">
              {/* Navigation Buttons */}
              {existingMedia.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={scrollPrevious}
                    disabled={currentMediaIndex === 0 || isUploading}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="Previous media"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={scrollNext}
                    disabled={currentMediaIndex === existingMedia.length - 1 || isUploading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="Next media"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Carousel */}
              <div
                ref={carouselRef}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 scrollbar-hide"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
                onScroll={(e) => {
                  // Don't update if we're programmatically scrolling
                  if (isScrollingRef.current) return;
                  
                  const container = e.currentTarget;
                  const scrollLeft = container.scrollLeft;
                  const containerWidth = container.clientWidth;
                  
                  // Find which item is closest to the center
                  let closestIndex = 0;
                  let closestDistance = Infinity;
                  
                  Array.from(container.children).forEach((child, index) => {
                    const childElement = child as HTMLElement;
                    const childRect = childElement.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const childCenter = childRect.left + childRect.width / 2;
                    const containerCenter = containerRect.left + containerWidth / 2;
                    const distance = Math.abs(childCenter - containerCenter);
                    
                    if (distance < closestDistance) {
                      closestDistance = distance;
                      closestIndex = index;
                    }
                  });
                  
                  if (closestIndex !== currentMediaIndex && closestIndex >= 0 && closestIndex < existingMedia.length) {
                    setCurrentMediaIndex(closestIndex);
                  }
                }}
              >
                <style>{`
                  .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                
                {existingMedia.map((media, index) => (
                  <div
                    key={media.id}
                    className="relative group flex-shrink-0 w-full sm:w-80 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 snap-center"
                  >
                    {media.media_type === 'image' ? (
                      <img
                        src={media.media_url}
                        alt={media.title || 'Event media'}
                        className="w-full h-48 sm:h-64 object-contain bg-zinc-900"
                      />
                    ) : (
                      <div className="w-full h-48 sm:h-64 bg-zinc-900 flex items-center justify-center relative">
                        {media.thumbnail ? (
                          <img
                            src={media.thumbnail}
                            alt="Video thumbnail"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Video className="w-12 h-12 text-zinc-600" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                            <Video className="w-8 h-8 text-white" />
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeExistingMedia(media.id)}
                      className="absolute top-2 right-2 p-2 bg-red-500/90 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                      disabled={isUploading}
                      aria-label="Delete media"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                    {media.uploaded_by && (
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white">
                        From {media.uploaded_by}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Dots Indicator */}
              {existingMedia.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {existingMedia.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => scrollToMedia(index)}
                      className={`h-1.5 rounded-full transition-all ${
                        index === currentMediaIndex
                          ? 'w-6 bg-purple-500'
                          : 'w-1.5 bg-zinc-600 hover:bg-zinc-500'
                      }`}
                      aria-label={`Go to media ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Uploader Name */}
        <div className="mb-4 sm:mb-6">
          <label htmlFor="uploaderName" className="block text-sm font-medium text-zinc-300 mb-2">
            Your Name *
          </label>
          <input
            id="uploaderName"
            type="text"
            value={uploaderName}
            onChange={(e) => setUploaderName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-3 sm:px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm sm:text-base"
            required
            disabled={isUploading}
          />
          <p className="mt-1 text-xs text-zinc-500">
            This name will be shown with your uploads
          </p>
        </div>

        {/* Add Media */}
        <div className="mb-4 sm:mb-6">
          <label className="block text-sm font-medium text-zinc-300 mb-2 sm:mb-3">
            Add New Media
          </label>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3">
            <label className="flex-1 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, 'image')}
                className="hidden"
                disabled={isUploading}
                multiple
              />
              <div className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors text-zinc-300 text-sm sm:text-base">
                <ImageIcon className="w-4 h-4" />
                <span>Add Images</span>
              </div>
            </label>
            <label className="flex-1 cursor-pointer">
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleFileSelect(e, 'video')}
                className="hidden"
                disabled={isUploading}
                multiple
              />
              <div className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors text-zinc-300 text-sm sm:text-base">
                <Video className="w-4 h-4" />
                <span>Add Videos</span>
              </div>
            </label>
          </div>

          {/* Preview new media */}
          {mediaFiles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
              {mediaFiles.map((item, index) => (
                <div key={index} className="relative group rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700">
                  {item.type === 'image' && item.preview ? (
                    <img
                      src={item.preview}
                      alt="Preview"
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-zinc-900 flex items-center justify-center">
                      <Video className="w-8 h-8 text-zinc-600" />
                      <span className="ml-2 text-xs text-zinc-500 truncate max-w-[100px]">
                        {item.file.name}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMediaFile(index)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={isUploading}
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                  {uploadProgress[`${index}-${item.file.name}`] !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700">
                      <div
                        className="h-full bg-purple-500 transition-all"
                        style={{ width: `${uploadProgress[`${index}-${item.file.name}`]}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm sm:text-base"
            disabled={isUploading}
          >
            {mediaFiles.length === 0 ? 'Close' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={mediaFiles.length === 0 || isUploading || !uploaderName.trim()}
            className="flex-1 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add {mediaFiles.length > 0 ? `${mediaFiles.length} ` : ''}Media
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
