import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { PiperSynthesizer, piperSampleRate, takeSentences } from '../../../src/adapters/in/session/piper-synthesizer.js';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

/** A stand-in for the Piper binary: the script body decides what reaches stdout. */
async function fakePiper(body: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-piper-'));
  directories.push(directory);
  const binary = join(directory, 'piper');
  await writeFile(binary, `#!/bin/sh\n${body}\n`);
  await chmod(binary, 0o755);
  return binary;
}

async function* pieces(...values: string[]): AsyncIterable<string> { yield* values; }

async function collect(stream: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    expect(chunk.length % 2).toBe(0);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

it('splits streamed text into complete sentences and keeps the unfinished tail', () => {
  expect(takeSentences('Ciao. Come  stai? Bene')).toEqual({ sentences: ['Ciao.', 'Come stai?'], rest: 'Bene' });
  expect(takeSentences('Riga uno\nRiga')).toEqual({ sentences: ['Riga uno'], rest: 'Riga' });
  expect(takeSentences('3.5 gradi')).toEqual({ sentences: [], rest: '3.5 gradi' });
});

it('writes one sentence per line and ends when the process output ends', async () => {
  const binary = await fakePiper('exec cat');
  const synthesizer = new PiperSynthesizer(binary, '/voice.onnx', 22_050);
  const audio = await collect(synthesizer.synthesize(pieces('Ciao. Come ', 'stai? Bene'), new AbortController().signal));
  expect(audio.toString('utf8')).toBe('Ciao.\nCome stai?\nBene\n');
});

it('stops the process when the transmission is aborted', async () => {
  const binary = await fakePiper('printf "ab"; exec sleep 30');
  const synthesizer = new PiperSynthesizer(binary, '/voice.onnx', 22_050);
  const controller = new AbortController();
  const started = Date.now();
  const chunks: Uint8Array[] = [];
  for await (const chunk of synthesizer.synthesize(pieces('Ciao.'), controller.signal)) {
    chunks.push(chunk);
    controller.abort();
  }
  expect(Buffer.concat(chunks).toString('utf8')).toBe('ab');
  expect(Date.now() - started).toBeLessThan(5_000);
});

it('fails when the process exits with an error', async () => {
  const binary = await fakePiper('cat > /dev/null; exit 3');
  const synthesizer = new PiperSynthesizer(binary, '/voice.onnx', 22_050);
  await expect(collect(synthesizer.synthesize(pieces('Ciao.'), new AbortController().signal)))
    .rejects.toThrow('Speech synthesis failed');
});

it('reads the native sample rate of the configured voice', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-voice-'));
  directories.push(directory);
  const model = join(directory, 'voice.onnx');
  await writeFile(`${model}.json`, JSON.stringify({ audio: { sample_rate: 16_000 } }));
  expect(await piperSampleRate(model)).toBe(16_000);
  await writeFile(`${model}.json`, JSON.stringify({ audio: { sample_rate: 'fast' } }));
  await expect(piperSampleRate(model)).rejects.toThrow('Invalid Piper sample rate');
});
