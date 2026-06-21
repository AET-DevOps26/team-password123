# syntax=docker/dockerfile:1

# ── Build the static SPA ─────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The SPA always talks to the real backend; .env.local is excluded via
# .dockerignore so local dev overrides never leak into the image.
RUN npm run build

# ── Serve via nginx, reverse-proxying /api/* to the backend services ──
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
