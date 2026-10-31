FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends bzip2 && rm -rf /var/lib/apt/lists/*
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/server/package.json apps/server/tsconfig.build.json apps/server/
COPY packages/conversations/package.json packages/conversations/tsconfig.build.json packages/conversations/
RUN pnpm install --frozen-lockfile

COPY apps/server/src/ apps/server/src/
COPY packages/conversations/src/ packages/conversations/src/
RUN pnpm build
COPY scripts/fetch-speech-models.mjs /tmp/fetch-speech-models.mjs
RUN node /tmp/fetch-speech-models.mjs /opt/ambrogio/voices /opt/ambrogio/models

FROM node:24-bookworm-slim

WORKDIR /workspace
LABEL org.opencontainers.image.source="https://github.com/ambrogio-app/ambrogio-backend" \
      org.opencontainers.image.licenses="MIT"
RUN mkdir -p /etc/ambrogio/agents
COPY --from=build /opt/ambrogio/voices/ /opt/ambrogio/voices/
COPY --from=build /opt/ambrogio/models/ /opt/ambrogio/models/
COPY voices/README.md /opt/ambrogio/voices/README.md
# OpenMDW 1.1 requires its text next to the distributed model.
COPY voices/OpenMDW-1.1.txt /opt/ambrogio/models/sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11/LICENSE
COPY --from=build /workspace/package.json ./
COPY protocol/ protocol/
COPY --from=build /workspace/node_modules/ node_modules/
COPY --from=build /workspace/apps/server/package.json apps/server/
COPY --from=build /workspace/apps/server/node_modules/ apps/server/node_modules/
COPY --from=build /workspace/apps/server/dist/ apps/server/dist/
COPY --from=build /workspace/packages/conversations/package.json packages/conversations/
COPY --from=build /workspace/packages/conversations/node_modules/ packages/conversations/node_modules/
COPY --from=build /workspace/packages/conversations/dist/ packages/conversations/dist/

# Liveness only («Profilo dell'endpoint di liveness»): healthy only when GET /health answers 200.
HEALTHCHECK CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.AMBROGIO_HTTP_PORT + '/health').then(response => process.exit(response.status === 200 ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/server/dist/main.js"]
