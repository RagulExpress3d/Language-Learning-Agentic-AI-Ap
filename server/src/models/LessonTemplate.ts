import mongoose, { Schema, Document } from 'mongoose';

/** Reusable lesson by language + theme + level. No userId. */
export interface ILessonTemplate extends Document {
  language: string;
  theme: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  title: string;
  slides: {
    word: string;
    translation: string;
    phonetic: string;
    exampleSentence: string;
    visualPrompt: string;
    imageUrl?: string;
  }[];
  quizzes: {
    type: string;
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const LessonTemplateSchema = new Schema<ILessonTemplate>(
  {
    language: { type: String, required: true, index: true },
    theme: { type: String, required: true, index: true },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    slides: [{
      word: { type: String, required: true },
      translation: { type: String, required: true },
      phonetic: { type: String, required: true },
      exampleSentence: { type: String, required: true },
      visualPrompt: { type: String, required: true },
      imageUrl: { type: String },
    }],
    quizzes: [{
      type: { type: String, required: true },
      question: { type: String, required: true },
      options: [{ type: String }],
      correctAnswer: { type: String, required: true },
    }],
  },
  { timestamps: true }
);

LessonTemplateSchema.index({ language: 1, theme: 1, level: 1 }, { unique: true });

export const LessonTemplate = mongoose.model<ILessonTemplate>('LessonTemplate', LessonTemplateSchema);
