import { Router } from 'express';
import { generateTTS, scorePronunciation } from '../services/geminiService.js';

const router = Router();

/** POST /api/tts – TTS via backend (no client API key). Body: { text: string, language: string }. Returns { audio: base64 }. */
router.post('/tts', async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text || !language) {
      res.status(400).json({ error: 'text and language required' });
      return;
    }
    const audio = await generateTTS(String(text), String(language));
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
    const result = await scorePronunciation(
      String(spokenText),
      String(targetText),
      String(language)
    );
    res.json(result);
  } catch (e: any) {
    console.error('Pronunciation score route error:', e);
    res.status(500).json({ error: e?.message || 'Score failed' });
  }
});

export default router;
