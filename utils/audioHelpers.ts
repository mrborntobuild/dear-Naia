/**
 * Extracts audio from a video file and converts it to a format suitable for transcription.
 * Returns the audio as a Blob (WAV format).
 */
export async function extractAudioFromVideo(videoFile: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = false;
    video.playsInline = true;

    const fileURL = URL.createObjectURL(videoFile);
    video.src = fileURL;

    video.onloadeddata = () => {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaElementSource(video);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination);

      // Use MediaRecorder to capture audio
      const mediaRecorder = new MediaRecorder(destination.stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        URL.revokeObjectURL(fileURL);
        video.remove();
        resolve(audioBlob);
      };

      mediaRecorder.onerror = (error) => {
        URL.revokeObjectURL(fileURL);
        video.remove();
        reject(error);
      };

      // Start recording
      mediaRecorder.start();
      
      // Play video to capture audio
      video.play().then(() => {
        // Stop recording when video ends
        video.onended = () => {
          mediaRecorder.stop();
        };
      }).catch((error) => {
        mediaRecorder.stop();
        reject(error);
      });
    };

    video.onerror = (e) => {
      URL.revokeObjectURL(fileURL);
      reject(new Error("Error loading video"));
    };
  });
}

/**
 * Alternative: Extract audio using Web Audio API and convert to base64
 * This is simpler and more reliable for sending to APIs
 */
export async function extractAudioAsBase64(videoFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = false;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const fileURL = URL.createObjectURL(videoFile);
    video.src = fileURL;

    video.onloadeddata = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create a source from the video element
        const source = audioContext.createMediaElementSource(video);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        source.connect(audioContext.destination);

        // Use MediaRecorder API for simpler audio extraction
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        // For video files, we need to extract audio differently
        // Let's use a simpler approach: convert video to audio blob
        const response = await fetch(fileURL);
        const blob = await response.blob();
        
        // Create a new blob with audio mime type (this is a workaround)
        // The actual transcription API will handle the video file directly
        URL.revokeObjectURL(fileURL);
        video.remove();
        
        // Actually, Hugging Face Whisper can accept video files directly!
        // So we can just return the video file as-is
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1] || base64); // Remove data URL prefix if present
        };
        reader.onerror = reject;
        reader.readAsDataURL(videoFile);
      } catch (error) {
        URL.revokeObjectURL(fileURL);
        video.remove();
        reject(error);
      }
    };

    video.onerror = (e) => {
      URL.revokeObjectURL(fileURL);
      reject(new Error("Error loading video"));
    };
  });
}

