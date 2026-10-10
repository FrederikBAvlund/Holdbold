# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Optional CA mount for builds in managed environments; unnecessary on Hetzner.
RUN --mount=type=secret,id=proxy_ca NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci
COPY . .
ARG NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY
ENV NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=$NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm run cron:build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
# Prisma CLI is retained for explicit migration commands.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/next.config.mjs ./
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node deploy/start-app.sh ./deploy/start-app.sh
RUN mkdir -p /data/profile-images && chown node:node /data/profile-images
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "/app/deploy/start-app.sh"]
CMD ["npm", "start", "--", "--hostname", "0.0.0.0"]
