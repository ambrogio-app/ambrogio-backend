import { access, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { ProjectError } from '../../domain/project-error.js';
import { invalidVariable, missingVariable, type EnvironmentVariable } from './environment-variables.js';

/** The Piper (VITS) voice chosen by the installation. */
export type VoiceSelection = Readonly<{ voiceModelDir: string }>;

/** The streaming transducer model chosen by the installation; it recognizes the spoken language by itself. */
export type TranscriptionSelection = Readonly<{ sttModelDir: string }>;

export type VoiceConfig = TranscriptionSelection & VoiceSelection;

/** The files of a sherpa-onnx streaming transducer model directory, such as Nemotron ASR streaming. */
export type TranscriptionModelFiles = Readonly<{ encoder: string; decoder: string; joiner: string; tokens: string }>;

/** The files of a sherpa-onnx Piper (VITS) voice directory. */
export type VoiceModelFiles = Readonly<{ model: string; tokens: string; dataDir: string }>;

/** Every file readable and `dataDir` a directory. */
async function readable(files: VoiceModelFiles): Promise<VoiceModelFiles> {
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

/** The single file of a directory whose name satisfies `matches`. */
async function onlyFile(directory: string, matches: (name: string) => boolean): Promise<string> {
  const files = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isFile() && matches(entry.name));
  if (files.length !== 1) throw new Error('expected exactly one file');
  return join(directory, files[0]!.name);
}

/** Exactly one `*encoder*.onnx`, `*decoder*.onnx` and `*joiner*.onnx` and one `*tokens.txt`, all readable. */
export async function transcriptionModel(selection: TranscriptionSelection): Promise<TranscriptionModelFiles> {
  const directory = selection.sttModelDir;
  try {
    const part = (name: string) => onlyFile(directory, file => file.includes(name) && file.endsWith('.onnx'));
    const files = { encoder: await part('encoder'), decoder: await part('decoder'), joiner: await part('joiner'),
      tokens: await onlyFile(directory, file => file.endsWith('tokens.txt')) };
    for (const path of Object.values(files)) await access(path, constants.R_OK);
    return files;
  } catch { throw new ProjectError('Voice resources are unavailable'); }
}

export function voiceModel(voice: VoiceSelection): Promise<VoiceModelFiles> {
  return voiceModelFiles(voice.voiceModelDir);
}

export type VoiceLanguage = 'it' | 'en';

const voiceLanguages: readonly VoiceLanguage[] = ['it', 'en'];

/** The list of languages with a voice profile; voice is disabled when it is absent. */
export const voiceLanguagesVariable: EnvironmentVariable = { name: 'AMBROGIO_VOICE_LANGUAGES' };

/** The variables of the voice profile of one language; none has a default. */
export function voiceProfileVariables(language: VoiceLanguage) {
  const prefix = `AMBROGIO_VOICE_${language.toUpperCase()}_`;
  return {
    sttModelDir: { name: `${prefix}STT_MODEL_DIR` },
    modelDir: { name: `${prefix}MODEL_DIR` },
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
  return { sttModelDir: required(environment, names.sttModelDir.name),
    voiceModelDir: required(environment, names.modelDir.name) };
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
