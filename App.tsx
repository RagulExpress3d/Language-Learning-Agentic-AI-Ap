
import React, { useState, useEffect, useRef } from 'react';
import { UserState, ViewState, Lesson } from './types';
import { generateTTS } from './services/geminiService';
import { apiService } from './services/api';
import { Layout } from './components/Layout';
import { Button, HeartIcon, XPIcon } from './components/UI';
import { ProgressBar } from './components/ProgressBar';
import { LiveTutor } from './components/LiveTutor';
import { LingoMascot, LingoMascotMini } from './components/LingoMascot';
import { Auth } from './src/components/Auth';

const THEMES = [
  { id: 'auto', label: 'Surprise Me', icon: '🪄', color: 'from-violet-400 to-purple-500' },
  { id: 'travel', label: 'Travel', icon: '✈️', color: 'from-sky-400 to-blue-500' },
  { id: 'food', label: 'Food', icon: '🍱', color: 'from-orange-400 to-red-400' },
  { id: 'nature', label: 'Nature', icon: '🌿', color: 'from-emerald-400 to-green-500' },
  { id: 'business', label: 'Work', icon: '💼', color: 'from-amber-400 to-yellow-500' },
];

const LANGUAGES = ['Spanish', 'French', 'Japanese', 'German', 'Italian', 'Chinese', 'Hindi', 'Tamil'];

const LANG_FLAGS: Record<string, string> = {
  Spanish: '🇪🇸', French: '🇫🇷', Japanese: '🇯🇵', German: '🇩🇪',
  Italian: '🇮🇹', Chinese: '🇨🇳', Hindi: '🇮🇳', Tamil: '🇮🇳',
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<UserState>({
    xp: 0,
    hearts: 5,
    streak: 0,
    language: 'Spanish',
    goal: 'Quick Practice',
    theme: 'auto',
    level: 'beginner'
  });
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
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
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [lessonStartTime, setLessonStartTime] = useState<number>(0);
  const [voiceQuizCardIndex, setVoiceQuizCardIndex] = useState(0);
  const [isVoiceQuizMicOn, setIsVoiceQuizMicOn] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = apiService.getToken();
        if (token) {
          try {
            const { user: userData } = await apiService.getCurrentUser();
            setUser({
              xp: userData.xp || 0,
              hearts: userData.hearts || 5,
              streak: userData.streak || 0,
              language: userData.languages?.[0]?.language || 'Spanish',
              goal: 'Quick Practice',
              theme: userData.languages?.[0]?.preferredTheme || 'auto',
              level: userData.languages?.[0]?.level || 'beginner'
            });
            setIsAuthenticated(true);
          } catch (err) {
            console.error('Auth check failed:', err);
            apiService.setToken(null);
            setIsAuthenticated(false);
          }
        } else {
          // Demo mode: auto sign in as guest and go straight to language selection
          try {
            const { user: userData } = await apiService.trialLogin();
            setUser({
              xp: userData.xp || 0,
              hearts: userData.hearts || 5,
              streak: userData.streak || 0,
              language: userData.languages?.[0]?.language || 'Spanish',
              goal: 'Quick Practice',
              theme: userData.languages?.[0]?.preferredTheme || 'auto',
              level: userData.languages?.[0]?.level || 'beginner'
            });
            setIsAuthenticated(true);
            setView(ViewState.ONBOARDING);
          } catch (err) {
            console.error('Trial login failed:', err);
            setIsAuthenticated(false);
          }
        }
      } catch (error) {
        console.error('Auth error:', error);
        apiService.setToken(null);
        setIsAuthenticated(false);
      }
    };
    checkAuth();

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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/d856fbe8-325b-4a0c-9b2d-64a1b03cb158',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:startNewLesson:entry',message:'Generate lesson started',data:{view},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    setIsLoading(true);
    setLoadingStep('Crafting your lesson...');
    setView(ViewState.LOADING);
    setLessonStartTime(Date.now());

    try {
      const themes = ['Urban Life', 'Space Travel', 'Ancient History', 'Coffee Shop', 'Music Festival'];
      const selectedTheme = user.theme === 'auto' ? themes[Math.floor(Math.random() * themes.length)] : user.theme;

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d856fbe8-325b-4a0c-9b2d-64a1b03cb158',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:startNewLesson:beforeGenerate',message:'Calling generateLesson API',data:{language:user.language,selectedTheme},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const { lesson: lessonData } = await apiService.generateLesson(
        user.language,
        selectedTheme,
        user.goal,
        user.level
      );

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d856fbe8-325b-4a0c-9b2d-64a1b03cb158',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:startNewLesson:afterGenerate',message:'generateLesson returned',data:{hasLesson:!!lessonData,slidesLen:lessonData?.slides?.length,quizzesLen:lessonData?.quizzes?.length},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      const lesson: Lesson = {
        id: lessonData._id || lessonData.id,
        title: lessonData.title,
        slides: lessonData.slides.map((s: any, i: number) => ({
          ...s,
          id: `slide-${i}`,
          imageUrl: s.imageUrl
        })),
        quizzes: lessonData.quizzes.map((q: any, i: number) => ({
          ...q,
          id: `quiz-${i}`
        }))
      };

      setCurrentLessonId(lesson.id);
      setCurrentLesson(lesson);
      setView(ViewState.LESSON);
      setLessonIndex(0);

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d856fbe8-325b-4a0c-9b2d-64a1b03cb158',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:startNewLesson:success',message:'Set view to LESSON',data:{lessonId:lesson.id},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      await apiService.trackEvent('lesson_started', {
        language: user.language,
        theme: selectedTheme,
        level: user.level,
        lessonId: lesson.id
      });
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d856fbe8-325b-4a0c-9b2d-64a1b03cb158',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:startNewLesson:catch',message:'Generate lesson failed',data:{errMsg:String(error?.message||error).slice(0,120)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const errMsg = String(error?.message ?? error).trim();
      if (errMsg.includes("KEY_RESET_REQUIRED")) setNeedsApiKey(true);
      else if (errMsg.includes("space quota") || errMsg.includes("512 MB")) {
        alert(`${errMsg}\n\nThis usually means your MongoDB Atlas cluster is full (free tier is 512 MB). Free up space in Atlas or upgrade your cluster.`);
      } else if (errMsg.length > 0) alert(errMsg);
      else alert("Oops! Something went wrong. Let's try again.");
      setView(ViewState.HOME);
    } finally {
      setIsLoading(false);
    }
  };

  const nextSlide = () => {
    setIsPracticeMode(false);
    if (lessonIndex < (currentLesson?.slides.length || 0) - 1) {
      setLessonIndex(lessonIndex + 1);
    } else {
      setView(ViewState.QUIZ);
      setQuizIndex(0);
    }
  };

  const handleQuizAnswer = async (answer: string) => {
    const question = currentLesson?.quizzes[quizIndex];
    const isCorrect = answer === question?.correctAnswer;
    
    if (isCorrect) {
      setFeedback({ type: 'success', message: 'You got it!' });
      await apiService.updateStats(10, 0, user.language);
      setUser(prev => ({ ...prev, xp: prev.xp + 10 }));
    } else {
      setFeedback({ type: 'error', message: `Not quite. It's: ${question?.correctAnswer}` });
      await apiService.updateStats(0, -1, user.language);
      setUser(prev => ({ ...prev, hearts: Math.max(0, prev.hearts - 1) }));
    }
    
    await apiService.trackEvent('quiz_answered', {
      lessonId: currentLessonId,
      quizId: question?.id,
      correct: isCorrect,
      language: user.language
    });
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
      console.error('TTS Playback Error:', e);
      setIsTTSPlaying(false);
    }
  };

  /* ─── Map tutor status to mascot mood ─── */
  const tutorMood = tutorStatus === 'speaking' ? 'speaking' as const
    : tutorStatus === 'listening' ? 'listening' as const
    : tutorStatus === 'connecting' ? 'thinking' as const
    : 'happy' as const;

  /* ─── API Key Gate ─── */
  if (needsApiKey) {
    return (
      <Layout className="justify-center items-center text-center p-10 space-y-8 bg-gradient-to-b from-[#E8F9DD] to-white">
        <LingoMascot mood="thinking" size={120} animate />
        <div className="space-y-4">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Unlock LingoAgent</h2>
          <p className="text-gray-500 leading-relaxed font-medium">Select your <span className="text-[#58CC02] font-bold">LingoAgent</span> project key to enable real-time voice tutoring.</p>
        </div>
        <Button onClick={handleOpenKeyDialog} className="!bg-[#58CC02] !shadow-[0_5px_0_0_#46A302]">Setup Key</Button>
      </Layout>
    );
  }

  /* ─── HOME ─── */
  const renderHome = () => (
    <div className="flex flex-col h-full animate-in fade-in duration-700 overflow-y-auto">
      {/* Top bar */}
      <div className="flex justify-between items-center p-6 pb-2">
        <h1 className="text-3xl font-black tracking-tighter">
          <span className="text-[#58CC02]">Lingo</span><span className="text-gray-800">Agent</span>
        </h1>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 font-bold bg-amber-50 text-amber-600 px-3 py-1.5 rounded-2xl text-sm border border-amber-100">
            <XPIcon /> <span>{user.xp}</span>
          </div>
          <div className="flex items-center space-x-1 font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-2xl text-sm border border-red-100">
            <HeartIcon /> <span>{user.hearts}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 space-y-6">
        {/* Streak Hero */}
        <div className="bg-gradient-to-br from-[#58CC02] to-[#46A302] rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl shadow-green-200/50">
          <div className="relative z-10 flex items-center gap-4">
            <LingoMascot mood="celebrating" size={80} />
            <div className="flex-1">
              <p className="text-green-100 font-bold uppercase text-[0.6rem] tracking-widest mb-0.5 opacity-80">Current Streak</p>
              <h2 className="text-3xl font-black">{user.streak} Days 🔥</h2>
              <div className="bg-white/25 h-2 rounded-full mt-3">
                <div className="bg-white h-full rounded-full shadow-sm" style={{ width: '65%' }}></div>
              </div>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/5"></div>
          <div className="absolute right-8 -top-4 w-16 h-16 rounded-full bg-white/5"></div>
        </div>

        {/* CTA */}
        <Button 
          onClick={() => setView(ViewState.ONBOARDING)} 
          className="!bg-[#58CC02] !shadow-[0_5px_0_0_#46A302] hover:!shadow-[0_3px_0_0_#46A302] hover:!translate-y-[2px] !text-lg !py-5 !rounded-[1.5rem]"
        >
          Start Today's Lesson
        </Button>

        {/* Theme grid */}
        <div className="space-y-3">
          <h3 className="text-lg font-black text-gray-800 px-1 tracking-tight">Pick a vibe</h3>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => {
                  setUser({ ...user, theme: theme.id });
                  setView(ViewState.ONBOARDING);
                }}
                className="group relative bg-white border-2 border-gray-100 p-5 rounded-[1.5rem] flex flex-col items-center justify-center space-y-2 hover:border-[#58CC02] hover:shadow-lg hover:shadow-green-50 transition-all active:scale-95"
              >
                <div className="text-3xl group-hover:scale-110 transition-transform duration-300">{theme.icon}</div>
                <p className="font-black text-gray-700 text-sm tracking-tight">{theme.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  /* ─── ONBOARDING ─── */
  const renderOnboarding = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-500 overflow-y-auto">
      <div className="flex-1 p-6 space-y-8 pt-8">
        {/* Header with mascot */}
        <div className="flex items-start gap-4">
          <LingoMascot mood="happy" size={70} />
          <div className="flex-1 pt-2">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">
              Let's <span className="text-[#58CC02]">customize</span><br/>your path
            </h2>
            <p className="text-gray-400 font-bold text-sm mt-1">Pick your target language & level</p>
          </div>
        </div>

        {/* Language grid */}
        <div className="space-y-3">
          <label className="text-[0.6rem] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">I want to learn</label>
          <div className="grid grid-cols-2 gap-3">
            {LANGUAGES.map(lang => (
              <button
                key={lang}
                onClick={async () => {
                  setUser({...user, language: lang});
                  await apiService.updateLanguage(lang, user.level);
                }}
                className={`py-3.5 px-4 rounded-[1.25rem] border-2 font-black text-sm transition-all flex items-center justify-center gap-2 ${
                  user.language === lang 
                    ? 'bg-[#58CC02] border-[#58CC02] text-white shadow-lg shadow-green-200/50 scale-[1.03]' 
                    : 'bg-white border-gray-100 text-gray-600 hover:border-green-300'
                }`}
              >
                <span className="text-lg">{LANG_FLAGS[lang]}</span>
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Level selector */}
        <div className="space-y-3">
          <label className="text-[0.6rem] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">My current level</label>
          <div className="flex bg-gray-50 p-1.5 rounded-[1.25rem] border-2 border-gray-100">
            {['beginner', 'intermediate', 'advanced'].map(lvl => (
              <button
                key={lvl}
                onClick={async () => {
                  setUser({...user, level: lvl as any});
                  await apiService.updateLanguage(user.language, lvl);
                }}
                className={`flex-1 py-3.5 rounded-xl font-black text-sm capitalize transition-all ${
                  user.level === lvl 
                    ? 'bg-white shadow-md text-[#58CC02]' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="p-6 pt-2 space-y-3 border-t border-gray-50">
        <Button onClick={startNewLesson} className="!bg-[#58CC02] !shadow-[0_5px_0_0_#46A302] hover:!shadow-[0_3px_0_0_#46A302] hover:!translate-y-[2px]">
          Generate My Lesson
        </Button>
        <Button variant="ghost" onClick={() => setView(ViewState.HOME)}>Go Back</Button>
      </div>
    </div>
  );

  /* ─── LOADING ─── */
  const renderLoading = () => (
    <div className="p-10 flex flex-col h-full items-center justify-center text-center space-y-10 bg-gradient-to-b from-[#E8F9DD] via-white to-[#FFF8E7]">
      <div className="relative">
        {/* Spinning ring */}
        <div className="w-44 h-44 border-[10px] border-green-100 border-t-[#58CC02] rounded-full animate-spin"></div>
        {/* Mascot centered inside */}
        <div className="absolute inset-0 flex items-center justify-center">
          <LingoMascot mood="thinking" size={90} />
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Preparing your lesson</h2>
        <p className="text-[#58CC02] font-black animate-pulse uppercase tracking-[0.15em] text-xs">{loadingStep}</p>
        <p className="text-gray-400 font-medium text-sm">This may take a moment — AI is crafting something special</p>
      </div>
    </div>
  );

  /* ─── LESSON ─── */
  const renderLesson = () => {
    const slide = currentLesson?.slides[lessonIndex];
    if (!slide) return null;
    const isSpeaking = tutorStatus === 'speaking' || isTTSPlaying;
    
    return (
      <div className="flex flex-col h-full bg-white relative animate-in fade-in duration-500">
        {/* Progress header */}
        <div className="p-5 pb-2">
          <div className="flex items-center space-x-4 mb-4">
            <button onClick={() => setView(ViewState.HOME)} className="text-gray-300 hover:text-gray-600 transition-colors text-lg">✕</button>
            <ProgressBar progress={((lessonIndex) / (currentLesson?.slides.length || 1)) * 100} />
            <div className="flex items-center space-x-1 font-bold text-red-500 text-sm">
              <HeartIcon /> <span>{user.hearts}</span>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col items-center px-6 text-center space-y-6 overflow-y-auto overflow-x-hidden min-w-0 w-full">
          {/* Image with mascot badge */}
          <div className="relative group w-full">
            <div className="w-full aspect-square bg-gray-50 rounded-[2.5rem] overflow-hidden shadow-xl border-[8px] border-white relative">
              <img src={slide.imageUrl} alt={slide.word} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent"></div>
            </div>
            {/* Mascot presence badge */}
            <div className={`absolute -right-2 -bottom-2 bg-white rounded-full shadow-xl p-1 border-4 border-gray-50 transition-all duration-300 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
              <LingoMascotMini mood={tutorMood} size={36} />
              {(isSpeaking || isPracticeMode) && (
                <div className={`absolute -inset-1 rounded-full border-[3px] ${isPracticeMode ? 'border-blue-400' : 'border-[#58CC02]'} animate-ping opacity-20`}></div>
              )}
            </div>
          </div>
          
          {/* Word & controls */}
          <div className="space-y-1 min-w-0 w-full">
            <div className="flex items-center justify-center gap-3 min-w-0">
              <h1 className="text-4xl font-black text-gray-900 tracking-tighter break-words min-w-0">{slide.word}</h1>
              
              <div className="flex gap-2">
                {/* TTS Button */}
                <button 
                  onClick={() => triggerTutorSpeech(slide.word)}
                  disabled={isTTSPlaying}
                  className={`w-11 h-11 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center text-xl hover:bg-blue-100 hover:scale-110 active:scale-95 transition-all border border-blue-100 ${isTTSPlaying ? 'opacity-50 animate-pulse' : ''}`}
                  title="Hear Pronunciation"
                >
                  🔊
                </button>

                {/* Practice mic */}
                <button 
                  onClick={() => setIsPracticeMode(!isPracticeMode)}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all active:scale-95 border ${
                    isPracticeMode 
                      ? 'bg-red-500 text-white animate-pulse border-red-400 shadow-lg shadow-red-200' 
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-100'
                  }`}
                  title="Practice Speaking"
                >
                  🎙️
                </button>
              </div>
            </div>
            <p className="text-xl text-blue-400 font-bold italic tracking-tight opacity-70">/ {slide.phonetic} /</p>
          </div>

          {/* Definition card */}
          <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-6 rounded-[2rem] w-full text-left relative overflow-hidden border border-blue-100/50">
            <p className="text-[0.6rem] font-black text-blue-400 uppercase tracking-[0.15em] mb-2">Definition</p>
            <p className="text-2xl font-black text-gray-800 mb-3">{slide.translation}</p>
            <div className="h-px bg-blue-100/80 w-full mb-3"></div>
            <p className="text-base text-gray-500 leading-snug font-medium italic">"{slide.exampleSentence}"</p>
          </div>

          {/* Tutor status */}
          {isPracticeMode && (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-green-50 text-[#46A302] rounded-full font-bold text-sm animate-in fade-in slide-in-from-bottom duration-300 border border-green-100">
              <LingoMascotMini mood={tutorMood} size={24} />
              {tutorStatus === 'connecting' && 'Connecting...'}
              {tutorStatus === 'listening' && 'Listening — repeat the word!'}
              {tutorStatus === 'speaking' && 'Speaking...'}
              {tutorStatus === 'idle' && 'Ready. Click mic to start.'}
            </div>
          )}
        </div>

        <LiveTutor 
          language={user.language} 
          context={slide.word} 
          active={isPracticeMode} 
          onKeyError={() => setNeedsApiKey(true)} 
          onStatusChange={setTutorStatus}
          lessonId={currentLessonId || undefined}
        />

        {/* Bottom action */}
        <div className="p-6 pt-3 bg-white z-10 border-t border-gray-50">
          <Button 
            className="!bg-[#58CC02] !shadow-[0_5px_0_0_#46A302] hover:!shadow-[0_3px_0_0_#46A302] hover:!translate-y-[2px]" 
            onClick={nextSlide}
          >
            {lessonIndex === (currentLesson?.slides.length || 1) - 1 ? 'Start Quiz' : 'Got it!'}
          </Button>
        </div>
      </div>
    );
  };

  /* ─── QUIZ ─── */
  const renderQuiz = () => {
    const question = currentLesson?.quizzes[quizIndex];
    if (!question) return null;
    return (
      <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-500">
        {/* Progress header */}
        <div className="p-5 pb-2">
          <div className="flex items-center space-x-4 mb-2">
            <button onClick={() => setView(ViewState.HOME)} className="text-gray-300 hover:text-gray-600 text-lg">✕</button>
            <ProgressBar progress={(quizIndex / (currentLesson?.quizzes.length || 1)) * 100} />
            <div className="flex items-center space-x-1 font-bold text-red-500 text-sm">
              <HeartIcon /> <span>{user.hearts}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 flex flex-col justify-center space-y-8">
          {/* Question area */}
          <div className="text-center space-y-4">
            <LingoMascot mood="happy" size={72} />
            <h2 className="text-2xl font-black text-gray-900 leading-tight px-2">{question.question}</h2>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 gap-3">
            {question.options.map((opt, i) => (
              <button 
                key={i} 
                onClick={() => handleQuizAnswer(opt)} 
                className="p-5 text-left rounded-[1.5rem] border-[3px] border-gray-100 font-bold text-lg hover:border-[#58CC02] hover:bg-green-50/50 transition-all active:scale-[0.98] group flex justify-between items-center"
              >
                <span className="text-gray-800">{opt}</span>
                <span className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-[#58CC02] group-hover:text-white flex items-center justify-center text-sm font-black transition-all">
                  {String.fromCharCode(65 + i)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Feedback overlay */}
        {feedback && (
          <div className={`p-6 pb-10 border-t-[6px] fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 animate-in slide-in-from-bottom duration-300 ${
            feedback.type === 'success' 
              ? 'border-[#58CC02] bg-green-50' 
              : 'border-red-500 bg-red-50'
          }`}>
            <div className="flex items-center gap-4 mb-6">
              <LingoMascot 
                mood={feedback.type === 'success' ? 'celebrating' : 'thinking'} 
                size={64} 
                animate={feedback.type === 'success'}
              />
              <div className="flex-1">
                <h3 className={`text-2xl font-black ${feedback.type === 'success' ? 'text-[#58CC02]' : 'text-red-500'}`}>
                  {feedback.type === 'success' ? 'Awesome!' : 'Not quite'}
                </h3>
                <p className="text-gray-600 font-bold">{feedback.message}</p>
              </div>
            </div>
            <Button 
              className={feedback.type === 'success' 
                ? '!bg-[#58CC02] !shadow-[0_5px_0_0_#46A302]' 
                : '!bg-red-500 !shadow-[0_5px_0_0_#dc2626]'
              }
              onClick={async () => {
                setFeedback(null);
                if (quizIndex < (currentLesson?.quizzes.length || 0) - 1) {
                  setQuizIndex(quizIndex + 1);
                } else {
                  setVoiceQuizCardIndex(0);
                  setIsVoiceQuizMicOn(false);
                  setView(ViewState.VOICE_QUIZ);
                }
              }}
            >
              Continue
            </Button>
          </div>
        )}
      </div>
    );
  };

  const finishLessonAndGoToSummary = async () => {
    if (currentLessonId && lessonStartTime) {
      const timeSpent = Math.floor((Date.now() - lessonStartTime) / 1000);
      const correctAnswers = currentLesson?.quizzes.length || 0;
      const score = Math.floor((correctAnswers / (currentLesson?.quizzes.length || 1)) * 100);
      await apiService.completeLesson(currentLessonId, score, timeSpent);
      const progress: any = await apiService.getProgressSummary();
      setUser(prev => ({
        ...prev,
        xp: progress.totalXP || prev.xp,
        hearts: progress.hearts || prev.hearts,
        streak: progress.streak || prev.streak
      }));
    }
    setView(ViewState.SUMMARY);
  };

  /* ─── VOICE QUIZ ─── */
  const renderVoiceQuiz = () => {
    const slides = currentLesson?.slides ?? [];
    const totalCards = slides.length;
    const currentSlide = slides[voiceQuizCardIndex];
    const isLastCard = voiceQuizCardIndex >= totalCards - 1;

    if (totalCards === 0) {
      return (
        <div className="p-8 flex flex-col h-full items-center justify-center text-center space-y-6">
          <LingoMascot mood="celebrating" size={100} animate />
          <p className="text-gray-500 font-bold text-lg">No words to practice. Great job!</p>
          <Button onClick={finishLessonAndGoToSummary} className="!bg-[#58CC02] !shadow-[0_5px_0_0_#46A302]">Finish</Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-white relative animate-in fade-in duration-500">
        {/* Header */}
        <div className="p-5 pb-2">
          <div className="flex items-center justify-between">
            <button onClick={() => setView(ViewState.HOME)} className="text-gray-300 hover:text-gray-600 transition-colors text-lg">✕</button>
            <div className="flex items-center gap-2">
              <LingoMascotMini mood={isVoiceQuizMicOn ? tutorMood : 'happy'} size={24} />
              <p className="text-sm font-black text-gray-400 uppercase tracking-wider">
                {voiceQuizCardIndex + 1} / {totalCards}
              </p>
            </div>
            <div className="w-8" />
          </div>
          {/* Mini progress */}
          <div className="mt-3">
            <ProgressBar progress={((voiceQuizCardIndex) / totalCards) * 100} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center p-6 text-center space-y-5 overflow-y-auto min-w-0 w-full">
          <div className="w-full aspect-square max-w-[280px] mx-auto bg-gray-50 rounded-[2rem] overflow-hidden shadow-xl border-[6px] border-white">
            <img src={currentSlide.imageUrl} alt={currentSlide.word} className="w-full h-full object-cover" />
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter break-words">{currentSlide.word}</h1>
            <p className="text-lg text-blue-400 font-bold italic">/ {currentSlide.phonetic} /</p>
          </div>

          {/* Mic area */}
          <div className="flex flex-col items-center gap-3 w-full">
            <button
              onClick={() => setIsVoiceQuizMicOn(!isVoiceQuizMicOn)}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all active:scale-95 border-2 ${
                isVoiceQuizMicOn 
                  ? 'bg-red-500 text-white border-red-400 animate-pulse shadow-lg shadow-red-200' 
                  : 'bg-[#58CC02] text-white border-[#46A302] hover:shadow-lg hover:shadow-green-200'
              }`}
              title="Practice with Lingo"
            >
              🎙️
            </button>
            <span className="text-gray-400 font-bold text-xs">
              {isVoiceQuizMicOn ? 'Tap to stop' : 'Tap to speak'}
            </span>
          </div>

          {/* Status pill */}
          {isVoiceQuizMicOn && (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-green-50 text-[#46A302] rounded-full font-bold text-sm border border-green-100 animate-in fade-in slide-in-from-bottom duration-300">
              <LingoMascotMini mood={tutorMood} size={22} />
              {tutorStatus === 'connecting' && 'Connecting...'}
              {tutorStatus === 'listening' && 'Listening — say the word!'}
              {tutorStatus === 'speaking' && 'Giving your score...'}
              {tutorStatus === 'idle' && 'Ready. Tap mic to try again.'}
            </div>
          )}
        </div>

        <LiveTutor
          language={user.language}
          context={currentSlide.word}
          active={isVoiceQuizMicOn}
          pronunciationMode="score"
          onKeyError={() => setNeedsApiKey(true)}
          onStatusChange={setTutorStatus}
          lessonId={currentLessonId || undefined}
        />

        {/* Bottom actions */}
        <div className="p-6 pt-3 flex gap-3 bg-white z-10 border-t border-gray-50">
          {isLastCard ? (
            <Button
              className="flex-1 !bg-[#58CC02] !shadow-[0_5px_0_0_#46A302]"
              onClick={finishLessonAndGoToSummary}
            >
              Finish Practice
            </Button>
          ) : (
            <Button
              className="flex-1 !bg-[#58CC02] !shadow-[0_5px_0_0_#46A302]"
              onClick={() => {
                setIsVoiceQuizMicOn(false);
                setVoiceQuizCardIndex(voiceQuizCardIndex + 1);
              }}
            >
              Next Word
            </Button>
          )}
          <Button variant="secondary" className="!border-2 !border-gray-200 !w-auto !px-6" onClick={finishLessonAndGoToSummary}>
            Skip
          </Button>
        </div>
      </div>
    );
  };

  /* ─── SUMMARY ─── */
  const renderSummary = () => (
    <div className="flex flex-col h-full items-center justify-center text-center bg-gradient-to-b from-[#E8F9DD] via-white to-[#FFF8E7] animate-in zoom-in duration-500 p-10 space-y-8">
      <LingoMascot mood="celebrating" size={140} animate />
      <div className="space-y-2">
        <h2 className="text-5xl font-black text-gray-900 tracking-tighter">Day {user.streak}!</h2>
        <p className="text-gray-500 font-bold text-lg">+10 XP earned</p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-sm font-bold border border-amber-100">🔥 Streak {user.streak}</span>
          <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-sm font-bold border border-purple-100">⭐ {user.xp} XP</span>
        </div>
      </div>
      <Button 
        className="!bg-[#58CC02] !shadow-[0_5px_0_0_#46A302] hover:!shadow-[0_3px_0_0_#46A302] hover:!translate-y-[2px]" 
        onClick={async () => {
          const progress: any = await apiService.getProgressSummary();
          setUser(prev => ({
            ...prev,
            xp: progress.totalXP || prev.xp,
            hearts: progress.hearts || prev.hearts,
            streak: progress.streak || prev.streak
          }));
          setView(ViewState.HOME);
        }}
      >
        Sweet!
      </Button>
    </div>
  );

  /* ─── AUTH CHECK LOADING ─── */
  if (isAuthenticated === null) {
    return (
      <Layout className="justify-center items-center bg-gradient-to-b from-[#E8F9DD] to-white">
        <div className="text-center space-y-4">
          <LingoMascot mood="happy" size={100} animate />
          <div className="w-12 h-12 border-4 border-[#58CC02] border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <Auth onAuthSuccess={(userData) => {
          setUser({
            xp: userData.xp || 0,
            hearts: userData.hearts || 5,
            streak: userData.streak || 0,
            language: userData.languages?.[0]?.language || 'Spanish',
            goal: 'Quick Practice',
            theme: userData.languages?.[0]?.preferredTheme || 'auto',
            level: userData.languages?.[0]?.level || 'beginner'
          });
          setIsAuthenticated(true);
        }} />
      </Layout>
    );
  }

  return (
    <Layout>
      {view === ViewState.HOME && renderHome()}
      {view === ViewState.ONBOARDING && renderOnboarding()}
      {view === ViewState.LOADING && renderLoading()}
      {view === ViewState.LESSON && renderLesson()}
      {view === ViewState.QUIZ && renderQuiz()}
      {view === ViewState.VOICE_QUIZ && renderVoiceQuiz()}
      {view === ViewState.SUMMARY && renderSummary()}
    </Layout>
  );
};

export default App;
