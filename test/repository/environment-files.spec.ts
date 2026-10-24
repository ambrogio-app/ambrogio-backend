// «Prova dei file d'ambiente e dei valori predefiniti del backend»: the example environment file lists
// every variable read by the configuration modules without values, the Compose example sets only values
// production requires, no default is repeated, and only the development command loads `.env`.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { expect, test } from 'vitest';
import { conversationVariables } from '../../packages/conversations/src/adapters/out/conversation-config.js';
import { runtimeEnvironmentVariable, type EnvironmentVariable }
  from '../../packages/conversations/src/adapters/out/environment-variables.js';
import { voiceVariables } from '../../packages/conversations/src/adapters/out/voice-config.js';
import { agentVariables } from '../../apps/server/src/runtime/agent-config.js';
import { httpVariables } from '../../apps/server/src/runtime/http-config.js';
import { repositoryRoot } from './source-imports.js';
import { parseYaml } from './workflow-yaml.js';

const declared: readonly EnvironmentVariable[] = [runtimeEnvironmentVariable, ...Object.values(httpVariables),
  ...Object.values(conversationVariables), ...Object.values(agentVariables), ...voiceVariables];
const read = (path: string) => readFileSync(join(repositoryRoot, path), 'utf8');

function envFile(text: string): Map<string, string> {
  const entries = text.split('\n').filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split(/=(.*)/s).slice(0, 2) as [string, string]);
  return new Map(entries);
}

/** The variables named by the example agent files, which hold no secret. */
function agentCredentialNames(): string[] {
  const names: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) {
        if (key.endsWith('Env') && typeof inner === 'string') names.push(inner); else visit(inner);
      }
    }
  };
  for (const name of readdirSync(join(repositoryRoot, 'examples/agents'))) {
    visit(JSON.parse(read(`examples/agents/${name}`)));
  }
  return [...new Set(names)];
}

test('the example environment file lists every variable without values except the development environment', () => {
  const example = envFile(read('.env.example'));
  expect([...example.keys()].sort()).toEqual([...declared.map(variable => variable.name),
    ...agentCredentialNames()].sort());
  for (const [name, value] of example) expect([name, value]).toEqual([name, name === 'AMBROGIO_ENV' ? 'development' : '']);
});

test('the Compose example sets only production values and repeats no default', () => {
  const compose = parseYaml(read('compose.example.yaml')) as { services: { backend: { environment: Record<string, string> } } };
  const environment = compose.services.backend.environment;
  expect(environment.AMBROGIO_ENV).toBe('production');
  const known = new Map(declared.map(variable => [variable.name, variable]));
  for (const name of Object.keys(environment)) {
    const variable = known.get(name);
    if (!variable) { expect(agentCredentialNames()).toContain(name); continue; }
    // A default that applies in production belongs to the configuration module only.
    expect(variable.default?.environments, name).not.toBe('all');
  }
  for (const variable of declared.filter(variable => variable.default?.environments === 'development')) {
    expect(Object.keys(environment), variable.name).toContain(variable.name);
  }
  expect(Object.values(environment).join('\n')).not.toMatch(/:-/);
});

test('only the development command loads the local environment file', () => {
  const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
  expect(scripts.dev).toBe('node --env-file=.env apps/server/dist/main.js');
  expect(Object.entries(scripts).filter(([, command]) => command.includes('--env-file')).map(([name]) => name))
    .toEqual(['dev']);
  const sources: string[] = [];
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (name === 'node_modules' || name === 'dist') continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) sources.push(path);
    }
  };
  for (const root of ['apps/server/src', 'packages/conversations/src']) walk(join(repositoryRoot, root));
  for (const path of sources) {
    expect(readFileSync(path, 'utf8'), relative(repositoryRoot, path)).not.toMatch(/loadEnvFile|dotenv|--env-file|['\"`/]\.env\b/);
  }
  expect(JSON.stringify(JSON.parse(read('apps/server/package.json')))).not.toMatch(/dotenv/);
});

test('a variable of the process environment prevails over the local environment file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ambrogio-env-file-'));
  try {
    writeFileSync(join(directory, '.env'), 'AMBROGIO_LANGUAGE=it\nAMBROGIO_TIME_ZONE=Europe/Rome\n');
    const output = execFileSync(process.execPath, ['--env-file=.env', '-e',
      'console.log(process.env.AMBROGIO_LANGUAGE + " " + process.env.AMBROGIO_TIME_ZONE)'],
    { cwd: directory, encoding: 'utf8', env: { PATH: process.env.PATH, AMBROGIO_LANGUAGE: 'en' } });
    expect(output.trim()).toBe('en Europe/Rome');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
