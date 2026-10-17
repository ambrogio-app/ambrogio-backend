// Fetch the pinned Italian voices, converted for sherpa-onnx by k2-fsa, for the Docker build.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BASE_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models';
const VOICES = {
  'vits-piper-it_IT-riccardo-x_low': '8ad0791558ae2b3e96054fc5756ae3ae2f6457fb1765bc01f43bbab85e0a7021',
  'vits-piper-it_IT-paola-medium': '7541f75778afa164e44e34baaef63befad7698595df26a95ca944b63ef1a16b4',
};

async function fetchVoice(directory, name, expected) {
  const archive = join(directory, `.${name}.tar.bz2`);
  try {
    const response = await fetch(`${BASE_URL}/${name}.tar.bz2`);
    if (!response.ok || !response.body) throw new Error(`Download failed for ${name}: ${response.status}`);
    const digest = createHash('sha256');
    const body = Readable.fromWeb(response.body);
    body.on('data', chunk => digest.update(chunk));
    await pipeline(body, createWriteStream(archive));
    const actual = digest.digest('hex');
    if (actual !== expected) throw new Error(`SHA-256 mismatch for ${name}: ${actual}`);
    execFileSync('tar', ['-xjf', archive, '-C', directory], { stdio: 'inherit' });
  } finally {
    await rm(archive, { force: true });
  }
  const voice = join(directory, name);
  const entries = await readdir(voice);
  if (entries.filter(entry => entry.endsWith('.onnx')).length !== 1 || !entries.includes('tokens.txt')
    || !entries.includes('MODEL_CARD') || !(await stat(join(voice, 'espeak-ng-data'))).isDirectory()) {
    throw new Error(`Unexpected content for ${name}`);
  }
  console.log(`Fetched ${name}: ${expected}`);
}

const directory = process.argv[2];
if (!directory) throw new Error('Usage: node scripts/fetch-voices.mjs <directory>');
await mkdir(directory, { recursive: true });
for (const [name, expected] of Object.entries(VOICES)) await fetchVoice(directory, name, expected);
