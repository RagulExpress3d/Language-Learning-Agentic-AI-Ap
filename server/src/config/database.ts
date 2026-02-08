import mongoose from 'mongoose';

let dbReadyResolve: () => void;
let dbReadyReject: (err: Error) => void;
/** Resolves when MongoDB is connected; reject on failure. Await before DB operations. */
export const dbReady = new Promise<void>((resolve, reject) => {
  dbReadyResolve = resolve;
  dbReadyReject = reject;
});

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lingoagent';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected');
    dbReadyResolve();
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    dbReadyReject(error as Error);
    throw error;
  }
};
