import { loadConversationListConfig } from '@ambrogio/conversations/adapters/out/conversation-list-config';
import { openConversationArchive } from '@ambrogio/conversations/adapters/out/sqlite/archive';
import { SqliteConversationListRead } from '@ambrogio/conversations/adapters/out/sqlite/list-read';
import { createListConversations } from '@ambrogio/conversations/application/list-conversations';
import { conversationConfigPath } from '../runtime/conversation-config-path.js';

/** Prepare the list before an HTTP ingress can be enabled. */
export async function prepareConversationList(
  archiveFilename: string,
  interruptedAt: Date,
  environment?: NodeJS.ProcessEnv,
) {
  const config = await loadConversationListConfig(conversationConfigPath(environment));
  const archive = await openConversationArchive(archiveFilename, interruptedAt);
  try {
    const read = new SqliteConversationListRead(archive.db, config.maxListPageSize);
    const listConversations = createListConversations(read, config.listPageSize, config.maxListPageSize);
    return { listConversations, archive };
  } catch (error) {
    try { await archive.close(); } catch { /* preserve the preparation failure */ }
    throw error;
  }
}
