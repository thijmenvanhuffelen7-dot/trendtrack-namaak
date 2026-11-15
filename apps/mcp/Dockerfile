# Bouwen vanuit de root van de monorepo:  docker build -f apps/mcp/Dockerfile .
ARG NODE_IMAGE=node:22-slim
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/mcp/package.json apps/mcp/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile --prod=false --filter mcp...

FROM base AS runtime
ENV NODE_ENV=production MCP_PORT=3333
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY packages/db packages/db
COPY apps/mcp apps/mcp
USER node
WORKDIR /app/apps/mcp
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3333/health || exit 1
CMD ["node", "--import", "tsx", "src/index.ts"]
