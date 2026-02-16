/**
 * Sync, in-memory vocabulary filter and slide structure validation. No extra network.
 */

import { VOCABULARY_BLOCKLIST } from '../config/safety.js';

export interface SlideItem {
  word: string;
  translation: string;
  phonetic: string;
  exampleSentence: string;
  visualPrompt: string;
}

export interface LessonDataWithSlides {
  title: string;
  slides: SlideItem[];
  quizzes: unknown[];
}

const blocklistLower = new Set(VOCABULARY_BLOCKLIST.map((t) => t.toLowerCase()));

/** Exported for eval scripts: check if text matches vocabulary blocklist. */
export function matchesVocabularyBlocklist(text: string): boolean {
  return matchesBlocklist(text);
}

function matchesBlocklist(text: string): boolean {
  const lower = String(text).trim().toLowerCase();
  if (!lower) return false;
  for (const term of blocklistLower) {
    if (lower.includes(term) || term.includes(lower)) return true;
  }
  return false;
}

function isSlideValid(slide: unknown): slide is SlideItem {
  if (!slide || typeof slide !== 'object') return false;
  const s = slide as Record<string, unknown>;
  return (
    typeof s.word === 'string' && String(s.word).trim() !== '' &&
    typeof s.translation === 'string' && String(s.translation).trim() !== '' &&
    typeof s.phonetic === 'string' && String(s.phonetic).trim() !== '' &&
    typeof s.exampleSentence === 'string' && String(s.exampleSentence).trim() !== '' &&
    typeof s.visualPrompt === 'string' && String(s.visualPrompt).trim() !== ''
  );
}

/**
 * Keeps only slides with valid structure (non-empty word, translation, phonetic, exampleSentence, visualPrompt),
 * then filters out slides whose word or translation matches the vocabulary blocklist.
 * If blocklist would remove all slides, keeps structure-valid slides only. Mutates lessonData.slides in place.
 */
export function filterAndValidateSlides(lessonData: LessonDataWithSlides): void {
  if (!lessonData.slides || !Array.isArray(lessonData.slides)) return;

  const validStructure = lessonData.slides.filter((s): s is SlideItem => isSlideValid(s));
  const blocklistFiltered = validStructure.filter(
    (s) => !matchesBlocklist(s.word) && !matchesBlocklist(s.translation)
  );
  lessonData.slides = blocklistFiltered.length > 0 ? blocklistFiltered : validStructure;
}
