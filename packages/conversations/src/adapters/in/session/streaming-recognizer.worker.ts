import { createRequire } from 'node:module';
import { parentPort, workerData } from 'node:worker_threads';
import { RecognitionHost, type OnlineRecognizer, type OnlineRecognizerConfig, type RecognitionReply,
  type RecognitionRequest } from './streaming-recognition.js';

// The recognition worker: sherpa-onnx decodes streams synchronously, so it runs here, off the event loop of the server.
const port = parentPort!;
const send = (reply: RecognitionReply) => port.postMessage(reply);
let host: RecognitionHost | undefined;
try {
  // The package is CommonJS without type declarations; only the members of `OnlineRecognizer` are used.
  const sherpa = createRequire(import.meta.url)('sherpa-onnx-node') as
    { OnlineRecognizer: new (config: OnlineRecognizerConfig) => OnlineRecognizer };
  host = new RecognitionHost(new sherpa.OnlineRecognizer((workerData as { config: OnlineRecognizerConfig }).config), send);
  send({ type: 'ready' });
} catch (error) {
  send({ type: 'failed', message: error instanceof Error ? error.message : String(error) });
}
port.on('message', (request: RecognitionRequest) => host?.handle(request));
