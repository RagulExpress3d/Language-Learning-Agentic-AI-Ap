import { GoogleGenAI, Type, Modality } from "@google/genai";

// Lazy initialization to ensure env vars are loaded
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY must be set in environment variables');
  }
  return new GoogleGenAI({ apiKey });
};

export interface LessonData {
  title: string;
  slides: {
    word: string;
    translation: string;
    phonetic: string;
    exampleSentence: string;
    visualPrompt: string;
  }[];
  quizzes: {
    type: string;
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
}

export const generateLesson = async (
  language: string,
  theme: string,
  goal: string,
  level: string
): Promise<LessonData> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a language lesson for an English speaker learning ${language}. 
        Theme: ${theme}. User Goal: ${goal}. Proficiency Level: ${level}.
        
        STRICT RULES:
        1. 'title' and ALL quiz 'question' fields MUST be in English.
        2. Slide 'word' and 'exampleSentence' MUST be in ${language}.
        3. Quiz 'options' and 'correctAnswer' must be English meanings or translations.
        4. Output strictly valid JSON.
        5. Include 5-7 slides with vocabulary words relevant to the theme.
        6. Include 3-5 quiz questions testing comprehension.`,
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
      title: lessonData.title || `${theme} Lesson`,
      slides: lessonData.slides || [],
      quizzes: lessonData.quizzes || []
    };
  } catch (error: any) {
    console.error('Lesson generation error:', error);
    throw new Error(`Failed to generate lesson: ${error.message}`);
  }
};

export const generateSlideImage = async (prompt: string): Promise<string> => {
  try {
    const ai = getAI();
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
    console.error('Image generation error:', error);
    return `https://picsum.photos/seed/${encodeURIComponent(prompt)}/400/400`;
  }
};

export const generateTTS = async (text: string, language: string): Promise<string> => {
  try {
    const ai = getAI();
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
      throw new Error("No audio data returned from TTS");
    }
    return base64Audio;
  } catch (error: any) {
    console.error('TTS generation error:', error);
    throw new Error(`Failed to generate TTS: ${error.message}`);
  }
};

export const scorePronunciation = async (
  spokenText: string,
  targetText: string,
  language: string
): Promise<{ score: number; feedback: string; accuracy: number }> => {
  try {
    const ai = getAI();
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
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            accuracy: { type: Type.NUMBER },
          },
          required: ["score", "feedback", "accuracy"],
        },
      },
    });

    const text = response.text || '{"score": 50, "feedback": "Keep practicing", "accuracy": 0.5}';
    return JSON.parse(text);
  } catch (error: any) {
    console.error('Pronunciation scoring error:', error);
    return { score: 50, feedback: "Could not analyze pronunciation", accuracy: 0.5 };
  }
};
