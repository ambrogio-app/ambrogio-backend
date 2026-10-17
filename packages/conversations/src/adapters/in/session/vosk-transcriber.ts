import { Model, Recognizer, setLogLevel } from 'vosk-koffi';
import type { Transcriber } from './speech-components.js';

const sampleRate = 16_000;
setLogLevel(-1);

function recognizedText(result: { text?: string; alternatives?: Array<{ text?: string }> }): string {
  return result.text ?? result.alternatives?.[0]?.text ?? '';
}

/** Vosk recognition of one request at a time per call, off the event loop. */
export class VoskTranscriber implements Transcriber {
  private readonly model: Model;

  constructor(modelPath: string) {
    this.model = new Model(modelPath);
  }

  async transcribe(audio: AsyncIterable<Uint8Array>): Promise<string> {
    const recognizer = new Recognizer({ model: this.model, sampleRate });
    try {
      const parts: string[] = [];
      for await (const chunk of audio) {
        if (await recognizer.acceptWaveformAsync(Buffer.from(chunk))) {
          const part = recognizedText(recognizer.result());
          if (part) parts.push(part);
        }
      }
      const final = recognizedText(recognizer.finalResult());
      if (final) parts.push(final);
      return parts.join(' ');
    } finally {
      recognizer.free();
    }
  }

  close(): void {
    this.model.free();
  }
}
