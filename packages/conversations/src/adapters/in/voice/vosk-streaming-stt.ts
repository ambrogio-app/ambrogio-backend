import { STT } from '@micdrop/server';
import { Model, Recognizer, setLogLevel } from 'vosk-koffi';
import type { Readable } from 'node:stream';

const sampleRate = 16_000;
const models = new Map<string, Model>();
setLogLevel(-1);

function recognizedText(result: { text?: string; alternatives?: Array<{ text?: string }> }): string {
  return result.text ?? result.alternatives?.[0]?.text ?? '';
}

/** Decode each PCM chunk as it arrives; retain only recognized text. */
export class VoskStreamingSTT extends STT {
  private generation = 0;
  private readonly activeFinishes = new Set<() => void>();
  private readonly model: Model;

  constructor(modelPath: string) {
    super();
    let model = models.get(modelPath);
    if (!model) {
      model = new Model(modelPath);
      models.set(modelPath, model);
    }
    this.model = model;
  }

  transcribe(audioStream: Readable): void {
    const generation = this.generation;
    const recognizer = new Recognizer({ model: this.model, sampleRate });
    const parts: string[] = [];
    let finished = false;
    const finish = (failed: boolean) => {
      if (finished) return;
      finished = true;
      this.activeFinishes.delete(abort);
      try {
        if (!failed) {
          const final = recognizedText(recognizer.finalResult());
          if (final) parts.push(final);
        }
      } catch { failed = true; }
      recognizer.free();
      const transcript = parts.join(' ');
      if (generation === this.generation) {
        this.emit('Transcript', failed || !transcript.trim() ? '' : transcript);
      }
    };
    const abort = () => finish(true);
    this.activeFinishes.add(abort);
    audioStream.on('data', (chunk: Buffer) => {
      if (finished || generation !== this.generation) return;
      try {
        if (recognizer.acceptWaveform(chunk)) {
          const part = recognizedText(recognizer.result());
          if (part) parts.push(part);
        }
      } catch { finish(true); }
    });
    audioStream.once('end', () => finish(false));
    audioStream.once('error', () => finish(true));
  }

  override destroy(): void {
    this.generation += 1;
    for (const finish of this.activeFinishes) finish();
    super.destroy();
  }
}
