// Verification: Prova del runner Vitest del backend
// «Suite di test del backend»: every test script runs one Vitest project, and the projects select disjoint sets of
// files that together cover every `*.spec.ts` file of the repository.
import { readdirSync, readFileSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';
import { expect, test } from 'vitest';
import config from '../../vitest.config.js';
import { repositoryRoot } from './source-imports.js';

type Project = Readonly<{ test: Readonly<{ name: string; include: readonly string[]; exclude: readonly string[] }> }>;

const projects = (config.test?.projects ?? []) as unknown as readonly Project[];
const scripts = (JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')) as {
  scripts: Record<string, string> }).scripts;

function specFiles(directory = ''): string[] {
  return readdirSync(join(repositoryRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = directory === '' ? entry.name : `${directory}/${entry.name}`;
    if (entry.isDirectory()) return ['node_modules', 'dist', '.git'].includes(entry.name) ? [] : specFiles(path);
    return entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

const selects = (project: Project, path: string) => project.test.include.some((glob) => matchesGlob(path, glob))
  && !project.test.exclude.some((glob) => matchesGlob(path, glob));

test('the test scripts run the fast, integration and e2e projects with Vitest', () => {
  expect(projects.map((project) => project.test.name)).toEqual(['fast', 'integration', 'e2e']);
  expect(scripts.test).toBe('vitest run --project fast');
  expect(scripts['test:integration']).toBe('vitest run --project integration');
  expect(scripts['test:e2e']).toBe('vitest run --project e2e');
});

test('every test file belongs to exactly one project', () => {
  const files = specFiles();
  expect(files.length).toBeGreaterThan(0);
  for (const path of files) {
    expect(projects.filter((project) => selects(project, path)).map((project) => project.test.name), path)
      .toHaveLength(1);
  }
  expect(files.filter((path) => path.endsWith('.integration.spec.ts')).every((path) =>
    selects(projects[1]!, path))).toBe(true);
  expect(files.filter((path) => path.endsWith('.e2e.spec.ts')).every((path) => selects(projects[2]!, path))).toBe(true);
});
