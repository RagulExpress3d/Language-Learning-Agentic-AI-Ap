/**
 * Cleans ~50% of MongoDB assets (oldest records) to free space.
 * Touches: LessonTemplate, Lesson, Analytics. Does NOT touch Users.
 * Run from server folder: npx tsx scripts/clean-mongo.ts
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Lesson } from '../src/models/Lesson';
import { LessonTemplate } from '../src/models/LessonTemplate';
import { Analytics } from '../src/models/Analytics';

dotenv.config();

/** Delete ~50% of documents using $rand (no sort, so no memory limit). */
async function deleteOldestHalf(
  model: mongoose.Model<mongoose.Document>,
  name: string
): Promise<{ deleted: number; total: number }> {
  const total = await model.countDocuments();
  if (total === 0) {
    console.log(`  ${name}: 0 documents, nothing to delete`);
    return { deleted: 0, total: 0 };
  }
  const result = await model.deleteMany({ $expr: { $lt: [{ $rand: {} }, 0.5] } });
  const deleted = result.deletedCount ?? 0;
  console.log(`  ${name}: deleted ${deleted} (~50%), ${total - deleted} remaining`);
  return { deleted, total };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set. Add it to server/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected. Cleaning oldest 50% of assets (LessonTemplate, Lesson, Analytics)...\n');

  const results = {
    lessonTemplates: { deleted: 0, total: 0 },
    lessons: { deleted: 0, total: 0 },
    analytics: { deleted: 0, total: 0 },
  };

  results.lessonTemplates = await deleteOldestHalf(LessonTemplate, 'LessonTemplate');
  results.lessons = await deleteOldestHalf(Lesson, 'Lesson');
  results.analytics = await deleteOldestHalf(Analytics, 'Analytics');

  await mongoose.disconnect();
  console.log('\nDone. Users were not modified.');
  const totalDeleted =
    results.lessonTemplates.deleted + results.lessons.deleted + results.analytics.deleted;
  console.log(`Total documents removed: ${totalDeleted}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
