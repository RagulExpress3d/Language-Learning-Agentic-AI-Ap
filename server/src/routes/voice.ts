import { Router } from 'express';
import { ALLOWED_LANGUAGES, TTS_MAX_TEXT_LENGTH } from '../config/safety.js';
import { generateTTS, scorePronunciation } from '../services/geminiService.js';

const router = Router();

/** Sanitize TTS text: strip control chars, enforce max length. Sync, in-memory. */
function sanitizeTTSText(raw: string): string {
  const s = String(raw).replace(/[\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim();
  return s.slice(0, TTS_MAX_TEXT_LENGTH);
}

/** Validate TTS input. Returns error message or null if valid. */
function validateTTSInput(text: string, language: string): string | null {
  const lang = String(language).trim();
  if (!ALLOWED_LANGUAGES.has(lang)) return 'Invalid language';
  const sanitized = sanitizeTTSText(text);
  if (!sanitized) return 'Invalid or empty text';
  if (String(text).length > TTS_MAX_TEXT_LENGTH) return 'Text exceeds maximum length';
  return null;
}

/** POST /api/tts – TTS via backend (no client API key). Body: { text: string, language: string }. Returns { audio: base64 }. */
router.post('/tts', async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text || !language) {
      res.status(400).json({ error: 'text and language required' });
      return;
    }
    const err = validateTTSInput(String(text), String(language));
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    const sanitizedText = sanitizeTTSText(String(text));
    const lang = String(language).trim();
    const audio = await generateTTS(sanitizedText, lang);
    res.json({ audio });
  } catch (e: any) {
    console.error('TTS route error:', e);
    res.status(500).json({ error: e?.message || 'TTS failed' });
  }
});

/** POST /api/pronunciation/score – Pronunciation score via backend. Body: { spokenText, targetText, language }. Returns { score, feedback, accuracy }. */
router.post('/pronunciation/score', async (req, res) => {
  try {
    const { spokenText, targetText, language } = req.body;
    if (spokenText == null || targetText == null || !language) {
      res.status(400).json({ error: 'spokenText, targetText and language required' });
      return;
    }
    const lang = String(language).trim();
    if (!ALLOWED_LANGUAGES.has(lang)) {
      res.status(400).json({ error: 'Invalid language' });
      return;
    }
    const result = await scorePronunciation(
      String(spokenText),
      String(targetText),
      lang
    );
    res.json(result);
  } catch (e: any) {
    console.error('Pronunciation score route error:', e);
    res.status(500).json({ error: e?.message || 'Score failed' });
  }
});

export default router;
