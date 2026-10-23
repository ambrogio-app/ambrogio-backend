import { writeConfigFile } from '../../support/config-fixture.js';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { loadVoiceConfig, voiceModel, voiceModelFiles } from '../../../src/adapters/out/voice-config.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path =>
  rm(path, { recursive: true, force: true }))); });

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-voice-config-'));
  directories.push(directory);
  const vosk = join(directory, 'vosk');
  const voice = join(directory, 'voice');
  const config = join(directory, 'voice.ts');
  await mkdir(vosk);
  await mkdir(join(voice, 'espeak-ng-data'), { recursive: true });
  await writeConfigFile(join(voice, 'it_IT-paola-medium.onnx'), 'fixture');
  await writeConfigFile(join(voice, 'it_IT-paola-medium.onnx.ts'), '{}');
  await writeConfigFile(join(voice, 'tokens.txt'), 'a 1\n');
  return { directory, vosk, voice, config };
}

/** A Kokoro directory as extracted from `kokoro-multi-lang-v1_0.tar.bz2`. */
async function kokoroFixture() {
  const paths = await fixture();
  const kokoro = join(paths.directory, 'kokoro');
  await mkdir(join(kokoro, 'espeak-ng-data'), { recursive: true });
  for (const name of ['model.onnx', 'voices.bin', 'tokens.txt', 'lexicon-us-en.txt']) {
    await writeConfigFile(join(kokoro, name), 'fixture');
  }
  return { ...paths, kokoro };
}

it('validates the Vosk model and the voice directory', async () => {
  const { vosk, voice, config } = await fixture();
  await writeConfigFile(config, JSON.stringify({ voskModelPath: vosk, voiceEngine: 'piper', voiceModelDir: voice }));
  expect(await loadVoiceConfig(config)).toEqual({ voskModelPath: vosk, voiceEngine: 'piper', voiceModelDir: voice });
  expect(await voiceModelFiles(voice)).toEqual({ model: join(voice, 'it_IT-paola-medium.onnx'),
    tokens: join(voice, 'tokens.txt'), dataDir: join(voice, 'espeak-ng-data') });
});

// Verification: Analisi della selezione vocale per lingua
it('selects explicit paths for the active language without loading the other profile', async () => {
  const { directory, vosk, voice, kokoro, config } = await kokoroFixture();
  const otherItalianVoice = join(directory, 'other-italian-voice');
  await mkdir(join(otherItalianVoice, 'espeak-ng-data'), { recursive: true });
  await writeConfigFile(join(otherItalianVoice, 'other.onnx'), 'fixture');
  await writeConfigFile(join(otherItalianVoice, 'tokens.txt'), 'a 1\n');
  const englishVosk = join(directory, 'english-vosk');
  await mkdir(englishVosk);
  const italian = { voskModelPath: vosk, voiceEngine: 'piper', voiceModelDir: otherItalianVoice };
  const english = { voskModelPath: englishVosk, voiceEngine: 'kokoro', voiceModelDir: kokoro,
    voiceSpeaker: 3, voiceLanguage: 'en' };
  await writeConfigFile(config, JSON.stringify({ languages: { it: italian, en: english } }));
  expect(await loadVoiceConfig(config, 'it')).toEqual(italian);
  expect(await loadVoiceConfig(config, 'en')).toEqual(english);
  // The unselected model paths are not opened until that language is active.
  await rm(englishVosk, { recursive: true });
  expect(await loadVoiceConfig(config, 'it')).toEqual(italian);
  await expect(loadVoiceConfig(config, 'en')).rejects.toThrow('Voice resources are unavailable');
  // Choosing among Italian voices is by directory path, with no fixed catalogue ID.
  await writeConfigFile(config, JSON.stringify({ languages: { it: { ...italian, voiceModelDir: voice } } }));
  expect(await loadVoiceConfig(config, 'it')).toMatchObject({ voiceModelDir: voice });
  await expect(loadVoiceConfig(config, 'en')).rejects.toThrow('Invalid voice configuration file');
  await writeConfigFile(config, JSON.stringify({ languages: { it: italian, en: { ...english, voiceEngine: 'unknown' } } }));
  await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Invalid voice configuration file');
});

it('rejects missing, empty and unknown fields, including the former Piper paths', async () => {
  const { vosk, voice, config } = await fixture();
  for (const value of [{ voskModelPath: vosk, voiceEngine: 'piper' },
    { voskModelPath: vosk, voiceEngine: 'piper', voiceModelDir: ' ' },
    { voskModelPath: vosk, voiceEngine: 'piper', voiceModelDir: voice, piperModelPath: '/voice.onnx' },
    { voskModelPath: vosk, voiceEngine: 'piper', voiceModelDir: voice, piperBinaryPath: '/piper' }, []]) {
    await writeConfigFile(config, JSON.stringify(value));
    await expect(loadVoiceConfig(config)).rejects.toThrow('Invalid voice configuration file');
  }
});

it('requires exactly one readable model, tokens and espeak data in the voice directory', async () => {
  const { vosk, voice, config } = await fixture();
  await writeConfigFile(config, JSON.stringify({ voskModelPath: vosk, voiceEngine: 'piper', voiceModelDir: voice }));
  await writeConfigFile(join(voice, 'other.onnx'), 'fixture');
  await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
  await rm(join(voice, 'other.onnx'));
  await rm(join(voice, 'tokens.txt'));
  await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
  await writeConfigFile(join(voice, 'tokens.txt'), 'a 1\n');
  await rm(join(voice, 'espeak-ng-data'), { recursive: true });
  await writeConfigFile(join(voice, 'espeak-ng-data'), 'not a directory');
  await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
  await rm(join(voice, 'espeak-ng-data'));
  await mkdir(join(voice, 'espeak-ng-data'));
  if (process.getuid?.() !== 0) {
    await chmod(join(voice, 'it_IT-paola-medium.onnx'), 0o000);
    await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
    await chmod(join(voice, 'it_IT-paola-medium.onnx'), 0o644);
  }
  await expect(loadVoiceConfig(config)).resolves.toEqual({ voskModelPath: vosk, voiceEngine: 'piper', voiceModelDir: voice });
  await writeConfigFile(config, JSON.stringify({ voskModelPath: join(vosk, 'absent'), voiceEngine: 'piper', voiceModelDir: voice }));
  await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
});

// Verification: Prova della scelta del motore di sintesi
it('accepts a Piper voice or any Kokoro voice and language', async () => {
  const { vosk, voice, kokoro, config } = await kokoroFixture();
  await writeConfigFile(config, JSON.stringify({ voskModelPath: vosk, voiceEngine: 'piper', voiceModelDir: voice }));
  const piper = await loadVoiceConfig(config);
  expect(await voiceModel(piper)).toEqual({ engine: 'piper', files: { model: join(voice, 'it_IT-paola-medium.onnx'),
    tokens: join(voice, 'tokens.txt'), dataDir: join(voice, 'espeak-ng-data') } });
  for (const [speaker, language] of [[0, 'en'], [35, 'it'], [52, 'pt-br']] as const) {
    const value = { voskModelPath: vosk, voiceEngine: 'kokoro', voiceModelDir: kokoro, voiceSpeaker: speaker,
      voiceLanguage: language };
    await writeConfigFile(config, JSON.stringify(value));
    const loaded = await loadVoiceConfig(config);
    expect(loaded).toEqual(value);
    expect(await voiceModel(loaded)).toEqual({ engine: 'kokoro', speaker, language, files: {
      model: join(kokoro, 'model.onnx'), voices: join(kokoro, 'voices.bin'), tokens: join(kokoro, 'tokens.txt'),
      dataDir: join(kokoro, 'espeak-ng-data') } });
  }
  // The int8 variant is a Kokoro model too.
  await rm(join(kokoro, 'model.onnx'));
  await writeConfigFile(join(kokoro, 'model.int8.onnx'), 'fixture');
  await writeConfigFile(config, JSON.stringify({ voskModelPath: vosk, voiceEngine: 'kokoro', voiceModelDir: kokoro,
    voiceSpeaker: 3, voiceLanguage: 'en' }));
  const int8 = await loadVoiceConfig(config);
  expect(await voiceModel(int8)).toMatchObject({ files: { model: join(kokoro, 'model.int8.onnx') } });
});

// Verification: Prova della scelta del motore di sintesi
it('rejects a missing or unknown engine and a speaker or language that does not fit the engine', async () => {
  const { vosk, voice, kokoro, config } = await kokoroFixture();
  for (const value of [{ voskModelPath: vosk, voiceModelDir: voice },
    { voskModelPath: vosk, voiceEngine: '', voiceModelDir: voice },
    { voskModelPath: vosk, voiceEngine: 'espeak', voiceModelDir: voice },
    { voskModelPath: vosk, voiceEngine: 'Piper', voiceModelDir: voice },
    { voskModelPath: vosk, voiceEngine: 'piper', voiceModelDir: voice, voiceSpeaker: 0 },
    { voskModelPath: vosk, voiceEngine: 'piper', voiceModelDir: voice, voiceLanguage: 'it' },
    { voskModelPath: vosk, voiceEngine: 'kokoro', voiceModelDir: kokoro },
    { voskModelPath: vosk, voiceEngine: 'kokoro', voiceModelDir: kokoro, voiceSpeaker: 35 },
    { voskModelPath: vosk, voiceEngine: 'kokoro', voiceModelDir: kokoro, voiceLanguage: 'it' },
    ...[-1, 1.5, '35', 'if_sara', null].map(voiceSpeaker =>
      ({ voskModelPath: vosk, voiceEngine: 'kokoro', voiceModelDir: kokoro, voiceSpeaker, voiceLanguage: 'it' })),
    ...['', ' ', 3, null].map(voiceLanguage =>
      ({ voskModelPath: vosk, voiceEngine: 'kokoro', voiceModelDir: kokoro, voiceSpeaker: 35, voiceLanguage }))]) {
    await writeConfigFile(config, JSON.stringify(value));
    await expect(loadVoiceConfig(config)).rejects.toThrow('Invalid voice configuration file');
  }
});

// Verification: Prova della scelta del motore di sintesi
it('requires exactly one readable Kokoro model, voices, tokens and espeak data', async () => {
  const { vosk, kokoro, config } = await kokoroFixture();
  await writeConfigFile(config, JSON.stringify({ voskModelPath: vosk, voiceEngine: 'kokoro', voiceModelDir: kokoro,
    voiceSpeaker: 36, voiceLanguage: 'it' }));
  for (const name of ['model.onnx', 'voices.bin', 'tokens.txt']) {
    await rm(join(kokoro, name));
    await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
    await writeConfigFile(join(kokoro, name), 'fixture');
  }
  await rm(join(kokoro, 'espeak-ng-data'), { recursive: true });
  await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
  await mkdir(join(kokoro, 'espeak-ng-data'));
  // Two models in the directory are ambiguous.
  await writeConfigFile(join(kokoro, 'model.int8.onnx'), 'fixture');
  await expect(loadVoiceConfig(config)).rejects.toThrow('Voice resources are unavailable');
});
