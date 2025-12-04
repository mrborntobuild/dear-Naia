import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Use AssemblyAI for transcription (supports larger files, faster)
const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2/transcript';
const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY') || null;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    const { videoId, videoUrl } = await req.json();

    if (!videoId || !videoUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing videoId or videoUrl' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🎬 Processing video ${videoId} from ${videoUrl}`);

    // Verify video URL is accessible (AssemblyAI needs a publicly accessible URL)
    console.log(`📥 Verifying video URL is accessible...`);
    let finalVideoUrl = videoUrl;
    let videoResponse = await fetch(videoUrl, { method: 'HEAD' });
    
    // If HEAD fails, try GET
    if (!videoResponse.ok) {
      videoResponse = await fetch(videoUrl);
    }
    
    // If still fails, try getting a signed URL from storage
    if (!videoResponse.ok) {
      console.log(`⚠️ Public URL failed (${videoResponse.status}), trying signed URL...`);
      
      // Extract file path from URL
      const urlParts = videoUrl.split('/storage/v1/object/public/');
      if (urlParts.length > 1) {
        const pathParts = urlParts[1].split('/');
        const bucket = pathParts[0];
        const filePath = pathParts.slice(1).join('/');
        
        console.log(`🔑 Creating signed URL for bucket: ${bucket}, path: ${filePath}`);
        
        // Get signed URL (valid for 1 hour)
        const { data: signedUrlData, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 3600);
        
        if (signedError || !signedUrlData) {
          console.error('❌ Failed to create signed URL:', signedError);
          throw new Error(`Failed to access video: ${videoResponse.statusText}`);
        }
        
        console.log('✅ Using signed URL for transcription');
        finalVideoUrl = signedUrlData.signedUrl;
      }
    }

    const fileSizeMB = videoResponse.headers.get('content-length') 
      ? parseInt(videoResponse.headers.get('content-length')!) / (1024 * 1024)
      : 0;
    console.log(`✅ Video accessible: ${fileSizeMB > 0 ? fileSizeMB.toFixed(2) + ' MB' : 'size unknown'}`);

    // Transcribe the video using AssemblyAI (supports larger files)
    console.log('🎤 Starting transcription via AssemblyAI...');
    const transcription = await transcribeVideo(finalVideoUrl, videoId);
    
    if (!transcription) {
      console.error('❌ Transcription failed - returned null');
    } else {
      console.log(`✅ Transcription successful: ${transcription.substring(0, 50)}...`);
    }

    if (transcription) {
      console.log('💾 Updating database with transcription...');
      
      // Update video record with transcription
      const { error: updateError } = await supabase
        .from('videos')
        .update({ 
          transcription: transcription,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);

      if (updateError) {
        console.error('❌ Error updating video:', updateError);
        throw updateError;
      }

      console.log(`✅ Video ${videoId} processed successfully`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          videoId,
          transcription: transcription.substring(0, 100) + '...' // Preview
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } else {
      console.warn('⚠️ Transcription returned null, but continuing...');
      return new Response(
        JSON.stringify({ 
          success: true, 
          videoId,
          transcription: null,
          warning: 'Transcription was not available'
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

  } catch (error) {
    console.error('❌ Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

/**
 * Transcribes a video using AssemblyAI (supports larger files, faster processing)
 * AssemblyAI accepts URLs directly, so we pass the video URL instead of the file
 */
async function transcribeVideo(videoUrl: string, videoId: string): Promise<string | null> {
  try {
    if (!ASSEMBLYAI_API_KEY) {
      console.error('❌ ASSEMBLYAI_API_KEY is not set');
      console.error('💡 To fix: Add ASSEMBLYAI_API_KEY secret to Edge Function');
      console.error('   1. Get API key: https://www.assemblyai.com/app/account (free tier available)');
      console.error('   2. Add secret: Supabase Dashboard → Edge Functions → Secrets');
      return null;
    }

    console.log(`📤 Submitting video URL to AssemblyAI for transcription...`);
    
    // Step 1: Submit transcription job
    const submitResponse = await fetch(ASSEMBLYAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: videoUrl,
        language_code: 'en',
      }),
    });
    
    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error(`❌ Failed to submit transcription: ${submitResponse.status}`, errorText.substring(0, 500));
      return null;
    }

    const submitResult = await submitResponse.json();
    const transcriptId = submitResult.id;
    
    if (!transcriptId) {
      console.error('❌ No transcript ID returned from AssemblyAI');
      return null;
    }

    console.log(`✅ Transcription job submitted: ${transcriptId}`);
    console.log('⏳ Polling for transcription results...');

    // Step 2: Poll for results (AssemblyAI processes asynchronously)
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
      
      const statusResponse = await fetch(`${ASSEMBLYAI_API_URL}/${transcriptId}`, {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY,
        },
      });
      
      if (!statusResponse.ok) {
        console.error(`❌ Failed to check status: ${statusResponse.status}`);
        continue;
      }

      const statusResult = await statusResponse.json();
      const status = statusResult.status;
      
      console.log(`📊 Status check ${attempts}/${maxAttempts}: ${status}`);
      
      if (status === 'completed') {
        console.log('✅ Transcription completed!');
        if (statusResult.text) {
          console.log(`✅ Transcription: ${statusResult.text.substring(0, 50)}...`);
          return statusResult.text;
        }
      } else if (status === 'error') {
        console.error('❌ Transcription failed:', statusResult.error);
        return null;
      }
      // If status is 'queued' or 'processing', continue polling
    }
    
    console.error('❌ Transcription timed out after 5 minutes');
    return null;

  } catch (error) {
    console.error('❌ Transcription error:', error);
    return null;
  }
}
