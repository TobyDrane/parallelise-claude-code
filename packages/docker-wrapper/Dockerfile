# Multi-stage build for Claude Code wrapper
# Build stage
FROM node:20-slim AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY packages/docker-wrapper/package.json ./
COPY tsconfig.base.json ./
COPY packages/docker-wrapper/tsconfig.json ./

COPY packages/docker-wrapper/src/ ./src/

RUN pnpm install && \
    sed -i 's|../../tsconfig.base.json|./tsconfig.base.json|' tsconfig.json && \
    pnpm run build

FROM node:20-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    && rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm && \
    npm install -g @anthropic-ai/claude-code

RUN groupadd -r claude && useradd -r -g claude -m claude && \
    mkdir -p /workspace && \
    chown claude:claude /workspace

COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/package.json ./

RUN pnpm install --prod --no-lockfile

COPY packages/docker-wrapper/healthcheck.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/healthcheck.sh

USER claude

VOLUME /workspace

ENV NODE_ENV=production \
    WORKSPACE_DIR=/workspace

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["/usr/local/bin/healthcheck.sh"]

STOPSIGNAL SIGTERM

CMD ["node", "dist/index.js"] 