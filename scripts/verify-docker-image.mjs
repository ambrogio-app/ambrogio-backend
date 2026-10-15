import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const image = 'ambrogio-server:verification';
const port = 34123;
const temp = mkdtempSync(join(tmpdir(), 'ambrogio-docker-'));
const config = join(temp, 'config');
const data = join(temp, 'data');
let container;

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

try {
  mkdirSync(join(config, 'agents'), { recursive: true });
  mkdirSync(data);
  writeFileSync(join(config, 'http.json'), JSON.stringify({
    host: '0.0.0.0', port, allowedOrigins: [], publicHttps: false,
  }));
  writeFileSync(join(config, 'conversations.json'), JSON.stringify({
    archivePath: '/var/lib/ambrogio/conversations.sqlite', language: 'it',
  }));
  writeFileSync(join(config, 'agents', 'orchestrator.json'), JSON.stringify({
    instructions: 'Docker image verification',
    llm: { provider: 'mistral', model: 'mistral-small-latest', apiKey: 'test-only-placeholder' },
  }));

  docker('build', '--tag', image, '.');
  docker('run', '--rm', '--entrypoint', '/bin/sh', image, '-c',
    'test ! -e /etc/ambrogio/http.json && test ! -e /etc/ambrogio/conversations.json && test ! -e /var/lib/ambrogio/conversations.sqlite');
  container = docker('run', '--detach', '--rm',
    '--publish', `127.0.0.1::${port}`,
    '--mount', `type=bind,src=${config},dst=/etc/ambrogio,readonly`,
    '--mount', `type=bind,src=${data},dst=/var/lib/ambrogio`,
    '--env', 'AMBROGIO_HTTP_CONFIG_PATH=/etc/ambrogio/http.json',
    '--env', 'AMBROGIO_CONVERSATIONS_CONFIG_PATH=/etc/ambrogio/conversations.json',
    image);
  const published = docker('port', container, `${port}/tcp`);
  const hostPort = Number(published.match(/:(\d+)$/)?.[1]);
  if (!Number.isSafeInteger(hostPort)) throw new Error(`Unexpected published port: ${published}`);
  const url = `http://127.0.0.1:${hostPort}/api/conversations`;
  let response;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { response = await fetch(url); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  if (!response) throw new Error('HTTP listener did not become available');
  const body = await response.json();
  if (response.status !== 200 || !Array.isArray(body.items)) {
    throw new Error(`Unexpected HTTP response: ${response.status}`);
  }
  if (!existsSync(join(data, 'conversations.sqlite'))) {
    throw new Error('SQLite archive was not created in the external mount');
  }
  console.log('Docker image verification passed: external JSON and SQLite, HTTP 200, no Compose.');
} finally {
  if (container) {
    try { docker('stop', container); } catch { /* preserve the verification failure */ }
  }
  rmSync(temp, { recursive: true, force: true });
}
