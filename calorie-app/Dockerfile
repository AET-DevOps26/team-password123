# syntax=docker/dockerfile:1

# ── Build the static SPA ─────────────────────────────────────────────
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The SPA always talks to the real backend; .env.local is excluded via
# .dockerignore so local dev overrides never leak into the image.
RUN npm run build

# ── Serve via nginx (unprivileged: runs as non-root uid 101, listens on 8080) ──
FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Explicit non-root, numeric UID (the unprivileged base's built-in nginx user).
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:8080/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
