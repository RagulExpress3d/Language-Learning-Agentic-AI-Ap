/**
 * Shared safety config: allowlists, blocklists, and limits.
 * Loaded at startup; all checks are sync in-memory to avoid adding latency.
 */

/** Allowed languages for Live tutor and TTS (allowlist). */
export const ALLOWED_LANGUAGES = new Set([
  'Spanish', 'French', 'Japanese', 'German', 'Italian', 'Chinese', 'Hindi', 'Tamil', 'English',
]);

/** Max character length for TTS input text. */
export const TTS_MAX_TEXT_LENGTH = 500;

/** Max character length for Live context (word/phrase). */
export const CONTEXT_MAX_LENGTH = 100;

/**
 * Terms to strip or replace in image prompts (sanitizeImagePrompt).
 * Lowercase; matching is case-insensitive.
 */
export const IMAGE_PROMPT_BLOCKLIST: string[] = [
  'violence', 'weapon', 'gun', 'blood', 'gore',
  'adult', 'nude', 'explicit', 'sexual',
  'brand', 'trademark', 'logo', 'copyright',
  'drug', 'alcohol', 'cigarette',
];

/**
 * Words or phrases to filter from lesson vocabulary (word/translation).
 * Slides matching these (case-insensitive) are filtered before save.
 */
export const VOCABULARY_BLOCKLIST: string[] = [
  // Extend as needed for age-appropriateness and content policy
];
