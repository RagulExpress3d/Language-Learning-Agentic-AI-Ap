
import React, { useState } from 'react';
import { UserState, ViewState, Lesson } from './types';
import { generateLesson, generateSlideImage, generateLessonVideo } from './services/geminiService';
import { Layout } from './components/Layout';
import { Button, HeartIcon, XPIcon } from './components/UI';
import { ProgressBar } from './components/ProgressBar';
import { LiveTutor } from './components/LiveTutor';

const App: React.FC = () => {
  const [user, setUser] = useState<UserState>({
    xp: 0,
    hearts: 5,
    streak: 3,
    language: 'Spanish',
    goal: 'Travel Basics',
    level: 'beginner'
  });

  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Generating curriculum...');

  const startNewLesson = async () => {
    setIsLoading(true);
    setLoadingStep('Agentic AI is crafting your lesson...');
    setView(ViewState.LOADING);
    
    try {
      const lesson = await generateLesson(user.language, user.goal, user.level);
      setCurrentLesson(lesson);
      
      setLoadingStep('Generating visual aids with Gemini Image...');
      const slidesWithImages = await Promise.all(
        lesson.slides.map(async (slide) => {
          const imageUrl = await generateSlideImage(slide.visualPrompt);
          return { ...slide, imageUrl };
        })
      );
      
      setLoadingStep('Generating Veo Scenario Video...');
      const videoUrl = await generateLessonVideo(lesson.scenarioPrompt || "Daily conversation");
      
      setCurrentLesson({ ...lesson, slides: slidesWithImages, videoUrl });
      setView(ViewState.LESSON);
      setLessonIndex(0);
    } catch (error) {
      console.error(error);
      alert("Failed to generate lesson. Please check your API key.");
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
    if (!question) return;

    if (answer === question.correctAnswer) {
      setFeedback({ type: 'success', message: 'Amazing!' });
      setUser(prev => ({ ...prev, xp: prev.xp + 10 }));
    } else {
      setFeedback({ type: 'error', message: `Incorrect. It was: ${question.correctAnswer}` });
      setUser(prev => ({ ...prev, hearts: Math.max(0, prev.hearts - 1) }));
    }
  };

  const nextQuiz = () => {
    setFeedback(null);
    if (quizIndex < (currentLesson?.quizzes.length || 0) - 1) {
      setQuizIndex(quizIndex + 1);
    } else {
      setView(ViewState.SUMMARY);
    }
  };

  const renderHome = () => (
    <div className="p-6 flex flex-col h-full space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black text-blue-600">LingoAgent</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 font-bold">
            <XPIcon />
            <span>{user.xp}</span>
          </div>
          <div className="flex items-center space-x-1 font-bold text-red-500">
            <HeartIcon />
            <span>{user.hearts}</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-6 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-blue-900">Streak: {user.streak} Days!</h2>
          <p className="text-blue-700 mt-2">You're on fire! Keep going to maintain your streak.</p>
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-10">
          <svg className="w-32 h-32 fill-blue-500" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-800">Current Goal</h3>
        <div className="flex items-center justify-between bg-white border-2 border-gray-100 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="bg-green-100 p-3 rounded-xl text-2xl">🌍</div>
            <div>
              <p className="font-bold text-gray-900">{user.language}</p>
              <p className="text-sm text-gray-500">{user.goal}</p>
            </div>
          </div>
          <button 
            onClick={() => setView(ViewState.LIVE_TUTOR)}
            className="p-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors"
            title="Start Voice Session"
          >
            🎙️
          </button>
        </div>
        
        <div className="bg-white border-2 border-gray-100 p-6 rounded-3xl text-center space-y-4">
          <div className="text-5xl">🧠</div>
          <h3 className="text-xl font-bold">Ready for a new lesson?</h3>
          <p className="text-gray-500">Our Agentic AI will generate fresh content based on your progress.</p>
          <Button onClick={() => setView(ViewState.ONBOARDING)}>Customize Lesson</Button>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-3xl text-white space-y-4 shadow-lg">
          <div className="text-4xl">🗣️</div>
          <h3 className="text-xl font-bold">Live Voice Tutor</h3>
          <p className="text-indigo-100 text-sm">Practice pronunciation with real-time feedback from our Gemini Live AI.</p>
          <Button variant="secondary" onClick={() => setView(ViewState.LIVE_TUTOR)} className="border-none text-indigo-600">
            Start Conversation
          </Button>
        </div>
      </div>
    </div>
  );

  const renderOnboarding = () => (
    <div className="p-6 flex flex-col h-full">
      <div className="flex-1 space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-gray-900">Customize Path</h2>
          <p className="text-gray-500">Tailor your learning experience.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Language</label>
            <select 
              value={user.language} 
              onChange={(e) => setUser({...user, language: e.target.value})}
              className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl outline-none focus:border-blue-500"
            >
              {['Spanish', 'French', 'Japanese', 'Italian', 'German', 'Arabic', 'Chinese', 'Portuguese'].map(lang => (
                <option key={lang}>{lang}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Starting Level</label>
            <div className="grid grid-cols-3 gap-2">
              {['beginner', 'intermediate', 'advanced'].map(level => (
                <button
                  key={level}
                  onClick={() => setUser({...user, level: level as any})}
                  className={`p-3 rounded-xl border-2 font-bold capitalize text-sm ${user.level === level ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-100 text-gray-500'}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Goal / Topic</label>
            <input 
              type="text"
              value={user.goal}
              placeholder="e.g., Ordering coffee, Business meeting..."
              onChange={(e) => setUser({...user, goal: e.target.value})}
              className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>
      <div className="space-y-4 pt-6">
        <Button onClick={startNewLesson}>Generate Lesson</Button>
        <Button variant="ghost" onClick={() => setView(ViewState.HOME)}>Back</Button>
      </div>
    </div>
  );

  const renderLesson = () => {
    const slide = currentLesson?.slides[lessonIndex];
    if (!slide) return null;
    const progress = ((lessonIndex) / (currentLesson?.slides.length || 1)) * 100;

    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-6 pb-0 space-y-4">
          <div className="flex items-center space-x-4">
            <button onClick={() => setView(ViewState.HOME)} className="text-gray-400">✕</button>
            <ProgressBar progress={progress} />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center p-6 text-center space-y-6 overflow-y-auto">
          {/* Scenario Video (First Slide) */}
          {lessonIndex === 0 && currentLesson?.videoUrl && (
            <div className="w-full space-y-4">
              <div className="bg-indigo-50 p-4 rounded-2xl text-left border border-indigo-100">
                <p className="text-xs font-bold text-indigo-500 uppercase">Scenario Overview</p>
                <p className="text-indigo-800 font-medium">{currentLesson.scenarioPrompt}</p>
              </div>
              <video 
                src={currentLesson.videoUrl} 
                className="w-full rounded-3xl shadow-xl border-4 border-white" 
                autoPlay 
                muted 
                loop
              />
            </div>
          )}

          <div className="w-full aspect-square bg-gray-100 rounded-3xl overflow-hidden shadow-lg border-4 border-white">
            {slide.imageUrl ? (
              <img src={slide.imageUrl} alt={slide.word} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 animate-pulse" />
            )}
          </div>
          
          <div className="space-y-2">
            <h1 className="text-5xl font-black text-blue-600 tracking-tight">{slide.word}</h1>
            <p className="text-xl text-gray-400 font-medium italic">/ {slide.phonetic} /</p>
            <p className="text-2xl font-bold text-gray-800 border-t border-gray-100 pt-4">{slide.translation}</p>
          </div>

          <div className="bg-gray-50 p-6 rounded-2xl w-full text-left flex justify-between items-center group cursor-pointer hover:bg-blue-50 transition-colors"
               onClick={() => setView(ViewState.LIVE_TUTOR)}>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase mb-1">Example</p>
              <p className="text-lg text-gray-700 italic">"{slide.exampleSentence}"</p>
            </div>
            <div className="text-2xl opacity-0 group-hover:opacity-100 transition-opacity">🎙️</div>
          </div>
        </div>

        <div className="p-6 flex space-x-4">
          <Button variant="secondary" className="w-1/4" onClick={() => setView(ViewState.LIVE_TUTOR)}>🎙️</Button>
          <Button className="flex-1" onClick={nextSlide}>
            {lessonIndex === (currentLesson?.slides.length || 1) - 1 ? 'Start Quiz' : 'Continue'}
          </Button>
        </div>
      </div>
    );
  };

  const renderLoading = () => (
    <div className="p-10 flex flex-col h-full items-center justify-center text-center space-y-8">
      <div className="relative">
        <div className="w-32 h-32 border-8 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-4xl animate-bounce">🤖</div>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-gray-900">Generating...</h2>
        <p className="text-blue-600 font-semibold">{loadingStep}</p>
        <p className="text-xs text-gray-400">High-quality video and audio generation may take 15-30 seconds.</p>
      </div>
    </div>
  );

  return (
    <Layout>
      {view === ViewState.HOME && renderHome()}
      {view === ViewState.ONBOARDING && renderOnboarding()}
      {view === ViewState.LOADING && renderLoading()}
      {view === ViewState.LESSON && renderLesson()}
      {view === ViewState.LIVE_TUTOR && (
        <LiveTutor 
          language={user.language} 
          context={currentLesson?.title || user.goal} 
          onClose={() => setView(currentLesson ? ViewState.LESSON : ViewState.HOME)} 
        />
      )}
      {/* Existing other views omitted for brevity, logic remains same */}
      {view === ViewState.QUIZ && (
        <div className="flex flex-col h-full">
           {/* Reusing existing Quiz render logic */}
           <div className="p-6 pb-0 flex items-center space-x-4 justify-between">
              <button onClick={() => setView(ViewState.HOME)} className="text-gray-400">✕</button>
              <ProgressBar progress={(quizIndex / (currentLesson?.quizzes.length || 1)) * 100} />
           </div>
           <div className="flex-1 p-6 flex flex-col justify-center space-y-8">
              <h2 className="text-2xl font-black text-gray-800">{currentLesson?.quizzes[quizIndex].question}</h2>
              <div className="grid grid-cols-1 gap-4">
                {currentLesson?.quizzes[quizIndex].options.map((opt, i) => (
                  <button key={i} onClick={() => handleQuizAnswer(opt)} className="p-6 text-left rounded-2xl border-2 font-bold text-lg hover:border-blue-500 hover:bg-blue-50 transition-all">
                    {opt}
                  </button>
                ))}
              </div>
           </div>
           {feedback && (
              <div className={`p-6 pb-8 border-t-4 fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 bg-white ${feedback.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="text-4xl">{feedback.type === 'success' ? '🎉' : '❌'}</div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-black ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.type === 'success' ? 'Excellent!' : 'Oh no!'}</h3>
                    <p className="text-gray-600">{feedback.message}</p>
                  </div>
                </div>
                <Button onClick={nextQuiz}>Continue</Button>
              </div>
           )}
        </div>
      )}
      {view === ViewState.SUMMARY && (
        <div className="p-10 flex flex-col h-full items-center justify-center text-center space-y-8">
           <div className="text-9xl animate-bounce">🏆</div>
           <h2 className="text-4xl font-black text-gray-900">Lesson Complete!</h2>
           <Button onClick={() => setView(ViewState.HOME)}>Awesome!</Button>
        </div>
      )}
    </Layout>
  );
};

export default App;
