import { createClient } from '@supabase/supabase-js';
import * as tus from 'tus-js-client';
import { VideoEntry, ArticleEntry, ImageEntry } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dszvvagszjltrssjivmu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzenZ2YWdzempsdHJzc2ppdm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3OTc5NzIsImV4cCI6MjA4MDM3Mzk3Mn0.oDzR-JpFMSQStjpiJDVpJYpkkLEJHjkxVNDcNe85ng8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Extract project ID from URL for direct storage hostname
const projectId = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || 'dszvvagszjltrssjivmu';
const storageUrl = `https://${projectId}.storage.supabase.co`;

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
 * Uses resumable uploads (TUS) for files larger than 6MB for better reliability
 * @param file - The video file to upload
 * @param videoId - The unique ID for the video
 * @param onProgress - Optional progress callback
 * @returns The public URL of the uploaded video, or null if upload fails
 */
export async function uploadVideoToStorage(
  file: File, 
  videoId: string,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${videoId}.${fileExt}`;
    const filePath = `videos/${fileName}`;

    const fileSizeMB = file.size / 1024 / 1024;
    const useResumable = fileSizeMB > 6; // Use resumable uploads for files > 6MB

    console.log(`Uploading video to storage: ${filePath} (Size: ${fileSizeMB.toFixed(2)} MB, Method: ${useResumable ? 'Resumable' : 'Standard'})`);

    if (useResumable) {
      // Use resumable uploads for larger files
      return await uploadResumable(file, filePath, onProgress);
    } else {
      // Use standard upload for smaller files
      return await uploadStandard(file, filePath);
    }
  } catch (error) {
    console.error('Error uploading video to storage:', error);
    return null;
  }
}

/**
 * Standard upload for smaller files
 */
async function uploadStandard(file: File, filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('videos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    console.error('Error uploading video to storage:', error);
    if (error.message?.includes('exceeded the maximum allowed size') || error.message?.includes('EntityTooLarge')) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      console.error(
        `❌ File size error: Video is ${fileSizeMB} MB, but exceeds Supabase Storage limit.\n` +
        `Global Limit is likely set too low in the dashboard.`
      );
    }
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('videos')
    .getPublicUrl(filePath);

  console.log('Video uploaded successfully:', urlData.publicUrl);
  return urlData.publicUrl;
}

/**
 * Resumable upload using TUS protocol for larger files
 */
async function uploadResumable(
  file: File, 
  filePath: string,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    // Get session for authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      const upload = new tus.Upload(file, {
        // Use direct storage hostname for better performance
        endpoint: `${storageUrl}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: 'videos',
          objectName: filePath,
          contentType: file.type,
          cacheControl: '3600',
        },
        chunkSize: 6 * 1024 * 1024, // 6MB chunks (required by Supabase)
        onError: function (error) {
          console.error('Resumable upload failed:', error);
          reject(error);
        },
        onProgress: function (bytesUploaded, bytesTotal) {
          const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
          console.log(`Upload progress: ${percentage}% (${(bytesUploaded / 1024 / 1024).toFixed(2)} MB / ${(bytesTotal / 1024 / 1024).toFixed(2)} MB)`);
          if (onProgress) {
            onProgress(Number(percentage));
          }
        },
        onSuccess: function () {
          console.log('Resumable upload completed successfully');
          // Get public URL
          const { data: urlData } = supabase.storage
            .from('videos')
            .getPublicUrl(filePath);
          
          console.log('Video uploaded successfully:', urlData.publicUrl);
          resolve(urlData.publicUrl);
        },
      });

      // Check for previous uploads to resume
      upload.findPreviousUploads().then(function (previousUploads) {
        if (previousUploads.length) {
          console.log('Resuming previous upload...');
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        // Start the upload
        upload.start();
      }).catch((error) => {
        console.error('Error finding previous uploads:', error);
        // Start fresh upload anyway
        upload.start();
      });
    }).catch((error) => {
      console.error('Error getting session:', error);
      reject(error);
    });
  });
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

/**
 * Triggers background processing for a video (transcription) via Supabase Edge Function
 * This is a fire-and-forget call - the Edge Function processes in the background
 */
export async function triggerVideoProcessing(videoId: string, videoUrl: string): Promise<void> {
  try {
    const functionUrl = `${supabaseUrl}/functions/v1/process-video`;
    
    console.log(`🎬 Triggering Supabase Edge Function for transcription...`, {
      videoId,
      functionUrl,
      videoUrl: videoUrl.substring(0, 50) + '...'
    });
    
    // Call Edge Function asynchronously (don't wait for response)
    fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey, // Some Edge Functions need this
      },
      body: JSON.stringify({ videoId, videoUrl }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Error triggering video processing:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
        } else {
          const result = await response.json().catch(() => ({}));
          console.log(`✅ Background transcription started for video ${videoId}`, result);
        }
      })
      .catch((error) => {
        console.error('❌ Failed to trigger video processing:', error);
        // Don't throw - this is background processing, failures shouldn't block the user
      });
    
    // Return immediately without waiting
  } catch (error) {
    console.error('❌ Error setting up video processing:', error);
    // Don't throw - background processing failures shouldn't block the user
  }
}

// --- Articles ---

export async function fetchArticles(): Promise<ArticleEntry[]> {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching articles:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      link: row.link,
      title: row.title,
      description: row.description,
      timestamp: row.timestamp,
      posted_by: row.posted_by,
    }));
  } catch (error) {
    console.error('Error fetching articles:', error);
    return [];
  }
}

export async function insertArticle(article: ArticleEntry): Promise<ArticleEntry | null> {
  const row = {
    id: article.id,
    link: article.link,
    title: article.title,
    description: article.description,
    timestamp: article.timestamp,
    posted_by: article.posted_by || null,
  };

  try {
    const { data, error } = await supabase
      .from('articles')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Error inserting article:', error);
      return null;
    }

    return {
      id: data.id,
      link: data.link,
      title: data.title,
      description: data.description,
      timestamp: data.timestamp,
      posted_by: data.posted_by,
    };
  } catch (error) {
    console.error('Error inserting article:', error);
    return null;
  }
}

// --- Images ---

export async function fetchImages(): Promise<ImageEntry[]> {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching images:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      description: row.description,
      timestamp: row.timestamp,
    }));
  } catch (error) {
    console.error('Error fetching images:', error);
    return [];
  }
}

export async function insertImage(image: ImageEntry): Promise<ImageEntry | null> {
  const row = {
    id: image.id,
    url: image.url,
    title: image.title,
    description: image.description,
    timestamp: image.timestamp,
  };

  try {
    const { data, error } = await supabase
      .from('images')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Error inserting image:', error);
      return null;
    }

    return {
      id: data.id,
      url: data.url,
      title: data.title,
      description: data.description,
      timestamp: data.timestamp,
    };
  } catch (error) {
    console.error('Error inserting image:', error);
    return null;
  }
}

export async function uploadImageToStorage(file: File, imageId: string): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${imageId}.${fileExt}`;
    // Use images folder in videos bucket to leverage existing policies
    const filePath = `images/${fileName}`;

    console.log(`Uploading image to storage: ${filePath}`);

    const { data, error } = await supabase.storage
      .from('videos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      console.error('Error uploading image to storage:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(filePath);

    console.log('Image uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading image to storage:', error);
    return null;
  }
}
