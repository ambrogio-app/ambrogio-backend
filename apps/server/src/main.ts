import { startConversationServer } from './runtime/conversation-server.js';

try {
  const runtime = await startConversationServer();
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void runtime.close().then(() => process.exit(0), () => process.exit(1));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  process.stderr.write('Unable to start HTTP server.\n');
  process.exitCode = 1;
}
