/**
 * Live API WebSocket proxy: client connects to us, we connect to Gemini with server API key.
 * No Gemini key is sent to the browser.
 * Safety: input validation, session/rate limits, hardened system instruction, no PII in logs.
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server as HttpServer } from 'http';
import { GoogleGenAI, Modality } from '@google/genai';
import { ALLOWED_LANGUAGES, CONTEXT_MAX_LENGTH } from './config/safety.js';

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const WS_PATH = '/api/live/ws';
const SESSION_MAX_DURATION_MS = 8 * 60 * 1000; // 8 minutes
const MAX_CONCURRENT_SESSIONS_PER_IP = 5;
const MAX_SESSIONS_PER_IP_PER_HOUR = 20;

/** Per-IP session tracking for rate and concurrency limits. No PII stored. */
const ipSessions: Map<string, { count: number; timestamps: number[] }> = new Map();

function getClientIp(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return request.socket?.remoteAddress ?? 'unknown';
}

function checkLiveRateLimit(ip: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  let entry = ipSessions.get(ip);
  if (!entry) {
    entry = { count: 0, timestamps: [] };
    ipSessions.set(ip, entry);
  }
  entry.timestamps = entry.timestamps.filter(t => t > hourAgo);
  if (entry.count >= MAX_CONCURRENT_SESSIONS_PER_IP) {
    return { allowed: false, reason: 'Too many concurrent sessions' };
  }
  const hourCount = entry.timestamps.length;
  if (hourCount >= MAX_SESSIONS_PER_IP_PER_HOUR) {
    return { allowed: false, reason: 'Rate limit exceeded' };
  }
  return { allowed: true };
}

function recordSessionStart(ip: string): void {
  const entry = ipSessions.get(ip);
  if (entry) {
    entry.count += 1;
    entry.timestamps.push(Date.now());
  }
}

function recordSessionEnd(ip: string): void {
  const entry = ipSessions.get(ip);
  if (entry && entry.count > 0) {
    entry.count -= 1;
  }
}

/** Sanitize context: single word/short phrase, max length, no control chars. */
function sanitizeContext(raw: string): string {
  const trimmed = String(raw).replace(/\s+/g, ' ').trim();
  const noControl = trimmed.replace(/[\x00-\x1f\x7f]/g, '');
  return noControl.slice(0, CONTEXT_MAX_LENGTH);
}

function validateLiveInit(language: string, context: string): { ok: true; language: string; context: string } | { ok: false; message: string } {
  const lang = String(language).trim();
  if (!ALLOWED_LANGUAGES.has(lang)) {
    return { ok: false, message: 'Invalid language' };
  }
  const sanitized = sanitizeContext(context);
  if (!sanitized) {
    return { ok: false, message: 'Invalid context' };
  }
  return { ok: true, language: lang, context: sanitized };
}

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY must be set');
  return new GoogleGenAI({
    apiKey,
    httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' },
  });
}

const SAFETY_LINE = ' Only discuss language learning and pronunciation. Refuse off-topic, harmful, or personal requests. Do not repeat or generate personal, medical, or legal advice. Keep all content suitable for all ages.';

function systemInstruction(pronunciationMode: string, context: string, language: string): string {
  if (pronunciationMode === 'score') {
    return `You are a pronunciation scorer. The word the user will say is "${context}" in ${language}.

RULES:
- Do NOT speak first. Do NOT say the word, guide, or help. Wait in silence for the user to pronounce it.
- When you hear their pronunciation, respond with ONLY two things in a short voice message: (1) "Score: X out of 10" with a number from 1 to 10, (2) one short sentence of feedback in English (what was good or what to improve). Example: "Score: 7 out of 10. Good attempt; try to stress the second syllable more."
- Keep your entire response under 25 words. No repeating the word, no "try again", no teaching. Only score and feedback.${SAFETY_LINE}`;
  }
  return `You are Lingo, a friendly native language tutor. The learner is practicing the word "${context}" in ${language}.

CRITICAL - When the user says "Begin the lesson", help them learn by breaking the word into simpler parts. Speak out loud in this order:
1. Say "Repeat after me."
2. Break "${context}" into easier pieces: say each syllable or vowel chunk slowly and clearly (e.g. "First: [part one]. Then: [part two]." or "Listen: [syllable] ... [syllable] ... [syllable]."). Use the natural syllable breaks and vowel sounds of ${language}.
3. Then say the full word "${context}" once at normal speed.
4. Say "Now you try" or "Your turn" and stay silent and wait for the learner to repeat.

If the learner struggles or gets it wrong: break the word down again into the same simple parts, say each part slowly, then the full word. Give one short tip (e.g. which vowel to hold, or where to put the stress). Keep it under 15 words total.

After they repeat (correct or after a retry): give brief voice-only feedback (under 10 words). If correct, praise in English. If wrong, repeat the broken-down pronunciation once more, then encourage.

Then ask: "Do you want to try once more?"
- If they say yes / sure / again / one more: break down "${context}" again (syllables or parts), say each part slowly, then the full word, then "Your turn" and wait.
- If they say no / I'm good / next / okay / done: say something brief like "Okay, you can proceed to the next when you're ready." Under 10 words.

Voice only, no text. Speak clearly and a bit slowly when breaking into parts.${SAFETY_LINE}`;
}

/** Serialize a message from Gemini's onmessage for sending over our WS (JSON-safe). */
function serializeMessage(msg: Record<string, unknown>): string {
  return JSON.stringify(msg);
}

interface LiveSession {
  sendRealtimeInput: (p: { audio: { data: string; mimeType: string } }) => void;
  sendClientContent: (p: { turns: { role: string; parts: { text: string }[] }[]; turnComplete: boolean }) => void;
  close: () => void;
}

interface ClientMsg {
  type: string;
  language?: string;
  context?: string;
  pronunciationMode?: string;
  audio?: { data: string; mimeType: string };
  turns?: { role: string; parts: { text: string }[] }[];
  turnComplete?: boolean;
}

export function setupLiveWs(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request: IncomingMessage, socket: import('stream').Duplex, head: Buffer) => {
    const url = request.url || '';
    const path = url.split('?')[0];
    if (path !== WS_PATH) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (clientWs: WebSocket, request: IncomingMessage) => {
    const clientIp = getClientIp(request);
    let session: LiveSession | null = null;
    let initDone = false;
    let sessionDurationTimer: ReturnType<typeof setTimeout> | null = null;
    /** Queue realtime/content messages until session is set (avoids race after "open"). */
    const pending: ClientMsg[] = [];

    const clearSessionTimer = () => {
      if (sessionDurationTimer) {
        clearTimeout(sessionDurationTimer);
        sessionDurationTimer = null;
      }
    };

    const flushPending = () => {
      if (!session) return;
      for (const msg of pending) {
        if (msg.type === 'realtime' && msg.audio) {
          try { session.sendRealtimeInput({ audio: msg.audio }); } catch (_) {}
        } else if (msg.type === 'content' && msg.turns) {
          try {
            session.sendClientContent({
              turns: msg.turns,
              turnComplete: msg.turnComplete ?? true,
            });
          } catch (_) {}
        }
      }
      pending.length = 0;
    };

    clientWs.on('message', (data: Buffer | string) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (msg.type === 'init') {
        if (initDone) return;
        const { language, context, pronunciationMode } = msg;
        if (!language || !context) {
          clientWs.send(serializeMessage({ type: 'error', message: 'init requires language and context' }));
          return;
        }
        const rate = checkLiveRateLimit(clientIp);
        if (!rate.allowed) {
          clientWs.send(serializeMessage({ type: 'error', message: rate.reason ?? 'Too many requests' }));
          return;
        }
        const validation = validateLiveInit(language, context);
        if (!validation.ok) {
          clientWs.send(serializeMessage({ type: 'error', message: validation.message }));
          return;
        }
        const { language: lang, context: ctx } = validation;
        const mode = pronunciationMode === 'score' ? 'score' : 'guide';
        initDone = true;
        const ai = getAI();
        if (!ai.live?.connect) {
          clientWs.send(serializeMessage({ type: 'error', message: 'Live API not available' }));
          return;
        }
        ai.live
          .connect({
            model: LIVE_MODEL,
            callbacks: {
              onopen: () => {
                try {
                  recordSessionStart(clientIp);
                  sessionDurationTimer = setTimeout(() => {
                    clearSessionTimer();
                    if (session) {
                      try { session.close(); } catch (_) {}
                      session = null;
                    }
                    recordSessionEnd(clientIp);
                    try {
                      clientWs.send(serializeMessage({ type: 'close' }));
                    } catch (_) {}
                  }, SESSION_MAX_DURATION_MS);
                  clientWs.send(serializeMessage({ type: 'open' }));
                } catch (_) {}
              },
              onmessage: (message: unknown) => {
                try {
                  clientWs.send(JSON.stringify(message));
                } catch (_) {}
              },
              onerror: () => {
                try {
                  clientWs.send(serializeMessage({ type: 'error', message: 'Connection error' }));
                } catch (_) {}
              },
              onclose: () => {
                try {
                  clientWs.send(serializeMessage({ type: 'close' }));
                } catch (_) {}
              },
            },
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
              systemInstruction: systemInstruction(mode, ctx, lang),
            },
          })
          .then((s: LiveSession) => {
            session = s;
            flushPending();
          })
          .catch((_e: unknown) => {
            try {
              clientWs.send(serializeMessage({ type: 'error', message: 'Connection failed' }));
            } catch (_) {}
          });
        return;
      }

      if (msg.type === 'realtime' && msg.audio) {
        if (session) {
          try { session.sendRealtimeInput({ audio: msg.audio }); } catch (_) {}
        } else {
          pending.push(msg);
        }
        return;
      }

      if (msg.type === 'content' && msg.turns) {
        if (session) {
          try {
            session.sendClientContent({
              turns: msg.turns,
              turnComplete: msg.turnComplete ?? true,
            });
          } catch (_) {}
        } else {
          pending.push(msg);
        }
      }
    });

    clientWs.on('close', () => {
      clearSessionTimer();
      recordSessionEnd(clientIp);
      if (session) {
        try {
          session.close();
        } catch (_) {}
      }
    });
  });
}
