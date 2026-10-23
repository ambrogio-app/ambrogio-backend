import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { repositoryRoot } from './source-imports.js';

let directory: string;
let repository: string;

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
  mkdirSync(join(repository, '.githooks'), { recursive: true });
  copyFileSync(join(repositoryRoot, '.githooks/pre-commit'), join(repository, '.githooks/pre-commit'));
  for (const args of [['init', '--quiet'], ['config', 'user.name', 'Hook test'], ['config', 'user.email', 'hook@example.com'],
    ['config', 'commit.gpgsign', 'false'], ['config', 'core.hooksPath', '.githooks']]) {
    expect(git(args).status, args.join(' ')).toBe(0);
  }
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

// Verification: Prova dell'hook pre-commit dei segreti
test('gitleaks is available to the hook test', () => {
  const result = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  expect(result.error, 'gitleaks must be on PATH, as the CI installs it').toBeUndefined();
  expect(result.stdout).toContain('8.30.1');
});

// Verification: Prova dell'hook pre-commit dei segreti
test('a commit that adds a secret is blocked without showing it', () => {
  const token = placeholderToken();
  writeFileSync(join(repository, 'settings.txt'), `github_token = "${token}"\n`);
  expect(git(['add', 'settings.txt']).status).toBe(0);
  const commit = git(['commit', '--quiet', '--message', 'Add settings']);
  expect(commit.status).not.toBe(0);
  expect(commit.output).toMatch(/(?<!no )leaks found: 1/);
  expect(commit.output).not.toContain(token);
  expect(commitCount()).toBe(0);
});

// Verification: Prova dell'hook pre-commit dei segreti
test('a commit without secrets passes the hook', () => {
  writeFileSync(join(repository, 'notes.txt'), 'The assistant answers in the configured language.\n');
  expect(git(['add', 'notes.txt']).status).toBe(0);
  const commit = git(['commit', '--quiet', '--message', 'Add notes']);
  expect(commit.output).toContain('no leaks found');
  expect(commit.status).toBe(0);
  expect(commitCount()).toBe(1);
});

// Verification: Prova dell'hook pre-commit dei segreti
test('without gitleaks on PATH the hook blocks the commit and says how to install it', () => {
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const gitPath = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  symlinkSync(gitPath, join(bin, 'git'));
  writeFileSync(join(repository, 'notes.txt'), 'The assistant answers in the configured language.\n');
  expect(git(['add', 'notes.txt'], bin).status).toBe(0);
  const commit = git(['commit', '--quiet', '--message', 'Add notes'], bin);
  expect(commit.status).not.toBe(0);
  expect(commit.output).toContain('gitleaks is not on PATH');
  expect(commit.output).toContain('https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1');
  expect(commitCount()).toBe(0);
});
