import { createClient } from '@supabase/supabase-js';
import { VideoEntry } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dszvvagszjltrssjivmu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzenZ2YWdzempsdHJzc2ppdm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3OTc5NzIsImV4cCI6MjA4MDM3Mzk3Mn0.oDzR-JpFMSQStjpiJDVpJYpkkLEJHjkxVNDcNe85ng8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types matching our schema
interface VideoRow {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  description: string;
  timestamp: number;
  duration_string: string;
  transcription: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Converts a database row to a VideoEntry
 */
function rowToVideoEntry(row: VideoRow): VideoEntry {
  return {
    id: row.id,
    url: row.url,
    thumbnail: row.thumbnail,
    title: row.title,
    description: row.description,
    timestamp: row.timestamp,
    durationString: row.duration_string,
    transcription: row.transcription || undefined,
  };
}

/**
 * Converts a VideoEntry to a database row
 */
function videoEntryToRow(video: VideoEntry): Omit<VideoRow, 'created_at' | 'updated_at'> {
  return {
    id: video.id,
    url: video.url,
    thumbnail: video.thumbnail,
    title: video.title,
    description: video.description,
    timestamp: video.timestamp,
    duration_string: video.durationString,
    transcription: video.transcription || null,
  };
}

/**
 * Fetches all videos from the database, ordered by timestamp (newest first)
 */
export async function fetchVideos(): Promise<VideoEntry[]> {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching videos:', error);
      return [];
    }

    return (data || []).map(rowToVideoEntry);
  } catch (error) {
    console.error('Error fetching videos:', error);
    return [];
  }
}

/**
 * Inserts a new video into the database
 */
export async function insertVideo(video: VideoEntry): Promise<VideoEntry | null> {
  try {
    const row = videoEntryToRow(video);
    const { data, error } = await supabase
      .from('videos')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Error inserting video:', error);
      return null;
    }

    return rowToVideoEntry(data);
  } catch (error) {
    console.error('Error inserting video:', error);
    return null;
  }
}

/**
 * Updates an existing video in the database
 */
export async function updateVideo(video: VideoEntry): Promise<VideoEntry | null> {
  try {
    const row = videoEntryToRow(video);
    const { data, error } = await supabase
      .from('videos')
      .update(row)
      .eq('id', video.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating video:', error);
      return null;
    }

    return rowToVideoEntry(data);
  } catch (error) {
    console.error('Error updating video:', error);
    return null;
  }
}

/**
 * Uploads a video file to Supabase Storage
 * @param file - The video file to upload
 * @param videoId - The unique ID for the video
 * @returns The public URL of the uploaded video, or null if upload fails
 */
export async function uploadVideoToStorage(file: File, videoId: string): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${videoId}.${fileExt}`;
    const filePath = `videos/${fileName}`;

    console.log('Uploading video to storage:', filePath);

    const { data, error } = await supabase.storage
      .from('videos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading video to storage:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(filePath);

    console.log('Video uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading video to storage:', error);
    return null;
  }
}

/**
 * Uploads a thumbnail image to Supabase Storage
 * @param thumbnailDataUrl - The thumbnail as a data URL (base64)
 * @param videoId - The unique ID for the video
 * @returns The public URL of the uploaded thumbnail, or null if upload fails
 */
export async function uploadThumbnailToStorage(thumbnailDataUrl: string, videoId: string): Promise<string | null> {
  try {
    // Convert data URL to blob
    const response = await fetch(thumbnailDataUrl);
    const blob = await response.blob();
    
    const fileName = `${videoId}_thumb.jpg`;
    const filePath = `thumbnails/${fileName}`;

    console.log('Uploading thumbnail to storage:', filePath);

    const { data, error } = await supabase.storage
      .from('videos')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg',
      });

    if (error) {
      console.error('Error uploading thumbnail to storage:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(filePath);

    console.log('Thumbnail uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading thumbnail to storage:', error);
    return null;
  }
}

/**
 * Deletes a video from the database
 */
export async function deleteVideo(videoId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (error) {
      console.error('Error deleting video:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting video:', error);
    return false;
  }
}

