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
