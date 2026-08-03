FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy necessary packages and apps
COPY packages ./packages
COPY apps/server ./apps/server

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @peep/server build
RUN pnpm --filter @peep/shared build
RUN pnpm --filter @peep/agent build

FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy built artifacts and configuration
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["pnpm", "--filter", "@peep/server", "start"]
