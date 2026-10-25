import { access, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { ProjectError } from '../../domain/project-error.js';
import { integerVariable, invalidVariable, missingVariable, type EnvironmentVariable } from './environment-variables.js';

/** The synthesis engine and voice chosen by the installation. */
export type VoiceSelection = Readonly<
  | { voiceEngine: 'piper'; voiceModelDir: string }
  | { voiceEngine: 'kokoro'; voiceModelDir: string; voiceSpeaker: number; voiceLanguage: string }>;

/** The transcription engine and model chosen by the installation; Whisper uses the language of the profile. */
export type TranscriptionSelection = Readonly<{ sttEngine: 'whisper'; sttModelDir: string; sttLanguage: VoiceLanguage }>;

export type VoiceConfig = TranscriptionSelection & VoiceSelection;

/** The files of a sherpa-onnx Whisper model directory. */
export type WhisperModelFiles = Readonly<{ encoder: string; decoder: string; tokens: string }>;

/** A transcription model ready to be loaded by sherpa-onnx. */
export type TranscriptionModel = Readonly<{ engine: 'whisper'; files: WhisperModelFiles; language: VoiceLanguage }>;

/** The files of a sherpa-onnx Piper (VITS) voice directory. */
export type VoiceModelFiles = Readonly<{ model: string; tokens: string; dataDir: string }>;

/** The files of a sherpa-onnx Kokoro model directory. */
export type KokoroModelFiles = Readonly<{ model: string; voices: string; tokens: string; dataDir: string }>;

/** A voice ready to be loaded by sherpa-onnx. */
export type VoiceModel = Readonly<
  | { engine: 'piper'; files: VoiceModelFiles }
  | { engine: 'kokoro'; files: KokoroModelFiles; speaker: number; language: string }>;

/** Every file readable and `dataDir` a directory. */
async function readable<T extends Readonly<{ dataDir: string }>>(files: T): Promise<T> {
  if (!(await stat(files.dataDir)).isDirectory()) throw new Error('not a directory');
  for (const path of Object.values(files)) await access(path, constants.R_OK);
  return files;
}

/** The single `.onnx` file of a model directory, such as `model.onnx` or `model.int8.onnx`. */
async function onlyModel(directory: string): Promise<string> {
  const models = (await readdir(directory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.onnx'));
  if (models.length !== 1) throw new Error('expected exactly one model');
  return join(directory, models[0]!.name);
}

/** Exactly one `.onnx` model, `tokens.txt` and `espeak-ng-data/`, all readable. */
export async function voiceModelFiles(directory: string): Promise<VoiceModelFiles> {
  try {
    return await readable({ model: await onlyModel(directory), tokens: join(directory, 'tokens.txt'),
      dataDir: join(directory, 'espeak-ng-data') });
  } catch { throw new ProjectError('Voice resources are unavailable'); }
}

/** Exactly one `.onnx` model, `voices.bin`, `tokens.txt` and `espeak-ng-data/`, all readable. */
export async function kokoroModelFiles(directory: string): Promise<KokoroModelFiles> {
  try {
    return await readable({ model: await onlyModel(directory), voices: join(directory, 'voices.bin'),
      tokens: join(directory, 'tokens.txt'), dataDir: join(directory, 'espeak-ng-data') });
  } catch { throw new ProjectError('Voice resources are unavailable'); }
}

/** The single file of a directory whose name satisfies `matches`. */
async function onlyFile(directory: string, matches: (name: string) => boolean): Promise<string> {
  const files = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isFile() && matches(entry.name));
  if (files.length !== 1) throw new Error('expected exactly one file');
  return join(directory, files[0]!.name);
}

/** Exactly one `*encoder*.onnx`, one `*decoder*.onnx` and one `*tokens.txt`, all readable. */
export async function whisperModelFiles(directory: string): Promise<WhisperModelFiles> {
  try {
    const files = {
      encoder: await onlyFile(directory, name => name.includes('encoder') && name.endsWith('.onnx')),
      decoder: await onlyFile(directory, name => name.includes('decoder') && name.endsWith('.onnx')),
      tokens: await onlyFile(directory, name => name.endsWith('tokens.txt')),
    };
    for (const path of Object.values(files)) await access(path, constants.R_OK);
    return files;
  } catch { throw new ProjectError('Voice resources are unavailable'); }
}

export async function transcriptionModel(selection: TranscriptionSelection): Promise<TranscriptionModel> {
  return { engine: 'whisper', files: await whisperModelFiles(selection.sttModelDir), language: selection.sttLanguage };
}

export async function voiceModel(voice: VoiceSelection): Promise<VoiceModel> {
  return voice.voiceEngine === 'kokoro'
    ? { engine: 'kokoro', files: await kokoroModelFiles(voice.voiceModelDir), speaker: voice.voiceSpeaker,
      language: voice.voiceLanguage }
    : { engine: 'piper', files: await voiceModelFiles(voice.voiceModelDir) };
}

export type VoiceLanguage = 'it' | 'en';

const voiceLanguages: readonly VoiceLanguage[] = ['it', 'en'];

/** The list of languages with a voice profile; voice is disabled when it is absent. */
export const voiceLanguagesVariable: EnvironmentVariable = { name: 'AMBROGIO_VOICE_LANGUAGES' };

/** The variables of the voice profile of one language; none has a default. */
export function voiceProfileVariables(language: VoiceLanguage) {
  const prefix = `AMBROGIO_VOICE_${language.toUpperCase()}_`;
  return {
    sttEngine: { name: `${prefix}STT_ENGINE` },
    sttModelDir: { name: `${prefix}STT_MODEL_DIR` },
    engine: { name: `${prefix}ENGINE` },
    modelDir: { name: `${prefix}MODEL_DIR` },
    speaker: { name: `${prefix}SPEAKER` },
    language: { name: `${prefix}LANGUAGE` },
  } as const satisfies Record<string, EnvironmentVariable>;
}

/** Every variable of the voice component, for the example environment file. */
export const voiceVariables: readonly EnvironmentVariable[] = [voiceLanguagesVariable,
  ...voiceLanguages.flatMap(language => Object.values(voiceProfileVariables(language)))];

function value(environment: NodeJS.ProcessEnv, name: string): string | undefined {
  const raw = environment[name];
  return raw === undefined || raw === '' ? undefined : raw;
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const raw = value(environment, name);
  if (raw === undefined) throw missingVariable(name);
  return raw;
}

/** Validate the variables of one language profile, without touching its files. */
function parseProfile(environment: NodeJS.ProcessEnv, language: VoiceLanguage): VoiceConfig {
  const names = voiceProfileVariables(language);
  const sttEngine = required(environment, names.sttEngine.name);
  if (sttEngine !== 'whisper') throw invalidVariable(names.sttEngine.name, 'expected whisper');
  const transcription = { sttEngine, sttModelDir: required(environment, names.sttModelDir.name), sttLanguage: language } as const;
  const voiceModelDir = required(environment, names.modelDir.name);
  const engine = required(environment, names.engine.name);
  const speaker = value(environment, names.speaker.name);
  const espeakLanguage = value(environment, names.language.name);
  if (engine === 'piper') {
    if (speaker !== undefined) throw invalidVariable(names.speaker.name, 'not allowed with the piper engine');
    if (espeakLanguage !== undefined) throw invalidVariable(names.language.name, 'not allowed with the piper engine');
    return { ...transcription, voiceEngine: 'piper', voiceModelDir };
  }
  if (engine !== 'kokoro') throw invalidVariable(names.engine.name, 'expected piper or kokoro');
  // Any Kokoro model and language: the speaker is the model's numeric ID, the language an espeak-ng code.
  if (speaker === undefined) throw missingVariable(names.speaker.name);
  if (espeakLanguage === undefined) throw missingVariable(names.language.name);
  return { ...transcription, voiceEngine: 'kokoro', voiceModelDir,
    voiceSpeaker: integerVariable(names.speaker.name, speaker, 0), voiceLanguage: espeakLanguage };
}

/**
 * Read the voice configuration: `undefined` when voice is disabled. Every listed profile is validated;
 * only the profile of the conversation language is required and has its resources checked.
 */
export async function loadVoiceConfig(environment: NodeJS.ProcessEnv,
  language: VoiceLanguage): Promise<VoiceConfig | undefined> {
  const listed = value(environment, voiceLanguagesVariable.name);
  if (listed === undefined) return undefined;
  const languages = listed.split(',').map(entry => entry.trim());
  if (!languages.every(entry => voiceLanguages.includes(entry as VoiceLanguage))
    || new Set(languages).size !== languages.length) {
    throw invalidVariable(voiceLanguagesVariable.name, 'expected distinct languages among it and en');
  }
  if (!languages.includes(language)) {
    throw invalidVariable(voiceLanguagesVariable.name, 'expected the conversation language AMBROGIO_LANGUAGE');
  }
  for (const entry of languages) parseProfile(environment, entry as VoiceLanguage);
  const config = parseProfile(environment, language);
  await transcriptionModel(config);
  await voiceModel(config);
  return config;
}
