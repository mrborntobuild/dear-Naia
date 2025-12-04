/**
 * Extracts a frame from a video file at a specific time (default 1s).
 * Returns the frame as a Data URL (base64).
 */
export const extractFrameFromVideo = async (videoFile: File, time: number = 1.0): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const fileURL = URL.createObjectURL(videoFile);
    video.src = fileURL;

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
          resolve(dataURL);
        } else {
          reject(new Error("Could not get canvas context"));
        }
      } catch (e) {
        reject(e);
      } finally {
        // Cleanup
        URL.revokeObjectURL(fileURL);
        video.remove();
      }
    };

    video.onerror = (e) => {
      reject(new Error("Error loading video"));
    };
  });
};

export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};
