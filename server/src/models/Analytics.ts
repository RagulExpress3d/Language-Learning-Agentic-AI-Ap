import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalytics extends Document {
  userId: mongoose.Types.ObjectId;
  eventType: 'lesson_started' | 'lesson_completed' | 'quiz_answered' | 'voice_practice' | 'slide_viewed';
  metadata: {
    language?: string;
    lessonId?: string;
    quizId?: string;
    correct?: boolean;
    timeSpent?: number;
    difficulty?: string;
    [key: string]: any;
  };
  timestamp: Date;
}

const AnalyticsSchema = new Schema<IAnalytics>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: ['lesson_started', 'lesson_completed', 'quiz_answered', 'voice_practice', 'slide_viewed'],
    required: true,
    index: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for analytics queries
AnalyticsSchema.index({ userId: 1, timestamp: -1 });
AnalyticsSchema.index({ eventType: 1, timestamp: -1 });
AnalyticsSchema.index({ 'metadata.language': 1 });

export const Analytics = mongoose.model<IAnalytics>('Analytics', AnalyticsSchema);
