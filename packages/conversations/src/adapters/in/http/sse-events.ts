import { ProjectError } from '../../../project-error.js';
export type TurnSseEvent =
  | Readonly<{ kind: 'conversation'; conversationId: string }>
  | Readonly<{ kind: 'delta'; text: string }>
  | Readonly<{ kind: 'done' }>
  | Readonly<{ kind: 'error'; error: string }>;

/** Encode one complete UTF-8 SSE message for the chat transport. */
export function encodeTurnSseEvent(event: TurnSseEvent): string {
  switch (event.kind) {
    case 'conversation': return `event: conversation\ndata: ${JSON.stringify({ conversationId: event.conversationId })}\n\n`;
    case 'delta': return `event: delta\ndata: ${JSON.stringify({ text: event.text })}\n\n`;
    case 'done': return 'event: done\ndata: {}\n\n';
    case 'error': return `event: error\ndata: ${JSON.stringify({ error: event.error })}\n\n`;
    default: return assertNever(event);
  }
}

function assertNever(_value: never): never {
  throw new ProjectError('Unexpected SSE event');
}
