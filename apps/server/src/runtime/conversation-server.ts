import { loadConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import { loadVoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { SystemCurrentTime } from '@ambrogio/conversations/adapters/out/system-current-time';
import { recoverPendingTurns } from '@ambrogio/conversations/adapters/out/sqlite/recover-pending-turns';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import { prepareAgents } from '../composition/agents.js';
import { prepareConfiguredConversations } from '../composition/conversations.js';
import { buildConversationServer } from './consultation-server.js';
import { conversationConfigPath } from './conversation-config-path.js';
import { httpConfigPath, loadHttpConfig } from './http-config.js';
import { startupPhase } from './startup-failure.js';

/** Start the executable conversation ingress with the configured orchestrator. */
export async function startConversationServer(environment: NodeJS.ProcessEnv = process.env,
  agentDirectory = '/etc/ambrogio/agents',
  prepare: (directory: string, timeZone: string) => Promise<Readonly<{
    orchestrator: ProduceConversationReply; close(): Promise<void> }>> = (directory, timeZone) =>
    prepareAgents(directory, undefined, { timeZone, clock: new SystemCurrentTime() })) {
  const [http, conversations] = await Promise.all([
    loadHttpConfig(httpConfigPath(environment)),
    loadConversationConfig(conversationConfigPath(environment)),
  ]);
  const voicePath = environment.AMBROGIO_VOICE_CONFIG_PATH;
  if (voicePath !== undefined && !voicePath.trim()) {
    throw new ProjectError('Invalid voice configuration path');
  }
  const voice = voicePath === undefined ? undefined : await loadVoiceConfig(voicePath);
  const agents = await prepare(agentDirectory, conversations.timeZone);
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
  const archive = prepared.archive;
  let closing: Promise<void> | undefined;
  return { server, close() {
    closing ??= (async () => {
      try {
        await turnIngress.stopAccepting();
        await recoverPendingTurns(archive.db, new Date());
        await turnIngress.closeSessions();
      } finally {
        try { await server.close(); }
        finally { await Promise.allSettled([agents.close(), archive.close()]); }
      }
    })();
    return closing;
  } };
}
