import Ajv2020Module from 'ajv/dist/2020.js';
import { ProjectError } from '../../../application/project-error.js';

export type SessionHello = Readonly<{ type: 'session.hello'; clientId: string; name: string }>;
export type InputStart = Readonly<{
  type: 'input.start';
  requestId: string;
  conversationId?: string;
  stream: number;
  content: Readonly<{ type: 'text' }> | Readonly<{ type: 'audio'; sampleRate: 16000 }>;
  reply: 'text' | 'audio';
}>;
export type InputChunk = Readonly<{ type: 'input.chunk'; requestId: string; text: string }>;
export type InputEnd = Readonly<{ type: 'input.end'; requestId: string }>;
export type ClientMessage = SessionHello | InputStart | InputChunk | InputEnd;

export type DecodedMessage =
  | Readonly<{ ok: true; message: ClientMessage }>
  | Readonly<{ ok: false; code: 'invalid_message' | 'unknown_type'; requestId?: string }>;

const clientTypes = new Set(['session.hello', 'input.start', 'input.chunk', 'input.end']);
const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;

/**
 * Decode JSON text frames against the `clientMessage` definition of the published schema,
 * without coercion, defaults or removal of additional fields.
 */
export function createProtocolDecoder(schema: Readonly<Record<string, unknown>>): (frame: string) => DecodedMessage {
  if (typeof schema.$id !== 'string') throw new ProjectError('Invalid conversation protocol schema');
  const ajv = new Ajv2020({ strict: true, allErrors: false, coerceTypes: false,
    useDefaults: false, removeAdditional: false });
  ajv.addSchema(schema);
  const validate = ajv.getSchema(`${schema.$id}#/$defs/clientMessage`);
  if (!validate) throw new ProjectError('Invalid conversation protocol schema');
  return frame => {
    let value: unknown;
    try { value = JSON.parse(frame); } catch { return { ok: false, code: 'invalid_message' }; }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, code: 'invalid_message' };
    }
    const fields = value as Record<string, unknown>;
    const requestId = typeof fields.requestId === 'string' && fields.requestId
      ? { requestId: fields.requestId } : {};
    if (typeof fields.type !== 'string') return { ok: false, code: 'invalid_message', ...requestId };
    if (!clientTypes.has(fields.type)) return { ok: false, code: 'unknown_type', ...requestId };
    if (!validate(value)) return { ok: false, code: 'invalid_message', ...requestId };
    return { ok: true, message: value as ClientMessage };
  };
}
