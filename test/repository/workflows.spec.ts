import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot } from './source-imports.js';
import { parseYaml, readWorkflow } from './workflow-yaml.js';

// «Profilo di irrobustimento dei workflow GitHub Actions» and «Profilo di scansione dei segreti con gitleaks»
const pinnedActions: Readonly<Record<string, string>> = {
  'actions/checkout': 'd23441a48e516b6c34aea4fa41551a30e30af803',
  'actions/setup-node': '249970729cb0ef3589644e2896645e5dc5ba9c38',
};
const gitleaksVersion = '8.30.1';
const gitleaksSha256 = '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb';
const jobTimeouts: Readonly<Record<string, string>> = { checks: '20', gitleaks: '10', publish: '60' };

const ci = readWorkflow('ci.yml');
const secretScan = readWorkflow('secret-scan.yml');
const publish = readWorkflow('publish-image.yml');
const workflows = [ci, secretScan, publish];

type Step = { [key: string]: any };
const stepsOf = (job: { steps?: Step[] }): Step[] => job.steps ?? [];
const runs = (job: { steps?: Step[] }) => stepsOf(job).map((step) => String(step.run ?? ''));
const indexOfRun = (job: { steps?: Step[] }, pattern: RegExp) => runs(job).findIndex((run) => pattern.test(run));

test('the workflow reader understands the YAML forms used by the workflows', () => {
  expect(parseYaml([
    'on:', '  push:', "    branches: ['**', main]", '  workflow_call:', 'jobs:', '  one:',
    '    steps:', '      - name: First # comment', '        with:', '          depth: 0',
    '      - run: |', '          echo "#1"', '', '          echo two', 'list:', '  - a', "  - 'b'",
  ].join('\n'))).toEqual({
    on: { push: { branches: ['**', 'main'] }, workflow_call: '' },
    jobs: { one: { steps: [{ name: 'First', with: { depth: '0' } }, { run: 'echo "#1"\n\necho two\n' }] } },
    list: ['a', 'b'],
  });
  expect(Object.keys(ci.document.jobs)).toEqual(['checks']);
  expect(Object.keys(secretScan.document.jobs)).toEqual(['gitleaks']);
  expect(Object.keys(publish.document.jobs)).toEqual(['checks', 'secret-scan', 'publish']);
});

// Verification: Prova dell'irrobustimento dei workflow
test('workflows follow the hardening profile', () => {
  const listed = readdirSync(join(repositoryRoot, '.github/workflows')).filter((name) => /\.ya?ml$/.test(name)).sort();
  expect(listed).toEqual(['ci.yml', 'publish-image.yml', 'secret-scan.yml']);
  for (const workflow of workflows) {
    expect(workflow.document.permissions, workflow.path).toEqual({ contents: 'read' });
    for (const [id, job] of Object.entries<any>(workflow.document.jobs)) {
      const where = `${workflow.path} ${id}`;
      expect(job['continue-on-error'], where).toBeUndefined();
      if (workflow === publish && id === 'publish') {
        expect(job.permissions, where).toEqual({ contents: 'read', 'packages': 'write' });
      } else {
        expect(job.permissions, where).toBeUndefined();
      }
      if (job.uses !== undefined) continue; // a call to a reusable workflow of the repository
      expect(job['runs-on'], where).toBe('ubuntu-24.04');
      expect(job['timeout-minutes'], where).toBe(jobTimeouts[id]);
      for (const step of stepsOf(job)) {
        expect(step['continue-on-error'], `${where} ${step.name}`).toBeUndefined();
        if (step.uses === undefined) continue;
        const [action, ref] = String(step.uses).split('@');
        expect(ref, `${where} ${step.uses}`).toMatch(/^[0-9a-f]{40}$/);
        if (action! in pinnedActions) expect(ref, `${where} ${action}`).toBe(pinnedActions[action!]);
        if (action === 'actions/checkout') expect(step.with?.['persist-credentials'], where).toBe('false');
      }
    }
    // Every external action carries its version as a comment next to the pinned commit.
    for (const line of workflow.text.split('\n').filter((candidate) => /^\s*(-\s+)?uses:\s+[^.]/.test(candidate))) {
      expect(line, workflow.path).toMatch(/uses:\s+[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+(\.\d+)*$/);
    }
  }
  expect(ci.document.on).toHaveProperty('workflow_call');
  expect(secretScan.document.on).toHaveProperty('workflow_call');
  const jobs = publish.document.jobs;
  expect(jobs.checks).toEqual({ uses: './.github/workflows/ci.yml' });
  expect(jobs['secret-scan']).toEqual({ uses: './.github/workflows/secret-scan.yml' });
  expect(jobs.publish.needs).toEqual(['checks', 'secret-scan']);
  // The token reaches only the registry login step, as an environment variable.
  for (const workflow of workflows) {
    const tokenLines = workflow.text.split('\n').filter((line) => line.includes('secrets.GITHUB_TOKEN'));
    expect(tokenLines.length, workflow.path).toBe(workflow === publish ? 1 : 0);
  }
  const loginSteps = stepsOf(jobs.publish).filter((step) => JSON.stringify(step).includes('secrets.GITHUB_TOKEN'));
  expect(loginSteps).toHaveLength(1);
  expect(loginSteps[0]!.env).toEqual({ GHCR_TOKEN: '${{ secrets.GITHUB_TOKEN }}' });
  expect(loginSteps[0]!.run).toContain('docker login ghcr.io');
  // The CI and the secret scan install the same verified gitleaks.
  for (const workflow of [ci, secretScan]) {
    expect(workflow.document.env, workflow.path).toEqual({ GITLEAKS_VERSION: gitleaksVersion, GITLEAKS_SHA256: gitleaksSha256 });
  }
  expect(installStep(ci.document.jobs.checks).run).toBe(installStep(secretScan.document.jobs.gitleaks).run);
});

function installStep(job: { steps?: Step[] }): Step {
  const steps = stepsOf(job).filter((step) => String(step.run ?? '').includes('gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz'));
  expect(steps).toHaveLength(1);
  return steps[0]!;
}

function expectVerifiedInstall(job: { steps?: Step[] }) {
  const run = String(installStep(job).run);
  expect(run).toContain('set -euo pipefail');
  expect(run).toContain('https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${archive}');
  const check = run.indexOf('echo "${GITLEAKS_SHA256}  $RUNNER_TEMP/$archive" | sha256sum --check --strict');
  expect(check).toBeGreaterThan(run.indexOf('curl --fail'));
  expect(run.indexOf('tar -xzf')).toBeGreaterThan(check);
  expect(run).toContain('echo "$RUNNER_TEMP" >> "$GITHUB_PATH"');
}

// Verification: Prova della configurazione della scansione dei segreti in CI
test('the secret scan covers the whole history with the verified gitleaks and gates publication', () => {
  expect(secretScan.document.on).toEqual({
    push: { branches: ['**'] }, pull_request: '', workflow_dispatch: '', workflow_call: '',
  });
  const job = secretScan.document.jobs.gitleaks;
  expect(job.name).toBe('Scan history for secrets');
  const checkout = stepsOf(job).find((step) => String(step.uses).startsWith('actions/checkout@'));
  expect(checkout?.with).toEqual({ 'fetch-depth': '0', 'persist-credentials': 'false' });
  expect(secretScan.document.env).toEqual({ GITLEAKS_VERSION: gitleaksVersion, GITLEAKS_SHA256: gitleaksSha256 });
  expectVerifiedInstall(job);
  const scan = indexOfRun(job, /^gitleaks git --redact --no-banner --exit-code 1 \.\s*$/);
  expect(scan).toBeGreaterThan(stepsOf(job).indexOf(installStep(job)));
  expect(publish.document.jobs['secret-scan']).toEqual({ uses: './.github/workflows/secret-scan.yml' });
  expect(publish.document.jobs.publish.needs).toContain('secret-scan');
});

// Verification: Prova della configurazione della CI del server
test('the CI checks the whole model from the side-by-side workspace, then the backend, and tolerates no failure', () => {
  expect(ci.document.on).toEqual({
    pull_request: '', push: { branches: ['main'] }, workflow_dispatch: '', workflow_call: '',
  });
  const job = ci.document.jobs.checks;
  expect(job.name).toBe('Backend checks');
  expect(job.env).toEqual({ BRANCH: '${{ github.head_ref || github.ref_name }}', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
    AMBROGIO_TEST_DATABASE_URL: 'postgres://postgres@127.0.0.1:5432/postgres' });
  // The PostgreSQL test server of the job: the selections that use it fail when it is not available.
  expect(Object.keys(job.services ?? {})).toEqual(['postgres']);
  const postgres = job.services.postgres;
  expect(postgres.image).toBe('pgvector/pgvector:pg18');
  expect(postgres.env).toEqual({ POSTGRES_HOST_AUTH_METHOD: 'trust' });
  expect(postgres.ports).toEqual(['5432:5432']);
  expect(String(postgres.options)).toMatch(/--health-cmd "pg_isready[^"]*"/);
  expect(ci.text).not.toMatch(/continue-on-error/);
  // The Reqvire version is resolved by ambrogio-model, never repeated here.
  expect(ci.text).not.toMatch(/reqvire-org|check-model/);
  const checkout = stepsOf(job).find((step) => String(step.uses).startsWith('actions/checkout@'));
  expect(checkout?.with).toEqual({
    path: 'workspace/ambrogio-backend', 'fetch-depth': '0', 'persist-credentials': 'false',
  });
  const model = indexOfRun(job, /git clone --quiet --branch "\$ref" "\$url" workspace\/ambrogio-model/);
  const modelRun = runs(job)[model] ?? '';
  expect(modelRun).toContain('set -euo pipefail');
  expect(modelRun).toContain('url="https://github.com/ambrogio-app/ambrogio-model.git"');
  expect(modelRun).toContain('git ls-remote --exit-code --heads "$url" "$BRANCH"');
  const sideBySide = indexOfRun(job, /^workspace\/ambrogio-model\/scripts\/checkout-workspace workspace "\$BRANCH"\s*$/);
  const modelChecks = indexOfRun(job, /^workspace\/ambrogio-model\/scripts\/model-checks --workspace workspace\s*$/);
  const corepack = indexOfRun(job, /^corepack enable\s*$/);
  const install = indexOfRun(job, /^pnpm install --frozen-lockfile\s*$/);
  const audit = indexOfRun(job, /^pnpm audit --audit-level high\s*$/);
  const typecheck = indexOfRun(job, /^pnpm typecheck\s*$/);
  const build = indexOfRun(job, /^pnpm build\s*$/);
  const databaseTypes = indexOfRun(job, /^pnpm db:types:check\s*$/);
  const tests = indexOfRun(job, /^pnpm test\s*$/);
  const integration = indexOfRun(job, /^pnpm test:integration\s*$/);
  const e2e = indexOfRun(job, /^pnpm test:e2e\s*$/);
  const gitleaks = stepsOf(job).indexOf(installStep(job));
  for (const index of [model, sideBySide, modelChecks, corepack, install, audit, typecheck, build, databaseTypes, tests, integration, e2e]) expect(index).toBeGreaterThanOrEqual(0);
  expect(databaseTypes).toBe(build + 1);
  expect(install).toBeGreaterThan(corepack);
  expect(audit).toBe(install + 1);
  expect(sideBySide).toBeGreaterThan(model);
  expect(modelChecks).toBeGreaterThan(sideBySide);
  expect(Math.min(typecheck, build, tests, integration)).toBeGreaterThan(audit);
  expect(typecheck).toBeGreaterThan(databaseTypes);
  expect(tests).toBeGreaterThan(Math.max(typecheck, gitleaks));
  expect(integration).toBeGreaterThan(tests);
  expect(e2e).toBeGreaterThan(Math.max(build, integration));
  for (const index of [install, audit, typecheck, build, databaseTypes, tests, integration, e2e]) {
    expect(stepsOf(job)[index]!['working-directory']).toBe('workspace/ambrogio-backend');
  }
  expectVerifiedInstall(job);
});

// Verification: Prova della configurazione della CI del server
test('every test that uses PostgreSQL belongs to the integration or compiled process selection', () => {
  const testFiles = ['packages', 'apps', 'test']
    .flatMap((top) => readdirSync(join(repositoryRoot, top), { recursive: true, encoding: 'utf8' })
      .filter((name) => name.endsWith('.spec.ts') && !/(^|\/)(node_modules|dist)\//.test(name))
      .map((name) => join(top, name)));
  const text = (file: string) => readFileSync(join(repositoryRoot, file), 'utf8');
  // The pure mapper, the migration list and the generated types of `postgres/` reach no database.
  const pure = /\/adapters\/out\/postgres\/(?:postgres-turn-mapper|migrations|database\.generated)\.js$/;
  const usesDatabase = (file: string) => [...text(file).matchAll(/^\s*(?:import|export)\b[^']*?\bfrom '([^']+)'/gm)].some((match) => {
    const specifier = match[1]!;
    const target = specifier.startsWith('.') ? join(dirname(file), specifier) : specifier;
    if (target === join('test', 'support', 'test-database.js')) return true;
    return target.includes('/adapters/out/postgres/') && !pure.test(target);
  });
  const databaseTests = testFiles.filter(usesDatabase);
  expect(databaseTests.length).toBeGreaterThan(0);
  for (const file of databaseTests) expect(file).toMatch(/\.(integration|e2e)\.spec\.ts$/);
});

const pnpmProfileViolations = (text: string) => [/npm install (--global|-g)\b[^\n]*pnpm/, /npx[^\n]*\bpnpm@/]
  .filter((pattern) => pattern.test(text)).map(String);

// Verification: Prova dell'installazione del backend con pnpm e Corepack
test('the CI and the image build activate the declared pnpm with Corepack and install from the frozen lockfile', () => {
  const manifest = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')) as { packageManager?: string };
  expect(manifest.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
  for (const workflow of workflows) expect(pnpmProfileViolations(workflow.text), workflow.path).toEqual([]);
  const job = ci.document.jobs.checks;
  expect(job.env.COREPACK_ENABLE_DOWNLOAD_PROMPT).toBe('0');
  expect(indexOfRun(job, /^corepack enable\s*$/)).toBeLessThan(indexOfRun(job, /^pnpm /));
  const dockerfile = readFileSync(join(repositoryRoot, 'Dockerfile'), 'utf8');
  expect(pnpmProfileViolations(dockerfile)).toEqual([]);
  const build = dockerfile.split(/^FROM /m)[1]!;
  expect(build).toMatch(/^node:24\b/);
  const prompt = build.indexOf('ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0\n');
  const enable = build.indexOf('RUN corepack enable\n');
  const install = build.indexOf('RUN pnpm install --frozen-lockfile\n');
  expect(prompt).toBeGreaterThanOrEqual(0);
  expect(enable).toBeGreaterThan(prompt);
  expect(install).toBeGreaterThan(enable);
  expect(build.indexOf('RUN pnpm ')).toBe(install);
});

// Verification: Prova dell'audit delle dipendenze nella CI del backend
test('the CI audits the dependencies at high severity and exceptions name single advisories', () => {
  const audits = workflows.flatMap((workflow) => workflow.text.split('\n').filter((line) => /pnpm audit/.test(line)));
  expect(audits.map((line) => line.trim())).toEqual(['run: pnpm audit --audit-level high']);
  const settings = parseYaml(readFileSync(join(repositoryRoot, 'pnpm-workspace.yaml'), 'utf8')) as { [key: string]: any };
  const auditConfig = settings.auditConfig ?? {};
  expect(Object.keys(auditConfig).filter((key) => key !== 'ignoreGhsas')).toEqual([]);
  const ignored: unknown = auditConfig.ignoreGhsas ?? [];
  expect(Array.isArray(ignored)).toBe(true);
  for (const advisory of ignored as unknown[]) {
    expect(String(advisory)).toMatch(/^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/);
  }
  // «Audit delle dipendenze con pnpm» lists no accepted advisory.
  expect(ignored).toEqual([]);
});

// Verification: Prova del comando di verifica completo del backend
test('pnpm verify runs the model checks, the frozen installation, the audit and the CI checks in order', () => {
  const manifest = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
  const job = ci.document.jobs.checks;
  const install = indexOfRun(job, /^pnpm install --frozen-lockfile\s*$/);
  const checks = runs(job).slice(install + 1).map((run) => run.trim()).filter((run) => /^pnpm /.test(run))
    .filter((run) => run !== 'pnpm audit --audit-level high');
  expect(checks).toEqual(['pnpm build', 'pnpm db:types:check', 'pnpm typecheck', 'pnpm test', 'pnpm test:integration',
    'pnpm test:e2e']);
  expect(manifest.scripts.verify!.split(' && ')).toEqual([
    '../ambrogio-model/scripts/model-checks', 'pnpm install --frozen-lockfile', 'pnpm audit --audit-level high', ...checks,
  ]);
});

// Verification: Prova del workflow di pubblicazione dell'immagine del server
test('the release workflow publishes the verified image on version tags and reports it in the job summary', () => {
  expect(publish.document.on).toEqual({ push: { tags: ['v*'] } });
  const job = publish.document.jobs.publish;
  const validate = indexOfRun(job, /\^v\(0\|\[1-9\]\[0-9\]\*\)/);
  const verify = indexOfRun(job, /^AMBROGIO_DOCKER_IMAGE="\$IMAGE" node scripts\/verify-docker-image\.mjs\s*$/);
  const push = indexOfRun(job, /docker push "\$IMAGE"/);
  for (const index of [validate, verify, push]) expect(index).toBeGreaterThanOrEqual(0);
  expect(verify).toBeGreaterThan(validate);
  expect(push).toBeGreaterThan(verify);
  expect(runs(job)[validate]).toContain('IMAGE=ghcr.io/ambrogio-app/ambrogio-backend:${GITHUB_REF_NAME}');
  const publishRun = runs(job)[push]!;
  expect(publishRun).toContain('set -euo pipefail');
  const summary = publishRun.indexOf('echo "Published $IMAGE" >> "$GITHUB_STEP_SUMMARY"');
  expect(summary).toBeGreaterThan(publishRun.indexOf('docker push "$IMAGE"'));
  expect(publish.text).not.toMatch(/:latest\b/);
});
