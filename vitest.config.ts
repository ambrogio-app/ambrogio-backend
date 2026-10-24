// «Suite di test del backend»: Vitest is the only runner, and the selections are disjoint, so no
// test file runs twice. `pnpm test` runs `fast`, `pnpm test:integration` runs `integration`, `pnpm test:e2e` runs `e2e`.
import { configDefaults, defineConfig } from 'vitest/config';

const integration = '**/*.integration.spec.ts';
const e2e = '**/*.e2e.spec.ts';

export default defineConfig({
  test: {
    projects: [
      { extends: true, test: { name: 'fast', include: ['**/*.spec.ts'], exclude: [...configDefaults.exclude, integration, e2e] } },
      { extends: true, test: { name: 'integration', include: [integration], exclude: [...configDefaults.exclude] } },
      { extends: true, test: { name: 'e2e', include: [e2e], exclude: [...configDefaults.exclude] } },
    ],
  },
});
