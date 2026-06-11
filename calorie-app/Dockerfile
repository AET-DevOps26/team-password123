# syntax=docker/dockerfile:1

# ── Build the static SPA ─────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Production defaults apply: MOCK_MODE/OFFLINE_MODE are off because
# .env.local is excluded via .dockerignore, so the build hits the real backend.
RUN npm run build

# ── Serve via nginx, reverse-proxying /api/* to the backend services ──
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
