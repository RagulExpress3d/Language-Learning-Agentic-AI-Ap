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
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
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
}

export const apiService = new ApiService();
