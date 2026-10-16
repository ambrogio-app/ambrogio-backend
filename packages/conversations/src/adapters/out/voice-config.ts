import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { ProjectError } from '../../project-error.js';

export type VoiceConfig = Readonly<{
  voskModelPath: string;
  piperModelPath: string;
  piperBinaryPath: string;
}>;

export async function loadVoiceConfig(filename: string): Promise<VoiceConfig> {
  let raw: unknown;
  try { raw = JSON.parse(await readFile(filename, 'utf8')); }
  catch { throw new ProjectError('Invalid voice configuration file'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ProjectError('Invalid voice configuration file');
  }
  const fields = raw as Record<string, unknown>;
  for (const name of ['voskModelPath', 'piperModelPath', 'piperBinaryPath']) {
    if (typeof fields[name] !== 'string' || !fields[name].trim()) {
      throw new ProjectError('Invalid voice configuration file');
    }
  }
  const config: VoiceConfig = {
    voskModelPath: fields.voskModelPath as string,
    piperModelPath: fields.piperModelPath as string,
    piperBinaryPath: fields.piperBinaryPath as string,
  };
  try {
    if (!(await stat(config.voskModelPath)).isDirectory()) throw new Error('not a directory');
    await access(config.voskModelPath, constants.R_OK);
    await access(config.piperModelPath, constants.R_OK);
    await access(`${config.piperModelPath}.json`, constants.R_OK);
    await access(config.piperBinaryPath, constants.X_OK);
  } catch { throw new ProjectError('Voice resources are unavailable'); }
  return config;
}
