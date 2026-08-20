# ============================================================================
# Frontend - Dockerfile (DevOps scaffold - infra lives in docker/ separate
# from Haroon's frontend code).
#
# Build context is the repo root so infra stays in docker/:
#   build: { context: .., dockerfile: docker/frontend/Dockerfile }
# Builds the React/Vite app and serves it with nginx (port 80).
# Required to run: docker compose --profile full up -d
# ============================================================================
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ .
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY database1/docker/nginx/frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]