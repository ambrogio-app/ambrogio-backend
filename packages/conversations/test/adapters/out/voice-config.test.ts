import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { loadVoiceConfig } from '../../../src/adapters/out/voice-config.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path =>
  rm(path, { recursive: true, force: true }))); });

it('validates local voice resources', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-voice-config-'));
  directories.push(directory);
  const model = join(directory, 'vosk');
  const voice = join(directory, 'voice.onnx');
  const binary = join(directory, 'piper');
  const config = join(directory, 'voice.json');
  await mkdir(model);
  await writeFile(voice, 'fixture');
  await writeFile(`${voice}.json`, '{}');
  await writeFile(binary, '#!/bin/sh\n');
  await chmod(binary, 0o755);
  await writeFile(config, JSON.stringify({ voskModelPath: model, piperModelPath: voice,
    piperBinaryPath: binary }));
  expect(await loadVoiceConfig(config)).toEqual({ voskModelPath: model,
    piperModelPath: voice, piperBinaryPath: binary });
  await rm(`${voice}.json`);
  await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
});
