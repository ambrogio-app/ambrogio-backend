import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { loadVoiceConfig, voiceModelFiles } from '../../../src/adapters/out/voice-config.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path =>
  rm(path, { recursive: true, force: true }))); });

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-voice-config-'));
  directories.push(directory);
  const vosk = join(directory, 'vosk');
  const voice = join(directory, 'voice');
  const config = join(directory, 'voice.json');
  await mkdir(vosk);
  await mkdir(join(voice, 'espeak-ng-data'), { recursive: true });
  await writeFile(join(voice, 'it_IT-paola-medium.onnx'), 'fixture');
  await writeFile(join(voice, 'it_IT-paola-medium.onnx.json'), '{}');
  await writeFile(join(voice, 'tokens.txt'), 'a 1\n');
  return { directory, vosk, voice, config };
}

it('validates the Vosk model and the voice directory', async () => {
  const { vosk, voice, config } = await fixture();
  await writeFile(config, JSON.stringify({ voskModelPath: vosk, voiceModelDir: voice }));
  expect(await loadVoiceConfig(config)).toEqual({ voskModelPath: vosk, voiceModelDir: voice });
  expect(await voiceModelFiles(voice)).toEqual({ model: join(voice, 'it_IT-paola-medium.onnx'),
    tokens: join(voice, 'tokens.txt'), dataDir: join(voice, 'espeak-ng-data') });
});

it('rejects missing, empty and unknown fields, including the former Piper paths', async () => {
  const { vosk, voice, config } = await fixture();
  for (const value of [{ voskModelPath: vosk }, { voskModelPath: vosk, voiceModelDir: ' ' },
    { voskModelPath: vosk, voiceModelDir: voice, piperModelPath: '/voice.onnx' },
    { voskModelPath: vosk, voiceModelDir: voice, piperBinaryPath: '/piper' }, []]) {
    await writeFile(config, JSON.stringify(value));
    await expect(loadVoiceConfig(config)).rejects.toThrow('Invalid voice configuration file');
  }
});

it('requires exactly one readable model, tokens and espeak data in the voice directory', async () => {
  const { vosk, voice, config } = await fixture();
  await writeFile(config, JSON.stringify({ voskModelPath: vosk, voiceModelDir: voice }));
  await writeFile(join(voice, 'other.onnx'), 'fixture');
  await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
  await rm(join(voice, 'other.onnx'));
  await rm(join(voice, 'tokens.txt'));
  await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
  await writeFile(join(voice, 'tokens.txt'), 'a 1\n');
  await rm(join(voice, 'espeak-ng-data'), { recursive: true });
  await writeFile(join(voice, 'espeak-ng-data'), 'not a directory');
  await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
  await rm(join(voice, 'espeak-ng-data'));
  await mkdir(join(voice, 'espeak-ng-data'));
  if (process.getuid?.() !== 0) {
    await chmod(join(voice, 'it_IT-paola-medium.onnx'), 0o000);
    await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
    await chmod(join(voice, 'it_IT-paola-medium.onnx'), 0o644);
  }
  await expect(loadVoiceConfig(config)).resolves.toEqual({ voskModelPath: vosk, voiceModelDir: voice });
  await writeFile(config, JSON.stringify({ voskModelPath: join(vosk, 'absent'), voiceModelDir: voice }));
  await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
});
