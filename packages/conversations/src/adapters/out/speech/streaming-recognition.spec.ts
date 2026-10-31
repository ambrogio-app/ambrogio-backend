// Verification: Prova della trascrizione in streaming
import { describe, expect, it } from 'vitest';
import { LEAD_PADDING_SAMPLES, onlineRecognizerConfig, RecognitionHost, TAIL_PADDING_SAMPLES, type OnlineRecognizer, type OnlineStream,
  type RecognitionReply } from './streaming-recognition.js';

type FakeStream = OnlineStream & { id: number; accepted: number[]; finished: boolean; pending: number; decoded: number };

/** A recognizer that decodes every accepted block and answers with the number of samples it received. */
function recognizer(options: { failOn?: number; text?: (stream: FakeStream) => string } = {}) {
  const streams: FakeStream[] = [];
  const fake: OnlineRecognizer = {
    createStream() {
      const stream: FakeStream = { id: streams.length, accepted: [], finished: false, pending: 0, decoded: 0,
        acceptWaveform({ samples, sampleRate }) {
          expect(sampleRate).toBe(16_000);
          if (stream.id === 0 && stream.accepted.length === options.failOn) throw new Error('native failure');
          stream.accepted.push(samples.length); stream.pending++;
        },
        inputFinished() { stream.finished = true; } };
      streams.push(stream);
      return stream;
    },
    isReady: stream => (stream as FakeStream).pending > 0,
    decode(stream) { (stream as FakeStream).pending--; (stream as FakeStream).decoded++; },
    getResult: stream => ({ text: options.text?.(stream as FakeStream) ?? `  ${(stream as FakeStream).accepted.join('+')}  ` }),
  };
  return { fake, streams };
}

function host(options?: Parameters<typeof recognizer>[0]) {
  const replies: RecognitionReply[] = [];
  const { fake, streams } = recognizer(options);
  return { host: new RecognitionHost(fake, reply => replies.push(reply)), replies, streams };
}

describe('streaming recognition in the worker', () => {
  it('configures a streaming transducer with greedy search and no endpoint detection', () => {
    expect(onlineRecognizerConfig({ encoder: '/m/encoder.int8.onnx', decoder: '/m/decoder.int8.onnx',
      joiner: '/m/joiner.int8.onnx', tokens: '/m/tokens.txt' }, 2)).toEqual({
      featConfig: { sampleRate: 16_000, featureDim: 80 },
      modelConfig: { transducer: { encoder: '/m/encoder.int8.onnx', decoder: '/m/decoder.int8.onnx',
        joiner: '/m/joiner.int8.onnx' }, tokens: '/m/tokens.txt', numThreads: 2, provider: 'cpu', debug: 0 },
      decodingMethod: 'greedy_search', enableEndpoint: 0 });
  });

  it('starts each stream with one second of silence, decodes every frame as it arrives and finishes with silence', () => {
    const { host: recognition, replies, streams } = host();
    recognition.handle({ type: 'audio', id: 1, samples: new Float32Array(1_600) });
    expect(LEAD_PADDING_SAMPLES).toBe(16_000);
    expect(streams[0]!.accepted).toEqual([LEAD_PADDING_SAMPLES, 1_600]);
    expect(streams[0]!.decoded).toBe(2);
    recognition.handle({ type: 'audio', id: 1, samples: new Float32Array(3_200) });
    expect(streams[0]!.decoded).toBe(3);
    expect(replies).toEqual([]);
    recognition.handle({ type: 'finish', id: 1 });
    expect(streams[0]!.finished).toBe(true);
    expect(replies).toEqual([{ type: 'result', id: 1, text: `${LEAD_PADDING_SAMPLES}+1600+3200+${TAIL_PADDING_SAMPLES}` }]);
  });

  it('keeps concurrent requests in separate streams and finishes a request without audio', () => {
    const { host: recognition, replies, streams } = host();
    recognition.handle({ type: 'audio', id: 1, samples: new Float32Array(10) });
    recognition.handle({ type: 'audio', id: 2, samples: new Float32Array(20) });
    recognition.handle({ type: 'audio', id: 1, samples: new Float32Array(30) });
    recognition.handle({ type: 'finish', id: 2 });
    recognition.handle({ type: 'finish', id: 1 });
    recognition.handle({ type: 'finish', id: 3 });
    expect(streams).toHaveLength(3);
    expect(replies).toEqual([{ type: 'result', id: 2, text: `${LEAD_PADDING_SAMPLES}+20+${TAIL_PADDING_SAMPLES}` },
      { type: 'result', id: 1, text: `${LEAD_PADDING_SAMPLES}+10+30+${TAIL_PADDING_SAMPLES}` }, { type: 'result', id: 3, text: `${LEAD_PADDING_SAMPLES}+${TAIL_PADDING_SAMPLES}` }]);
  });

  it('discards a cancelled request without an answer', () => {
    const { host: recognition, replies } = host();
    recognition.handle({ type: 'audio', id: 1, samples: new Float32Array(10) });
    recognition.handle({ type: 'cancel', id: 1 });
    expect(replies).toEqual([]);
  });

  it('reports a decoding error once and ignores the rest of that request', () => {
    const { host: recognition, replies } = host({ failOn: 2 });
    recognition.handle({ type: 'audio', id: 1, samples: new Float32Array(10) });
    recognition.handle({ type: 'audio', id: 1, samples: new Float32Array(10) });
    recognition.handle({ type: 'audio', id: 1, samples: new Float32Array(10) });
    recognition.handle({ type: 'finish', id: 1 });
    recognition.handle({ type: 'audio', id: 2, samples: new Float32Array(10) });
    recognition.handle({ type: 'finish', id: 2 });
    expect(replies).toEqual([{ type: 'error', id: 1, message: 'native failure' },
      { type: 'result', id: 2, text: `${LEAD_PADDING_SAMPLES}+10+${TAIL_PADDING_SAMPLES}` }]);
  });
});
