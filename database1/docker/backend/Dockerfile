# ============================================================================
# Backend API - Dockerfile (DevOps scaffold - infra lives in docker/ separate
# from Azin's backend code).
#
# Build context is the repo root so infra stays in docker/:
#   build: { context: .., dockerfile: database1/docker/backend/Dockerfile }
# Required to run: docker compose --profile full up -d
# ============================================================================
FROM node:20-alpine AS deps
# bcrypt compiles native code on musl (node-gyp-build) - add build tooling.
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY secure-file-backend/package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY secure-file-backend/ .

# Non-root user for the app (least privilege)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && mkdir -p /app/uploads \
    && chown -R appuser:appgroup /app
USER appuser

EXPOSE 8000
CMD ["node", "server.js"]