# syntax=docker/dockerfile:1.7
#
# One image: the NestJS API (which also serves the built Vue app) running on top
# of the official Hermes Agent image, so every eval run executes the real
# Hermes CLI in the same container.

ARG NODE_IMAGE=node:22-bookworm-slim
ARG HERMES_IMAGE=nousresearch/hermes-agent:v0.22.1

# ─── Build: install, compile shared + API + web, then drop dev dependencies ───
FROM ${NODE_IMAGE} AS build
WORKDIR /app
# npm 11 avoids an arborist resolution bug in npm 10 with this dependency graph.
RUN npm install -g npm@11.21.0 --no-fund --no-audit
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --no-fund --no-audit
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run build && npm prune --omit=dev --no-fund --no-audit

# ─── Runtime: Hermes image + Node + the built app ───
FROM ${NODE_IMAGE} AS node
FROM ${HERMES_IMAGE} AS runtime
COPY --from=node /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/drizzle apps/api/drizzle
COPY --from=build /app/apps/web/dist apps/web/dist
COPY evals ./evals

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data \
    EVALS_DIR=/app/evals \
    WEB_DIST_DIR=/app/apps/web/dist \
    HERMES_BIN=/opt/hermes/.venv/bin/hermes

# Hermes refuses to run its gateway as root; the image ships a `hermes` user.
RUN mkdir -p /data && chown hermes:hermes /data
USER hermes
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Node is the main process; compose runs it under `init: true` so orphaned
# agent subprocesses are reaped.
ENTRYPOINT ["node", "apps/api/dist/main.js"]
