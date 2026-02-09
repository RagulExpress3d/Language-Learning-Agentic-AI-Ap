import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  name?: string;
  xp: number;
  hearts: number;
  streak: number;
  currentStreakStart?: Date;
  lastActiveDate?: Date;
  languages: {
    language: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    xp: number;
    lessonsCompleted: number;
    preferredTheme?: string;
    learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
    difficultyAdjustment?: number; // -1 to 1, adjusts lesson difficulty
  }[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    trim: true
  },
  xp: {
    type: Number,
    default: 0
  },
  hearts: {
    type: Number,
    default: 5,
    min: 0,
    max: 5
  },
  streak: {
    type: Number,
    default: 0
  },
  currentStreakStart: {
    type: Date
  },
  lastActiveDate: {
    type: Date,
    default: Date.now
  },
  languages: [{
    language: { type: String, required: true },
    level: { 
      type: String, 
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    xp: { type: Number, default: 0 },
    lessonsCompleted: { type: Number, default: 0 },
    preferredTheme: { type: String },
    learningStyle: { 
      type: String, 
      enum: ['visual', 'auditory', 'kinesthetic', 'mixed'],
      default: 'mixed'
    },
    difficultyAdjustment: { 
      type: Number, 
      default: 0,
      min: -1,
      max: 1
    }
  }]
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Index for faster queries (email already has unique:true index from schema definition)
UserSchema.index({ 'languages.language': 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
