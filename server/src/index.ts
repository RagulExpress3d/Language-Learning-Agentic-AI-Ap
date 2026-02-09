import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB, dbReady } from './config/database.js';
import { setupLiveWs } from './liveProxy.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import lessonRoutes from './routes/lessons.js';
import progressRoutes from './routes/progress.js';
import analyticsRoutes from './routes/analytics.js';
import voiceRoutes from './routes/voice.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: process.env.FRONTEND_URL || (isProduction ? undefined : 'http://localhost:5173'),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Wait for MongoDB before handling API requests (avoids "buffering timed out")
const DB_WAIT_MS = 20000;
app.use('/api', (_req, res, next) => {
  const timeout = setTimeout(() => {
    res.status(503).json({ error: 'Database unavailable. Try again in a moment.' });
  }, DB_WAIT_MS);
  dbReady
    .then(() => {
      clearTimeout(timeout);
      next();
    })
    .catch(() => {
      clearTimeout(timeout);
      res.status(503).json({ error: 'Database connection failed. Check server logs.' });
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api', voiceRoutes);

if (isProduction) {
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.use(errorHandler);

// Use HTTP server so we can attach WebSocket for Live API proxy (/api/live/ws).
const server = http.createServer(app);
setupLiveWs(server);

// Listen on PORT first so Cloud Run sees the container as ready (startup check).
// Then connect DB in background; otherwise DB connect can hang/fail and we never bind to PORT.
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  connectDB().catch((err) => {
    console.error('❌ MongoDB connection failed (will retry on first request):', err.message);
  });
});
