/**
 * Optional TTS evaluation: golden (text, language) list; call TTS and record latency/success.
 * Run from server folder: npx tsx scripts/eval-tts.ts
 * Offline only; zero impact on request latency.
 */
import dotenv from 'dotenv';
import { generateTTS } from '../src/services/geminiService';

dotenv.config();

const GOLDEN_SAMPLES: { text: string; language: string }[] = [
  { text: 'Hello', language: 'English' },
  { text: 'Hola', language: 'Spanish' },
  { text: 'Bonjour', language: 'French' },
];

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not set. Add it to server/.env');
    process.exit(1);
  }

  console.log('--- TTS evaluation (golden samples) ---');
  let success = 0;
  let fail = 0;
  const latencies: number[] = [];

  for (const { text, language } of GOLDEN_SAMPLES) {
    const start = Date.now();
    try {
      await generateTTS(text, language);
      const ms = Date.now() - start;
      latencies.push(ms);
      success++;
      console.log(`  OK "${text}" (${language}): ${ms}ms`);
    } catch (e) {
      fail++;
      console.log(`  FAIL "${text}" (${language}): ${(e as Error).message}`);
    }
  }

  const total = success + fail;
  const avgMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  console.log('-------------------------------------');
  console.log(`Success: ${success}/${total}, Failed: ${fail}`);
  console.log(`Avg latency: ${avgMs.toFixed(0)}ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
