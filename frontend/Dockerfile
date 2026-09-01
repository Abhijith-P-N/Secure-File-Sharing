FROM node:20-alpine AS build

WORKDIR /app

# API base URL used by the built SPA. Empty = same-origin (/api proxied by nginx).
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config (template for Render, static fallback for docker-compose)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Render injects PORT and BACKEND_URL; generate the config from the template.
COPY render-start.sh /render-start.sh
RUN chmod +x /render-start.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/ || exit 1

CMD ["/render-start.sh"]