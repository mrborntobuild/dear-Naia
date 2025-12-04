export interface VideoEntry {
  id: string;
  url: string; // Blob URL for local preview
  thumbnail: string; // Base64 or Blob URL
  title: string;
  description: string;
  timestamp: number;
  durationString: string;
}

export interface VideoAnalysisResult {
  title: string;
  description: string;
}
