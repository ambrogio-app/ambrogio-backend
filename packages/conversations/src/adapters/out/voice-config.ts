import { access, readdir, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { ProjectError } from '../../project-error.js';

/** The speaker IDs of the Italian voices in `kokoro-multi-lang-v1_0`, from k2-fsa's `generate_voices_bin.py`. */
export const kokoroSpeakers = { if_sara: 35, im_nicola: 36 } as const;
export type KokoroSpeaker = keyof typeof kokoroSpeakers;

/** The synthesis engine and voice chosen by the installation. */
export type VoiceSelection = Readonly<
  | { voiceEngine: 'piper'; voiceModelDir: string }
  | { voiceEngine: 'kokoro'; voiceModelDir: string; voiceSpeaker: KokoroSpeaker }>;

export type VoiceConfig = Readonly<{ voskModelPath: string }> & VoiceSelection;

/** The files of a sherpa-onnx Piper (VITS) voice directory. */
export type VoiceModelFiles = Readonly<{ model: string; tokens: string; dataDir: string }>;

/** The files of a sherpa-onnx Kokoro model directory. */
export type KokoroModelFiles = Readonly<{ model: string; voices: string; tokens: string; dataDir: string }>;

/** A voice ready to be loaded by sherpa-onnx. */
export type VoiceModel = Readonly<
  | { engine: 'piper'; files: VoiceModelFiles }
  | { engine: 'kokoro'; files: KokoroModelFiles; speaker: KokoroSpeaker }>;

const fieldNames = ['voskModelPath', 'voiceEngine', 'voiceModelDir', 'voiceSpeaker'];
const pathNames = ['voskModelPath', 'voiceModelDir'];

/** Every file readable and `dataDir` a directory. */
async function readable<T extends Readonly<{ dataDir: string }>>(files: T): Promise<T> {
  if (!(await stat(files.dataDir)).isDirectory()) throw new Error('not a directory');
  for (const path of Object.values(files)) await access(path, constants.R_OK);
  return files;
}

/** Exactly one `.onnx` model, `tokens.txt` and `espeak-ng-data/`, all readable. */
export async function voiceModelFiles(directory: string): Promise<VoiceModelFiles> {
  try {
    const models = (await readdir(directory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith('.onnx'));
    if (models.length !== 1) throw new Error('expected exactly one model');
    return await readable({ model: join(directory, models[0]!.name), tokens: join(directory, 'tokens.txt'),
      dataDir: join(directory, 'espeak-ng-data') });
  } catch { throw new ProjectError('Voice resources are unavailable'); }
}

/** `model.onnx`, `voices.bin`, `tokens.txt` and `espeak-ng-data/`, all readable. */
export async function kokoroModelFiles(directory: string): Promise<KokoroModelFiles> {
  try {
    return await readable({ model: join(directory, 'model.onnx'), voices: join(directory, 'voices.bin'),
      tokens: join(directory, 'tokens.txt'), dataDir: join(directory, 'espeak-ng-data') });
  } catch { throw new ProjectError('Voice resources are unavailable'); }
}

export async function voiceModel(voice: VoiceSelection): Promise<VoiceModel> {
  return voice.voiceEngine === 'kokoro'
    ? { engine: 'kokoro', files: await kokoroModelFiles(voice.voiceModelDir), speaker: voice.voiceSpeaker }
    : { engine: 'piper', files: await voiceModelFiles(voice.voiceModelDir) };
}

/** The engine and its speaker, or undefined when they do not fit together. */
function selection(fields: Record<string, unknown>, voiceModelDir: string): VoiceSelection | undefined {
  const { voiceEngine, voiceSpeaker } = fields;
  if (voiceEngine === 'piper' && voiceSpeaker === undefined) return { voiceEngine, voiceModelDir };
  if (voiceEngine === 'kokoro' && typeof voiceSpeaker === 'string' && Object.hasOwn(kokoroSpeakers, voiceSpeaker)) {
    return { voiceEngine, voiceModelDir, voiceSpeaker: voiceSpeaker as KokoroSpeaker };
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
