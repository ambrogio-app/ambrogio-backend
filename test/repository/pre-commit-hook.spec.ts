import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync,
  writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { repositoryRoot } from './source-imports.js';

let directory: string;
let repository: string;
let modelChecksLog: string;

/**
 * A stand-in for `ambrogio-model/scripts/model-checks` next to the temporary repository: it records each
 * run and passes, or fails with a message, so that the hook is tested without running Reqvire.
 */
function fakeModelChecks(outcome: 'pass' | 'fail') {
  const scripts = join(directory, 'ambrogio-model', 'scripts');
  mkdirSync(scripts, { recursive: true });
  const script = join(scripts, 'model-checks');
  writeFileSync(script, ['#!/bin/sh', `echo "run $*" >> '${modelChecksLog}'`,
    outcome === 'pass' ? 'exit 0' : 'echo "model-checks: fake violation" >&2; exit 1', ''].join('\n'));
  chmodSync(script, 0o755);
}
const modelChecksRan = () => existsSync(modelChecksLog);
const modelChecksRuns = () => readFileSync(modelChecksLog, 'utf8').trim().split('\n');

// Commits run with the repository's own hook only: no global or system Git configuration.
const gitEnvironment = (path: string) => ({ ...process.env, PATH: path, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });

function git(args: readonly string[], path = process.env.PATH ?? '') {
  const result = spawnSync('git', args, { cwd: repository, env: gitEnvironment(path), encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const commitCount = () => {
  const result = git(['rev-list', '--count', '--all']);
  return result.status === 0 ? Number(result.output.trim()) : 0;
};

/** A GitHub personal access token that only exists while the test runs. */
function placeholderToken(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const body = Array.from({ length: 36 }, () => alphabet[randomInt(alphabet.length)]).join('');
  return ['gh', 'p_', body].join('');
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'ambrogio-pre-commit-'));
  repository = join(directory, 'repository');
  modelChecksLog = join(directory, 'model-checks.log');
  mkdirSync(join(repository, '.githooks'), { recursive: true });
  copyFileSync(join(repositoryRoot, '.githooks/pre-commit'), join(repository, '.githooks/pre-commit'));
  for (const args of [['init', '--quiet'], ['config', 'user.name', 'Hook test'], ['config', 'user.email', 'hook@example.com'],
    ['config', 'commit.gpgsign', 'false'], ['config', 'core.hooksPath', '.githooks']]) {
    expect(git(args).status, args.join(' ')).toBe(0);
  }
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

// Verification: Prova dell'hook pre-commit dei segreti del backend
test('gitleaks is available to the hook test', () => {
  const result = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  expect(result.error, 'gitleaks must be on PATH, as the CI installs it').toBeUndefined();
  expect(result.stdout.trim(), 'the hook requires exactly this version').toBe('8.30.1');
});

// Verification: Prova dell'hook pre-commit dei segreti del backend
test('a commit that adds a secret is blocked without showing it', () => {
  fakeModelChecks('pass');
  const token = placeholderToken();
  writeFileSync(join(repository, 'settings.txt'), `github_token = "${token}"\n`);
  expect(git(['add', 'settings.txt']).status).toBe(0);
  const commit = git(['commit', '--quiet', '--message', 'Add settings']);
  expect(commit.status).not.toBe(0);
  expect(commit.output).toMatch(/(?<!no )leaks found: 1/);
  expect(commit.output).not.toContain(token);
  expect(commitCount()).toBe(0);
  expect(modelChecksRan(), 'the model checks run only after a clean secret scan').toBe(false);
});

// Verification: Prova dell'hook pre-commit dei segreti del backend
// Verification: Prova dei controlli del modello nell'hook pre-commit del backend
test('a commit without secrets passes the hook', () => {
  fakeModelChecks('pass');
  writeFileSync(join(repository, 'notes.txt'), 'The assistant answers in the configured language.\n');
  expect(git(['add', 'notes.txt']).status).toBe(0);
  const commit = git(['commit', '--quiet', '--message', 'Add notes']);
  expect(commit.output).toContain('no leaks found');
  expect(commit.status).toBe(0);
  expect(commitCount()).toBe(1);
  expect(modelChecksRan()).toBe(true);
  // The checks read the staged content: the top level of the repository and the index about to be committed.
  const top = realpathSync(repository);
  expect(modelChecksRuns()).toEqual([`run --staged ${top} ${join(top, '.git', 'index')}`]);
});

// Verification: Prova dell'hook pre-commit dei segreti del backend
test('an inline gitleaks:allow comment does not hide a secret', () => {
  fakeModelChecks('pass');
  const token = placeholderToken();
  writeFileSync(join(repository, 'settings.txt'), `github_token = "${token}" # gitleaks:allow\n`);
  expect(git(['add', 'settings.txt']).status).toBe(0);
  const commit = git(['commit', '--quiet', '--message', 'Add settings']);
  expect(commit.status).not.toBe(0);
  expect(commit.output).toMatch(/(?<!no )leaks found: 1/);
  expect(commit.output).not.toContain(token);
  expect(commitCount()).toBe(0);
  expect(modelChecksRan()).toBe(false);
});

// Verification: Prova dei controlli del modello nell'hook pre-commit del backend
test('a commit is blocked when the model checks of the side-by-side ambrogio-model fail', () => {
  fakeModelChecks('fail');
  writeFileSync(join(repository, 'notes.txt'), 'The assistant answers in the configured language.\n');
  expect(git(['add', 'notes.txt']).status).toBe(0);
  const commit = git(['commit', '--quiet', '--message', 'Add notes']);
  expect(commit.status).not.toBe(0);
  expect(commit.output).toContain('model-checks: fake violation');
  expect(modelChecksRan()).toBe(true);
  expect(commitCount()).toBe(0);
});

// Verification: Prova dei controlli del modello nell'hook pre-commit del backend
test('a commit is blocked when ambrogio-model is not next to the repository', () => {
  writeFileSync(join(repository, 'notes.txt'), 'The assistant answers in the configured language.\n');
  expect(git(['add', 'notes.txt']).status).toBe(0);
  const commit = git(['commit', '--quiet', '--message', 'Add notes']);
  expect(commit.status).not.toBe(0);
  expect(commit.output).toContain('pre-commit: ambrogio-model is not next to this repository; '
    + 'clone https://github.com/ambrogio-app/ambrogio-model beside it and retry.');
  expect(commitCount()).toBe(0);
});

// Verification: Prova dell'hook pre-commit dei segreti del backend
test('without gitleaks on PATH the hook blocks the commit and says how to install it', () => {
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const gitPath = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  symlinkSync(gitPath, join(bin, 'git'));
  writeFileSync(join(repository, 'notes.txt'), 'The assistant answers in the configured language.\n');
  expect(git(['add', 'notes.txt'], bin).status).toBe(0);
  const commit = git(['commit', '--quiet', '--message', 'Add notes'], bin);
  expect(commit.status).not.toBe(0);
  expect(commit.output).toContain('pre-commit: gitleaks 8.30.1 is not on PATH; install gitleaks 8.30.1 '
    + '(https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) and retry.');
  expect(commitCount()).toBe(0);
});

// Verification: Prova dell'hook pre-commit dei segreti del backend
test('a gitleaks of another version on PATH blocks the commit before any scan', () => {
  fakeModelChecks('pass');
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const gitPath = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  symlinkSync(gitPath, join(bin, 'git'));
  const scanned = join(directory, 'scanned.log');
  writeFileSync(join(bin, 'gitleaks'), ['#!/bin/sh', `[ "$1" = version ] && { echo 8.30.0; exit 0; }`,
    `echo scan >> '${scanned}'`, 'exit 0', ''].join('\n'));
  chmodSync(join(bin, 'gitleaks'), 0o755);
  writeFileSync(join(repository, 'notes.txt'), 'The assistant answers in the configured language.\n');
  expect(git(['add', 'notes.txt'], bin).status).toBe(0);
  const commit = git(['commit', '--quiet', '--message', 'Add notes'], bin);
  expect(commit.status).not.toBe(0);
  expect(commit.output).toContain('pre-commit: gitleaks 8.30.1 is not on PATH');
  expect(existsSync(scanned)).toBe(false);
  expect(modelChecksRan()).toBe(false);
  expect(commitCount()).toBe(0);
});
