import { spawn, type ChildProcess } from 'node:child_process';
import { once, type EventEmitter } from 'node:events';
import type { Readable, Writable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { ProjectError } from '../../../project-error.js';
import type { Synthesizer } from './speech-components.js';

const defaultSampleRate = 22_050;
const sentenceEnd = /[.!?…;:]+["'»)\]]*\s+|\n+/g;

/** Read the native sample rate from the voice JSON next to the ONNX model. */
export async function piperSampleRate(modelPath: string): Promise<number> {
  const raw = JSON.parse(await readFile(`${modelPath}.json`, 'utf8')) as { audio?: { sample_rate?: unknown } };
  const rate = raw.audio?.sample_rate ?? defaultSampleRate;
  if (typeof rate !== 'number' || !Number.isSafeInteger(rate) || rate < 8_000 || rate > 48_000) {
    throw new ProjectError('Invalid Piper sample rate');
  }
  return rate;
}

/** Split streamed text into complete sentences, keeping the unfinished tail. */
export function takeSentences(buffer: string): Readonly<{ sentences: string[]; rest: string }> {
  const sentences: string[] = [];
  let start = 0;
  for (const match of buffer.matchAll(sentenceEnd)) {
    const end = match.index + match[0].length;
    sentences.push(buffer.slice(start, end));
    start = end;
  }
  return { sentences: sentences.map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean),
    rest: buffer.slice(start) };
}

/**
 * One Piper process per transmission: sentences are written to stdin as they are completed,
 * and the end of stdout after stdin closes marks the end of the spoken reply.
 */
export class PiperSynthesizer implements Synthesizer {
  constructor(private readonly binaryPath: string, private readonly modelPath: string,
    readonly sampleRate: number) {}

  async *synthesize(text: AsyncIterable<string>, signal: AbortSignal): AsyncIterable<Uint8Array> {
    if (signal.aborted) return;
    const child: ChildProcess = spawn(this.binaryPath, ['--model', this.modelPath, '--output_raw'],
      { stdio: ['pipe', 'pipe', 'ignore'] });
    const stdin = child.stdin as Writable;
    const stdout = child.stdout as Readable;
    const stop = () => { child.kill('SIGKILL'); };
    signal.addEventListener('abort', stop, { once: true });
    // `events.once` settles on the first `close`, or rejects on a spawn `error`.
    const exited = once(child as unknown as EventEmitter, 'close')
      .then(([code]) => code as number | null, () => -1);
    stdin.on('error', () => { /* the exit status reports a failed process */ });
    const feeding = (async () => {
      let buffer = '';
      try {
        for await (const piece of text) {
          if (signal.aborted) return;
          const { sentences, rest } = takeSentences(buffer + piece);
          buffer = rest;
          for (const sentence of sentences) stdin.write(`${sentence}\n`);
        }
        const tail = buffer.replace(/\s+/g, ' ').trim();
        if (tail) stdin.write(`${tail}\n`);
      } finally {
        stdin.end();
      }
    })();
    // The text source belongs to the caller: it is never awaited here after the process ends.
    feeding.catch(() => { stop(); });
    try {
      let odd: Buffer | undefined;
      for await (const chunk of stdout as AsyncIterable<Buffer>) {
        const bytes = odd ? Buffer.concat([odd, chunk]) : chunk;
        const even = bytes.length - (bytes.length % 2);
        odd = even < bytes.length ? bytes.subarray(even) : undefined;
        if (even > 0) yield bytes.subarray(0, even);
      }
      const code = await exited;
      if (code !== 0 && !signal.aborted) throw new ProjectError('Speech synthesis failed');
    } finally {
      signal.removeEventListener('abort', stop);
      if (child.exitCode === null && child.signalCode === null) stop();
    }
  }
}
