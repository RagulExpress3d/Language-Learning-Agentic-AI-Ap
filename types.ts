
export interface Slide {
  id: string;
  word: string;
  translation: string;
  phonetic: string;
  exampleSentence: string;
  visualPrompt: string;
  imageUrl?: string;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'translate' | 'image-match';
  question: string;
  options: string[];
  correctAnswer: string;
  imageWord?: string;
  imageUrl?: string;
}

export interface Lesson {
  id: string;
  title: string;
  slides: Slide[];
  quizzes: QuizQuestion[];
}

export interface UserState {
  xp: number;
  hearts: number;
  streak: number;
  language: string;
  goal: string;
  theme: string;
  level: 'beginner' | 'intermediate' | 'advanced';
}

export enum ViewState {
  HOME,
  ONBOARDING,
  LOADING,
  LESSON,
  QUIZ,
  VOICE_QUIZ,
  SUMMARY
}
