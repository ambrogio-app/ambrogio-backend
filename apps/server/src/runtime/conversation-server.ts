import { readConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import { readRuntimeEnvironment } from '@ambrogio/conversations/adapters/out/environment-variables';
import { loadVoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';
import { SystemCurrentTime } from '@ambrogio/conversations/adapters/out/system-current-time';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import { prepareAgents } from '../composition/agents.js';
import { prepareConfiguredConversations } from '../composition/conversations.js';
import { buildConversationServer } from '../composition/http-surface.js';
import { readAgentsDirectory } from './agent-config.js';
import { readHttpConfig } from './http-config.js';
import { startupPhase } from './startup-failure.js';

/**
 * Start the executable conversation ingress with the configured orchestrator. The configuration of
 * every component is read once, here, from the process environment, before any resource is built.
 */
export async function startConversationServer(environment: NodeJS.ProcessEnv = process.env,
  prepare: (directory: string, timeZone: string, language: 'en' | 'it') => Promise<Readonly<{
    orchestrator: ProduceConversationReply; close(): Promise<void> }>> = (directory, timeZone, language) =>
    prepareAgents(directory, environment, undefined, { timeZone, clock: new SystemCurrentTime() }, language)) {
  const runtime = readRuntimeEnvironment(environment);
  const http = readHttpConfig(environment, runtime);
  const conversations = readConversationConfig(environment, runtime);
  const agentDirectory = readAgentsDirectory(environment, runtime);
  const voice = await loadVoiceConfig(environment, conversations.language);
  const agents = await prepare(agentDirectory, conversations.timeZone, conversations.language);
  let prepared: Awaited<ReturnType<typeof prepareConfiguredConversations>> | undefined;
  let built: Awaited<ReturnType<typeof buildConversationServer>> | undefined;
  try {
    prepared = await startupPhase('Conversation archive could not be prepared',
      () => prepareConfiguredConversations(conversations, new Date()));
    built = await buildConversationServer(http, prepared, agents.orchestrator, voice);
    const server = built.server;
    await startupPhase('HTTP listener could not start',
      () => server.listen({ host: http.host, port: http.port }));
  } catch (error) {
    try { if (built) await built.server.close(); }
    finally {
      await Promise.allSettled([prepared?.archive.close(), agents.close()]);
    }
    throw error;
  }
  const { server, turnIngress } = built;
  const { archive, interruptPendingTurns } = prepared;
  let closing: Promise<void> | undefined;
  return { server, close() {
    closing ??= (async () => {
      try {
        await turnIngress.stopAccepting();
        await interruptPendingTurns();
        await turnIngress.closeSessions();
      } finally {
        try { await server.close(); }
        finally { await Promise.allSettled([agents.close(), archive.close()]); }
      }
    })();
    return closing;
  } };
}
