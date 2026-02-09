/**
 * Live API WebSocket proxy: client connects to us, we connect to Gemini with server API key.
 * No Gemini key is sent to the browser.
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server as HttpServer } from 'http';
import { GoogleGenAI, Modality } from '@google/genai';

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const WS_PATH = '/api/live/ws';

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY must be set');
  return new GoogleGenAI({
    apiKey,
    httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' },
  });
}

function systemInstruction(pronunciationMode: string, context: string, language: string): string {
  if (pronunciationMode === 'score') {
    return `You are a pronunciation scorer. The word the user will say is "${context}" in ${language}.

RULES:
- Do NOT speak first. Do NOT say the word, guide, or help. Wait in silence for the user to pronounce it.
- When you hear their pronunciation, respond with ONLY two things in a short voice message: (1) "Score: X out of 10" with a number from 1 to 10, (2) one short sentence of feedback in English (what was good or what to improve). Example: "Score: 7 out of 10. Good attempt; try to stress the second syllable more."
- Keep your entire response under 25 words. No repeating the word, no "try again", no teaching. Only score and feedback.`;
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

Voice only, no text. Speak clearly and a bit slowly when breaking into parts.`;
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

  wss.on('connection', (clientWs: WebSocket) => {
    let session: LiveSession | null = null;
    let initDone = false;
    /** Queue realtime/content messages until session is set (avoids race after "open"). */
    const pending: ClientMsg[] = [];

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
        const mode = pronunciationMode || 'guide';
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
                  clientWs.send(serializeMessage({ type: 'open' }));
                } catch (_) {}
              },
              onmessage: (message: unknown) => {
                try {
                  clientWs.send(JSON.stringify(message));
                } catch (_) {}
              },
              onerror: (e: unknown) => {
                const errMsg = e instanceof Error ? e.message : String(e);
                try {
                  clientWs.send(serializeMessage({ type: 'error', message: errMsg }));
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
              systemInstruction: systemInstruction(mode, context, language),
            },
          })
          .then((s: LiveSession) => {
            session = s;
            flushPending();
          })
          .catch((e: unknown) => {
            const errMsg = e instanceof Error ? e.message : String(e);
            try {
              clientWs.send(serializeMessage({ type: 'error', message: errMsg }));
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
      if (session) {
        try {
          session.close();
        } catch (_) {}
      }
    });
  });
}
