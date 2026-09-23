# ── Stage 1: build de producción ─────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Variables VITE_* en tiempo de build: `vite build` las inlina en import.meta.env.
ARG VITE_APP_ENV=development
ARG VITE_API_URL=/api
ENV VITE_APP_ENV=${VITE_APP_ENV}
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: nginx interno (encapsulado — NO toca el proxy del host) ─────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
