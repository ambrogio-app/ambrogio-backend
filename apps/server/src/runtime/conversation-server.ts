import { loadConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import { recoverPendingTurns } from '@ambrogio/conversations/adapters/out/sqlite/recover-pending-turns';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import { prepareAgents } from '../composition/agents.js';
import { prepareConfiguredConversations } from '../composition/conversations.js';
import { buildConversationServer } from './consultation-server.js';
import { conversationConfigPath } from './conversation-config-path.js';
import { httpConfigPath, loadHttpConfig } from './http-config.js';

/** Start the executable conversation ingress with the configured orchestrator. */
export async function startConversationServer(environment: NodeJS.ProcessEnv = process.env,
  agentDirectory = '/etc/ambrogio/agents',
  prepare: (directory: string) => Promise<Readonly<{
    orchestrator: ProduceConversationReply; close(): Promise<void> }>> = prepareAgents) {
  const [http, conversations] = await Promise.all([
    loadHttpConfig(httpConfigPath(environment)),
    loadConversationConfig(conversationConfigPath(environment)),
  ]);
  const agents = await prepare(agentDirectory);
  let prepared: Awaited<ReturnType<typeof prepareConfiguredConversations>> | undefined;
  let built: Awaited<ReturnType<typeof buildConversationServer>> | undefined;
  try {
    prepared = await prepareConfiguredConversations(conversations, new Date());
    built = await buildConversationServer(http, prepared, agents.orchestrator);
    await built.server.listen({ host: http.host, port: http.port });
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
      } finally {
        try { await server.close(); }
        finally { await Promise.allSettled([agents.close(), archive.close()]); }
      }
    })();
    return closing;
  } };
}
