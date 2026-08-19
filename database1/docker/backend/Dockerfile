# ============================================================================
# Backend API - Dockerfile (DevOps scaffold - infra lives in docker/ separate
# from Azin's backend code).
#
# Build context is the repo root so infra stays in docker/:
#   build: { context: ., dockerfile: docker/backend/Dockerfile }
# Required to run: docker compose --profile full up -d
# ============================================================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ .

# Non-root user for the app (least privilege)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

EXPOSE 8000
CMD ["node", "src/server.js"]