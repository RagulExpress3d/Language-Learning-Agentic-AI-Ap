/**
 * Evaluation script: sample lesson templates, run quiz validation, vocabulary check, image prompt check.
 * Outputs summary (e.g. % valid quizzes, % safe vocabulary, % prompts passing blocklist).
 * Run from server folder: npx tsx scripts/eval-lessons.ts
 * Off the hot path; zero impact on request latency.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { LessonTemplate } from '../src/models/LessonTemplate';
import { getQuizValidationSummary } from '../src/utils/quizValidation';
import { matchesVocabularyBlocklist } from '../src/utils/vocabularyGuardrails';
import { IMAGE_PROMPT_BLOCKLIST } from '../src/config/safety';

dotenv.config();

const SAMPLE_SIZE = 50;

function imagePromptPassesBlocklist(prompt: string): boolean {
  const lower = String(prompt || '').toLowerCase();
  for (const term of IMAGE_PROMPT_BLOCKLIST) {
    if (lower.includes(term.toLowerCase())) return false;
  }
  return true;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set. Add it to server/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);

  // Avoid sort to prevent "Sort exceeded memory limit" on Atlas / limited memory; sample any N templates.
  const templates = await LessonTemplate.find({}).limit(SAMPLE_SIZE).lean();

  let quizValidTotal = 0;
  let quizTotal = 0;
  let vocabSafeTemplates = 0;
  let imagePromptsPassTotal = 0;
  let imagePromptsTotal = 0;

  for (const t of templates) {
    const slides = (t as any).slides || [];
    const quizzes = (t as any).quizzes || [];

    const qSummary = getQuizValidationSummary(quizzes);
    quizValidTotal += qSummary.validCount;
    quizTotal += qSummary.totalCount;

    let vocabSafe = true;
    for (const s of slides) {
      if (!s) continue;
      if (matchesVocabularyBlocklist(s.word || '') || matchesVocabularyBlocklist(s.translation || '')) {
        vocabSafe = false;
        break;
      }
    }
    if (vocabSafe && slides.length > 0) vocabSafeTemplates++;

    for (const s of slides) {
      const prompt = s?.visualPrompt || '';
      imagePromptsTotal++;
      if (imagePromptPassesBlocklist(prompt)) imagePromptsPassTotal++;
    }
  }

  await mongoose.disconnect();

  const templateCount = templates.length;
  const pctQuizzes = quizTotal > 0 ? ((quizValidTotal / quizTotal) * 100).toFixed(1) : 'N/A';
  const pctVocab = templateCount > 0 ? ((vocabSafeTemplates / templateCount) * 100).toFixed(1) : 'N/A';
  const pctImage = imagePromptsTotal > 0 ? ((imagePromptsPassTotal / imagePromptsTotal) * 100).toFixed(1) : 'N/A';

  console.log('--- Lesson evaluation summary ---');
  console.log(`Templates sampled: ${templateCount}`);
  console.log(`Quiz validation: ${quizValidTotal}/${quizTotal} valid (${pctQuizzes}%)`);
  console.log(`Vocabulary safe (no blocklist match): ${vocabSafeTemplates}/${templateCount} templates (${pctVocab}%)`);
  console.log(`Image prompts passing blocklist: ${imagePromptsPassTotal}/${imagePromptsTotal} (${pctImage}%)`);
  console.log('---------------------------------');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
