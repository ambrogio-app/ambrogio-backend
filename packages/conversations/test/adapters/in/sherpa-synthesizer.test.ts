import { availableParallelism } from 'node:os';
import { expect, it } from 'vitest';
import { takeSentences } from '../../../src/adapters/in/session/sentences.js';
import { SherpaSynthesizer, pcm16, type SherpaTtsConfig } from '../../../src/adapters/in/session/sherpa-synthesizer.js';
import { voiceModelFiles } from '../../../src/adapters/out/voice-config.js';

const files = { model: '/voice/it.onnx', tokens: '/voice/tokens.txt', dataDir: '/voice/espeak-ng-data' };

/** A controlled engine: each sentence becomes one sample per character, after `delayMs`. */
function fakeEngine(options: Readonly<{ sampleRate?: number; delayMs?: number; fail?: string }> = {}) {
  const state = { configs: [] as SherpaTtsConfig[], texts: [] as string[], running: 0, maxRunning: 0,
    syncCalls: 0 };
  const sampleRate = options.sampleRate ?? 22_050;
  const engine = {
    async createAsync(config: SherpaTtsConfig) {
      state.configs.push(config);
      return {
        sampleRate,
        generate() { state.syncCalls++; throw new Error('blocking generation used'); },
        async generateAsync(request: { text: string; sid: number; speed: number }) {
          state.texts.push(request.text);
          state.running++;
          state.maxRunning = Math.max(state.maxRunning, state.running);
          try {
            await new Promise(resolve => setTimeout(resolve, options.delayMs ?? 1));
            if (options.fail === request.text) throw new Error('native failure');
            return { samples: new Float32Array(request.text.length).fill(0.5), sampleRate };
          } finally { state.running--; }
        },
      };
    },
  };
  return { engine, state };
}

/** A text source the test feeds piece by piece, like the session transmission. */
function source() {
  const items: string[] = [];
  let ended = false;
  let wake: (() => void) | undefined;
  return {
    push(text: string) { items.push(text); wake?.(); },
    end() { ended = true; wake?.(); },
    async *[Symbol.asyncIterator]() {
      for (;;) {
        if (items.length) { yield items.shift()!; continue; }
        if (ended) return;
        await new Promise<void>(resolve => { wake = resolve; });
        wake = undefined;
      }
    },
  };
}

async function* pieces(...values: string[]): AsyncIterable<string> { yield* values; }

async function collect(stream: AsyncIterable<Uint8Array>): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    expect(chunk.length % 2).toBe(0);
    chunks.push(chunk);
  }
  return chunks;
}

it('splits streamed text into complete sentences and keeps the unfinished tail', () => {
  expect(takeSentences('Ciao. Come  stai? Bene')).toEqual({ sentences: ['Ciao.', 'Come stai?'], rest: 'Bene' });
  expect(takeSentences('Riga uno\nRiga')).toEqual({ sentences: ['Riga uno'], rest: 'Riga' });
  expect(takeSentences('3.5 gradi')).toEqual({ sentences: [], rest: '3.5 gradi' });
});

it('converts float samples to PCM16 little-endian', () => {
  const bytes = Buffer.from(pcm16(new Float32Array([0, 1, -1, 0.5, 2, -2])));
  expect([0, 2, 4, 6, 8, 10].map(offset => bytes.readInt16LE(offset)))
    .toEqual([0, 32_767, -32_768, 16_384, 32_767, -32_768]);
});

// Verification: Prova della sintesi vocale nel processo backend
it('loads the voice once and generates each completed sentence asynchronously', async () => {
  const { engine, state } = fakeEngine({ sampleRate: 16_000 });
  const synthesizer = await SherpaSynthesizer.load(files, engine);
  expect(synthesizer.sampleRate).toBe(16_000);
  expect(state.configs).toEqual([{ model: { vits: files, numThreads: Math.min(4, availableParallelism()),
    debug: false, provider: 'cpu' }, maxNumSentences: 1 }]);

  const text = source();
  const audio: Uint8Array[] = [];
  const done = (async () => {
    for await (const chunk of synthesizer.synthesize(text, new AbortController().signal)) audio.push(chunk);
  })();
  text.push('Ciao. Come ');
  await until(() => audio.length === 1);
  // The first sentence is spoken before the rest of the text arrives.
  expect(state.texts).toEqual(['Ciao.']);
  text.push('stai? Bene');
  text.end();
  await done;
  expect(state.texts).toEqual(['Ciao.', 'Come stai?', 'Bene']);
  expect(audio.map(chunk => chunk.length)).toEqual([10, 20, 8]);
  expect(Buffer.from(audio[0]!).readInt16LE(0)).toBe(Math.round(0.5 * 0x7fff));

  await collect(synthesizer.synthesize(pieces('Ancora.'), new AbortController().signal));
  expect(state.configs).toHaveLength(1);
  expect(state.syncCalls).toBe(0);
});

// Verification: Prova della sintesi vocale nel processo backend
it('runs generations of concurrent transmissions one at a time without mixing their audio', async () => {
  const { engine, state } = fakeEngine({ delayMs: 10 });
  const synthesizer = await SherpaSynthesizer.load(files, engine);
  const [first, second] = await Promise.all([
    collect(synthesizer.synthesize(pieces('Uno. Due.'), new AbortController().signal)),
    collect(synthesizer.synthesize(pieces('Tre tre. Quattro quattro.'), new AbortController().signal)),
  ]);
  expect(state.maxRunning).toBe(1);
  expect(first.map(chunk => chunk.length)).toEqual([8, 8]);
  expect(second.map(chunk => chunk.length)).toEqual([16, 32]);
});

// Verification: Prova della sintesi vocale nel processo backend
it('stops after the current sentence when the transmission is aborted', async () => {
  const { engine, state } = fakeEngine({ delayMs: 20 });
  const synthesizer = await SherpaSynthesizer.load(files, engine);
  const controller = new AbortController();
  const chunks: Uint8Array[] = [];
  for await (const chunk of synthesizer.synthesize(pieces('Prima. Seconda. Terza.'), controller.signal)) {
    chunks.push(chunk);
    controller.abort();
  }
  expect(chunks).toHaveLength(1);
  await new Promise(resolve => setTimeout(resolve, 60));
  expect(state.texts).toEqual(['Prima.']);

  // An abort while waiting for text ends the transmission without waiting for the source.
  const waiting = new AbortController();
  const text = source();
  const pending = collect(synthesizer.synthesize(text, waiting.signal));
  setTimeout(() => waiting.abort(), 10);
  expect(await pending).toEqual([]);
});

// Verification: Prova della sintesi vocale nel processo backend
it('keeps the event loop responsive while a sentence is generated', async () => {
  const { engine } = fakeEngine({ delayMs: 50 });
  const synthesizer = await SherpaSynthesizer.load(files, engine);
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 5);
  try { await collect(synthesizer.synthesize(pieces('Frase lenta.'), new AbortController().signal)); }
  finally { clearInterval(timer); }
  expect(ticks).toBeGreaterThan(0);
});

// Verification: Prova della sintesi vocale nel processo backend
it('rejects a voice that cannot be loaded and reports a failed generation', async () => {
  await expect(SherpaSynthesizer.load(files, { async createAsync() { throw new Error('bad model'); } }))
    .rejects.toThrow('Voice model could not be loaded');
  await expect(SherpaSynthesizer.load(files, fakeEngine({ sampleRate: 0 }).engine))
    .rejects.toThrow('Invalid voice sample rate');
  const synthesizer = await SherpaSynthesizer.load(files, fakeEngine({ fail: 'Rotta.' }).engine);
  await expect(collect(synthesizer.synthesize(pieces('Rotta.'), new AbortController().signal)))
    .rejects.toThrow('Speech synthesis failed');
  // A failed generation does not block the next transmission.
  expect(await collect(synthesizer.synthesize(pieces('Sana.'), new AbortController().signal))).toHaveLength(1);
  synthesizer.close();
  expect(await collect(synthesizer.synthesize(pieces('Dopo.'), new AbortController().signal))).toEqual([]);
});

const realVoice = process.env.AMBROGIO_TEST_VOICE_MODEL_DIR;

// Verification: Prova della sintesi vocale nel processo backend
it.skipIf(!realVoice)('synthesizes Italian speech with a real voice directory', async () => {
  const synthesizer = await SherpaSynthesizer.load(await voiceModelFiles(realVoice!));
  try {
    expect([16_000, 22_050]).toContain(synthesizer.sampleRate);
    let ticks = 0;
    const timer = setInterval(() => { ticks++; }, 5);
    let audio: Uint8Array[];
    try { audio = await collect(synthesizer.synthesize(pieces('Ciao, sono Ambrogio.'), new AbortController().signal)); }
    finally { clearInterval(timer); }
    const bytes = audio.reduce((total, chunk) => total + chunk.length, 0);
    // At least half a second of audio, generated without blocking the event loop.
    expect(bytes).toBeGreaterThan(synthesizer.sampleRate);
    expect(ticks).toBeGreaterThan(0);
  } finally { synthesizer.close(); }
}, 30_000);

async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out');
    await new Promise(resolve => setTimeout(resolve, 2));
  }
}
