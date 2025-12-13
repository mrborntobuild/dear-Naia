import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Image as ImageIcon, Video, Calendar, Loader2 } from 'lucide-react';
import { EventEntry, EventMediaEntry } from '../types';
import { 
  insertEvent, 
  updateEvent, 
  insertEventMedia, 
  uploadEventMediaToStorage,
  deleteEventMedia
} from '../services/supabaseService';
import { PLACEHOLDER_THUMBNAIL } from '../utils/constants';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: EventEntry) => void;
  event?: EventEntry | null; // If provided, we're editing; otherwise creating
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  event
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [mediaFiles, setMediaFiles] = useState<Array<{ file: File; type: 'video' | 'image'; preview?: string }>>([]);
  const [existingMedia, setExistingMedia] = useState<EventMediaEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploaderName, setUploaderName] = useState('Henry Moses');

  // Initialize form when event changes
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setDate(event.date.split('T')[0]); // Extract date part from ISO string
      setExistingMedia(event.media || []);
    } else {
      setTitle('');
      setDescription('');
      setDate('');
      setExistingMedia([]);
    }
    setMediaFiles([]);
    setUploadProgress({});
    setUploaderName('Henry Moses'); // Default name
  }, [event, isOpen]);

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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    setIsSaving(true);

    try {
      let savedEvent: EventEntry;

      if (event) {
        // Update existing event
        savedEvent = await updateEvent({
          ...event,
          title: title.trim(),
          description: description.trim() || undefined,
          date: new Date(date).toISOString(),
        }) || event;
      } else {
        // Create new event
        const newEvent = await insertEvent({
          title: title.trim(),
          description: description.trim() || undefined,
          date: new Date(date).toISOString(),
        });

        if (!newEvent) {
          throw new Error('Failed to create event');
        }

        savedEvent = newEvent;
      }

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
            savedEvent.id,
            mediaId,
            mediaItem.type
          );

          if (!mediaUrl) {
            throw new Error(`Failed to upload ${mediaItem.type}`);
          }

          // For videos, use placeholder thumbnail (or extract one if needed)
          let thumbnailUrl: string | undefined;
          if (mediaItem.type === 'video') {
            thumbnailUrl = PLACEHOLDER_THUMBNAIL;
          }

          // Save media entry to database
          const savedMedia = await insertEventMedia({
            event_id: savedEvent.id,
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

      // Fetch updated event with all media
      const updatedEvent = await updateEvent(savedEvent);
      const finalEvent = updatedEvent || savedEvent;
      
      // Reset form
      setTitle('');
      setDescription('');
      setDate('');
      setMediaFiles([]);
      setExistingMedia([]);
      setUploaderName('Henry Moses');
      setUploadProgress({});
      
      // Close modal first
      onClose();
      
      // Then save and refresh with a small delay to ensure state updates
      setTimeout(() => {
        onSave(finalEvent);
      }, 200);
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Failed to save event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto p-2 sm:p-4">
      <div className="bg-zinc-900 rounded-xl sm:rounded-2xl border border-zinc-700 p-4 sm:p-6 md:p-8 max-w-3xl w-full mx-auto my-4 sm:my-8 shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-zinc-100">
            {event ? 'Edit Event' : 'Create New Event'}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-zinc-300 mb-2">
              Event Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Graduation Party, Birthday Celebration..."
              className="w-full px-3 sm:px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm sm:text-base"
              required
              disabled={isSaving}
            />
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-zinc-300 mb-2">
              Event Date *
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm sm:text-base"
              required
              disabled={isSaving}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about the event..."
              rows={3}
              className="w-full px-3 sm:px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none text-sm sm:text-base"
              disabled={isSaving}
            />
          </div>

          {/* Existing Media */}
          {existingMedia.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Current Media
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {existingMedia.map((media) => (
                  <div key={media.id} className="relative group rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700">
                    {media.media_type === 'image' ? (
                      <img
                        src={media.media_url}
                        alt={media.title || 'Event media'}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-zinc-900 flex items-center justify-center relative">
                        {media.thumbnail ? (
                          <img
                            src={media.thumbnail}
                            alt="Video thumbnail"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Video className="w-8 h-8 text-zinc-600" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                            <Video className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeExistingMedia(media.id)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={isSaving}
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uploader Name */}
          {mediaFiles.length > 0 && (
            <div>
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
                disabled={isSaving}
              />
              <p className="mt-1 text-xs text-zinc-500">
                This name will be shown with your uploads
              </p>
            </div>
          )}

          {/* Add Media */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Add Pictures & Videos
            </label>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3">
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, 'image')}
                  className="hidden"
                  disabled={isSaving}
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
                  disabled={isSaving}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
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
                      disabled={isSaving}
                    >
                      <Trash2 className="w-4 h-4 text-white" />
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
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !date || isSaving || (mediaFiles.length > 0 && !uploaderName.trim())}
              className="flex-1 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                event ? 'Update Event' : 'Create Event'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
