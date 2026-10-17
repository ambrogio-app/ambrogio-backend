import { access, readdir, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { ProjectError } from '../../project-error.js';

export type VoiceConfig = Readonly<{
  voskModelPath: string;
  voiceModelDir: string;
}>;

/** The files of a sherpa-onnx voice directory. */
export type VoiceModelFiles = Readonly<{ model: string; tokens: string; dataDir: string }>;

const fieldNames = ['voskModelPath', 'voiceModelDir'];

/** Exactly one `.onnx` model, `tokens.txt` and `espeak-ng-data/`, all readable. */
export async function voiceModelFiles(directory: string): Promise<VoiceModelFiles> {
  try {
    const models = (await readdir(directory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith('.onnx'));
    if (models.length !== 1) throw new Error('expected exactly one model');
    const files = { model: join(directory, models[0]!.name), tokens: join(directory, 'tokens.txt'),
      dataDir: join(directory, 'espeak-ng-data') };
    if (!(await stat(files.dataDir)).isDirectory()) throw new Error('not a directory');
    for (const path of Object.values(files)) await access(path, constants.R_OK);
    return files;
  } catch { throw new ProjectError('Voice resources are unavailable'); }
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
  for (const name of fieldNames) {
    if (typeof fields[name] !== 'string' || !fields[name].trim()) {
      throw new ProjectError('Invalid voice configuration file');
    }
  }
  const config: VoiceConfig = {
    voskModelPath: fields.voskModelPath as string,
    voiceModelDir: fields.voiceModelDir as string,
  };
  try {
    if (!(await stat(config.voskModelPath)).isDirectory()) throw new Error('not a directory');
    await access(config.voskModelPath, constants.R_OK);
  } catch { throw new ProjectError('Voice resources are unavailable'); }
  await voiceModelFiles(config.voiceModelDir);
  return config;
}
