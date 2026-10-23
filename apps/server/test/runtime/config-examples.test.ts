import { copyFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { loadHttpConfig } from '../../src/runtime/http-config.js';
import { loadAgentConfigs } from '../../src/runtime/agent-config.js';
import { loadConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import { loadVoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';

const example = (name: string) => new URL(`../../../../examples/${name}`, import.meta.url);
let directory: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

test('the distributed TypeScript modules read deployment values and retain validation', async () => {
  vi.stubEnv('AMBROGIO_HTTP_PORT', '3100');
  vi.stubEnv('AMBROGIO_ALLOWED_ORIGINS', 'https://family.example.test');
  vi.stubEnv('AMBROGIO_LANGUAGE', 'it');
  vi.stubEnv('AMBROGIO_TIME_ZONE', 'Europe/Rome');
  vi.stubEnv('AMBROGIO_IT_VOICE_ENGINE', 'kokoro');
  vi.stubEnv('AMBROGIO_IT_VOICE_SPEAKER', '7');
  vi.stubEnv('MISTRAL_API_KEY', 'test-only-key');
  vi.stubEnv('AMBROGIO_GENERIC_MAX_TOKENS', '42');
  directory = await mkdtemp(join(tmpdir(), 'ambrogio-config-examples-'));
  const vosk = join(directory, 'vosk');
  const voice = join(directory, 'voice');
  await mkdir(vosk);
  await mkdir(join(voice, 'espeak-ng-data'), { recursive: true });
  await Promise.all(['model.onnx', 'voices.bin', 'tokens.txt'].map(name =>
    writeFile(join(voice, name), 'fixture')));
  vi.stubEnv('AMBROGIO_IT_VOSK_MODEL_PATH', vosk);
  vi.stubEnv('AMBROGIO_IT_VOICE_MODEL_DIR', voice);
  const agents = join(directory, 'agents');
  await mkdir(agents);
  await copyFile(example('agents/orchestrator.ts'), join(agents, 'orchestrator.ts'));
  await copyFile(example('agents/generic.ts'), join(agents, 'generic.ts'));

  expect(await loadHttpConfig(example('http.ts').pathname)).toMatchObject({
    port: 3100, allowedOrigins: ['https://family.example.test'],
  });
  expect(await loadConversationConfig(example('conversations.ts').pathname)).toMatchObject({
    language: 'it', timeZone: 'Europe/Rome',
  });
  expect(await loadVoiceConfig(example('voice.ts').pathname, 'it')).toMatchObject({
    voiceEngine: 'kokoro', voiceModelDir: voice, voiceSpeaker: 7,
  });
  const configured = await loadAgentConfigs(agents);
  expect(configured.orchestrator.llm.apiKey).toBe('test-only-key');
  expect(configured.specialists[0]?.llm.apiKey).toBe('test-only-key');
  expect(configured.specialists[0]?.llm.options).toEqual({ max_tokens: 42 });

  vi.stubEnv('AMBROGIO_HTTP_PORT', 'invalid');
  await expect(loadHttpConfig(example('http.ts').pathname)).rejects.toThrow('Invalid HTTP listener configuration');
});
