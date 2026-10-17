import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { PiperSynthesizer, piperSampleRate, takeSentences } from '../../../src/adapters/in/session/piper-synthesizer.js';

const directories: string[] = [];
const synthesizers: PiperSynthesizer[] = [];
/** Every synthesizer keeps a process started: tests must release it. */
function synthesizerFor(binary: string): PiperSynthesizer {
  const synthesizer = new PiperSynthesizer(binary, '/voice.onnx', 22_050);
  synthesizers.push(synthesizer);
  return synthesizer;
}

afterEach(async () => {
  for (const synthesizer of synthesizers.splice(0)) synthesizer.close();
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
  const synthesizer = synthesizerFor(binary);
  const audio = await collect(synthesizer.synthesize(pieces('Ciao. Come ', 'stai? Bene'), new AbortController().signal));
  expect(audio.toString('utf8')).toBe('Ciao.\nCome stai?\nBene\n');
});

it('stops the process when the transmission is aborted', async () => {
  const binary = await fakePiper('printf "ab"; exec sleep 30');
  const synthesizer = synthesizerFor(binary);
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
  const synthesizer = synthesizerFor(binary);
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

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function pids(file: string): Promise<number[]> {
  const content = await readFile(file, 'utf8').catch(() => '');
  return content.split('\n').filter(Boolean).map(Number);
}

async function until(check: () => Promise<boolean>, label: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

/** A Piper stand-in that records its pid and needs `startupMs` before reading its input. */
async function slowPiper(startupMs: number): Promise<{ binary: string; pidFile: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-piper-slow-'));
  directories.push(directory);
  const pidFile = join(directory, 'pids');
  const binary = join(directory, 'piper');
  await writeFile(binary, `#!/bin/sh\necho $$ >> ${pidFile}\nsleep ${startupMs / 1000}\nexec cat\n`);
  await chmod(binary, 0o755);
  return { binary, pidFile };
}

// Verification: Prova del processo Piper pre-avviato
it('uses a process started in advance, one per transmission, and releases it on close', async () => {
  const { binary, pidFile } = await slowPiper(600);
  const synthesizer = synthesizerFor(binary);
  await until(async () => (await pids(pidFile)).length === 1, 'pre-started process');
  await new Promise(resolve => setTimeout(resolve, 700));

  const started = Date.now();
  const first = await collect(synthesizer.synthesize(pieces('Ciao.'), new AbortController().signal));
  expect(Date.now() - started).toBeLessThan(500);
  expect(first.toString('utf8')).toBe('Ciao.\n');

  // Back-to-back transmissions: each uses its own process, without mixing audio.
  const [second, third] = await Promise.all([
    collect(synthesizer.synthesize(pieces('Bene.'), new AbortController().signal)),
    collect(synthesizer.synthesize(pieces('Okay.'), new AbortController().signal)),
  ]);
  expect(second.toString('utf8')).toBe('Bene.\n');
  expect(third.toString('utf8')).toBe('Okay.\n');
  const used = await pids(pidFile);
  expect(new Set(used).size).toBe(used.length);

  synthesizer.close();
  await until(async () => (await pids(pidFile)).every(pid => !alive(pid)), 'no process left after close');
  expect(await collect(synthesizer.synthesize(pieces('Dopo.'), new AbortController().signal))).toHaveLength(0);
});

// Verification: Prova del processo Piper pre-avviato
it('replaces a waiting process that ended on its own', async () => {
  const { binary, pidFile } = await slowPiper(0);
  const synthesizer = synthesizerFor(binary);
  await until(async () => (await pids(pidFile)).length === 1, 'pre-started process');
  const [waiting] = await pids(pidFile);
  process.kill(waiting!, 'SIGKILL');
  await until(async () => !alive(waiting!), 'waiting process ended');
  await new Promise(resolve => setTimeout(resolve, 50));
  const audio = await collect(synthesizer.synthesize(pieces('Ciao.'), new AbortController().signal));
  expect(audio.toString('utf8')).toBe('Ciao.\n');
  // The killed process, the replacement used for this transmission and the next waiting one.
  await until(async () => (await pids(pidFile)).length >= 3, 'replacement and next waiting process');
});

