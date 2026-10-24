import { readConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import { readRuntimeEnvironment } from '@ambrogio/conversations/adapters/out/environment-variables';
import { loadVoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';
import { SystemCurrentTime } from '@ambrogio/conversations/adapters/out/system-current-time';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import type { FastifyInstance } from 'fastify';
import { prepareAgents } from '../composition/agents.js';
import { prepareConfiguredConversations } from '../composition/conversations.js';
import { buildConversationServer } from '../composition/http-surface.js';
import { readAgentsDirectory } from './agent-config.js';
import { readHttpConfig } from './http-config.js';
import { collectFaults, createResourceStack, startupWithCleanup } from './lifecycle.js';
import type { Logger } from './logger.js';
import { startupPhase } from './startup-failure.js';

export type PrepareAgents = (directory: string, timeZone: string, language: 'en' | 'it') => Promise<Readonly<{
  orchestrator: ProduceConversationReply; close(): Promise<void> }>>;

/** The conversation server built and not yet listening («Costruzione del server separata dall'ascolto»). */
export type PreparedConversationServer = Readonly<{
  server: FastifyInstance;
  /** The validated listening address; the entry point opens it. */
  address: Readonly<{ host: string; port: number }>;
  /**
   * Stop accepting turns, interrupt the pending ones, close the sessions, then close listener, speech components,
   * archive and agent connections once each, in reverse order of acquisition. Repeated calls share one shutdown.
   */
  close(): Promise<void>;
  /** Faults observed by the closing so far, also while it is still in progress. */
  readonly faults: readonly unknown[];
}>;

/**
 * Build the executable conversation ingress with the configured orchestrator, without listening. The configuration
 * of every component is read once, here, from the process environment, before any resource is built; every
 * resource registers its closing right after it is acquired.
 */
export async function prepareConversationServer(environment: NodeJS.ProcessEnv, log: Logger,
  prepare: PrepareAgents = (directory, timeZone, language) =>
    prepareAgents(directory, environment, undefined, { timeZone, clock: new SystemCurrentTime() }, language),
): Promise<PreparedConversationServer> {
  const runtime = readRuntimeEnvironment(environment);
  const http = readHttpConfig(environment, runtime);
  const conversations = readConversationConfig(environment, runtime);
  const agentDirectory = readAgentsDirectory(environment, runtime);
  const voice = await loadVoiceConfig(environment, conversations.language);
  const resources = createResourceStack('Server shutdown failed');
  try {
    const agents = await prepare(agentDirectory, conversations.timeZone, conversations.language);
    resources.defer('Agent MCP connections could not be closed', () => agents.close());
    const prepared = await startupPhase('Conversation archive could not be prepared',
      () => prepareConfiguredConversations(conversations, new Date()));
    resources.defer('Conversation archive could not be closed', () => prepared.archive.close());
    const { server, turnIngress } = await buildConversationServer(http, prepared, agents.orchestrator, voice,
      undefined, { log, resources });
    const stopFaults: unknown[] = [];
    let closing: Promise<void> | undefined;
    return { server, address: { host: http.host, port: http.port }, close() {
      closing ??= (async () => {
        // New work stops and the turns in progress are interrupted before any resource is closed.
        try {
          await turnIngress.stopAccepting();
          await prepared.interruptPendingTurns();
          await turnIngress.closeSessions();
        } catch (error) { stopFaults.push(new ProjectError('Turns could not be interrupted', { cause: error })); }
        await resources.close().catch(() => undefined);
        const faults = [...stopFaults, ...resources.faults];
        if (faults.length > 0) throw collectFaults('Server shutdown failed', faults);
      })();
      return closing;
    }, get faults() { return [...stopFaults, ...resources.faults]; } };
  } catch (error) {
    const cleanup = await resources.close().then(() => [], () => resources.faults);
    throw startupWithCleanup('Server startup failed', error, cleanup);
  }
}
