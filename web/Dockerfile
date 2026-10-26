# syntax=docker/dockerfile:1

# The app needs a long-running Node server with a persistent disk:
# SQLite, uploaded photos and the QVAC model cache all live on that disk.
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
 && npm prune --omit=dev

FROM node:24-bookworm-slim AS runner
WORKDIR /app

# Everything that survives a restart lives under /data. Keeping HOME here makes
# QVAC cache its models and RAG workspace in /data/home/.qvac instead of the
# container's ephemeral home directory.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOME=/data/home \
    WAREHOUSE_DB_PATH=/data/warehouse.db \
    WAREHOUSE_UPLOAD_DIR=/data

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates gosu \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/qvac.config.json ./qvac.config.json
COPY --from=builder --chown=node:node /app/data/sop ./data/sop

COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /data/home /data/uploads \
 && chown -R node:node /data

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"]
