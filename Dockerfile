FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends bzip2 unzip && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@12.11.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/server/package.json apps/server/tsconfig.build.json apps/server/
COPY packages/conversations/package.json packages/conversations/tsconfig.build.json packages/conversations/
RUN pnpm install --frozen-lockfile

COPY apps/server/src/ apps/server/src/
COPY packages/conversations/src/ packages/conversations/src/
RUN pnpm build
COPY scripts/fetch-speech-models.mjs /tmp/fetch-speech-models.mjs
RUN node /tmp/fetch-speech-models.mjs /opt/ambrogio/voices /opt/ambrogio/models /opt/ambrogio/kokoro

FROM node:24-bookworm-slim

WORKDIR /workspace
LABEL org.opencontainers.image.source="https://github.com/ambrogio-app/ambrogio-backend" \
      org.opencontainers.image.licenses="MIT"
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /etc/ambrogio/agents /data
COPY --from=build /opt/ambrogio/voices/ /opt/ambrogio/voices/
COPY --from=build /opt/ambrogio/models/ /opt/ambrogio/models/
COPY --from=build /opt/ambrogio/kokoro/ /opt/ambrogio/kokoro/
COPY voices/README.md /opt/ambrogio/voices/README.md
COPY --from=build /workspace/package.json ./
COPY protocol/ protocol/
COPY --from=build /workspace/node_modules/ node_modules/
COPY --from=build /workspace/apps/server/package.json apps/server/
COPY --from=build /workspace/apps/server/node_modules/ apps/server/node_modules/
COPY --from=build /workspace/apps/server/dist/ apps/server/dist/
COPY --from=build /workspace/packages/conversations/package.json packages/conversations/
COPY --from=build /workspace/packages/conversations/node_modules/ packages/conversations/node_modules/
COPY --from=build /workspace/packages/conversations/dist/ packages/conversations/dist/

CMD ["node", "apps/server/dist/main.js"]
