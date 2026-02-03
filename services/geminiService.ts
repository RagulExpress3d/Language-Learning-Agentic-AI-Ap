
import { GoogleGenAI, Type } from "@google/genai";
import { Lesson, Slide, QuizQuestion } from "../types";

const API_KEY = process.env.API_KEY || '';

export const generateLesson = async (language: string, goal: string, level: string): Promise<Lesson> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a structured language lesson for learning ${language}. 
      Goal: ${goal}. Level: ${level}.
      The output MUST be in JSON format.
      Include 4 slides (vocabulary words) and 3 quiz questions based on those slides.
      Also include a 'scenarioPrompt' for a 5-second video illustrating a real-life use case of these words.`,
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
                visualPrompt: { type: Type.STRING, description: "A detailed descriptive prompt for an image generator to illustrate this word." }
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

  const lessonData = JSON.parse(response.text);
  
  // Assign stable IDs
  const lesson: Lesson = {
    id: Math.random().toString(36).substr(2, 9),
    title: lessonData.title,
    scenarioPrompt: lessonData.scenarioPrompt,
    slides: lessonData.slides.map((s: any, i: number) => ({ ...s, id: `slide-${i}` })),
    quizzes: lessonData.quizzes.map((q: any, i: number) => ({ ...q, id: `quiz-${i}` }))
  };

  return lesson;
};

export const generateSlideImage = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `A vibrant, high-quality, flat vector art style illustration of ${prompt}. Clean background, educational style.` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  return `https://picsum.photos/seed/${encodeURIComponent(prompt)}/400/400`;
};

export const generateLessonVideo = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `An educational animation for language learning: ${prompt}. High quality, clear visuals.`,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });
  
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  const videoResponse = await fetch(`${downloadLink}&key=${API_KEY}`);
  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
};
