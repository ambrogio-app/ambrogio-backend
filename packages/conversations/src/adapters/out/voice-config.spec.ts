import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { loadVoiceConfig, transcriptionModel, voiceModel, voiceModelFiles } from './voice-config.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path =>
  rm(path, { recursive: true, force: true }))); });

/** A streaming transducer directory as kept in the image. */
async function transcriptionDirectory(path: string): Promise<string> {
  await mkdir(path);
  for (const name of ['encoder.int8.onnx', 'decoder.int8.onnx', 'joiner.int8.onnx', 'tokens.txt']) {
    await writeFile(join(path, name), 'fixture');
  }
  return path;
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-voice-config-'));
  directories.push(directory);
  const stt = await transcriptionDirectory(join(directory, 'stt'));
  const voice = join(directory, 'voice');
  await mkdir(join(voice, 'espeak-ng-data'), { recursive: true });
  await writeFile(join(voice, 'it_IT-paola-medium.onnx'), 'fixture');
  await writeFile(join(voice, 'it_IT-paola-medium.onnx.json'), '{}');
  await writeFile(join(voice, 'tokens.txt'), 'a 1\n');
  return { directory, stt, voice };
}

/** A Kokoro directory as extracted from `kokoro-multi-lang-v1_0.tar.bz2`. */
async function kokoroFixture() {
  const paths = await fixture();
  const kokoro = join(paths.directory, 'kokoro');
  await mkdir(join(kokoro, 'espeak-ng-data'), { recursive: true });
  for (const name of ['model.onnx', 'voices.bin', 'tokens.txt', 'lexicon-us-en.txt']) {
    await writeFile(join(kokoro, name), 'fixture');
  }
  return { ...paths, kokoro };
}

type Profile = Readonly<{ sttModelDir?: string; voiceEngine?: string; voiceModelDir?: string;
  voiceSpeaker?: number | string; voiceLanguage?: string }>;

/** The variables of one language profile, as an installation sets them. */
function profileVariables(language: 'it' | 'en', profile: Profile): Record<string, string> {
  const prefix = `AMBROGIO_VOICE_${language.toUpperCase()}_`;
  const entries: [string, unknown][] = [['STT_MODEL_DIR', profile.sttModelDir], ['ENGINE', profile.voiceEngine],
    ['MODEL_DIR', profile.voiceModelDir], ['SPEAKER', profile.voiceSpeaker], ['LANGUAGE', profile.voiceLanguage]];
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined)
    .map(([name, value]) => [prefix + name, String(value)]));
}

/** The configuration read for a profile: the variables of the profile, unchanged. */
const withStt = (profile: Profile, _language: 'it' | 'en' = 'it') => profile;

/** Voice enabled for one language, the conversation language unless another is given. */
const single = (profile: Profile, language: 'it' | 'en' = 'it') =>
  ({ AMBROGIO_VOICE_LANGUAGES: language, ...profileVariables(language, profile) });

it('validates the transcription model and the voice directory', async () => {
  const { stt, voice } = await fixture();
  const piper = { sttModelDir: stt, voiceEngine: 'piper', voiceModelDir: voice };
  expect(await loadVoiceConfig(single(piper), 'it')).toEqual(withStt(piper));
  expect(await voiceModelFiles(voice)).toEqual({ model: join(voice, 'it_IT-paola-medium.onnx'),
    tokens: join(voice, 'tokens.txt'), dataDir: join(voice, 'espeak-ng-data') });
});

// Verification: Prova della selezione vocale per lingua
it('leaves voice disabled without a language list and reads no file', async () => {
  const unreadable = { AMBROGIO_VOICE_IT_STT_MODEL_DIR: '/missing/stt', AMBROGIO_VOICE_IT_ENGINE: 'unknown' };
  expect(await loadVoiceConfig({ ...unreadable }, 'it')).toBeUndefined();
  expect(await loadVoiceConfig({ ...unreadable, AMBROGIO_VOICE_LANGUAGES: '' }, 'it')).toBeUndefined();
});

// Verification: Prova della selezione vocale per lingua
it('requires distinct listed languages among it and en that include the conversation language', async () => {
  const { stt, voice } = await fixture();
  const piper = { sttModelDir: stt, voiceEngine: 'piper', voiceModelDir: voice };
  const both = { ...profileVariables('it', piper), ...profileVariables('en', piper) };
  expect(await loadVoiceConfig({ ...both, AMBROGIO_VOICE_LANGUAGES: 'it, en' }, 'en')).toEqual(withStt(piper, 'en'));
  for (const listed of ['fr', 'it,fr', 'it,it', 'IT', ',', 'it,']) {
    await expect(loadVoiceConfig({ ...both, AMBROGIO_VOICE_LANGUAGES: listed }, 'it')).rejects
      .toThrow('Invalid environment variable AMBROGIO_VOICE_LANGUAGES: expected distinct languages among it and en');
  }
  await expect(loadVoiceConfig({ ...both, AMBROGIO_VOICE_LANGUAGES: 'it' }, 'en')).rejects
    .toThrow('Invalid environment variable AMBROGIO_VOICE_LANGUAGES: expected the conversation language AMBROGIO_LANGUAGE');
});

// Verification: Prova della selezione vocale per lingua
it('selects explicit paths for the active language without loading the other profile', async () => {
  const { directory, stt, voice, kokoro } = await kokoroFixture();
  const otherItalianVoice = join(directory, 'other-italian-voice');
  await mkdir(join(otherItalianVoice, 'espeak-ng-data'), { recursive: true });
  await writeFile(join(otherItalianVoice, 'other.onnx'), 'fixture');
  await writeFile(join(otherItalianVoice, 'tokens.txt'), 'a 1\n');
  const englishStt = await transcriptionDirectory(join(directory, 'english-stt'));
  const italian = { sttModelDir: stt, voiceEngine: 'piper', voiceModelDir: otherItalianVoice };
  const english = { sttModelDir: englishStt, voiceEngine: 'kokoro', voiceModelDir: kokoro,
    voiceSpeaker: 3, voiceLanguage: 'en' };
  const environment = { AMBROGIO_VOICE_LANGUAGES: 'it,en', ...profileVariables('it', italian),
    ...profileVariables('en', english) };
  expect(await loadVoiceConfig(environment, 'it')).toEqual(withStt(italian));
  expect(await loadVoiceConfig(environment, 'en')).toEqual(withStt(english, 'en'));
  // The unselected model paths are not opened until that language is active.
  await rm(englishStt, { recursive: true });
  expect(await loadVoiceConfig(environment, 'it')).toEqual(withStt(italian));
  await expect(loadVoiceConfig(environment, 'en')).rejects.toThrow('Voice resources are unavailable');
  // Choosing among Italian voices is by directory path, with no fixed catalogue ID.
  expect(await loadVoiceConfig(single({ ...italian, voiceModelDir: voice }), 'it')).toMatchObject({ voiceModelDir: voice });
  // Every listed profile is validated, also when its language is not active.
  await expect(loadVoiceConfig({ ...environment, AMBROGIO_VOICE_EN_ENGINE: 'unknown' }, 'it'))
    .rejects.toThrow('Invalid environment variable AMBROGIO_VOICE_EN_ENGINE: expected piper or kokoro');
});

it('names each missing variable of a listed profile', async () => {
  const { stt, voice } = await fixture();
  const complete = single({ sttModelDir: stt, voiceEngine: 'piper', voiceModelDir: voice });
  for (const name of ['AMBROGIO_VOICE_IT_STT_MODEL_DIR', 'AMBROGIO_VOICE_IT_ENGINE', 'AMBROGIO_VOICE_IT_MODEL_DIR']) {
    await expect(loadVoiceConfig({ ...complete, [name]: undefined }, 'it')).rejects.toThrow(`Missing environment variable ${name}`);
    await expect(loadVoiceConfig({ ...complete, [name]: '' }, 'it')).rejects.toThrow(`Missing environment variable ${name}`);
  }
  // A profile of the other language is required as soon as that language is listed.
  await expect(loadVoiceConfig({ ...complete, AMBROGIO_VOICE_LANGUAGES: 'it,en' }, 'it'))
    .rejects.toThrow('Missing environment variable AMBROGIO_VOICE_EN_STT_MODEL_DIR');
});

it('requires exactly one readable model, tokens and espeak data in the voice directory', async () => {
  const { stt, voice } = await fixture();
  const config = single({ sttModelDir: stt, voiceEngine: 'piper', voiceModelDir: voice });
  await writeFile(join(voice, 'other.onnx'), 'fixture');
  await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Voice resources are unavailable');
  await rm(join(voice, 'other.onnx'));
  await rm(join(voice, 'tokens.txt'));
  await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Voice resources are unavailable');
  await writeFile(join(voice, 'tokens.txt'), 'a 1\n');
  await rm(join(voice, 'espeak-ng-data'), { recursive: true });
  await writeFile(join(voice, 'espeak-ng-data'), 'not a directory');
  await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Voice resources are unavailable');
  await rm(join(voice, 'espeak-ng-data'));
  await mkdir(join(voice, 'espeak-ng-data'));
  if (process.getuid?.() !== 0) {
    await chmod(join(voice, 'it_IT-paola-medium.onnx'), 0o000);
    await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Voice resources are unavailable');
    await chmod(join(voice, 'it_IT-paola-medium.onnx'), 0o644);
  }
  await expect(loadVoiceConfig(config, 'it')).resolves.toEqual(withStt({ sttModelDir: stt, voiceEngine: 'piper', voiceModelDir: voice }));
  await expect(loadVoiceConfig(single({ sttModelDir: join(stt, 'absent'), voiceEngine: 'piper', voiceModelDir: voice }), 'it'))
    .rejects.toThrow('Voice resources are unavailable');
});

// Verification: Prova della scelta del motore di sintesi
it('accepts a Piper voice or any Kokoro voice and language', async () => {
  const { stt, voice, kokoro } = await kokoroFixture();
  const piper = await loadVoiceConfig(single({ sttModelDir: stt, voiceEngine: 'piper', voiceModelDir: voice }), 'it');
  expect(await voiceModel(piper!)).toEqual({ engine: 'piper', files: { model: join(voice, 'it_IT-paola-medium.onnx'),
    tokens: join(voice, 'tokens.txt'), dataDir: join(voice, 'espeak-ng-data') } });
  for (const [speaker, language] of [[0, 'en'], [35, 'it'], [52, 'pt-br']] as const) {
    const value = { sttModelDir: stt, voiceEngine: 'kokoro', voiceModelDir: kokoro, voiceSpeaker: speaker,
      voiceLanguage: language };
    const loaded = await loadVoiceConfig(single(value), 'it');
    expect(loaded).toEqual(withStt(value));
    expect(await voiceModel(loaded!)).toEqual({ engine: 'kokoro', speaker, language, files: {
      model: join(kokoro, 'model.onnx'), voices: join(kokoro, 'voices.bin'), tokens: join(kokoro, 'tokens.txt'),
      dataDir: join(kokoro, 'espeak-ng-data') } });
  }
  // The int8 variant is a Kokoro model too.
  await rm(join(kokoro, 'model.onnx'));
  await writeFile(join(kokoro, 'model.int8.onnx'), 'fixture');
  const int8 = await loadVoiceConfig(single({ sttModelDir: stt, voiceEngine: 'kokoro', voiceModelDir: kokoro,
    voiceSpeaker: 3, voiceLanguage: 'en' }), 'it');
  expect(await voiceModel(int8!)).toMatchObject({ files: { model: join(kokoro, 'model.int8.onnx') } });
});

// Verification: Prova della scelta del motore di sintesi
it('rejects an unknown engine and a speaker or language that does not fit the engine', async () => {
  const { stt, voice, kokoro } = await kokoroFixture();
  const cases: [Profile, string][] = [
    ...['espeak', 'Piper'].map(voiceEngine => [{ sttModelDir: stt, voiceEngine, voiceModelDir: voice },
      'Invalid environment variable AMBROGIO_VOICE_IT_ENGINE: expected piper or kokoro'] as [Profile, string]),
    [{ sttModelDir: stt, voiceEngine: 'piper', voiceModelDir: voice, voiceSpeaker: 0 },
      'Invalid environment variable AMBROGIO_VOICE_IT_SPEAKER: not allowed with the piper engine'],
    [{ sttModelDir: stt, voiceEngine: 'piper', voiceModelDir: voice, voiceLanguage: 'it' },
      'Invalid environment variable AMBROGIO_VOICE_IT_LANGUAGE: not allowed with the piper engine'],
    [{ sttModelDir: stt, voiceEngine: 'kokoro', voiceModelDir: kokoro, voiceLanguage: 'it' },
      'Missing environment variable AMBROGIO_VOICE_IT_SPEAKER'],
    [{ sttModelDir: stt, voiceEngine: 'kokoro', voiceModelDir: kokoro, voiceSpeaker: 35 },
      'Missing environment variable AMBROGIO_VOICE_IT_LANGUAGE'],
    ...['-1', '1.5', 'if_sara', ' 35'].map(voiceSpeaker => [{ sttModelDir: stt, voiceEngine: 'kokoro',
      voiceModelDir: kokoro, voiceSpeaker, voiceLanguage: 'it' },
    'Invalid environment variable AMBROGIO_VOICE_IT_SPEAKER: expected an integer from 0'] as [Profile, string]),
  ];
  for (const [profile, message] of cases) {
    await expect(loadVoiceConfig(single(profile), 'it')).rejects.toThrow(message);
  }
});

// Verification: Prova della scelta del motore di sintesi
it('requires exactly one readable Kokoro model, voices, tokens and espeak data', async () => {
  const { stt, kokoro } = await kokoroFixture();
  const config = single({ sttModelDir: stt, voiceEngine: 'kokoro', voiceModelDir: kokoro,
    voiceSpeaker: 36, voiceLanguage: 'it' });
  for (const name of ['model.onnx', 'voices.bin', 'tokens.txt']) {
    await rm(join(kokoro, name));
    await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Voice resources are unavailable');
    await writeFile(join(kokoro, name), 'fixture');
  }
  await rm(join(kokoro, 'espeak-ng-data'), { recursive: true });
  await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Voice resources are unavailable');
  await mkdir(join(kokoro, 'espeak-ng-data'));
  // Two models in the directory are ambiguous.
  await writeFile(join(kokoro, 'model.int8.onnx'), 'fixture');
  await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Voice resources are unavailable');
});

// Verification: Prova della trascrizione in streaming
it('requires exactly one readable encoder, decoder, joiner and tokens file in the transcription directory', async () => {
  const { stt, voice } = await fixture();
  const config = single({ sttModelDir: stt, voiceEngine: 'piper', voiceModelDir: voice });
  const loaded = await loadVoiceConfig(config, 'it');
  expect(await transcriptionModel(loaded!)).toEqual({ encoder: join(stt, 'encoder.int8.onnx'),
    decoder: join(stt, 'decoder.int8.onnx'), joiner: join(stt, 'joiner.int8.onnx'), tokens: join(stt, 'tokens.txt') });
  for (const name of ['encoder.int8.onnx', 'decoder.int8.onnx', 'joiner.int8.onnx', 'tokens.txt']) {
    await rm(join(stt, name));
    await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Voice resources are unavailable');
    await writeFile(join(stt, name), 'fixture');
  }
  // Two encoders, such as an int8 and a floating-point one, are ambiguous.
  await writeFile(join(stt, 'encoder.onnx'), 'fixture');
  await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Voice resources are unavailable');
});
