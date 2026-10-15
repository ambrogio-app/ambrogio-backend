import { readFile } from 'node:fs/promises';

export type ConversationListConfig = Readonly<{
  listPageSize: number;
  maxListPageSize: number;
}>;

/** Load the conversation component's JSON before constructing list resources. */
export async function loadConversationListConfig(filename: string): Promise<ConversationListConfig> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(filename, 'utf8'));
  } catch {
    throw new Error('Invalid conversation configuration file');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid conversation configuration file');
  }
  const fields = value as Record<string, unknown>;
  const listPageSize = fields.listPageSize === undefined ? 20 : fields.listPageSize;
  const maxListPageSize = fields.maxListPageSize === undefined ? 100 : fields.maxListPageSize;
  if (typeof listPageSize !== 'number' || !Number.isSafeInteger(listPageSize) || listPageSize < 1
    || typeof maxListPageSize !== 'number' || !Number.isSafeInteger(maxListPageSize)
    || maxListPageSize < 1 || listPageSize > maxListPageSize) {
    throw new Error('Invalid conversation list limits');
  }
  return { listPageSize, maxListPageSize };
}
