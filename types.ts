export interface VideoEntry {
  id: string;
  url: string; // Blob URL for local preview
  thumbnail: string; // Base64 or Blob URL
  title: string;
  description: string;
  timestamp: number;
  durationString: string;
  transcription?: string; // Transcribed text from the video
}

export interface ArticleEntry {
  id: string;
  link: string;
  title: string;
  description: string;
  timestamp: number;
  posted_by?: string;
}

export interface ImageEntry {
  id: string;
  url: string;
  title: string;
  description: string;
  timestamp: number;
}

export interface VideoAnalysisResult {
  title: string;
  description: string;
}

export interface EventMediaEntry {
  id: string;
  event_id: string;
  media_type: 'video' | 'image';
  media_url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
  uploaded_by?: string;
  created_at: string;
}

export interface EventEntry {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO date string
  created_at: string;
  updated_at: string;
  media?: EventMediaEntry[]; // Optional array of media items
}
