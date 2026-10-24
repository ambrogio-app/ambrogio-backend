import { installFatalPath } from './runtime/fatal-path.js';

// The fatal path is installed before any application code is loaded («Percorso fatale del server»).
installFatalPath('Ambrogio backend stopped after a fatal error.');

const [{ createBaseLogger }, { prepareConversationServer }, { listen, runServerProcess }] = await Promise.all([
  import('./runtime/logger.js'), import('./runtime/conversation-server.js'), import('./runtime/server-process.js'),
]);

// The single base logger of the process, shared by every component of the graph.
const log = createBaseLogger();
const outcome = await runServerProcess({
  build: () => prepareConversationServer(process.env, log),
  activate: listen,
  log,
});
if (outcome.force) process.exit(outcome.exitCode);
process.exitCode = outcome.exitCode;
