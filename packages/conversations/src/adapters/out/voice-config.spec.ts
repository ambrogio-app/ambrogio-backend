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

type Profile = Readonly<{ sttModelDir?: string; voiceModelDir?: string }>;

/** The variables of one language profile, as an installation sets them. */
function profileVariables(language: 'it' | 'en', profile: Profile): Record<string, string> {
  const prefix = `AMBROGIO_VOICE_${language.toUpperCase()}_`;
  const entries: [string, unknown][] = [['STT_MODEL_DIR', profile.sttModelDir], ['MODEL_DIR', profile.voiceModelDir]];
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
  const piper = { sttModelDir: stt, voiceModelDir: voice };
  expect(await loadVoiceConfig(single(piper), 'it')).toEqual(withStt(piper));
  expect(await voiceModelFiles(voice)).toEqual({ model: join(voice, 'it_IT-paola-medium.onnx'),
    tokens: join(voice, 'tokens.txt'), dataDir: join(voice, 'espeak-ng-data') });
});

// Verification: Prova della selezione vocale per lingua
it('leaves voice disabled without a language list and reads no file', async () => {
  const unreadable = { AMBROGIO_VOICE_IT_STT_MODEL_DIR: '/missing/stt', AMBROGIO_VOICE_IT_MODEL_DIR: '/missing/voice' };
  expect(await loadVoiceConfig({ ...unreadable }, 'it')).toBeUndefined();
  expect(await loadVoiceConfig({ ...unreadable, AMBROGIO_VOICE_LANGUAGES: '' }, 'it')).toBeUndefined();
});

// Verification: Prova della selezione vocale per lingua
it('requires distinct listed languages among it and en that include the conversation language', async () => {
  const { stt, voice } = await fixture();
  const piper = { sttModelDir: stt, voiceModelDir: voice };
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
  const { directory, stt, voice } = await fixture();
  const otherItalianVoice = join(directory, 'other-italian-voice');
  await mkdir(join(otherItalianVoice, 'espeak-ng-data'), { recursive: true });
  await writeFile(join(otherItalianVoice, 'other.onnx'), 'fixture');
  await writeFile(join(otherItalianVoice, 'tokens.txt'), 'a 1\n');
  const englishStt = await transcriptionDirectory(join(directory, 'english-stt'));
  const italian = { sttModelDir: stt, voiceModelDir: otherItalianVoice };
  const english = { sttModelDir: englishStt, voiceModelDir: voice };
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
  await expect(loadVoiceConfig({ ...environment, AMBROGIO_VOICE_EN_MODEL_DIR: '' }, 'it'))
    .rejects.toThrow('Missing environment variable AMBROGIO_VOICE_EN_MODEL_DIR');
});

it('names each missing variable of a listed profile', async () => {
  const { stt, voice } = await fixture();
  const complete = single({ sttModelDir: stt, voiceModelDir: voice });
  for (const name of ['AMBROGIO_VOICE_IT_STT_MODEL_DIR', 'AMBROGIO_VOICE_IT_MODEL_DIR']) {
    await expect(loadVoiceConfig({ ...complete, [name]: undefined }, 'it')).rejects.toThrow(`Missing environment variable ${name}`);
    await expect(loadVoiceConfig({ ...complete, [name]: '' }, 'it')).rejects.toThrow(`Missing environment variable ${name}`);
  }
  // A profile of the other language is required as soon as that language is listed.
  await expect(loadVoiceConfig({ ...complete, AMBROGIO_VOICE_LANGUAGES: 'it,en' }, 'it'))
    .rejects.toThrow('Missing environment variable AMBROGIO_VOICE_EN_STT_MODEL_DIR');
});

// Verification: Prova della voce Piper configurata
it('requires exactly one readable model, tokens and espeak data in the voice directory', async () => {
  const { stt, voice } = await fixture();
  const config = single({ sttModelDir: stt, voiceModelDir: voice });
  await writeFile(join(voice, 'other.onnx'), 'fixture');
  await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Voice resources are unavailable');
  await rm(join(voice, 'other.onnx'));
  await rm(join(voice, 'it_IT-paola-medium.onnx'));
  await expect(loadVoiceConfig(config, 'it')).rejects.toThrow('Voice resources are unavailable');
  await writeFile(join(voice, 'it_IT-paola-medium.onnx'), 'fixture');
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
  await expect(loadVoiceConfig(config, 'it')).resolves.toEqual(withStt({ sttModelDir: stt, voiceModelDir: voice }));
  await expect(loadVoiceConfig(single({ sttModelDir: join(stt, 'absent'), voiceModelDir: voice }), 'it'))
    .rejects.toThrow('Voice resources are unavailable');
});

// Verification: Prova della voce Piper configurata
it('loads the single model of any Piper voice directory, also an int8 one', async () => {
  const { stt, voice } = await fixture();
  const piper = await loadVoiceConfig(single({ sttModelDir: stt, voiceModelDir: voice }), 'it');
  expect(await voiceModel(piper!)).toEqual({ model: join(voice, 'it_IT-paola-medium.onnx'),
    tokens: join(voice, 'tokens.txt'), dataDir: join(voice, 'espeak-ng-data') });
  await rm(join(voice, 'it_IT-paola-medium.onnx'));
  await writeFile(join(voice, 'model.int8.onnx'), 'fixture');
  expect(await voiceModel(piper!)).toMatchObject({ model: join(voice, 'model.int8.onnx') });
});

// Verification: Prova della trascrizione in streaming
it('requires exactly one readable encoder, decoder, joiner and tokens file in the transcription directory', async () => {
  const { stt, voice } = await fixture();
  const config = single({ sttModelDir: stt, voiceModelDir: voice });
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
