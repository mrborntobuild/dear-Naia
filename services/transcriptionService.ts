/**
 * Transcribes video/audio using OpenAI's Whisper API.
 * Whisper is OpenAI's speech recognition model.
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('⚠️ VITE_OPENAI_API_KEY is not set. Transcription will fail.');
}

/**
 * Transcribes a video file using OpenAI's Whisper API.
 * @param videoFile - The video file to transcribe
 * @returns The transcribed text, or null if transcription fails
 */
export async function transcribeVideo(videoFile: File): Promise<string | null> {
  try {
    console.log('Starting transcription for file:', videoFile.name, 'Size:', videoFile.size);
    console.log('Calling OpenAI Whisper API...');

    // Create FormData for multipart/form-data request
    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Optional: specify language for better accuracy

    // Send the file to OpenAI Whisper API
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        // Don't set Content-Type - let browser set it with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText.substring(0, 200) };
      }
      
      console.error('❌ Transcription API error:', response.status, errorData);
      
      if (response.status === 401) {
        console.error('Authentication failed. Check your OpenAI API key.');
      } else if (response.status === 429) {
        console.error('Rate limit exceeded. Please try again later.');
      }
      return null;
    }

    const result = await response.json();
    console.log('✅ Transcription API response received');
    
    // OpenAI Whisper API returns { text: string }
    if (result.text) {
      console.log('✅ Transcription successful:', result.text.substring(0, 100) + '...');
      return result.text;
    } else {
      console.warn('⚠️ Unexpected transcription response format:', result);
      return null;
    }
  } catch (error: any) {
    console.error('❌ Transcription failed:', error);
    if (error?.message) {
      console.error('Error message:', error.message);
    }
    return null;
  }
}

/**
 * Note: Transcription uses OpenAI's Whisper API directly.
 * 
 * Security Note: The API key is currently hardcoded. For production, move it to
 * an environment variable (.env.local) as VITE_OPENAI_API_KEY.
 * 
 * If you encounter CORS issues, you may need to proxy requests through a backend
 * or Edge Function to keep the API key secure.
 */
