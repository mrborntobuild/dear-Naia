import React, { useState } from 'react';
import { Calendar, Image as ImageIcon, Video, Edit2, Trash2 } from 'lucide-react';
import { EventEntry } from '../types';
import { EventModal } from './EventModal';
import { AddEventMediaModal } from './AddEventMediaModal';
import { deleteEvent, fetchEvents } from '../services/supabaseService';

interface EventsProps {
  events: EventEntry[];
  onEventsChange: () => void;
}

export const Events: React.FC<EventsProps> = ({ events, onEventsChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventEntry | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventEntry | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setShowModal(true);
  };

  const handleEditEvent = (event: EventEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setShowModal(true);
  };

  const handleEventClick = (event: EventEntry) => {
    setSelectedEvent(event);
    setShowMediaModal(true);
  };

  const handleDeleteEvent = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this event? This will also delete all associated media.')) {
      return;
    }

    setDeletingEventId(eventId);
    try {
      const success = await deleteEvent(eventId);
      if (success) {
        onEventsChange();
      } else {
        alert('Failed to delete event. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event. Please try again.');
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleSaveEvent = async () => {
    setShowModal(false);
    setShowMediaModal(false);
    setEditingEvent(null);
    setSelectedEvent(null);
    // Refresh events list
    await onEventsChange();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (events.length === 0) {
    return (
      <div className="w-full">
        <div className="text-center py-20 border-2 border-dashed border-zinc-800/50 rounded-2xl bg-zinc-900/20">
          <Calendar className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-zinc-500 mb-2">No Events Yet</h3>
          <p className="text-zinc-600 mb-6">Create your first event to get started!</p>
          <button
            onClick={handleCreateEvent}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium"
          >
            Create Your First Event
          </button>
        </div>

        {showModal && (
          <EventModal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              setEditingEvent(null);
            }}
            onSave={handleSaveEvent}
            event={editingEvent}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full">

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => handleEventClick(event)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-purple-500/50 transition-colors group cursor-pointer"
          >
            {/* Media Preview */}
            {event.media && event.media.length > 0 ? (
              <div className="relative h-48 bg-zinc-950">
                {event.media[0].media_type === 'image' ? (
                  <img
                    src={event.media[0].media_url}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full relative">
                    {event.media[0].thumbnail ? (
                      <img
                        src={event.media[0].thumbnail}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                        <Video className="w-12 h-12 text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                        <Video className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </div>
                )}
                {event.media.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                    {event.media.length > 1 && (
                      <>
                        {event.media.filter(m => m.media_type === 'image').length > 0 && (
                          <ImageIcon className="w-3 h-3" />
                        )}
                        {event.media.filter(m => m.media_type === 'video').length > 0 && (
                          <Video className="w-3 h-3" />
                        )}
                        <span>{event.media.length} items</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-48 bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center">
                <Calendar className="w-16 h-16 text-zinc-700" />
              </div>
            )}

            {/* Event Info */}
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-white line-clamp-2 flex-1">
                  {event.title}
                </h3>
                <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleEditEvent(event, e)}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Edit event"
                  >
                    <Edit2 className="w-4 h-4 text-zinc-400 hover:text-white" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteEvent(event.id, e)}
                    disabled={deletingEventId === event.id}
                    className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Delete event"
                  >
                    <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-400" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-zinc-400 mb-3">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(event.date)}</span>
              </div>

              {event.description && (
                <p className="text-sm text-zinc-300 line-clamp-2 mb-3">
                  {event.description}
                </p>
              )}

              {/* Media Count */}
              {event.media && event.media.length > 0 && (
                <div className="flex items-center gap-4 text-xs text-zinc-500 pt-3 border-t border-zinc-800">
                  {event.media.filter(m => m.media_type === 'image').length > 0 && (
                    <span className="flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {event.media.filter(m => m.media_type === 'image').length} photo{event.media.filter(m => m.media_type === 'image').length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {event.media.filter(m => m.media_type === 'video').length > 0 && (
                    <span className="flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      {event.media.filter(m => m.media_type === 'video').length} video{event.media.filter(m => m.media_type === 'video').length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <EventModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingEvent(null);
          }}
          onSave={handleSaveEvent}
          event={editingEvent}
        />
      )}

      {showMediaModal && selectedEvent && (
        <AddEventMediaModal
          isOpen={showMediaModal}
          onClose={() => {
            setShowMediaModal(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          onMediaAdded={handleSaveEvent}
        />
      )}
    </div>
  );
};
