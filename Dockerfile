# SyncWatch backend (Fastify + Socket.IO + Prisma).
# Build context = repo root. Deploys the server + the shared package only.
FROM node:20

RUN npm install -g pnpm@10

WORKDIR /app

# --- Install deps (server + shared) using the workspace lockfile ---
# Copy manifests first for better layer caching. All workspace package.json
# files are needed so pnpm can validate the frozen lockfile.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/server/package.json ./packages/server/package.json
COPY packages/client/package.json ./packages/client/package.json
RUN pnpm install --frozen-lockfile --filter "@syncwatch/server..."

# --- App source (only what the server needs) ---
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Generate the Prisma client for this container's platform.
RUN pnpm --filter @syncwatch/server exec prisma generate

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Apply pending migrations, then start the server (tsx runs the TS directly,
# which keeps the monorepo's shared package resolvable without a build step).
CMD ["sh", "-c", "pnpm --filter @syncwatch/server run migrate:deploy && pnpm --filter @syncwatch/server run start:prod"]
