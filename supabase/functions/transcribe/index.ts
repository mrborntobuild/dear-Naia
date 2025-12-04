import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const HUGGINGFACE_API_URL = 'https://router.huggingface.co/models/openai/whisper-large-v3';
const HUGGINGFACE_TOKEN = Deno.env.get('HUGGINGFACE_TOKEN') || null;

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
    // Get the file data from the request (can be FormData or JSON with base64)
    let file: File | null = null;
    let fileBlob: Blob | null = null;

    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle FormData
      const formData = await req.formData();
      file = formData.get('file') as File;
    } else {
      // Handle JSON with base64 file data
      const body = await req.json();
      if (body.file && typeof body.file === 'string') {
        // Convert base64 to Blob
        const base64Data = body.file;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const mimeType = body.contentType || 'video/mp4';
        fileBlob = new Blob([bytes], { type: mimeType });
        // Create a File-like object for Hugging Face API
        file = new File([fileBlob], body.filename || 'video.mp4', { type: mimeType });
      }
    }

    if (!file && !fileBlob) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log(`Transcribing file: ${file?.name || 'video'}, size: ${file?.size || fileBlob?.size || 0} bytes`);

    // Prepare headers for Hugging Face API
    const headers: HeadersInit = {};
    if (HUGGINGFACE_TOKEN) {
      headers['Authorization'] = `Bearer ${HUGGINGFACE_TOKEN}`;
    }

    // Forward the file to Hugging Face API
    const response = await fetch(HUGGINGFACE_API_URL, {
      method: 'POST',
      headers,
      body: file || fileBlob,
    });

    if (!response.ok) {
      // Handle model loading (503) with retry
      if (response.status === 503) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 10000;
        console.log(`Model loading, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Retry the request
        const retryResponse = await fetch(HUGGINGFACE_API_URL, {
          method: 'POST',
          headers,
          body: file,
        });

        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          console.error('Transcription API error after retry:', retryResponse.status, errorText);
          return new Response(
            JSON.stringify({ error: 'Transcription service unavailable', details: errorText }),
            { 
              status: retryResponse.status,
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        const result = await retryResponse.json();
        return new Response(
          JSON.stringify(result),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      const errorText = await response.text();
      console.error('Transcription API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Transcription failed', details: errorText }),
        { 
          status: response.status,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const result = await response.json();
    console.log('Transcription successful');

    // Extract text from various possible response formats
    let transcriptionText: string | null = null;
    if (result.text) {
      transcriptionText = result.text;
    } else if (result[0]?.text) {
      transcriptionText = result[0].text;
    } else if (typeof result === 'string') {
      transcriptionText = result;
    }

    return new Response(
      JSON.stringify({ text: transcriptionText, raw: result }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (error) {
    console.error('Edge function error:', error);
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

