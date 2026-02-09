# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Same-origin API when served from this container
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
# Optional: pass VITE_GEMINI_API_KEY at build time if you want client-side key (e.g. AI Studio).
# If omitted, voice/TTS use the backend proxy (GEMINI_API_KEY on server only).
ARG VITE_GEMINI_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine
WORKDIR /app/server
ENV NODE_ENV=production
COPY --from=backend /app/server/package.json /app/server/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=backend /app/server/dist ./dist
COPY --from=frontend /app/dist ./public
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/index.js"]
