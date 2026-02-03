
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Button } from './UI';

interface LiveTutorProps {
  language: string;
  context: string;
  onClose: () => void;
}

export const LiveTutor: React.FC<LiveTutorProps> = ({ language, context, onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('connecting');
  const [transcript, setTranscript] = useState<string>('');
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // PCM Decoding Utilities
  function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function createBlob(data: Float32Array): { data: string, mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputAudioCtx;

    let micStream: MediaStream;

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: async () => {
          setStatus('listening');
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const source = inputAudioCtx.createMediaStreamSource(micStream);
          const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioCtx.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            setTranscript(prev => prev + ' ' + message.serverContent!.outputTranscription!.text);
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

          if (message.serverContent?.interrupted) {
            for (const s of sourcesRef.current) s.stop();
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            setStatus('listening');
          }
        },
        onerror: (e) => console.error('Live API Error:', e),
        onclose: () => setStatus('idle'),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
        systemInstruction: `You are a professional ${language} language tutor. 
          Current context: ${context}. 
          Provide real-time pronunciation guidance. 
          Be encouraging, correct errors gently, and help the user reach their goal.
          Listen to the user's pronunciation and tell them how to improve.`,
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
  }, [language, context]);

  return (
    <div className="fixed inset-0 z-50 bg-blue-600 flex flex-col items-center justify-center p-8 text-white">
      <div className="w-full max-w-sm flex flex-col items-center space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-black">Live {language} Tutor</h2>
          <p className="text-blue-100 font-medium">Pronunciation Practice</p>
        </div>

        <div className="relative flex items-center justify-center">
          <div className={`w-48 h-48 rounded-full bg-blue-500 flex items-center justify-center border-8 border-blue-400 shadow-2xl transition-all duration-300 ${status === 'speaking' ? 'scale-110' : 'scale-100'}`}>
            <div className="text-7xl animate-pulse">
              {status === 'connecting' && '⏳'}
              {status === 'listening' && '👂'}
              {status === 'speaking' && '🗣️'}
              {status === 'idle' && '😴'}
            </div>
          </div>
          {status === 'speaking' && (
            <div className="absolute inset-0 rounded-full border-4 border-white animate-ping opacity-20"></div>
          )}
        </div>

        <div className="w-full bg-blue-700/50 p-6 rounded-3xl min-h-[120px] backdrop-blur-sm border border-blue-400/30">
          <p className="text-blue-200 text-xs font-bold uppercase mb-2">Tutor Feedback</p>
          <p className="text-lg italic font-medium">
            {status === 'connecting' ? 'Establishing connection...' : 
             transcript || `Say something in ${language} to begin...`}
          </p>
        </div>

        <Button variant="secondary" onClick={onClose} className="border-none shadow-none text-blue-600">
          Finish Session
        </Button>
      </div>
    </div>
  );
};
