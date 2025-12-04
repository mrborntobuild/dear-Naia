/**
 * Extracts a frame from a video file at a specific time (default 1s).
 * Returns the frame as a Data URL (base64).
 */
export const extractFrameFromVideo = async (videoFile: File, time: number = 1.0): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(fileURL);
      video.remove();
      reject(new Error('Thumbnail extraction timeout - video may be corrupted or unsupported'));
    }, 30000); // 30 second timeout

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const fileURL = URL.createObjectURL(videoFile);
    video.src = fileURL;

    const cleanup = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(fileURL);
      video.remove();
    };

    video.onloadeddata = () => {
      // Seek to the specified time
      video.currentTime = time;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Scale down if too massive for performance
        if (canvas.width > 1280) {
            const scale = 1280 / canvas.width;
            canvas.width = 1280;
            canvas.height = video.videoHeight * scale;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataURL = canvas.toDataURL('image/jpeg', 0.7);
          cleanup();
          resolve(dataURL);
        } else {
          cleanup();
          reject(new Error("Could not get canvas context"));
        }
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    video.onerror = (e) => {
      cleanup();
      reject(new Error("Error loading video"));
    };
  });
};

export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

/**
 * Fast video compression - aggressively reduces size for quick uploads
 * Uses lower resolution, bitrate, and frame rate for speed
 */
export const compressVideo = async (
  videoFile: File,
  maxSizeMB: number = 45,
  onProgress?: (progress: number) => void
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const fileSizeMB = videoFile.size / (1024 * 1024);
    
    // If file is already small enough, return as-is
    if (fileSizeMB <= maxSizeMB) {
      onProgress?.(100);
      resolve(videoFile);
      return;
    }

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.playsInline = true;
    
    const fileURL = URL.createObjectURL(videoFile);
    video.src = fileURL;

    video.onloadedmetadata = () => {
      onProgress?.(5);
      
      const duration = video.duration;
      const targetSizeBytes = maxSizeMB * 1024 * 1024;
      
      // Ultra-aggressive compression for maximum speed
      // Lower resolution significantly
      let width = video.videoWidth;
      let height = video.videoHeight;
      const maxDimension = 640; // Very low resolution for fastest compression
      
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }

      // Calculate ultra-aggressive bitrate (lower = faster, smaller)
      const targetBitrate = Math.max((targetSizeBytes * 8) / duration, 200000); // Min 200kbps (very low)
      const maxBitrate = 1000000; // Max 1 Mbps (very low for speed)

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        URL.revokeObjectURL(fileURL);
        return;
      }

      // Use fastest available codec (usually VP8 is faster than VP9)
      const codecs = [
        'video/webm;codecs=vp8', // VP8 is faster than VP9
        'video/webm',
        'video/webm;codecs=vp9',
      ];

      let selectedMimeType = '';
      for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
          selectedMimeType = codec;
          break;
        }
      }

      if (!selectedMimeType) {
        reject(new Error('No supported video codec found'));
        URL.revokeObjectURL(fileURL);
        return;
      }

      // Lower frame rate for fastest processing (20fps for speed)
      const frameRate = 20;
      const stream = canvas.captureStream(frameRate);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: Math.min(targetBitrate, maxBitrate),
      });

      const chunks: Blob[] = [];
      let frameCount = 0;
      const totalFrames = Math.ceil(duration * frameRate);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          frameCount += 1;
          const progress = 10 + (frameCount / totalFrames) * 85;
          onProgress?.(Math.min(progress, 95));
        }
      };

      mediaRecorder.onstop = () => {
        const compressedBlob = new Blob(chunks, { type: selectedMimeType });
        const compressedFile = new File(
          [compressedBlob],
          videoFile.name.replace(/\.[^/.]+$/, '.webm'),
          { type: selectedMimeType }
        );
        
        const compressedSizeMB = compressedFile.size / (1024 * 1024);
        console.log(`Fast compression: ${fileSizeMB.toFixed(2)} MB → ${compressedSizeMB.toFixed(2)} MB`);
        
        URL.revokeObjectURL(fileURL);
        video.remove();
        canvas.remove();
        onProgress?.(100);
        resolve(compressedFile);
      };

      mediaRecorder.onerror = () => {
        reject(new Error('MediaRecorder error'));
        URL.revokeObjectURL(fileURL);
        video.remove();
        canvas.remove();
      };

      // Start recording immediately
      video.currentTime = 0;
      mediaRecorder.start();
      video.play();
      onProgress?.(10);

      // Faster frame drawing - skip frames if needed for speed
      let lastFrameTime = 0;
      const frameInterval = 1000 / frameRate; // ms per frame
      
      const drawFrame = (timestamp: number) => {
        if (video.ended || video.paused) {
          mediaRecorder.stop();
          return;
        }

        // Only draw if enough time has passed (respect frame rate)
        if (timestamp - lastFrameTime >= frameInterval) {
          ctx.drawImage(video, 0, 0, width, height);
          lastFrameTime = timestamp;
        }

        requestAnimationFrame(drawFrame);
      };

      video.onplay = () => {
        requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        mediaRecorder.stop();
      };
    };

    video.onerror = () => {
      reject(new Error('Error loading video'));
      URL.revokeObjectURL(fileURL);
    };
  });
};
