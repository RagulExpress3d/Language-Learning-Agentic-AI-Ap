import React, { useState } from 'react';
import { Button } from '../../components/UI';
import { LingoMascot } from '../../components/LingoMascot';
import { apiService } from '../../services/api';

interface AuthProps {
  onAuthSuccess: (user: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await apiService.login(email, password);
      } else {
        result = await apiService.register(email, password, name);
      }
      onAuthSuccess(result.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTrial = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await apiService.trialLogin();
      onAuthSuccess(result.user);
    } catch (err: any) {
      const message = err?.message || 'Trial failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gradient-to-b from-[#E8F9DD] via-white to-[#FFF8E7]">
      {/* Hero area with mascot */}
      <div className="flex flex-col items-center pt-12 pb-6 px-6">
        <div className="relative">
          <LingoMascot mood="waving" size={110} animate />
          {/* Speech bubble */}
          <div className="absolute -right-4 -top-2 bg-white rounded-2xl rounded-bl-sm px-3 py-1.5 shadow-lg border border-green-100">
            <span className="text-sm font-black text-green-600">Hola!</span>
          </div>
        </div>

        <div className="text-center mt-4 space-y-1">
          <h1 className="text-4xl font-black tracking-tighter">
            <span className="text-[#58CC02]">Lingo</span>
            <span className="text-gray-800">Agent</span>
          </h1>
          <p className="text-gray-500 font-bold text-sm">Your AI-Powered Language Buddy</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pb-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-xl shadow-green-100/50 border border-gray-100 space-y-5">
          <div className="space-y-3">
            {!isLogin && (
              <div>
                <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-[0.15em] mb-1.5 block pl-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-[#58CC02] focus:ring-2 focus:ring-green-100 focus:outline-none font-bold text-gray-800 transition-all"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-[0.15em] mb-1.5 block pl-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-[#58CC02] focus:ring-2 focus:ring-green-100 focus:outline-none font-bold text-gray-800 transition-all"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-[0.15em] mb-1.5 block pl-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-[#58CC02] focus:ring-2 focus:ring-green-100 focus:outline-none font-bold text-gray-800 transition-all"
                placeholder="••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-100 text-red-600 px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="space-y-3 pt-1">
            <Button disabled={loading} className="!bg-[#58CC02] !shadow-[0_5px_0_0_#46A302] hover:!shadow-[0_3px_0_0_#46A302] hover:!translate-y-[2px]">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Loading...
                </span>
              ) : isLogin ? 'Sign In' : 'Create Account'}
            </Button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-bold text-gray-400 uppercase">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={handleTrial}
              className="!border-2 !border-[#58CC02]/20 !text-[#46A302] hover:!bg-green-50"
            >
              🚀 Try as Guest
            </Button>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="w-full text-center text-gray-400 font-bold text-sm hover:text-[#58CC02] transition-colors pt-1"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
