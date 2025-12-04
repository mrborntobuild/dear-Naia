<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1GaUEm9kuYXk5g03EmDEaMoqGxudPXYSS

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env.local` file in the root directory with the following variables:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   VITE_SUPABASE_URL=https://dszvvagszjltrssjivmu.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzenZ2YWdzempsdHJzc2ppdm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3OTc5NzIsImV4cCI6MjA4MDM3Mzk3Mn0.oDzR-JpFMSQStjpiJDVpJYpkkLEJHjkxVNDcNe85ng8
   ```
   Note: The Supabase credentials are already configured with defaults in the code, but you can override them via environment variables.
3. Run the app:
   `npm run dev`

## Transcription Setup

Videos are automatically transcribed using OpenAI's Whisper model via a Supabase Edge Function that proxies requests to Hugging Face.

**Optional:** For higher rate limits, set up a Hugging Face token:
1. Get a free token at: https://huggingface.co/settings/tokens
2. Add it as a secret in your Supabase project:
   - Go to your Supabase Dashboard → Edge Functions → Secrets
   - Add secret: `HUGGINGFACE_TOKEN` with your token value
   - The Edge Function will automatically use this token

The Edge Function (`transcribe`) is already deployed and ready to use.

## Features

- **Video Upload**: Upload video Messages with drag-and-drop support
- **Automatic Transcription**: Videos are automatically transcribed using OpenAI's Whisper model via Hugging Face (free, open-source)
- **Timeline View**: Browse all Messages in a beautiful timeline interface
- **Persistent Storage**: All videos and transcriptions are saved to Supabase database
- **Edge Function Proxy**: Transcription handled via Supabase Edge Function to avoid CORS issues
