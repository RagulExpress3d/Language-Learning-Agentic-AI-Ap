
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { isKeyError } from '../services/geminiService';

interface LiveTutorProps {
  language: string;
  context: string;
  active: boolean;
  onKeyError?: () => void;
}

export const LiveTutor: React.FC<LiveTutorProps> = ({ language, context, active, onKeyError }) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('idle');
  const [transcript, setTranscript] = useState<string>('');
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

  useEffect(() => {
    if (!active) {
      if (sessionRef.current) sessionRef.current.then((s: any) => s.close());
      setStatus('idle');
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputAudioCtx;
    setStatus('connecting');

    let micStream: MediaStream;

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: async () => {
          setStatus('listening');
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = inputAudioCtx.createMediaStreamSource(micStream);
            const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtx.destination);
          } catch (e) {
            console.error(e);
            setStatus('idle');
          }
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            setTranscript(message.serverContent.outputTranscription.text);
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio) {
            setStatus('speaking');
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtx.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioCtx, 24000, 1);
            const source = outputAudioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioCtx.destination);
            source.addEventListener('ended', () => {
              sourcesRef.current.delete(source);
              if (sourcesRef.current.size === 0) setStatus('listening');
            });
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
          }
        },
        onerror: (e: any) => {
          if (isKeyError(e) && onKeyError) onKeyError();
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
        systemInstruction: `You are a supportive ${language} tutor. Context: ${context}. Correct pronunciation gently. Keep it short.`,
        outputAudioTranscription: {},
      },
    });

    sessionRef.current = sessionPromise;

    return () => {
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      inputAudioCtx.close();
      outputAudioCtx.close();
      sessionPromise.then(s => s.close());
    };
  }, [active, language, context, onKeyError]);

  if (!active) return null;

  return (
    <div className="absolute bottom-24 left-4 right-4 z-40 bg-white/95 backdrop-blur shadow-2xl rounded-3xl p-4 border-2 border-blue-100 flex items-center space-x-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="relative">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${status === 'speaking' ? 'bg-blue-500 scale-110 shadow-lg shadow-blue-200' : 'bg-gray-100'}`}>
          <span className="text-2xl">
            {status === 'connecting' && '⏳'}
            {status === 'listening' && '👂'}
            {status === 'speaking' && '🗣️'}
          </span>
        </div>
        {status === 'speaking' && (
          <div className="absolute -inset-1 rounded-full border-2 border-blue-400 animate-ping opacity-50"></div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">Live Tutor</p>
        <p className="text-sm font-medium text-gray-700 truncate italic">
          {transcript || (status === 'listening' ? 'Listening...' : 'Connecting...')}
        </p>
      </div>
    </div>
  );
};
