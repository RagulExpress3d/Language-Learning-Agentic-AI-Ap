const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Load failed')) {
        throw new Error('Cannot reach server. Start the backend: run "npm run dev" in the server folder.');
      }
      throw err;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error((error as { error?: string }).error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // Auth endpoints
  async register(email: string, password: string, name?: string) {
    const data = await this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getCurrentUser() {
    return this.request<{ user: any }>('/auth/me');
  }

  /** Trial/guest login: no sign-up, uses shared trial user. */
  async trialLogin() {
    const data = await this.request<{ token: string; user: any }>('/auth/trial', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    this.setToken(data.token);
    return data;
  }

  // User endpoints
  async updateLanguage(language: string, level?: string, preferredTheme?: string, learningStyle?: string) {
    return this.request('/users/language', {
      method: 'PATCH',
      body: JSON.stringify({ language, level, preferredTheme, learningStyle }),
    });
  }

  async updateStats(xp?: number, hearts?: number, language?: string) {
    return this.request('/users/stats', {
      method: 'PATCH',
      body: JSON.stringify({ xp, hearts, language }),
    });
  }

  // Lesson endpoints
  async generateLesson(language: string, theme: string, goal?: string, level?: string) {
    return this.request<{ lesson: any }>('/lessons/generate', {
      method: 'POST',
      body: JSON.stringify({ language, theme, goal, level }),
    });
  }

  async getLessons(language?: string, completed?: boolean) {
    const params = new URLSearchParams();
    if (language) params.append('language', language);
    if (completed !== undefined) params.append('completed', String(completed));
    return this.request<{ lessons: any[] }>(`/lessons?${params}`);
  }

  async getLesson(id: string) {
    return this.request<{ lesson: any }>(`/lessons/${id}`);
  }

  async completeLesson(id: string, score: number, timeSpent: number) {
    return this.request(`/lessons/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ score, timeSpent }),
    });
  }

  // Progress endpoints
  async getProgressSummary() {
    return this.request('/progress/summary');
  }

  async getStreakInfo() {
    return this.request('/progress/streak');
  }

  // Analytics endpoints
  async trackEvent(eventType: string, metadata?: Record<string, any>) {
    return this.request('/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ eventType, metadata }),
    });
  }

  async getAnalytics(days: number = 30) {
    return this.request(`/analytics/dashboard?days=${days}`);
  }

  /** TTS via backend (no client API key). Returns { audio: base64 }. */
  async getTTS(text: string, language: string): Promise<{ audio: string }> {
    return this.request<{ audio: string }>('/tts', {
      method: 'POST',
      body: JSON.stringify({ text, language }),
    });
  }

  /** Pronunciation score via backend. Returns { score, feedback, accuracy }. */
  async scorePronunciation(
    spokenText: string,
    targetText: string,
    language: string
  ): Promise<{ score: number; feedback: string; accuracy: number }> {
    return this.request('/pronunciation/score', {
      method: 'POST',
      body: JSON.stringify({ spokenText, targetText, language }),
    });
  }

  /** WebSocket URL for Live API proxy (backend holds API key). */
  getLiveWsUrl(): string {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    if (typeof base === 'string' && base.startsWith('http://')) {
      return base.replace('http://', 'ws://').replace(/\/api\/?$/, '') + '/api/live/ws';
    }
    if (typeof base === 'string' && base.startsWith('https://')) {
      return base.replace('https://', 'wss://').replace(/\/api\/?$/, '') + '/api/live/ws';
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/live/ws`;
  }
}

export const apiService = new ApiService();
