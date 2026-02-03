
import React, { useState, useEffect, useRef } from 'react';
import { UserState, ViewState, Lesson } from './types';
import { generateLesson, generateSlideImage, generateTTS } from './services/geminiService';
import { Layout } from './components/Layout';
import { Button, HeartIcon, XPIcon } from './components/UI';
import { ProgressBar } from './components/ProgressBar';
import { LiveTutor } from './components/LiveTutor';

const THEMES = [
  { id: 'auto', label: 'Surprise Me ✨', icon: '🪄' },
  { id: 'travel', label: 'Travel 🏖️', icon: '✈️' },
  { id: 'food', label: 'Food 🍜', icon: '🍱' },
  { id: 'nature', label: 'Nature 🌿', icon: '⛰️' },
  { id: 'business', label: 'Work 💼', icon: '📈' },
];

const App: React.FC = () => {
  const [user, setUser] = useState<UserState>({
    xp: 0,
    hearts: 5,
    streak: 3,
    language: 'Spanish',
    goal: 'Quick Practice',
    theme: 'auto',
    level: 'beginner'
  });

  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Generating lesson...');
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [tutorStatus, setTutorStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('idle');
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setNeedsApiKey(!hasKey);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setNeedsApiKey(false);
    }
  };

  const startNewLesson = async () => {
    setIsLoading(true);
    setLoadingStep('Lingo Agent is preparing...');
    setView(ViewState.LOADING);
    
    try {
      const themes = ['Urban Life', 'Space Travel', 'Ancient History', 'Coffee Shop', 'Music Festival'];
      const selectedTheme = user.theme === 'auto' ? themes[Math.floor(Math.random() * themes.length)] : user.theme;
      const lesson = await generateLesson(user.language, selectedTheme, user.goal, user.level);
      
      setLoadingStep('Drawing mnemonic visuals...');
      const slidesWithImages = await Promise.all(
        lesson.slides.map(async (slide) => {
          const imageUrl = await generateSlideImage(slide.visualPrompt);
          return { ...slide, imageUrl };
        })
      );
      
      setCurrentLesson({ ...lesson, slides: slidesWithImages });
      setView(ViewState.LESSON);
      setLessonIndex(0);
    } catch (error: any) {
      if (String(error).includes("KEY_RESET_REQUIRED")) setNeedsApiKey(true);
      else alert("Agent encountered an error. Let's try again.");
      setView(ViewState.HOME);
    } finally {
      setIsLoading(false);
    }
  };

  const nextSlide = () => {
    if (lessonIndex < (currentLesson?.slides.length || 0) - 1) {
      setLessonIndex(lessonIndex + 1);
    } else {
      setView(ViewState.QUIZ);
      setQuizIndex(0);
    }
  };

  const handleQuizAnswer = (answer: string) => {
    const question = currentLesson?.quizzes[quizIndex];
    if (answer === question?.correctAnswer) {
      setFeedback({ type: 'success', message: 'You got it!' });
      setUser(prev => ({ ...prev, xp: prev.xp + 10 }));
    } else {
      setFeedback({ type: 'error', message: `Not quite. It's: ${question?.correctAnswer}` });
      setUser(prev => ({ ...prev, hearts: Math.max(0, prev.hearts - 1) }));
    }
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

  const triggerTutorSpeech = async (word: string) => {
    if (isTTSPlaying) return;
    setIsTTSPlaying(true);
    try {
      const base64Audio = await generateTTS(word, user.language);
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      const audioBuffer = await decodeAudioData(bytes, ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsTTSPlaying(false);
      source.start();
    } catch (e) {
      console.error('TTS Error:', e);
      setIsTTSPlaying(false);
    }
  };

  if (needsApiKey) {
    return (
      <Layout className="justify-center items-center text-center p-10 space-y-8 bg-blue-50">
        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-xl text-5xl">🔑</div>
        <div className="space-y-4">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Unlock LingoAgent</h2>
          <p className="text-gray-500 leading-relaxed font-medium">Select your <span className="text-blue-600 font-bold">DuolingoAgent</span> project key to enable real-time voice tutoring.</p>
        </div>
        <Button onClick={handleOpenKeyDialog}>Setup Key</Button>
      </Layout>
    );
  }

  const renderHome = () => (
    <div className="p-6 flex flex-col h-full space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-black text-green-500 italic tracking-tighter">Lingo!</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 font-bold bg-yellow-100 text-yellow-600 px-3 py-1.5 rounded-2xl text-sm shadow-sm">
            <XPIcon /> <span>{user.xp}</span>
          </div>
          <div className="flex items-center space-x-1 font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-2xl text-sm shadow-sm">
            <HeartIcon /> <span>{user.hearts}</span>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-[2.5rem] p-8 text-white relative shadow-2xl shadow-green-200">
        <div className="relative z-10">
          <p className="text-green-100 font-bold uppercase text-[0.65rem] tracking-widest mb-2 opacity-80">Current Streak</p>
          <h2 className="text-4xl font-black mb-4">{user.streak} Days! 🔥</h2>
          <div className="bg-white/30 h-2.5 rounded-full mb-8">
            <div className="bg-white h-full rounded-full shadow-sm" style={{ width: '65%' }}></div>
          </div>
          <Button variant="secondary" onClick={() => setView(ViewState.ONBOARDING)} className="border-none text-green-600 shadow-lg">
            Level Up Today
          </Button>
        </div>
        <div className="absolute right-[-10px] bottom-[-10px] text-9xl opacity-10 select-none">🦜</div>
      </div>

      <div className="space-y-4 pt-2">
        <h3 className="text-xl font-black text-gray-800 px-2 tracking-tight">Pick your vibe</h3>
        <div className="grid grid-cols-2 gap-4">
          {THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => {
                setUser({ ...user, theme: theme.id });
                setView(ViewState.ONBOARDING);
              }}
              className="bg-white border-2 border-gray-100 p-6 rounded-[2rem] flex flex-col items-center justify-center space-y-3 hover:border-green-400 hover:shadow-xl hover:shadow-green-50 transition-all group active:scale-95"
            >
              <div className="text-4xl group-hover:scale-110 transition-transform duration-300">{theme.icon}</div>
              <p className="font-black text-gray-800 text-sm tracking-tight">{theme.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderOnboarding = () => (
    <div className="p-8 flex flex-col h-full animate-in slide-in-from-right duration-500 bg-white">
      <div className="flex-1 space-y-12 pt-10">
        <div className="space-y-3">
          <h2 className="text-5xl font-black text-gray-900 tracking-tight leading-none">Custom<br/><span className="text-green-500">Path.</span></h2>
          <p className="text-gray-400 font-bold text-lg">Personalized for you.</p>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-[0.2em] pl-2">Level Up</label>
            <div className="flex bg-gray-50 p-2 rounded-[1.5rem] border-2 border-gray-100">
              {['beginner', 'intermediate', 'advanced'].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setUser({...user, level: lvl as any})}
                  className={`flex-1 py-4 rounded-xl font-black text-sm capitalize transition-all ${user.level === lvl ? 'bg-white shadow-md text-green-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-[0.2em] pl-2">Target Language</label>
            <select 
              value={user.language} 
              onChange={(e) => setUser({...user, language: e.target.value})}
              className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-[1.5rem] font-black text-gray-700 appearance-none focus:border-green-400 outline-none"
            >
              {['Spanish', 'French', 'Japanese', 'German', 'Italian', 'Chinese'].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="space-y-3 pt-6">
        <Button onClick={startNewLesson}>Generate Lesson</Button>
        <Button variant="ghost" onClick={() => setView(ViewState.HOME)}>Go Back</Button>
      </div>
    </div>
  );

  const renderLesson = () => {
    const slide = currentLesson?.slides[lessonIndex];
    if (!slide) return null;
    const isSpeaking = tutorStatus === 'speaking' || isTTSPlaying;
    
    return (
      <div className="flex flex-col h-full bg-white relative animate-in fade-in duration-500">
        <div className="p-6 pb-2">
          <div className="flex items-center space-x-6 mb-6">
            <button onClick={() => setView(ViewState.HOME)} className="text-gray-300 hover:text-gray-600 transition-colors">✕</button>
            <ProgressBar progress={((lessonIndex) / (currentLesson?.slides.length || 1)) * 100} />
            <div className="flex items-center space-x-1 font-bold text-red-500 text-sm">
              <HeartIcon /> <span>{user.hearts}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center p-8 text-center space-y-8 overflow-y-auto pt-0">
          <div className="relative group w-full">
            <div className="w-full aspect-square bg-gray-50 rounded-[3rem] overflow-hidden shadow-2xl border-[12px] border-white relative">
              <img src={slide.imageUrl} alt={slide.word} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
            {/* Tutor Pulse Indicator */}
            <div className={`absolute -right-2 -bottom-2 w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center border-4 border-gray-50 transition-all duration-300 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
              <div className={`text-2xl ${isSpeaking ? 'animate-bounce' : ''}`}>🤖</div>
              {isSpeaking && (
                <div className="absolute -inset-2 rounded-full border-4 border-green-400 animate-ping opacity-20"></div>
              )}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-center space-x-4">
              <h1 className="text-5xl font-black text-gray-900 tracking-tighter">{slide.word}</h1>
              <button 
                onClick={() => triggerTutorSpeech(slide.word)}
                disabled={isTTSPlaying}
                className={`w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-2xl hover:bg-blue-100 hover:scale-110 active:scale-95 transition-all shadow-sm ${isTTSPlaying ? 'opacity-50 animate-pulse' : ''}`}
                title="Hear Pronunciation"
              >
                🔊
              </button>
            </div>
            <p className="text-2xl text-blue-400 font-bold italic tracking-tight opacity-70">/ {slide.phonetic} /</p>
          </div>

          <div className="bg-blue-50/50 p-8 rounded-[2.5rem] w-full text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl font-black">"{user.language[0]}"</div>
            <p className="text-[0.65rem] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Definition</p>
            <p className="text-3xl font-black text-gray-800 mb-4">{slide.translation}</p>
            <div className="h-0.5 bg-blue-100 w-full mb-4"></div>
            <p className="text-lg text-gray-600 leading-snug font-medium italic">"{slide.exampleSentence}"</p>
          </div>
        </div>

        <LiveTutor 
          language={user.language} 
          context={slide.word} 
          active={view === ViewState.LESSON} 
          onKeyError={() => setNeedsApiKey(true)} 
          onStatusChange={setTutorStatus}
        />

        <div className="p-8 pt-2 flex space-x-4 bg-white z-10">
          <Button className="flex-1 !bg-green-500 !shadow-[0_4px_0_0_#16a34a] hover:!shadow-[0_2px_0_0_#16a34a]" onClick={nextSlide}>
            {lessonIndex === (currentLesson?.slides.length || 1) - 1 ? 'Start Quiz' : 'Got it!'}
          </Button>
        </div>
      </div>
    );
  };

  const renderQuiz = () => {
    const question = currentLesson?.quizzes[quizIndex];
    if (!question) return null;
    return (
      <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-500">
         <div className="p-6 pb-2">
            <div className="flex items-center space-x-6 mb-4">
              <button onClick={() => setView(ViewState.HOME)} className="text-gray-300">✕</button>
              <ProgressBar progress={(quizIndex / (currentLesson?.quizzes.length || 1)) * 100} />
              <div className="flex items-center space-x-1 font-bold text-red-500 text-sm">
                <HeartIcon /> <span>{user.hearts}</span>
              </div>
            </div>
         </div>
         <div className="flex-1 p-8 flex flex-col justify-center space-y-12">
            <div className="space-y-4 text-center">
              <div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl">🧠</div>
              <h2 className="text-3xl font-black text-gray-900 leading-tight px-4">{question.question}</h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {question.options.map((opt, i) => (
                <button 
                  key={i} 
                  onClick={() => handleQuizAnswer(opt)} 
                  className="p-6 text-left rounded-[2rem] border-4 border-gray-100 font-black text-xl hover:border-green-400 hover:bg-green-50 transition-all active:scale-95 group flex justify-between items-center"
                >
                  <span>{opt}</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">✨</span>
                </button>
              ))}
            </div>
         </div>
         {feedback && (
            <div className={`p-8 pb-12 border-t-8 fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 bg-white animate-in slide-in-from-bottom duration-300 ${feedback.type === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
              <div className="flex items-center space-x-6 mb-8">
                <div className="text-7xl">{feedback.type === 'success' ? '🥳' : '🫠'}</div>
                <div className="flex-1">
                  <h3 className={`text-3xl font-black ${feedback.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{feedback.type === 'success' ? 'Perfect!' : 'Not quite'}</h3>
                  <p className="text-gray-600 font-bold text-lg">{feedback.message}</p>
                </div>
              </div>
              <Button 
                className={feedback.type === 'success' ? '!bg-green-500 !shadow-[0_4px_0_0_#16a34a]' : '!bg-red-500 !shadow-[0_4px_0_0_#dc2626]'}
                onClick={() => {
                  setFeedback(null);
                  if (quizIndex < (currentLesson?.quizzes.length || 0) - 1) setQuizIndex(quizIndex + 1);
                  else setView(ViewState.SUMMARY);
                }}
              >
                Continue
              </Button>
            </div>
         )}
      </div>
    );
  };

  return (
    <Layout>
      {view === ViewState.HOME && renderHome()}
      {view === ViewState.ONBOARDING && renderOnboarding()}
      {view === ViewState.LOADING && (
        <div className="p-10 flex flex-col h-full items-center justify-center text-center space-y-12 bg-white">
          <div className="relative">
            <div className="w-48 h-48 border-[12px] border-green-50 border-t-green-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-7xl animate-bounce">🤖</div>
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Preparing...</h2>
            <p className="text-green-500 font-black animate-pulse uppercase tracking-[0.2em] text-xs">{loadingStep}</p>
          </div>
        </div>
      )}
      {view === ViewState.LESSON && renderLesson()}
      {view === ViewState.QUIZ && renderQuiz()}
      {view === ViewState.SUMMARY && (
        <div className="p-12 flex flex-col h-full items-center justify-center text-center space-y-12 bg-gradient-to-b from-white to-green-50 animate-in zoom-in duration-500">
           <div className="text-[10rem] animate-bounce drop-shadow-2xl">🥇</div>
           <div className="space-y-3">
             <h2 className="text-6xl font-black text-gray-900 tracking-tighter">Day {user.streak}!</h2>
             <p className="text-gray-500 font-bold text-xl">+10 XP • Native Pronunciation</p>
           </div>
           <Button className="!bg-green-500 !shadow-[0_4px_0_0_#16a34a]" onClick={() => {
             setUser(prev => ({ ...prev, streak: prev.streak + 1 }));
             setView(ViewState.HOME);
           }}>Sweet!</Button>
        </div>
      )}
    </Layout>
  );
};

export default App;
