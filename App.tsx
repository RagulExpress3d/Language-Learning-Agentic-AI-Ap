
import React, { useState, useEffect } from 'react';
import { UserState, ViewState, Lesson } from './types';
import { generateLesson, generateSlideImage, generateLessonVideo } from './services/geminiService';
import { Layout } from './components/Layout';
import { Button, HeartIcon, XPIcon } from './components/UI';
import { ProgressBar } from './components/ProgressBar';
import { LiveTutor } from './components/LiveTutor';

const THEMES = [
  { id: 'auto', label: 'Surprise Me ✨', icon: '🪄' },
  { id: 'travel', label: 'Travel 🏖️', icon: '✈️' },
  { id: 'food', label: 'Food 🍜', icon: '🍱' },
  { id: 'romance', label: 'Romance ❤️', icon: '💘' },
  { id: 'business', label: 'Business 💼', icon: '📈' },
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
  const [isVoiceActive, setIsVoiceActive] = useState(false);

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
    setLoadingStep('Crafting your custom lesson...');
    setView(ViewState.LOADING);
    
    try {
      const selectedTheme = user.theme === 'auto' ? ['Street Talk', 'Nature', 'Sci-fi', 'Daily Routine'][Math.floor(Math.random()*4)] : user.theme;
      const lesson = await generateLesson(user.language, selectedTheme, user.goal, user.level);
      
      setLoadingStep('Drawing mnemonic visuals...');
      const slidesWithImages = await Promise.all(
        lesson.slides.map(async (slide) => {
          const imageUrl = await generateSlideImage(slide.visualPrompt);
          return { ...slide, imageUrl };
        })
      );
      
      setLoadingStep('Filming scenario clip...');
      try {
        const videoUrl = await generateLessonVideo(lesson.scenarioPrompt || "Language learning scenario");
        setCurrentLesson({ ...lesson, slides: slidesWithImages, videoUrl });
      } catch (e) {
        setCurrentLesson({ ...lesson, slides: slidesWithImages });
      }

      setView(ViewState.LESSON);
      setLessonIndex(0);
    } catch (error: any) {
      if (String(error).includes("KEY_RESET_REQUIRED")) setNeedsApiKey(true);
      else alert("Oops! Gemini is thinking too hard. Try again?");
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
      setIsVoiceActive(false);
    }
  };

  const handleQuizAnswer = (answer: string) => {
    const question = currentLesson?.quizzes[quizIndex];
    if (answer === question?.correctAnswer) {
      setFeedback({ type: 'success', message: 'Nailed it!' });
      setUser(prev => ({ ...prev, xp: prev.xp + 10 }));
    } else {
      setFeedback({ type: 'error', message: `Not quite. It's: ${question?.correctAnswer}` });
      setUser(prev => ({ ...prev, hearts: Math.max(0, prev.hearts - 1) }));
    }
  };

  if (needsApiKey) {
    return (
      <Layout className="justify-center items-center text-center p-8 space-y-8">
        <div className="text-7xl">🧪</div>
        <div className="space-y-4">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Setup AI Key</h2>
          <p className="text-gray-500 leading-relaxed">Select your DuolingoAgent project key to unlock native audio and high-res visuals.</p>
        </div>
        <Button onClick={handleOpenKeyDialog}>Select API Key</Button>
      </Layout>
    );
  }

  const renderHome = () => (
    <div className="p-6 flex flex-col h-full space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-black text-blue-500 italic tracking-tighter">Lingo!</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 font-bold bg-yellow-100 text-yellow-600 px-3 py-1 rounded-full text-sm">
            <XPIcon /> <span>{user.xp}</span>
          </div>
          <div className="flex items-center space-x-1 font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full text-sm">
            <HeartIcon /> <span>{user.hearts}</span>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2.5rem] p-8 text-white relative shadow-2xl shadow-blue-200">
        <div className="relative z-10">
          <p className="text-blue-100 font-bold uppercase text-xs tracking-widest mb-1">Your Progress</p>
          <h2 className="text-4xl font-black mb-4">{user.streak} Day Streak!</h2>
          <div className="bg-white/20 h-2 rounded-full mb-6">
            <div className="bg-white h-full rounded-full" style={{ width: '40%' }}></div>
          </div>
          <Button variant="secondary" onClick={() => setView(ViewState.ONBOARDING)} className="border-none text-blue-600">
            Start Today's Goal
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-800 px-2">Ready to Speak?</h3>
        <div className="bg-white border-2 border-gray-100 p-6 rounded-[2rem] flex items-center justify-between hover:border-blue-200 transition-colors cursor-pointer group" onClick={() => setView(ViewState.ONBOARDING)}>
          <div className="flex items-center space-x-4">
            <div className="text-4xl group-hover:scale-110 transition-transform">🗣️</div>
            <div>
              <p className="font-black text-gray-900">Custom Lesson</p>
              <p className="text-sm text-gray-400">Agentic AI Tutor</p>
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-2xl group-hover:bg-blue-50">➡️</div>
        </div>
      </div>
    </div>
  );

  const renderOnboarding = () => (
    <div className="p-8 flex flex-col h-full animate-in slide-in-from-right duration-500">
      <div className="flex-1 space-y-10">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">Pick a Path</h2>
          <p className="text-gray-500 font-medium">What's the vibe today?</p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => setUser({...user, theme: theme.id})}
                className={`p-5 rounded-[1.5rem] border-2 flex flex-col items-center justify-center space-y-2 transition-all ${user.theme === theme.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'}`}
              >
                <span className="text-3xl">{theme.icon}</span>
                <span className="font-black text-sm">{theme.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Level</label>
            <div className="flex bg-gray-100 p-1.5 rounded-2xl">
              {['beginner', 'intermediate', 'advanced'].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setUser({...user, level: lvl as any})}
                  className={`flex-1 py-3 rounded-xl font-black text-sm capitalize transition-all ${user.level === lvl ? 'bg-white shadow-sm text-blue-500' : 'text-gray-400'}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-3 pt-6">
        <Button onClick={startNewLesson}>Generate Lesson</Button>
        <Button variant="ghost" onClick={() => setView(ViewState.HOME)}>Back</Button>
      </div>
    </div>
  );

  const renderLesson = () => {
    const slide = currentLesson?.slides[lessonIndex];
    if (!slide) return null;
    return (
      <div className="flex flex-col h-full bg-white relative animate-in fade-in duration-300">
        <div className="p-6 pb-2">
          <div className="flex items-center space-x-4 mb-4">
            <button onClick={() => setView(ViewState.HOME)} className="text-gray-300 hover:text-gray-600 transition-colors">✕</button>
            <ProgressBar progress={((lessonIndex) / (currentLesson?.slides.length || 1)) * 100} />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center p-6 text-center space-y-6 overflow-y-auto">
          {lessonIndex === 0 && currentLesson?.videoUrl && (
            <video src={currentLesson.videoUrl} className="w-full rounded-[2rem] shadow-xl border-4 border-white mb-2" autoPlay muted loop />
          )}

          <div className="w-full aspect-square bg-blue-50 rounded-[2.5rem] overflow-hidden shadow-inner border-2 border-blue-100">
            <img src={slide.imageUrl} alt={slide.word} className="w-full h-full object-cover" />
          </div>
          
          <div className="space-y-1">
            <h1 className="text-5xl font-black text-gray-900 tracking-tighter">{slide.word}</h1>
            <p className="text-xl text-blue-400 font-medium italic">/ {slide.phonetic} /</p>
          </div>

          <div className="bg-gray-50 p-6 rounded-[2rem] w-full text-left relative group">
            <p className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1">{user.language}</p>
            <p className="text-2xl font-black text-gray-800">{slide.translation}</p>
            <p className="mt-2 text-gray-500 leading-relaxed font-medium italic">"{slide.exampleSentence}"</p>
          </div>
        </div>

        <LiveTutor 
          language={user.language} 
          context={slide.word} 
          active={isVoiceActive} 
          onKeyError={() => setNeedsApiKey(true)} 
        />

        <div className="p-6 pt-2 flex space-x-3 bg-white z-10">
          <button 
            onClick={() => setIsVoiceActive(!isVoiceActive)}
            className={`w-20 h-16 rounded-[1.5rem] border-2 flex items-center justify-center transition-all ${isVoiceActive ? 'bg-blue-500 border-blue-600 text-white shadow-lg' : 'border-gray-100 text-gray-400 bg-white hover:bg-gray-50'}`}
          >
            <span className="text-2xl">{isVoiceActive ? '🛑' : '🎙️'}</span>
          </button>
          <Button className="flex-1" onClick={nextSlide}>
            {lessonIndex === (currentLesson?.slides.length || 1) - 1 ? 'Start Quiz' : 'Next Word'}
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
            <div className="flex items-center space-x-4">
              <button onClick={() => setView(ViewState.HOME)} className="text-gray-300">✕</button>
              <ProgressBar progress={(quizIndex / (currentLesson?.quizzes.length || 1)) * 100} />
            </div>
         </div>
         <div className="flex-1 p-8 flex flex-col justify-center space-y-10">
            <div className="space-y-4 text-center">
              <span className="text-6xl">🧐</span>
              <h2 className="text-3xl font-black text-gray-900 leading-tight">{question.question}</h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {question.options.map((opt, i) => (
                <button key={i} onClick={() => handleQuizAnswer(opt)} className="p-6 text-left rounded-[1.5rem] border-2 border-gray-100 font-bold text-lg hover:border-blue-500 hover:bg-blue-50 transition-all active:scale-95">
                  {opt}
                </button>
              ))}
            </div>
         </div>
         {feedback && (
            <div className={`p-8 pb-10 border-t-4 fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 bg-white animate-in slide-in-from-bottom duration-300 ${feedback.type === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
              <div className="flex items-center space-x-6 mb-6">
                <div className="text-6xl">{feedback.type === 'success' ? '🥳' : '🫠'}</div>
                <div className="flex-1">
                  <h3 className={`text-2xl font-black ${feedback.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{feedback.type === 'success' ? 'Amazing!' : 'Whoops!'}</h3>
                  <p className="text-gray-600 font-medium">{feedback.message}</p>
                </div>
              </div>
              <Button onClick={() => {
                setFeedback(null);
                if (quizIndex < (currentLesson?.quizzes.length || 0) - 1) setQuizIndex(quizIndex + 1);
                else setView(ViewState.SUMMARY);
              }}>Continue</Button>
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
        <div className="p-10 flex flex-col h-full items-center justify-center text-center space-y-10">
          <div className="relative">
            <div className="w-40 h-40 border-[10px] border-blue-50 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-6xl">🤖</div>
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-gray-900">Training Agent...</h2>
            <p className="text-blue-500 font-black animate-pulse uppercase tracking-widest text-xs">{loadingStep}</p>
          </div>
        </div>
      )}
      {view === ViewState.LESSON && renderLesson()}
      {view === ViewState.QUIZ && renderQuiz()}
      {view === ViewState.SUMMARY && (
        <div className="p-10 flex flex-col h-full items-center justify-center text-center space-y-10 bg-gradient-to-b from-white to-blue-50">
           <div className="text-9xl animate-bounce">🥇</div>
           <div className="space-y-2">
             <h2 className="text-5xl font-black text-gray-900 tracking-tight">Lesson Done!</h2>
             <p className="text-gray-500 font-bold">+10 XP • Correcting {user.language} pronunciation</p>
           </div>
           <Button onClick={() => setView(ViewState.HOME)}>Sweet!</Button>
        </div>
      )}
    </Layout>
  );
};

export default App;
