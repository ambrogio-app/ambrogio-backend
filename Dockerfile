FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN npm install --global pnpm@12.11.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/server/package.json apps/server/tsconfig.build.json apps/server/
COPY packages/conversations/package.json packages/conversations/tsconfig.build.json packages/conversations/
RUN pnpm install --frozen-lockfile

COPY apps/server/src/ apps/server/src/
COPY packages/conversations/src/ packages/conversations/src/
RUN pnpm build

FROM node:24-bookworm-slim

WORKDIR /workspace
COPY --from=build /workspace/package.json ./
COPY --from=build /workspace/node_modules/ node_modules/
COPY --from=build /workspace/apps/server/package.json apps/server/
COPY --from=build /workspace/apps/server/node_modules/ apps/server/node_modules/
COPY --from=build /workspace/apps/server/dist/ apps/server/dist/
COPY --from=build /workspace/packages/conversations/package.json packages/conversations/
COPY --from=build /workspace/packages/conversations/node_modules/ packages/conversations/node_modules/
COPY --from=build /workspace/packages/conversations/dist/ packages/conversations/dist/

CMD ["node", "apps/server/dist/main.js"]
