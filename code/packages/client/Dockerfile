FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/

FROM base AS deps
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/client/ packages/client/
RUN pnpm --filter @tichu/shared build
RUN pnpm --filter @tichu/client build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/client/.next/standalone ./
COPY --from=build /app/packages/client/.next/static ./.next/static
COPY --from=build /app/packages/client/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
