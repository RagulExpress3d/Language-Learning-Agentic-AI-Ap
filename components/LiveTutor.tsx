/**
 * Live Tutor – real-time voice practice via Gemini Live API.
 * See CONVERSATIONAL_AI_STANDARDS.md for alignment with Google’s Live API docs.
 */
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import React, { useEffect, useRef, useState } from 'react';
import { isKeyError } from '../services/geminiService';
import { apiService } from '../services/api';

const getApiKey = () =>
  import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' && process.env?.API_KEY) || '';

/** Session-like adapter for backend Live proxy (no client API key). */
type SessionLike = {
  sendRealtimeInput: (p: { audio: { data: string; mimeType: string } }) => void;
  sendClientContent: (p: { turns: { role: string; parts: { text: string }[] }[]; turnComplete: boolean }) => void;
  close: () => void;
};

export type TranscriptEntry = { role: 'tutor' | 'user'; text: string };

/** 'guide' = speak first, break down word, help user. 'score' = listen only, then give score + feedback (no guiding). */
export type PronunciationMode = 'guide' | 'score';

interface LiveTutorProps {
  language: string;
  context: string;
  active: boolean;
  /** In quiz pronunciation: use 'score' so AI only listens and gives score/feedback. Default 'guide'. */
  pronunciationMode?: PronunciationMode;
  onKeyError?: () => void;
  onStatusChange?: (status: 'connecting' | 'listening' | 'speaking' | 'idle') => void;
  onTranscriptEntry?: (entry: TranscriptEntry) => void;
  lessonId?: string;
}

export const LiveTutor: React.FC<LiveTutorProps> = ({ 
  language, 
  context, 
  active, 
  pronunciationMode = 'guide',
  onKeyError,
  onStatusChange,
  onTranscriptEntry,
  lessonId
}) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('idle');
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  /** Start mic only after model has spoken first (so AI speaks before user) */
  const micStartedRef = useRef(false);
  /** Set to true in cleanup so onopen/onmessage skip work after teardown (avoids closed AudioContext use) */
  const cancelledRef = useRef(false);
  const onKeyErrorRef = useRef(onKeyError);
  const onStatusChangeRef = useRef(onStatusChange);
  const onTranscriptEntryRef = useRef(onTranscriptEntry);
  onKeyErrorRef.current = onKeyError;
  onStatusChangeRef.current = onStatusChange;
  onTranscriptEntryRef.current = onTranscriptEntry;

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  };

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const createBlob = (data: Float32Array) => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i])) * 32768;
      int16[i] = Math.max(-32768, Math.min(32767, Math.round(s)));
    }
    return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
  };

  const updateStatus = (newStatus: 'connecting' | 'listening' | 'speaking' | 'idle') => {
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  };

  useEffect(() => {
    if (!active) {
      cancelledRef.current = true;
      if (sessionRef.current) {
        sessionRef.current.then((s: any) => {
          try { s.close(); } catch (e) {}
        }).catch(() => {});
        sessionRef.current = null;
      }
      updateStatus('idle');
      return;
    }

    cancelledRef.current = false;

    // Prevent overlapping connections (e.g. React Strict Mode double-mount)
    if (sessionRef.current) {
      console.log('LiveTutor: skipping connect (session already in progress)');
      return;
    }

    const apiKey = getApiKey();
    let micStream: MediaStream | undefined;
    let inputAudioCtx: AudioContext;
    let outputAudioCtx: AudioContext;

    try {
      inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    } catch (e) {
      console.error('LiveTutor: AudioContext failed', e);
      updateStatus('idle');
      return;
    }

    audioContextRef.current = outputAudioCtx;
    outputAudioCtx.resume().catch(() => {});

    let sessionPromise: Promise<SessionLike | any>;
    const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

    // Proxy path: no client API key — use backend WebSocket (key stays on server).
    if (!apiKey) {
      console.log('LiveTutor: using backend proxy (no client key)');
      updateStatus('connecting');
      const wsUrl = apiService.getLiveWsUrl();
      const ws = new WebSocket(wsUrl);
      const adapter: SessionLike = {
        sendRealtimeInput: (p) => { try { ws.send(JSON.stringify({ type: 'realtime', audio: p.audio })); } catch (_) {} },
        sendClientContent: (p) => { try { ws.send(JSON.stringify({ type: 'content', turns: p.turns, turnComplete: p.turnComplete })); } catch (_) {} },
        close: () => { try { ws.close(); } catch (_) {} },
      };
      const handleServerMessage = (message: LiveServerMessage, getSession: () => Promise<SessionLike | any>) => {
        if (cancelledRef.current) return;
        if (message.setupComplete !== undefined) {
          getSession().then(s => {
            if (cancelledRef.current || !s?.sendClientContent) return;
            if (pronunciationMode === 'score') {
              s.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: `I am about to pronounce the word "${context}" in ${language}. Do not speak. Wait until you hear me say it. Then respond with ONLY: (1) "Score: X out of 10" with a number, (2) one short sentence of feedback in English. Do not guide, repeat the word, or help.` }] }],
                turnComplete: true,
              });
            } else {
              s.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: `Begin the lesson. Break the word "${context}" into simpler syllables or vowel parts in ${language}. Say "Repeat after me", then say each part slowly, then the full word, then "Your turn" and wait for me to repeat.` }] }],
                turnComplete: true,
              });
            }
          }).catch(() => {});
        }
        const parts = (message.serverContent as any)?.modelTurn?.parts ?? [];
        const audioPartCount = parts.filter((p: any) => p.inlineData?.data).length;
        if (audioPartCount > 0 && !micStartedRef.current) {
          micStartedRef.current = true;
          (async () => {
            if (cancelledRef.current || inputAudioCtx.state === 'closed') return;
            try {
              if (!micStream) {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (cancelledRef.current) { micStream!.getTracks().forEach(t => t.stop()); return; }
              }
              const source = inputAudioCtx.createMediaStreamSource(micStream!);
              const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e: AudioProcessingEvent) => {
                adapter.sendRealtimeInput({ audio: createBlob(e.inputBuffer.getChannelData(0)) });
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputAudioCtx.destination);
              updateStatus('listening');
              apiService.trackEvent('voice_practice', { language, context, lessonId }).catch(() => {});
              const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
              if (SpeechRecognitionAPI && !cancelledRef.current) {
                try {
                  const recognition = new SpeechRecognitionAPI();
                  recognition.continuous = true;
                  recognition.interimResults = true;
                  recognition.lang = language === 'Spanish' ? 'es-ES' : language === 'French' ? 'fr-FR' : language === 'Japanese' ? 'ja-JP' : language === 'German' ? 'de-DE' : language === 'Italian' ? 'it-IT' : language === 'Chinese' ? 'zh-CN' : language === 'Hindi' ? 'hi-IN' : language === 'Tamil' ? 'ta-IN' : 'en-US';
                  recognition.onresult = (e: SpeechRecognitionEvent) => {
                    if (cancelledRef.current) return;
                    const last = e.results[e.results.length - 1];
                    if (last.isFinal && last[0]?.transcript?.trim()) {
                      onTranscriptEntryRef.current?.({ role: 'user', text: last[0].transcript.trim() });
                    }
                  };
                  recognition.onerror = () => {};
                  recognition.start();
                  speechRecognitionRef.current = recognition;
                } catch (_) {}
              }
            } catch (e) {
              console.error('LiveTutor: Microphone access failed', e);
              updateStatus('idle');
            }
          })();
        }
        for (const part of parts) {
          const text = (part as { text?: string }).text;
          if (text?.trim()) onTranscriptEntryRef.current?.({ role: 'tutor', text: text.trim() });
          const base64Audio = (part as any).inlineData?.data;
          if (!base64Audio) continue;
          if (cancelledRef.current || outputAudioCtx.state === 'closed') continue;
          updateStatus('speaking');
          decodeAudioData(decode(base64Audio), outputAudioCtx, 24000, 1).then(audioBuffer => {
            if (cancelledRef.current || outputAudioCtx.state === 'closed') return;
            const source = outputAudioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioCtx.destination);
            source.addEventListener('ended', () => {
              sourcesRef.current.delete(source);
              if (sourcesRef.current.size === 0) updateStatus('listening');
            });
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtx.currentTime);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
          }).catch(() => {});
        }
        if ((message.serverContent as any)?.interrupted) {
          for (const s of sourcesRef.current) { try { s.stop(); } catch (e) {} }
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
          updateStatus('listening');
        }
      };

      sessionPromise = new Promise((resolve, reject) => {
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'init', language, context, pronunciationMode }));
        };
        ws.onmessage = (ev: MessageEvent) => {
          if (cancelledRef.current) return;
          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(ev.data as string);
          } catch {
            return;
          }
          if (msg.type === 'open') {
            resolve(adapter);
            updateStatus('connecting');
            (async () => {
              try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (cancelledRef.current) { micStream.getTracks().forEach(t => t.stop()); return; }
                if (pronunciationMode === 'score' && inputAudioCtx.state !== 'closed') {
                  const source = inputAudioCtx.createMediaStreamSource(micStream);
                  const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
                  scriptProcessor.onaudioprocess = (e: AudioProcessingEvent) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    adapter.sendRealtimeInput({ audio: createBlob(inputData) });
                  };
                  source.connect(scriptProcessor);
                  scriptProcessor.connect(inputAudioCtx.destination);
                  micStartedRef.current = true;
                  updateStatus('listening');
                  apiService.trackEvent('voice_practice', { language, context, lessonId }).catch(() => {});
                }
              } catch (e) {
                console.error('LiveTutor: Microphone access failed', e);
                updateStatus('idle');
              }
            })();
            return;
          }
          if (msg.type === 'error') {
            onKeyErrorRef.current?.();
            updateStatus('idle');
            return;
          }
          if (msg.type === 'close') {
            updateStatus('idle');
            return;
          }
          handleServerMessage(msg as LiveServerMessage, () => sessionPromise);
        };
        ws.onerror = () => { updateStatus('idle'); reject(new Error('WebSocket error')); };
        ws.onclose = () => updateStatus('idle');
      });
      sessionRef.current = sessionPromise;
      sessionPromise.catch(() => {});

      return () => {
        cancelledRef.current = true;
        micStartedRef.current = false;
        sessionRef.current = null;
        try { speechRecognitionRef.current?.stop(); } catch (e) {}
        speechRecognitionRef.current = null;
        if (micStream) micStream.getTracks().forEach(t => t.stop());
        try {
          if (inputAudioCtx?.state !== 'closed') inputAudioCtx.close();
          if (outputAudioCtx?.state !== 'closed') outputAudioCtx.close();
        } catch (e) {}
        try { ws.close(); } catch (e) {}
      };
    }

    // Direct path: client has API key (e.g. AI Studio or VITE_GEMINI_API_KEY).
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' },
    });
    if (!ai.live?.connect) {
      console.error('LiveTutor: Live API not available on this client');
      onKeyErrorRef.current?.();
      updateStatus('idle');
      return;
    }
    console.log('LiveTutor: starting connection (model:', LIVE_MODEL, ')');
    updateStatus('connecting');

    try {
      sessionPromise = ai.live.connect({
      model: LIVE_MODEL,
      callbacks: {
        onopen: async () => {
          console.log('LiveTutor: WebSocket open, waiting for setupComplete…');
          if (cancelledRef.current) return;
          updateStatus('connecting');
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (cancelledRef.current) { micStream.getTracks().forEach(t => t.stop()); return; }
            if (pronunciationMode === 'score') {
              if (inputAudioCtx.state === 'closed') { micStream.getTracks().forEach(t => t.stop()); return; }
              const source = inputAudioCtx.createMediaStreamSource(micStream);
              const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                sessionPromise.then(s => { try { s.sendRealtimeInput({ audio: createBlob(inputData) }); } catch (err) {} });
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputAudioCtx.destination);
              micStartedRef.current = true;
              updateStatus('listening');
              apiService.trackEvent('voice_practice', { language, context, lessonId }).catch(() => {});
            }
          } catch (e) {
            console.error('LiveTutor: Microphone access failed', e);
            updateStatus('idle');
          }
        },
        onmessage: async (message: LiveServerMessage) => {
          if (cancelledRef.current) return;
          // Send "speak first" prompt only after setup is complete (API requirement)
          if (message.setupComplete !== undefined) {
            try {
              if (cancelledRef.current) return;
              const session = await sessionPromise;
              if (session.sendClientContent) {
                if (pronunciationMode === 'score') {
                  session.sendClientContent({
                    turns: [{ role: 'user', parts: [{ text: `I am about to pronounce the word "${context}" in ${language}. Do not speak. Wait until you hear me say it. Then respond with ONLY: (1) "Score: X out of 10" with a number, (2) one short sentence of feedback in English. Do not guide, repeat the word, or help.` }] }],
                    turnComplete: true,
                  });
                  console.log('LiveTutor: score mode — waiting for user to pronounce, then will give score + feedback.');
                } else {
                  session.sendClientContent({
                    turns: [{ role: 'user', parts: [{ text: `Begin the lesson. Break the word "${context}" into simpler syllables or vowel parts in ${language}. Say "Repeat after me", then say each part slowly, then the full word, then "Your turn" and wait for me to repeat.` }] }],
                    turnComplete: true,
                  });
                  console.log('LiveTutor: sendClientContent sent (tutor should speak soon).');
                }
              }
            } catch (e) {
              console.warn('LiveTutor: sendClientContent failed', e);
            }
          }

          const parts = message.serverContent?.modelTurn?.parts ?? [];
          const audioPartCount = parts.filter(p => p.inlineData?.data).length;
          if (audioPartCount > 0) {
            console.log('LiveTutor: playing', audioPartCount, 'audio chunk(s).');
            if (!micStartedRef.current) {
              micStartedRef.current = true;
              (async () => {
                if (cancelledRef.current || inputAudioCtx.state === 'closed') return;
                try {
                  if (!micStream) {
                    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    if (cancelledRef.current) { micStream.getTracks().forEach(t => t.stop()); return; }
                  }
                  if (inputAudioCtx.state === 'closed') {
                    if (micStream) micStream.getTracks().forEach(t => t.stop());
                    return;
                  }
                  const source = inputAudioCtx.createMediaStreamSource(micStream!);
                  const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
                  scriptProcessor.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    sessionPromise.then(s => {
                      try { s.sendRealtimeInput({ audio: createBlob(inputData) }); } catch (err) {}
                    });
                  };
                  source.connect(scriptProcessor);
                  scriptProcessor.connect(inputAudioCtx.destination);
                  updateStatus('listening');
                  apiService.trackEvent('voice_practice', { language, context, lessonId }).catch(() => {});

                  const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                  if (SpeechRecognitionAPI && !cancelledRef.current) {
                    try {
                      const recognition = new SpeechRecognitionAPI();
                      recognition.continuous = true;
                      recognition.interimResults = true;
                      recognition.lang = language === 'Spanish' ? 'es-ES' : language === 'French' ? 'fr-FR' : language === 'Japanese' ? 'ja-JP' : language === 'German' ? 'de-DE' : language === 'Italian' ? 'it-IT' : language === 'Chinese' ? 'zh-CN' : language === 'Hindi' ? 'hi-IN' : language === 'Tamil' ? 'ta-IN' : 'en-US';
                      recognition.onresult = (e: SpeechRecognitionEvent) => {
                        if (cancelledRef.current) return;
                        const last = e.results[e.results.length - 1];
                        if (last.isFinal && last[0]?.transcript?.trim()) {
                          onTranscriptEntryRef.current?.({ role: 'user', text: last[0].transcript.trim() });
                        }
                      };
                      recognition.onerror = () => {};
                      recognition.start();
                      speechRecognitionRef.current = recognition;
                    } catch (_) {}
                  }
                } catch (e) {
                  console.error('LiveTutor: Microphone access failed', e);
                  updateStatus('idle');
                }
              })();
            }
          } else if (message.serverContent?.modelTurn && parts.length > 0) {
            console.log('LiveTutor: serverContent has modelTurn but no inlineData audio; parts:', parts.length);
          }

          for (const part of parts) {
            const text = (part as { text?: string }).text;
            if (text?.trim()) {
              onTranscriptEntryRef.current?.({ role: 'tutor', text: text.trim() });
            }
            const base64Audio = part.inlineData?.data;
            if (!base64Audio) continue;
            if (cancelledRef.current || outputAudioCtx.state === 'closed') continue;
            updateStatus('speaking');
            try {
              if (outputAudioCtx.state === 'suspended') {
                await outputAudioCtx.resume();
              }
              if (cancelledRef.current || outputAudioCtx.state === 'closed') continue;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioCtx, 24000, 1);
              const source = outputAudioCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioCtx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) updateStatus('listening');
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            } catch (e) {
              console.warn('LiveTutor: failed to play audio chunk', e);
            }
          }

          if (message.serverContent?.interrupted) {
            for (const s of sourcesRef.current) { try { s.stop(); } catch (e) {} }
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            updateStatus('listening');
          }
        },
        onerror: (e: any) => {
          let errorMsg = "Connection Error";
          if (e instanceof Error) errorMsg = e.message;
          else if (e?.message) errorMsg = e.message;
          else if (e?.reason) errorMsg = e.reason;
          else if (e?.error?.message) errorMsg = e.error.message;
          else if (e instanceof Event) {
            errorMsg = "WebSocket connection closed unexpectedly or failed to establish.";
          }
          console.error('LiveTutor: onerror →', errorMsg, e);
          updateStatus('idle');
          if (isKeyError(e) || errorMsg.includes("403") || errorMsg.includes("401")) {
            onKeyErrorRef.current?.();
          }
        },
        onclose: (e: any) => {
          const code = e?.code !== undefined ? e.code : 'unknown';
          const reason = (e?.reason ?? '') as string;
          console.log('LiveTutor: onclose → code', code, 'reason', reason || '(none)');
          updateStatus('idle');
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
        systemInstruction: pronunciationMode === 'score'
          ? `You are a pronunciation scorer. The word the user will say is "${context}" in ${language}.

RULES:
- Do NOT speak first. Do NOT say the word, guide, or help. Wait in silence for the user to pronounce it.
- When you hear their pronunciation, respond with ONLY two things in a short voice message: (1) "Score: X out of 10" with a number from 1 to 10, (2) one short sentence of feedback in English (what was good or what to improve). Example: "Score: 7 out of 10. Good attempt; try to stress the second syllable more."
- Keep your entire response under 25 words. No repeating the word, no "try again", no teaching. Only score and feedback.`
          : `You are Lingo, a friendly native language tutor. The learner is practicing the word "${context}" in ${language}.

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

Voice only, no text. Speak clearly and a bit slowly when breaking into parts.`,
      },
    });
    } catch (e) {
      console.error('LiveTutor: connect failed', e);
      onKeyErrorRef.current?.();
      updateStatus('idle');
      return;
    }

    sessionPromise.catch((e) => {
      console.error('LiveTutor: connection promise rejected', e);
      onKeyErrorRef.current?.();
      updateStatus('idle');
    });
    sessionRef.current = sessionPromise;

    return () => {
      cancelledRef.current = true;
      micStartedRef.current = false;
      sessionRef.current = null;
      try {
        speechRecognitionRef.current?.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      try {
        if (inputAudioCtx?.state !== 'closed') inputAudioCtx.close();
        if (outputAudioCtx?.state !== 'closed') outputAudioCtx.close();
      } catch (e) {}
      sessionPromise.then(s => {
        try { s.close(); } catch (e) {}
      }).catch(() => {});
    };
  }, [active, language, context, pronunciationMode]);

  return null;
};
