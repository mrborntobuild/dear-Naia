import { GoogleGenAI, Type } from "@google/genai";
import { VideoAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes a video frame (base64 image) to generate a title and description.
 * We analyze a frame instead of the whole video to keep the interaction fast and lightweight for this demo.
 */
export const analyzeVideoFrame = async (base64Image: string): Promise<VideoAnalysisResult> => {
  try {
    // Remove header if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: "Analyze this image, which is a frame from a user-uploaded video. Generate a catchy, short title (max 5 words) and a brief one-sentence description of what seems to be happening."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["title", "description"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as VideoAnalysisResult;

  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return {
      title: "Untitled Video",
      description: "Could not analyze video content."
    };
  }
};
