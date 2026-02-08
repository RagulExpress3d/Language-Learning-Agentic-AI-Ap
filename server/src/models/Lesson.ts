import mongoose, { Schema, Document } from 'mongoose';

export interface ILesson extends Document {
  userId: mongoose.Types.ObjectId;
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
  completed: boolean;
  score?: number;
  timeSpent?: number; // in seconds
  createdAt: Date;
  completedAt?: Date;
}

const LessonSchema = new Schema<ILesson>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  language: {
    type: String,
    required: true,
    index: true
  },
  theme: {
    type: String,
    required: true
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  slides: [{
    word: { type: String, required: true },
    translation: { type: String, required: true },
    phonetic: { type: String, required: true },
    exampleSentence: { type: String, required: true },
    visualPrompt: { type: String, required: true },
    imageUrl: { type: String }
  }],
  quizzes: [{
    type: { type: String, required: true },
    question: { type: String, required: true },
    options: [{ type: String }],
    correctAnswer: { type: String, required: true }
  }],
  completed: {
    type: Boolean,
    default: false
  },
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  timeSpent: {
    type: Number,
    min: 0
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
LessonSchema.index({ userId: 1, createdAt: -1 });
LessonSchema.index({ userId: 1, language: 1, completed: 1 });
LessonSchema.index({ language: 1, level: 1 });

export const Lesson = mongoose.model<ILesson>('Lesson', LessonSchema);
