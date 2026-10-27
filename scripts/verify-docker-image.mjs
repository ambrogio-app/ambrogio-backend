import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const writeAgent = (filename, value) => writeFileSync(filename, `${JSON.stringify(value)}\n`);

// The variables of the bundled voices, as an installation sets them.
const piperVoices = {
  AMBROGIO_VOICE_LANGUAGES: 'it,en',
  AMBROGIO_VOICE_IT_STT_MODEL_DIR: '/opt/ambrogio/models/sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11',
  AMBROGIO_VOICE_IT_MODEL_DIR: '/opt/ambrogio/voices/vits-piper-it_IT-paola-medium',
  AMBROGIO_VOICE_EN_STT_MODEL_DIR: '/opt/ambrogio/models/sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11',
  AMBROGIO_VOICE_EN_MODEL_DIR: '/opt/ambrogio/voices/vits-piper-en_US-kristin-medium',
};
const envArguments = (variables) => Object.entries(variables).flatMap(([name, value]) => ['--env', `${name}=${value}`]);

const existingImage = process.env.AMBROGIO_DOCKER_IMAGE;
const image = existingImage || 'ambrogio-server:verification';
const port = 34123;
const temp = mkdtempSync(join(tmpdir(), 'ambrogio-docker-'));
const agents = join(temp, 'agents');
const customVoices = join(temp, 'custom-voices');
// The archive is a PostgreSQL container on a network of its own, started like the backend with Docker only.
const suffix = randomBytes(4).toString('hex');
const network = `ambrogio-verify-${suffix}`;
const database = `ambrogio-verify-postgres-${suffix}`;
const databaseUrl = `postgres://postgres@${database}:5432/postgres`;
let container;
let networkCreated = false;
let databaseStarted = false;

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

try {
  mkdirSync(agents);
  mkdirSync(customVoices);
  writeFileSync(join(customVoices, 'custom-voice.marker'), 'mounted voice directory');
  const llm = { provider: 'mistral', model: 'mistral-medium-latest', apiKeyEnv: 'MISTRAL_API_KEY' };
  writeAgent(join(agents, 'orchestrator.json'), { instructions: 'Docker image verification', llm });
  // The orchestrator only chooses: at least one agent, here one without MCP, must answer.
  writeAgent(join(agents, 'generic.json'), {
    description: 'Answers general questions.', instructions: 'Docker image verification', llm,
  });

  if (!existingImage) docker('build', '--tag', image, '.');
  docker('run', '--rm', '--entrypoint', '/bin/sh', image, '-c',
    // The image holds no configuration: an empty agent directory, no TypeScript module, no environment file.
    'test -d /etc/ambrogio/agents && test -z "$(ls -A /etc/ambrogio/agents)" && ' +
    'test -z "$(find /etc/ambrogio -type f)" && test ! -e /workspace/.env && test ! -e /workspace/.env.example && ' +
    'test ! -e /workspace/examples && test ! -e /data && ' +
    'test ! -e /opt/piper && ! command -v python3 >/dev/null && cd /workspace/packages/conversations && node -e "require(\'sherpa-onnx-node\')"');
  // Each bundled voice is loaded and spoken with the image's own synthesizer code.
  const synthesis = [
    "import { SherpaSynthesizer } from '/workspace/packages/conversations/dist/adapters/in/session/sherpa-synthesizer.js';",
    "import { voiceModel } from '/workspace/packages/conversations/dist/adapters/out/voice-config.js';",
    "for (const [voice, rate, words] of [['vits-piper-it_IT-riccardo-x_low', 16000, 'Ciao, sono Ambrogio.'], ['vits-piper-it_IT-paola-medium', 22050, 'Ciao, sono Ambrogio.'], ['vits-piper-en_US-kristin-medium', 22050, 'Hello, I am Ambrogio.']]) {",
    "  const synthesizer = await SherpaSynthesizer.load(await voiceModel({ voiceModelDir: '/opt/ambrogio/voices/' + voice }));",
    "  async function* text() { yield words; }",
    "  let bytes = 0;",
    "  for await (const chunk of synthesizer.synthesize(text(), new AbortController().signal)) bytes += chunk.length;",
    "  synthesizer.close();",
    "  if (synthesizer.sampleRate !== rate || bytes < rate) throw new Error('Unexpected synthesis for ' + voice + ': ' + synthesizer.sampleRate + ' Hz, ' + bytes + ' bytes');",
    "  console.log(voice + ': ' + synthesizer.sampleRate + ' Hz, ' + bytes + ' bytes');",
    "}",
  ].join('\n');
  docker('run', '--rm', '--entrypoint', '/bin/sh', image, '-c',
    'set -eu; test -f /opt/ambrogio/voices/README.md; ' +
    'for voice in vits-piper-it_IT-riccardo-x_low vits-piper-it_IT-paola-medium vits-piper-en_US-kristin-medium; do ' +
    'dir="/opt/ambrogio/voices/$voice"; ' +
    'test -s "$dir/MODEL_CARD"; test -s "$dir/tokens.txt"; test -d "$dir/espeak-ng-data"; ' +
    'test "$(ls "$dir"/*.onnx | wc -l)" = 1; test -s "$(ls "$dir"/*.onnx)"; done; ' +
    // Only the int8 Nemotron model is kept in the image, with the text of its license.
    'dir=/opt/ambrogio/models/sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11; test "$(ls "$dir" | tr "\\n" " ")" = "LICENSE decoder.int8.onnx encoder.int8.onnx joiner.int8.onnx tokens.txt "; ' +
    'grep -q "OpenMDW License Agreement, version 1.1" "$dir/LICENSE"; ' +
    'test -s "$dir/encoder.int8.onnx"; test -s "$dir/decoder.int8.onnx"; test -s "$dir/joiner.int8.onnx"; test -s "$dir/tokens.txt"');
  console.log(docker('run', '--rm', '--entrypoint', 'node', image, '--input-type=module', '-e', synthesis));
  const recognition = [
    "import { StreamingTranscriber } from '/workspace/packages/conversations/dist/adapters/in/session/streaming-transcriber.js';",
    "import { SherpaSynthesizer } from '/workspace/packages/conversations/dist/adapters/in/session/sherpa-synthesizer.js';",
    "import { transcriptionModel, voiceModel } from '/workspace/packages/conversations/dist/adapters/out/voice-config.js';",
    "for (const [name, voice, words] of [['it', 'vits-piper-it_IT-riccardo-x_low', 'Ciao, come stai oggi?'], ['en', 'vits-piper-en_US-kristin-medium', 'Hello, how are you today?']]) {",
    "  const transcriber = await StreamingTranscriber.load(await transcriptionModel({ sttModelDir: '/opt/ambrogio/models/sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11' }));",
    "  const synthesizer = await SherpaSynthesizer.load(await voiceModel({ voiceModelDir: '/opt/ambrogio/voices/' + voice }));",
    "  try {",
    "    async function* text() { yield words; }",
    "    const chunks = [];",
    "    for await (const chunk of synthesizer.synthesize(text(), new AbortController().signal)) chunks.push(Buffer.from(chunk));",
    "    const pcm = Buffer.concat(chunks);",
    "    const count = Math.floor(pcm.length / 2 * 16000 / synthesizer.sampleRate);",
    "    const audio16k = Buffer.alloc(count * 2);",
    "    for (let i = 0; i < count; i++) {",
    "      const source = Math.min(Math.floor(i * synthesizer.sampleRate / 16000), pcm.length / 2 - 1);",
    "      audio16k.writeInt16LE(pcm.readInt16LE(source * 2), i * 2);",
    "    }",
    "    // 100 ms frames at real-time pace, as a satellite sends them, then half a second of silence.",
    "    const paced = Buffer.concat([audio16k, Buffer.alloc(16000)]);",
    "    let last = 0;",
    "    async function* audio() { for (let at = 0; at < paced.length; at += 3200) { yield paced.subarray(at, at + 3200); await new Promise(r => setTimeout(r, 100)); } last = performance.now(); }",
    "    const recognized = await transcriber.transcribe(audio());",
    "    if (!recognized.trim()) throw new Error('Empty transcription for ' + name);",
    "    console.log(name + ': ' + recognized + ' (' + Math.round(performance.now() - last) + ' ms after the last frame)');",
    "  } finally { synthesizer.close(); await transcriber.close(); }",
    "}",
  ].join('\n');
  console.log(docker('run', '--rm', '--entrypoint', 'node', image, '--input-type=module', '-e', recognition));
  const profiles = [
    "import { loadVoiceConfig } from '/workspace/packages/conversations/dist/adapters/out/voice-config.js';",
    "for (const [language, voice] of [['it', 'vits-piper-it_IT-paola-medium'], ['en', 'vits-piper-en_US-kristin-medium']]) {",
    "  const config = await loadVoiceConfig(JSON.parse(process.env.PIPER_VOICES), language);",
    "  if (config.sttModelDir !== '/opt/ambrogio/models/sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11' || !config.voiceModelDir.endsWith(voice)) throw new Error('Wrong voice profile: ' + language);",
    "  console.log('Selected ' + language + ': ' + voice);",
    "}",
  ].join('\n');
  console.log(docker('run', '--rm', '--entrypoint', 'node',
    '--env', `PIPER_VOICES=${JSON.stringify(piperVoices)}`,
    image, '--input-type=module', '-e', profiles));
  // A mounted directory can supply another voice for the same language without a catalogue ID.
  const alternateVoice = join(customVoices, 'alternate-italian');
  mkdirSync(alternateVoice);
  const sourceContainer = docker('create', image);
  try {
    docker('cp', `${sourceContainer}:/opt/ambrogio/voices/vits-piper-it_IT-riccardo-x_low/.`, alternateVoice);
  } finally { docker('rm', sourceContainer); }
  const customProfile = { ...piperVoices, AMBROGIO_VOICE_IT_MODEL_DIR: '/custom-voices/alternate-italian' };
  const customSelection = [
    "import { loadVoiceConfig, voiceModel } from '/workspace/packages/conversations/dist/adapters/out/voice-config.js';",
    "const selected = await loadVoiceConfig(JSON.parse(process.env.CUSTOM_VOICES), 'it');",
    "if (selected.voiceModelDir !== '/custom-voices/alternate-italian') throw new Error('Mounted voice not selected');",
    "await voiceModel(selected);",
    "console.log('Selected mounted Italian Piper voice');",
  ].join('\n');
  console.log(docker('run', '--rm', '--entrypoint', 'node',
    '--env', `CUSTOM_VOICES=${JSON.stringify(customProfile)}`,
    '--mount', `type=bind,src=${customVoices},dst=/custom-voices,readonly`,
    image, '--input-type=module', '-e', customSelection));
  docker('run', '--rm', '--entrypoint', '/bin/sh',
    '--mount', `type=bind,src=${customVoices},dst=/opt/ambrogio/voices,readonly`,
    image, '-c', 'test -f /opt/ambrogio/voices/custom-voice.marker && test ! -e /opt/ambrogio/voices/vits-piper-it_IT-riccardo-x_low');
  docker('network', 'create', network);
  networkCreated = true;
  docker('run', '--detach', '--name', database, '--network', network, '--env', 'POSTGRES_HOST_AUTH_METHOD=trust',
    'pgvector/pgvector:pg18');
  databaseStarted = true;
  // The image restarts the server once after initialization: wait for the final one.
  for (let attempt = 0; ; attempt++) {
    const logs = execFileSync('docker', ['logs', database], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    try { docker('exec', database, 'pg_isready', '--host', '127.0.0.1', '--username', 'postgres', '--quiet'); ready = true; }
    catch { /* not ready yet */ }
    if (ready && logs.includes('PostgreSQL init process complete')) break;
    if (attempt === 60) throw new Error('The PostgreSQL container did not become ready');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  for (const language of ['it', 'en']) {
    // Production values only: every setting without a production default is explicit.
    container = docker('run', '--detach', '--stop-timeout', '15',
      '--publish', `127.0.0.1::${port}`, '--network', network,
      '--mount', `type=bind,src=${agents},dst=/etc/ambrogio/agents,readonly`,
      ...envArguments({ AMBROGIO_ENV: 'production', AMBROGIO_HTTP_HOST: '0.0.0.0', AMBROGIO_HTTP_PORT: String(port),
        AMBROGIO_PUBLIC_HTTPS: 'false', AMBROGIO_DATABASE_URL: databaseUrl,
        AMBROGIO_LANGUAGE: language, MISTRAL_API_KEY: 'test-only-placeholder', ...piperVoices }),
      image);
    const published = docker('port', container, `${port}/tcp`);
    const hostPort = Number(published.match(/:(\d+)$/)?.[1]);
    if (!Number.isSafeInteger(hostPort)) throw new Error(`Unexpected published port: ${published}`);
    const url = `http://127.0.0.1:${hostPort}/api/v1/conversations`;
    let response;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { response = await fetch(url); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 200)); }
    }
    if (!response) throw new Error(`HTTP listener did not become available for ${language}`);
    const body = await response.json();
    if (response.status !== 200 || !Array.isArray(body.items)) {
      throw new Error(`Unexpected HTTP response for ${language}: ${response.status}`);
    }
    // An orderly stop ends within the shutdown window with exit code 0 and no log line.
    docker('stop', container);
    const exitCode = docker('inspect', '--format', '{{.State.ExitCode}}', container);
    const logs = execFileSync('docker', ['logs', container], { encoding: 'utf8' });
    docker('rm', container);
    container = undefined;
    if (exitCode !== '0') throw new Error(`Unexpected exit code after docker stop for ${language}: ${exitCode}`);
    if (logs.trim() !== '') throw new Error(`Unexpected output after docker stop for ${language}`);
    console.log(`Voice-enabled HTTP startup and orderly stop passed for ${language}`);
  }
  const tables = docker('exec', database, 'psql', '--username', 'postgres', '--tuples-only', '--no-align', '--command',
    "select string_agg(table_name, ',' order by table_name) from information_schema.tables where table_schema = 'public'");
  if (!['conversations', 'turns'].every(table => tables.split(',').includes(table))) {
    throw new Error(`The archive tables were not created in the PostgreSQL container: ${tables}`);
  }
  console.log('Docker image verification passed: configuration from environment variables, mounted JSON agents and an external PostgreSQL database, language profiles, bundled Nemotron streaming, Piper voices in Italian and English, replaceable Piper voices, voice-enabled HTTP 200, no Compose.');
} finally {
  if (container) {
    try { docker('rm', '--force', container); } catch { /* preserve the verification failure */ }
  }
  if (databaseStarted) {
    try { docker('rm', '--force', database); } catch { /* preserve the verification failure */ }
  }
  if (networkCreated) {
    try { docker('network', 'rm', network); } catch { /* preserve the verification failure */ }
  }
  rmSync(temp, { recursive: true, force: true });
}
