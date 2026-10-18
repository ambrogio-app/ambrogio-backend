import { access, readdir, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { ProjectError } from '../../project-error.js';

/** The synthesis engine and voice chosen by the installation. */
export type VoiceSelection = Readonly<
  | { voiceEngine: 'piper'; voiceModelDir: string }
  | { voiceEngine: 'kokoro'; voiceModelDir: string; voiceSpeaker: number; voiceLanguage: string }>;

export type VoiceConfig = Readonly<{ voskModelPath: string }> & VoiceSelection;

/** The files of a sherpa-onnx Piper (VITS) voice directory. */
export type VoiceModelFiles = Readonly<{ model: string; tokens: string; dataDir: string }>;

/** The files of a sherpa-onnx Kokoro model directory. */
export type KokoroModelFiles = Readonly<{ model: string; voices: string; tokens: string; dataDir: string }>;

/** A voice ready to be loaded by sherpa-onnx. */
export type VoiceModel = Readonly<
  | { engine: 'piper'; files: VoiceModelFiles }
  | { engine: 'kokoro'; files: KokoroModelFiles; speaker: number; language: string }>;

const fieldNames = ['voskModelPath', 'voiceEngine', 'voiceModelDir', 'voiceSpeaker', 'voiceLanguage'];
const pathNames = ['voskModelPath', 'voiceModelDir'];

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

export async function voiceModel(voice: VoiceSelection): Promise<VoiceModel> {
  return voice.voiceEngine === 'kokoro'
    ? { engine: 'kokoro', files: await kokoroModelFiles(voice.voiceModelDir), speaker: voice.voiceSpeaker,
      language: voice.voiceLanguage }
    : { engine: 'piper', files: await voiceModelFiles(voice.voiceModelDir) };
}

/** The engine with its speaker and language, or undefined when they do not fit together. */
function selection(fields: Record<string, unknown>, voiceModelDir: string): VoiceSelection | undefined {
  const { voiceEngine, voiceSpeaker, voiceLanguage } = fields;
  if (voiceEngine === 'piper' && voiceSpeaker === undefined && voiceLanguage === undefined) {
    return { voiceEngine, voiceModelDir };
  }
  // Any Kokoro model and language: the speaker is the model's numeric ID, the language an espeak-ng code.
  if (voiceEngine === 'kokoro' && Number.isSafeInteger(voiceSpeaker) && (voiceSpeaker as number) >= 0
    && typeof voiceLanguage === 'string' && voiceLanguage.trim()) {
    return { voiceEngine, voiceModelDir, voiceSpeaker: voiceSpeaker as number, voiceLanguage };
  }
  return undefined;
}

export async function loadVoiceConfig(filename: string): Promise<VoiceConfig> {
  let raw: unknown;
  try { raw = JSON.parse(await readFile(filename, 'utf8')); }
  catch { throw new ProjectError('Invalid voice configuration file'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ProjectError('Invalid voice configuration file');
  }
  const fields = raw as Record<string, unknown>;
  if (Object.keys(fields).some(name => !fieldNames.includes(name))) {
    throw new ProjectError('Invalid voice configuration file');
  }
  for (const name of pathNames) {
    if (typeof fields[name] !== 'string' || !fields[name].trim()) {
      throw new ProjectError('Invalid voice configuration file');
    }
  }
  const voice = selection(fields, fields.voiceModelDir as string);
  if (!voice) throw new ProjectError('Invalid voice configuration file');
  const config: VoiceConfig = { voskModelPath: fields.voskModelPath as string, ...voice };
  try {
    if (!(await stat(config.voskModelPath)).isDirectory()) throw new Error('not a directory');
    await access(config.voskModelPath, constants.R_OK);
  } catch { throw new ProjectError('Voice resources are unavailable'); }
  await voiceModel(config);
  return config;
}
