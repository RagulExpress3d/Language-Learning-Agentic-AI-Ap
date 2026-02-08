import React, { useState } from 'react';
import { Button } from '../../components/UI';
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
    <div className="p-8 flex flex-col h-full items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black text-green-500 italic tracking-tighter">Lingo!</h1>
          <p className="text-gray-600 font-bold">AI-Powered Language Learning</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-sm font-black text-gray-400 uppercase tracking-wider mb-2 block">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-green-400 focus:outline-none font-bold"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-black text-gray-400 uppercase tracking-wider mb-2 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-green-400 focus:outline-none font-bold"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-black text-gray-400 uppercase tracking-wider mb-2 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-green-400 focus:outline-none font-bold"
                placeholder="••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl font-bold text-sm">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="!bg-green-500 !shadow-[0_4px_0_0_#16a34a]">
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={handleTrial}
            className="!border-2 !border-gray-200"
          >
            Try as guest
          </Button>

          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="w-full text-center text-gray-500 font-bold hover:text-green-500 transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
