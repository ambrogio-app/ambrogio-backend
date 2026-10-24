import { prepareConversationServer, type PrepareAgents } from '../../src/runtime/conversation-server.js';
import { startupWithCleanup } from '../../src/runtime/lifecycle.js';
import type { Logger } from '../../src/runtime/logger.js';
import { listen } from '../../src/runtime/server-process.js';
import { recordingLogger } from './logger-fixture.js';

/**
 * Build the conversation server and activate its listener as the process runner does, for the tests that need a
 * listening server: a listening failure closes what was built and keeps both faults.
 */
export async function startConversationServer(environment: NodeJS.ProcessEnv, prepare?: PrepareAgents,
  log: Logger = recordingLogger().log) {
  const built = await prepareConversationServer(environment, log, prepare);
  try { await listen(built); }
  catch (error) {
    const cleanup = await built.close().then(() => [], () => built.faults);
    throw startupWithCleanup('Server startup failed', error, cleanup);
  }
  return built;
}
