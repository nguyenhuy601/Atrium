# syntax=docker/dockerfile:1
# SPA build → nginx. Bake absolute VITE_* at build time for split-host (api.$DOMAIN).
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=https://api.atrium.dev/api
ARG VITE_SOCKET_URL=https://api.atrium.dev
ARG VITE_SOCKET_USE_GATEWAY=true
ARG VITE_VOICE_SIGNAL_URL=https://api.atrium.dev
ARG VITE_VOICE_SIGNAL_PATH=/voice-socket

ENV VITE_API_URL=$VITE_API_URL \
    VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_SOCKET_USE_GATEWAY=$VITE_SOCKET_USE_GATEWAY \
    VITE_VOICE_SIGNAL_URL=$VITE_VOICE_SIGNAL_URL \
    VITE_VOICE_SIGNAL_PATH=$VITE_VOICE_SIGNAL_PATH

RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
