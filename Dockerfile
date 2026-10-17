FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/piper && /opt/piper/bin/pip install --no-cache-dir piper-tts==1.8.0
RUN npm install --global pnpm@12.11.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/server/package.json apps/server/tsconfig.build.json apps/server/
COPY packages/conversations/package.json packages/conversations/tsconfig.build.json packages/conversations/
RUN pnpm install --frozen-lockfile

COPY apps/server/src/ apps/server/src/
COPY packages/conversations/src/ packages/conversations/src/
RUN pnpm build
COPY scripts/fetch-piper-voices.py /tmp/fetch-piper-voices.py
RUN python3 /tmp/fetch-piper-voices.py /opt/ambrogio/voices

FROM node:24-bookworm-slim

WORKDIR /workspace
LABEL org.opencontainers.image.source="https://github.com/adrianofoschi/ambrogio-backend" \
      org.opencontainers.image.licenses="MIT"
RUN apt-get update && apt-get install -y --no-install-recommends python3 libgomp1 && rm -rf /var/lib/apt/lists/*
COPY --from=build /opt/piper/ /opt/piper/
COPY --from=build /opt/ambrogio/voices/ /opt/ambrogio/voices/
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
