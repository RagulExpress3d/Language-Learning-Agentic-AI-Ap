
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Lesson, Slide, QuizQuestion } from "../types";

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

export const generateLesson = async (language: string, theme: string, goal: string, level: string): Promise<Lesson> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a language lesson for an English speaker learning ${language}. 
        Theme: ${theme}. User Goal: ${goal}. Proficiency Level: ${level}.
        
        STRICT RULES:
        1. 'title' and ALL quiz 'question' fields MUST be in English.
        2. Slide 'word' and 'exampleSentence' MUST be in ${language}.
        3. Quiz 'options' and 'correctAnswer' must be English meanings or translations.
        4. Output strictly valid JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  translation: { type: Type.STRING },
                  phonetic: { type: Type.STRING },
                  exampleSentence: { type: Type.STRING },
                  visualPrompt: { type: Type.STRING, description: "Prompt for image generator." }
                },
                required: ["word", "translation", "phonetic", "exampleSentence", "visualPrompt"]
              }
            },
            quizzes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["multiple-choice"] },
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING }
                },
                required: ["type", "question", "options", "correctAnswer"]
              }
            }
          },
          required: ["title", "slides", "quizzes"]
        }
      }
    });

    const lessonData = JSON.parse(response.text || '{}');
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      title: lessonData.title || `${theme} Lesson`,
      slides: (lessonData.slides || []).map((s: any, i: number) => ({ ...s, id: `slide-${i}` })),
      quizzes: (lessonData.quizzes || []).map((q: any, i: number) => ({ ...q, id: `quiz-${i}` }))
    };
  } catch (error: any) {
    if (isKeyError(error)) throw new Error("KEY_RESET_REQUIRED");
    throw error;
  }
};

export const generateTTS = async (text: string, language: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

    // Safer extraction of audio data
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

export const generateSlideImage = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A vibrant, high-quality, friendly 3D illustration of ${prompt}. Clean white background, Duolingo aesthetic.` }]
      },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return `https://picsum.photos/seed/${encodeURIComponent(prompt)}/400/400`;
  } catch (error: any) {
    if (isKeyError(error)) throw new Error("KEY_RESET_REQUIRED");
    throw error;
  }
};
