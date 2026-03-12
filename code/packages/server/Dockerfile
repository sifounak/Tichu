FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

FROM base AS deps
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
RUN pnpm --filter @tichu/shared build
RUN pnpm --filter @tichu/server build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/packages/server/package.json ./
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
