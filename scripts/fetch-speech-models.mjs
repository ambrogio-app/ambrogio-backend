// Fetch pinned speech models for the Docker build, checking every archive before extraction.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const TTS_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models';
const ASR_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models';
const archives = [
  { name: 'sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11', extension: 'tar.bz2',
    sha256: 'c6bf5e0df765f9d5b43bc9e0536d4b4b3e7d40bdf5ecf13e45f134c51c05ae3a', kind: 'transcription' },
  { name: 'vits-piper-it_IT-riccardo-x_low', extension: 'tar.bz2',
    sha256: '8ad0791558ae2b3e96054fc5756ae3ae2f6457fb1765bc01f43bbab85e0a7021', kind: 'piper' },
  { name: 'vits-piper-it_IT-paola-medium', extension: 'tar.bz2',
    sha256: '7541f75778afa164e44e34baaef63befad7698595df26a95ca944b63ef1a16b4', kind: 'piper' },
  { name: 'vits-piper-en_US-kristin-medium', extension: 'tar.bz2',
    sha256: 'c2206f572df2956c50b1ae3367eebce3853c663e890cba8048cd62b1e4dbe6c7', kind: 'piper' },
];

const [voicesRoot, modelsRoot] = process.argv.slice(2);
if (!voicesRoot || !modelsRoot) {
  throw new Error('Usage: node scripts/fetch-speech-models.mjs <voices-root> <models-root>');
}
const roots = { piper: voicesRoot, transcription: modelsRoot };
/** The Nemotron files kept in the image: the int8 encoder, decoder and joiner and the tokens. */
const transcriptionFiles = ['decoder.int8.onnx', 'encoder.int8.onnx', 'joiner.int8.onnx', 'tokens.txt'];

async function checkExtracted(name, kind, root) {
  const directory = join(root, name);
  if (!(await stat(directory)).isDirectory()) throw new Error(`Missing extracted model: ${name}`);
  if (kind === 'transcription') {
    // Only the model is kept: the README and the test recordings are removed.
    for (const entry of await readdir(directory)) {
      if (!transcriptionFiles.includes(entry)) await rm(join(directory, entry), { recursive: true, force: true });
    }
    if ((await readdir(directory)).sort().join() !== transcriptionFiles.join()) throw new Error(`Unexpected model content: ${name}`);
    return;
  }
  const entries = await readdir(directory);
  if (entries.filter(entry => entry.endsWith('.onnx')).length !== 1
    || !entries.includes('tokens.txt') || !entries.includes('MODEL_CARD')
    || !(await stat(join(directory, 'espeak-ng-data'))).isDirectory()) {
    throw new Error(`Unexpected model content: ${name}`);
  }
}

async function fetchModel({ name, extension, sha256, kind }) {
  const root = roots[kind];
  await mkdir(root, { recursive: true });
  const archive = join(root, `.${name}.${extension}`);
  const url = `${kind === 'transcription' ? ASR_URL : TTS_URL}/${name}.${extension}`;
  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`Download failed for ${name}: ${response.status}`);
    const digest = createHash('sha256');
    const body = Readable.fromWeb(response.body);
    body.on('data', chunk => digest.update(chunk));
    await pipeline(body, createWriteStream(archive));
    const actual = digest.digest('hex');
    if (actual !== sha256) throw new Error(`SHA-256 mismatch for ${name}: ${actual}`);
    execFileSync('tar', ['-xjf', archive, '-C', root], { stdio: 'inherit' });
    await checkExtracted(name, kind, root);
    console.log(`Fetched ${name}: ${sha256}`);
  } finally {
    await rm(archive, { force: true });
  }
}

for (const model of archives) await fetchModel(model);
