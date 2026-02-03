
import { GoogleGenAI, Type } from "@google/genai";
import { Lesson, Slide, QuizQuestion } from "../types";

export const isKeyError = (error: any) => {
  const msg = error?.message || (typeof error === 'string' ? error : "");
  const status = error?.status || "";
  const code = error?.code || 0;
  
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
      contents: `Generate a structured language lesson for learning ${language}. 
        Theme: ${theme}. User Goal: ${goal}. Proficiency Level: ${level}.
        The output MUST be in JSON format.
        Include 4 specific vocabulary words related to the theme '${theme}' and 3 quiz questions.
        Also include a 'scenarioPrompt' for a 5-second video illustrating these words in the ${theme} context.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            scenarioPrompt: { type: Type.STRING },
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
          required: ["title", "slides", "quizzes", "scenarioPrompt"]
        }
      }
    });

    const lessonData = JSON.parse(response.text || '{}');
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      title: lessonData.title || `${theme} Lesson`,
      scenarioPrompt: lessonData.scenarioPrompt || `Learning ${theme} basics`,
      slides: (lessonData.slides || []).map((s: any, i: number) => ({ ...s, id: `slide-${i}` })),
      quizzes: (lessonData.quizzes || []).map((q: any, i: number) => ({ ...q, id: `quiz-${i}` }))
    };
  } catch (error: any) {
    if (isKeyError(error)) {
      throw new Error("KEY_RESET_REQUIRED");
    }
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

export const generateLessonVideo = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Animated educational clip: ${prompt}. Bright, colorful, simple characters.`,
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
    });
    
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    
    if (!videoResponse.ok) {
      if (videoResponse.status === 403 || videoResponse.status === 401) throw new Error("KEY_RESET_REQUIRED");
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }

    const blob = await videoResponse.blob();
    return URL.createObjectURL(blob);
  } catch (error: any) {
    if (isKeyError(error)) throw new Error("KEY_RESET_REQUIRED");
    throw error;
  }
};
