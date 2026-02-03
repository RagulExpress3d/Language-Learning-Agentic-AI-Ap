
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import React, { useEffect, useRef, useState } from 'react';
import { isKeyError } from '../services/geminiService';

interface LiveTutorProps {
  language: string;
  context: string;
  active: boolean;
  onKeyError?: () => void;
  onStatusChange?: (status: 'connecting' | 'listening' | 'speaking' | 'idle') => void;
}

export const LiveTutor: React.FC<LiveTutorProps> = ({ 
  language, 
  context, 
  active, 
  onKeyError,
  onStatusChange 
}) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('idle');
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

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
    for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
    return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
  };

  const updateStatus = (newStatus: 'connecting' | 'listening' | 'speaking' | 'idle') => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  };

  useEffect(() => {
    if (!active) {
      if (sessionRef.current) {
        sessionRef.current.then((s: any) => {
          try { s.close(); } catch (e) {}
        });
      }
      updateStatus('idle');
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputAudioCtx;
    updateStatus('connecting');

    let micStream: MediaStream;

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: async () => {
          updateStatus('listening');
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = inputAudioCtx.createMediaStreamSource(micStream);
            const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(s => {
                try { s.sendRealtimeInput({ media: createBlob(inputData) }); } catch (err) {}
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtx.destination);
          } catch (e) {
            console.error('Microphone failed:', e);
            updateStatus('idle');
          }
        },
        onmessage: async (message: LiveServerMessage) => {
          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio) {
            updateStatus('speaking');
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
          }

          if (message.serverContent?.interrupted) {
            for (const s of sourcesRef.current) { try { s.stop(); } catch (e) {} }
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            updateStatus('listening');
          }
        },
        onerror: (e: any) => {
          // Improve error reporting: e might be an ErrorEvent
          const errorMsg = e?.message || e?.error?.message || (e instanceof Event ? "Connection Error" : String(e));
          console.error('Live API Error:', errorMsg);
          if (isKeyError(e) || errorMsg.includes("403") || errorMsg.includes("401")) {
             onKeyError?.();
          }
        },
        onclose: () => updateStatus('idle'),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
        systemInstruction: `You are Lingo, a friendly language tutor. 
          Current language: ${language}. 
          Current context: ${context}. 
          Help the user with their ${language} pronunciation. Correct them gently if they make mistakes.
          Keep responses extremely brief and encouraging.`,
      },
    });

    sessionRef.current = sessionPromise;

    return () => {
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      inputAudioCtx.close();
      outputAudioCtx.close();
      sessionPromise.then(s => {
        try { s.close(); } catch (e) {}
      }).catch(() => {});
    };
  }, [active, language, context, onKeyError]);

  return null;
};
