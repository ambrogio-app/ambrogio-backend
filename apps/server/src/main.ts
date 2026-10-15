import { startConsultationServer } from './runtime/consultation-server.js';

try {
  const runtime = await startConsultationServer();
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void runtime.close().catch(() => { process.exitCode = 1; });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  process.stderr.write('Unable to start HTTP server.\n');
  process.exitCode = 1;
}
