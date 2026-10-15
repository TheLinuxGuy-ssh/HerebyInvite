FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY prompts ./prompts
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm lint \
  && pnpm typecheck \
  && pnpm test

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app

USER node
EXPOSE 8787
CMD ["pnpm", "--dir", "apps/web", "start"]
