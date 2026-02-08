import { GoogleGenAI, Modality } from "@google/genai";
import { Lesson } from "../types";

const getApiKey = () => {
  // @ts-ignore
  if (window.aistudio) {
    // Try to get from AI Studio context
    return process.env.API_KEY;
  }
  return import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
};

export const isKeyError = (error: any) => {
  const msg = error?.message || (typeof error === 'string' ? error : "");
  const status = error?.status || "";
  const code = error?.code || error?.status || 0;
  
  return msg.includes("Requested entity was not found") || 
         msg.includes("leaked") || 
         msg.includes("API key") ||
         status === "PERMISSION_DENIED" ||
         code === 403 ||
         code === 401;
};

export const generateTTS = async (text: string, language: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_REQUIRED");
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say clearly in ${language}: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No candidates in TTS response");

    const parts = candidate.content?.parts || [];
    const partWithAudio = parts.find(p => p.inlineData && p.inlineData.data);
    const base64Audio = partWithAudio?.inlineData?.data;
    
    if (!base64Audio) {
      console.warn("TTS extraction error: No audio part found among parts", parts);
      throw new Error("No audio data returned from TTS");
    }
    return base64Audio;
  } catch (error: any) {
    if (isKeyError(error)) throw new Error("KEY_RESET_REQUIRED");
    throw error;
  }
};

// Enhanced pronunciation scoring using AI
export const scorePronunciation = async (
  spokenText: string,
  targetText: string,
  language: string
): Promise<{ score: number; feedback: string; accuracy: number }> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_REQUIRED");
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a pronunciation expert for ${language}. 
        The user said: "${spokenText}"
        The target word/phrase is: "${targetText}"
        
        Rate the pronunciation on a scale of 0-100 and provide brief feedback.
        Return JSON: { "score": number, "feedback": string, "accuracy": number (0-1) }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            score: { type: "number" },
            feedback: { type: "string" },
            accuracy: { type: "number" }
          },
          required: ["score", "feedback", "accuracy"]
        }
      }
    });

    return JSON.parse(response.text || '{"score": 50, "feedback": "Keep practicing", "accuracy": 0.5}');
  } catch (error: any) {
    console.error('Pronunciation scoring error:', error);
    return { score: 50, feedback: "Could not analyze pronunciation", accuracy: 0.5 };
  }
};
