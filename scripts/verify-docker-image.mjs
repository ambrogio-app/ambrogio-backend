import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const writeAgent = (filename, value) => writeFileSync(filename, `${JSON.stringify(value)}\n`);

// The variables of the bundled voices, as an installation sets them.
const piperVoices = {
  AMBROGIO_VOICE_LANGUAGES: 'it,en',
  AMBROGIO_VOICE_IT_VOSK_MODEL_PATH: '/opt/ambrogio/models/vosk-model-small-it-0.22',
  AMBROGIO_VOICE_IT_ENGINE: 'piper',
  AMBROGIO_VOICE_IT_MODEL_DIR: '/opt/ambrogio/voices/vits-piper-it_IT-paola-medium',
  AMBROGIO_VOICE_EN_VOSK_MODEL_PATH: '/opt/ambrogio/models/vosk-model-small-en-us-0.15',
  AMBROGIO_VOICE_EN_ENGINE: 'piper',
  AMBROGIO_VOICE_EN_MODEL_DIR: '/opt/ambrogio/voices/vits-piper-en_US-kristin-medium',
};
const kokoroVoices = {
  ...piperVoices,
  AMBROGIO_VOICE_IT_ENGINE: 'kokoro', AMBROGIO_VOICE_IT_MODEL_DIR: '/opt/ambrogio/kokoro/kokoro-multi-lang-v1_0',
  AMBROGIO_VOICE_IT_SPEAKER: '35', AMBROGIO_VOICE_IT_LANGUAGE: 'it',
  AMBROGIO_VOICE_EN_ENGINE: 'kokoro', AMBROGIO_VOICE_EN_MODEL_DIR: '/opt/ambrogio/kokoro/kokoro-multi-lang-v1_0',
  AMBROGIO_VOICE_EN_SPEAKER: '3', AMBROGIO_VOICE_EN_LANGUAGE: 'en',
};
const envArguments = (variables) => Object.entries(variables).flatMap(([name, value]) => ['--env', `${name}=${value}`]);

const existingImage = process.env.AMBROGIO_DOCKER_IMAGE;
const image = existingImage || 'ambrogio-server:verification';
const port = 34123;
const temp = mkdtempSync(join(tmpdir(), 'ambrogio-docker-'));
const agents = join(temp, 'agents');
const data = join(temp, 'data');
const customVoices = join(temp, 'custom-voices');
let container;

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

try {
  mkdirSync(agents);
  mkdirSync(data);
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
    'test ! -e /workspace/examples && test ! -e /data/conversations.sqlite && ' +
    'test ! -e /opt/piper && ! command -v python3 >/dev/null && cd /workspace/packages/conversations && node -e "require(\'vosk-koffi\')"');
  // Each bundled voice is loaded and spoken with the image's own synthesizer code.
  const synthesis = [
    "import { SherpaSynthesizer } from '/workspace/packages/conversations/dist/adapters/in/session/sherpa-synthesizer.js';",
    "import { voiceModel } from '/workspace/packages/conversations/dist/adapters/out/voice-config.js';",
    "for (const [voice, rate, words] of [['vits-piper-it_IT-riccardo-x_low', 16000, 'Ciao, sono Ambrogio.'], ['vits-piper-it_IT-paola-medium', 22050, 'Ciao, sono Ambrogio.'], ['vits-piper-en_US-kristin-medium', 22050, 'Hello, I am Ambrogio.']]) {",
    "  const synthesizer = await SherpaSynthesizer.load(await voiceModel({ voiceEngine: 'piper', voiceModelDir: '/opt/ambrogio/voices/' + voice }));",
    "  async function* text() { yield words; }",
    "  let bytes = 0;",
    "  for await (const chunk of synthesizer.synthesize(text(), new AbortController().signal)) bytes += chunk.length;",
    "  synthesizer.close();",
    "  if (synthesizer.sampleRate !== rate || bytes < rate) throw new Error('Unexpected synthesis for ' + voice + ': ' + synthesizer.sampleRate + ' Hz, ' + bytes + ' bytes');",
    "  console.log(voice + ': ' + synthesizer.sampleRate + ' Hz, ' + bytes + ' bytes');",
    "}",
    "for (const [language, speaker, words] of [['en', 3, 'Hello, I am Ambrogio.'], ['it', 35, 'Ciao, sono Ambrogio.']]) {",
    "  const synthesizer = await SherpaSynthesizer.load(await voiceModel({ voiceEngine: 'kokoro', voiceModelDir: '/opt/ambrogio/kokoro/kokoro-multi-lang-v1_0', voiceSpeaker: speaker, voiceLanguage: language }));",
    "  async function* text() { yield words; }",
    "  let bytes = 0;",
    "  for await (const chunk of synthesizer.synthesize(text(), new AbortController().signal)) bytes += chunk.length;",
    "  synthesizer.close();",
    "  if (synthesizer.sampleRate !== 24000 || bytes < 24000) throw new Error('Unexpected Kokoro synthesis for ' + language);",
    "  console.log('kokoro ' + language + ': ' + bytes + ' bytes');",
    "}",
  ].join('\n');
  docker('run', '--rm', '--entrypoint', '/bin/sh', image, '-c',
    'set -eu; test -f /opt/ambrogio/voices/README.md; ' +
    'for voice in vits-piper-it_IT-riccardo-x_low vits-piper-it_IT-paola-medium vits-piper-en_US-kristin-medium; do ' +
    'dir="/opt/ambrogio/voices/$voice"; ' +
    'test -s "$dir/MODEL_CARD"; test -s "$dir/tokens.txt"; test -d "$dir/espeak-ng-data"; ' +
    'test "$(ls "$dir"/*.onnx | wc -l)" = 1; test -s "$(ls "$dir"/*.onnx)"; done; ' +
    'for model in vosk-model-small-it-0.22 vosk-model-small-en-us-0.15; do ' +
    'dir="/opt/ambrogio/models/$model"; test -s "$dir/am/final.mdl"; ' +
    'test -s "$dir/graph/HCLr.fst"; done; ' +
    'dir=/opt/ambrogio/kokoro/kokoro-multi-lang-v1_0; ' +
    'test -s "$dir/model.onnx"; test -s "$dir/voices.bin"; test -s "$dir/LICENSE"');
  console.log(docker('run', '--rm', '--entrypoint', 'node', image, '--input-type=module', '-e', synthesis));
  const recognition = [
    "import { VoskTranscriber } from '/workspace/packages/conversations/dist/adapters/in/session/vosk-transcriber.js';",
    "import { SherpaSynthesizer } from '/workspace/packages/conversations/dist/adapters/in/session/sherpa-synthesizer.js';",
    "import { voiceModel } from '/workspace/packages/conversations/dist/adapters/out/voice-config.js';",
    "for (const [name, voice, words] of [['vosk-model-small-it-0.22', 'vits-piper-it_IT-riccardo-x_low', 'Ciao, come stai oggi?'], ['vosk-model-small-en-us-0.15', 'vits-piper-en_US-kristin-medium', 'Hello, how are you today?']]) {",
    "  const transcriber = new VoskTranscriber('/opt/ambrogio/models/' + name);",
    "  const synthesizer = await SherpaSynthesizer.load(await voiceModel({ voiceEngine: 'piper', voiceModelDir: '/opt/ambrogio/voices/' + voice }));",
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
    "    async function* audio() { yield audio16k; yield Buffer.alloc(16000); }",
    "    const recognized = await transcriber.transcribe(audio());",
    "    if (!recognized.trim()) throw new Error('Empty transcription for ' + name);",
    "    console.log(name + ': ' + recognized);",
    "  } finally { synthesizer.close(); transcriber.close(); }",
    "}",
  ].join('\n');
  console.log(docker('run', '--rm', '--entrypoint', 'node', image, '--input-type=module', '-e', recognition));
  const profiles = [
    "import { loadVoiceConfig } from '/workspace/packages/conversations/dist/adapters/out/voice-config.js';",
    "for (const [language, vosk, voice] of [['it', 'vosk-model-small-it-0.22', 'vits-piper-it_IT-paola-medium'], ['en', 'vosk-model-small-en-us-0.15', 'vits-piper-en_US-kristin-medium']]) {",
    "  const config = await loadVoiceConfig(JSON.parse(process.env.PIPER_VOICES), language);",
    "  if (!config.voskModelPath.endsWith(vosk) || !config.voiceModelDir.endsWith(voice)) throw new Error('Wrong voice profile: ' + language);",
    "  console.log('Selected ' + language + ': ' + voice);",
    "  const kokoro = await loadVoiceConfig(JSON.parse(process.env.KOKORO_VOICES), language);",
    "  if (kokoro.voiceEngine !== 'kokoro' || kokoro.voiceLanguage !== language || kokoro.voiceSpeaker !== (language === 'it' ? 35 : 3)) throw new Error('Wrong Kokoro profile: ' + language);",
    "  console.log('Selected Kokoro ' + language + ': speaker ' + kokoro.voiceSpeaker);",
    "}",
  ].join('\n');
  console.log(docker('run', '--rm', '--entrypoint', 'node',
    '--env', `PIPER_VOICES=${JSON.stringify(piperVoices)}`, '--env', `KOKORO_VOICES=${JSON.stringify(kokoroVoices)}`,
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
  for (const language of ['it', 'en']) {
    // Production values only: every setting without a production default is explicit.
    container = docker('run', '--detach', '--stop-timeout', '15',
      '--publish', `127.0.0.1::${port}`,
      '--mount', `type=bind,src=${agents},dst=/etc/ambrogio/agents,readonly`,
      '--mount', `type=bind,src=${data},dst=/data`,
      ...envArguments({ AMBROGIO_ENV: 'production', AMBROGIO_HTTP_HOST: '0.0.0.0', AMBROGIO_HTTP_PORT: String(port),
        AMBROGIO_PUBLIC_HTTPS: 'false', AMBROGIO_ARCHIVE_PATH: '/data/conversations.sqlite',
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
  if (!existsSync(join(data, 'conversations.sqlite'))) {
    throw new Error('SQLite archive was not created in the external mount');
  }
  console.log('Docker image verification passed: configuration from environment variables, mounted JSON agents and external SQLite, language profiles, bundled Italian and English Vosk, Piper and Kokoro models, replaceable Piper voices, voice-enabled HTTP 200, no Compose.');
} finally {
  if (container) {
    try { docker('rm', '--force', container); } catch { /* preserve the verification failure */ }
  }
  rmSync(temp, { recursive: true, force: true });
}
