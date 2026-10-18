import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const existingImage = process.env.AMBROGIO_DOCKER_IMAGE;
const image = existingImage || 'ambrogio-server:verification';
const port = 34123;
const temp = mkdtempSync(join(tmpdir(), 'ambrogio-docker-'));
const config = join(temp, 'config');
const data = join(temp, 'data');
const customVoices = join(temp, 'custom-voices');
let container;

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

try {
  mkdirSync(join(config, 'agents'), { recursive: true });
  mkdirSync(data);
  mkdirSync(customVoices);
  writeFileSync(join(customVoices, 'custom-voice.marker'), 'mounted voice directory');
  writeFileSync(join(config, 'http.json'), JSON.stringify({
    host: '0.0.0.0', port, allowedOrigins: [], publicHttps: false,
  }));
  writeFileSync(join(config, 'conversations.json'), JSON.stringify({
    archivePath: '/var/lib/ambrogio/conversations.sqlite', language: 'it',
  }));
  writeFileSync(join(config, 'agents', 'orchestrator.json'), JSON.stringify({
    instructions: 'Docker image verification',
    llm: { provider: 'mistral', model: 'mistral-medium-latest', apiKey: 'test-only-placeholder' },
  }));
  // The orchestrator only chooses: at least one agent, here one without MCP, must answer.
  writeFileSync(join(config, 'agents', 'generic.json'), JSON.stringify({
    description: 'Answers general questions.', instructions: 'Docker image verification',
    llm: { provider: 'mistral', model: 'mistral-medium-latest', apiKey: 'test-only-placeholder' },
  }));

  if (!existingImage) docker('build', '--tag', image, '.');
  docker('run', '--rm', '--entrypoint', '/bin/sh', image, '-c',
    'test ! -e /etc/ambrogio/http.json && test ! -e /etc/ambrogio/conversations.json && test ! -e /var/lib/ambrogio/conversations.sqlite && ' +
    'test ! -e /opt/piper && ! command -v python3 >/dev/null && cd /workspace/packages/conversations && node -e "require(\'vosk-koffi\')"');
  // Each bundled voice is loaded and spoken with the image's own synthesizer code.
  const synthesis = [
    "import { SherpaSynthesizer } from '/workspace/packages/conversations/dist/adapters/in/session/sherpa-synthesizer.js';",
    "import { voiceModel } from '/workspace/packages/conversations/dist/adapters/out/voice-config.js';",
    "for (const [voice, rate] of [['vits-piper-it_IT-riccardo-x_low', 16000], ['vits-piper-it_IT-paola-medium', 22050]]) {",
    "  const synthesizer = await SherpaSynthesizer.load(await voiceModel({ voiceEngine: 'piper', voiceModelDir: '/opt/ambrogio/voices/' + voice }));",
    "  async function* text() { yield 'Ciao, sono Ambrogio.'; }",
    "  let bytes = 0;",
    "  for await (const chunk of synthesizer.synthesize(text(), new AbortController().signal)) bytes += chunk.length;",
    "  synthesizer.close();",
    "  if (synthesizer.sampleRate !== rate || bytes < rate) throw new Error('Unexpected synthesis for ' + voice + ': ' + synthesizer.sampleRate + ' Hz, ' + bytes + ' bytes');",
    "  console.log(voice + ': ' + synthesizer.sampleRate + ' Hz, ' + bytes + ' bytes');",
    "}",
  ].join('\n');
  docker('run', '--rm', '--entrypoint', '/bin/sh', image, '-c',
    'set -eu; test -f /opt/ambrogio/voices/README.md; ' +
    'for voice in vits-piper-it_IT-riccardo-x_low vits-piper-it_IT-paola-medium; do ' +
    'dir="/opt/ambrogio/voices/$voice"; ' +
    'test -s "$dir/MODEL_CARD"; test -s "$dir/tokens.txt"; test -d "$dir/espeak-ng-data"; ' +
    'test "$(ls "$dir"/*.onnx | wc -l)" = 1; test -s "$(ls "$dir"/*.onnx)"; done');
  console.log(docker('run', '--rm', '--entrypoint', 'node', image, '--input-type=module', '-e', synthesis));
  docker('run', '--rm', '--entrypoint', '/bin/sh',
    '--mount', `type=bind,src=${customVoices},dst=/opt/ambrogio/voices,readonly`,
    image, '-c', 'test -f /opt/ambrogio/voices/custom-voice.marker && test ! -e /opt/ambrogio/voices/vits-piper-it_IT-riccardo-x_low');
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
  console.log('Docker image verification passed: external JSON and SQLite, bundled sherpa-onnx voices synthesized in the image and replaceable by a mount, HTTP 200, no Compose.');
} finally {
  if (container) {
    try { docker('stop', container); } catch { /* preserve the verification failure */ }
  }
  rmSync(temp, { recursive: true, force: true });
}
