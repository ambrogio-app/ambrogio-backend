import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  expect(job.env).toEqual({ BRANCH: '${{ github.head_ref || github.ref_name }}' });
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
  const install = indexOfRun(job, /^pnpm install --frozen-lockfile\s*$/);
  const typecheck = indexOfRun(job, /^pnpm typecheck\s*$/);
  const build = indexOfRun(job, /^pnpm build\s*$/);
  const tests = indexOfRun(job, /^pnpm test\s*$/);
  const gitleaks = stepsOf(job).indexOf(installStep(job));
  for (const index of [model, sideBySide, modelChecks, install, typecheck, build, tests]) expect(index).toBeGreaterThanOrEqual(0);
  expect(sideBySide).toBeGreaterThan(model);
  expect(modelChecks).toBeGreaterThan(sideBySide);
  expect(Math.min(typecheck, build, tests)).toBeGreaterThan(install);
  expect(tests).toBeGreaterThan(Math.max(build, gitleaks));
  for (const index of [install, typecheck, build, tests]) {
    expect(stepsOf(job)[index]!['working-directory']).toBe('workspace/ambrogio-backend');
  }
  expectVerifiedInstall(job);
});

// Verification: Prova della configurazione della CI del server
test('every SQLite persistence adapter test drives a real SQLite database', () => {
  const testFiles = readdirSync(join(repositoryRoot, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readdirSync(join(repositoryRoot, 'packages', entry.name, 'test'), { recursive: true, encoding: 'utf8' })
      .filter((name) => name.endsWith('.test.ts')).map((name) => join('packages', entry.name, 'test', name)));
  const adapterTests = testFiles.filter((file) =>
    /from '[^']*\/adapters\/out\/sqlite\/[^']*\.adapter\.js'/.test(readFileSync(join(repositoryRoot, file), 'utf8')));
  expect(adapterTests.length).toBeGreaterThan(0);
  for (const file of adapterTests) {
    expect(readFileSync(join(repositoryRoot, file), 'utf8'), file).toMatch(/from 'better-sqlite3'/);
  }
});
