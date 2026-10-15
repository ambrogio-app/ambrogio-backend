export type ConversationListItem = Readonly<{
  id: string;
  lastActivityAt: Date;
}>;

export type ConversationListCursor = ConversationListItem;

export type ConversationListPage = Readonly<{
  items: readonly ConversationListItem[];
  next?: ConversationListCursor;
}>;

/** A projection for bounded list pages, independent of historical reads and writes. */
export interface ConversationListRead {
  page(after: ConversationListCursor | undefined, limit: number): Promise<ConversationListPage>;
}
