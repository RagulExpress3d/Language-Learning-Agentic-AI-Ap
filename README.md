# Lingo — AI-Powered Language Learning

Full-stack language learning app with AI-generated lessons, real-time voice tutoring, MCQ and pronunciation quizzes, and progress tracking. Built with React, Node.js, and Google Gemini.

## Features

- **AI lesson generation** — Vocabulary lessons by theme and level (words, phonetics, images, quizzes)
- **Lesson + template reuse** — Stored in MongoDB; same language/theme/level reused for all users (no repeated AI calls)
- **Real-time voice tutor** — In-lesson practice: AI speaks first, breaks down pronunciation, then listens and gives feedback
- **Guest access** — Try as guest without sign-up; trial user shares stored content
- **MCQ quiz** — Multiple-choice quiz after each lesson
- **Pronunciation quiz** — Post-quiz flashcard flow: say each word, AI scores (1–10) and gives feedback only (no guiding)
- **Progress & streaks** — XP, hearts, streak tracking and analytics
- **REST API** — JWT auth, MongoDB, structured error handling

## Architecture

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Node.js, Express, TypeScript, MongoDB
- **AI**: Google Gemini (lessons, TTS, images, Live API for voice)

## Prerequisites

- Node.js 18+ 
- MongoDB (local or MongoDB Atlas)
- Google Gemini API Key

## Setup

### 1. Clone and Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment Variables

**Frontend** (`.env`):
```env
VITE_API_URL=http://localhost:3001/api
VITE_GEMINI_API_KEY=your-gemini-api-key-here
```

**Backend** (`server/.env`):
```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/lingoagent
JWT_SECRET=your-super-secret-jwt-key-change-in-production
GEMINI_API_KEY=your-gemini-api-key-here
FRONTEND_URL=http://localhost:5173
```

### 3. Start MongoDB

```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas and update MONGODB_URI in server/.env
```

### 4. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Project structure

```
├── server/                 # Backend API
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── models/         # MongoDB models (User, Lesson, Analytics)
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic (Gemini AI)
│   │   └── middleware/     # Auth, error handling
│   └── package.json
├── src/                    # Frontend
│   ├── components/         # React components
│   ├── services/           # API client, Gemini services
│   └── types.ts           # TypeScript types
└── package.json
```

## API

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/trial` - Guest/trial login (no sign-up)
- `GET /api/auth/me` - Get current user

### Lessons
- `POST /api/lessons/generate` - Generate AI lesson
- `GET /api/lessons` - Get user's lessons (auth)
- `GET /api/lessons/templates` - List stored templates (words + slide summary; no auth)
- `GET /api/lessons/:id` - Get specific lesson with full slides and image URLs (auth)
- `PATCH /api/lessons/:id/complete` - Complete lesson

### Progress
- `GET /api/progress/summary` - Get progress summary
- `GET /api/progress/streak` - Get streak info

### Analytics
- `POST /api/analytics/track` - Track event
- `GET /api/analytics/dashboard` - Get analytics dashboard

## Viewing stored pictures and words

Generated lessons are saved in **MongoDB**:

- **LessonTemplate** — Shared by language + theme + level (words, images, quizzes). Reused for all users.
- **Lesson** — Per-user copy of a lesson (same content, plus completion state).

**Ways to see them:**

1. **In the app** — Start or resume a lesson; the words and images on screen are loaded from the DB.
2. **API (no auth)** — With the server running, open or request:
   - `http://localhost:3001/api/lessons/templates`  
   Returns a list of stored templates with language, theme, level, title, and each slide’s word, translation, phonetic, and whether it has an image.
3. **API (with auth)** — `GET /api/lessons` then `GET /api/lessons/:id` returns a full lesson including `slides[].imageUrl` (base64 data URLs for the pictures).
4. **MongoDB** — In MongoDB Compass or `mongosh`, open the `lessontemplates` and `lessons` collections. Each document has a `slides` array with `word`, `translation`, `phonetic`, `exampleSentence`, and `imageUrl` (base64 string).

## GitHub and Google Cloud Run

**→ For a full step-by-step Cloud Run guide, see [DEPLOY_CLOUDRUN.md](DEPLOY_CLOUDRUN.md).**

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

(If the repo already exists, add the remote and push. Create the repo on GitHub first if needed.)

### 2. Deploy to Google Cloud Run

**Prerequisites**

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`) installed and logged in
- A GCP project and MongoDB (e.g. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)) with a connection string
- A [Gemini API key](https://aistudio.google.com/apikey)

**One-time setup**

```bash
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

**Deploy (build from source)**

From the project root (where `Dockerfile` is):

```bash
gcloud run deploy lingo \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "MONGODB_URI=your-mongodb-connection-string" \
  --set-env-vars "JWT_SECRET=your-secret-at-least-32-chars" \
  --set-env-vars "GEMINI_API_KEY=your-gemini-api-key"
```

Cloud Run will build the image from the Dockerfile, then deploy. It will print the service URL (e.g. `https://lingo-xxxxx-uc.a.run.app`).

**Optional: add more env vars in the console**

In [Cloud Run Console](https://console.cloud.google.com/run) → your service → Edit & deploy new revision → Variables & secrets, you can add or change:

- `FRONTEND_URL` — set to your Cloud Run URL if you need CORS (e.g. `https://lingo-xxxxx-uc.a.run.app`)

**MongoDB**

Use a MongoDB Atlas (or other) cluster and put its connection string in `MONGODB_URI`. For Atlas: Network Access → allow `0.0.0.0/0` (or restrict to Cloud Run IPs if you prefer).

**Voice (mic/speaker) — no API key in the browser**

Voice (Live tutor and TTS) is **proxied through the backend**. Set `GEMINI_API_KEY` on the server only (e.g. Cloud Run → Variables & secrets → add secret `GEMINI_API_KEY`). The frontend never sees the key; mic and speaker work in the cloud with a normal deploy (e.g. `gcloud run deploy lingo --source . ...`). No build-time key or `cloudbuild.yaml` required.

### 3. Other deployment options

- **Backend only (Railway, Render, etc.)**: Deploy the `server/` folder as a Node app, set env vars, and use a separate frontend host with `VITE_API_URL` pointing at the backend.
- **Frontend on Vercel/Netlify**: Build the Vite app with `VITE_API_URL` set to your backend URL; deploy the backend (e.g. Cloud Run) separately.

## License

MIT
