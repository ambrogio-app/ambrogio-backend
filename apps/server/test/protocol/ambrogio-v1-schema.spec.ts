import { describe, expect, test } from 'vitest';
import { isClientMessage, isServerMessage, protocolSchema } from '../support/protocol-schema.js';

describe('ambrogio.v1 schema', () => {
  test('is a JSON Schema 2020-12 document exposing both message directions', () => {
    expect(protocolSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    const defs = protocolSchema.$defs as Record<string, unknown>;
    expect(defs.clientMessage).toBeDefined();
    expect(defs.serverMessage).toBeDefined();
  });

  test.each([
    { type: 'session.hello', clientId: 'cucina-01', name: 'Cucina' },
    { type: 'input.start', requestId: 'r1', stream: 1, content: { type: 'text' }, reply: 'text' },
    { type: 'input.start', requestId: 'r2', conversationId: 'c1', stream: 4294967295,
      content: { type: 'audio', sampleRate: 16000 }, reply: 'audio' },
    { type: 'input.chunk', requestId: 'r1', text: '' },
    { type: 'input.chunk', requestId: 'r1', text: 'ciao 🌍\n' },
    { type: 'input.end', requestId: 'r1' },
  ])('accepts client message %#', message => {
    expect(isClientMessage(message)).toBe(true);
    expect(isServerMessage(message)).toBe(false);
  });

  test.each([
    {},
    { type: 'session.hello', clientId: '', name: 'Cucina' },
    { type: 'session.hello', clientId: 'a', name: 'b', capabilities: ['audio-out'] },
    { type: 'input.start', requestId: 'r1', stream: 0, content: { type: 'text' }, reply: 'text' },
    { type: 'input.start', requestId: 'r1', stream: 1.5, content: { type: 'text' }, reply: 'text' },
    { type: 'input.start', requestId: 'r1', stream: '1', content: { type: 'text' }, reply: 'text' },
    { type: 'input.start', requestId: 'r1', stream: 1, content: { type: 'audio', sampleRate: 22050 }, reply: 'text' },
    { type: 'input.start', requestId: 'r1', stream: 1, content: { type: 'video' }, reply: 'text' },
    { type: 'input.start', requestId: 'r1', stream: 1, content: { type: 'text' }, reply: 'video' },
    { type: 'input.start', requestId: 'r1', conversationId: 7, stream: 1, content: { type: 'text' }, reply: 'text' },
    { type: 'input.start', requestId: 'r1', stream: 1, content: { type: 'text' }, reply: 'text', extra: true },
    { type: 'input.chunk', requestId: 'r1', text: 42 },
    { type: 'input.end' },
    { type: 'client.result', id: 'cmd', ok: true },
    { type: 'client.result', id: 'cmd', ok: false, reason: 'unsupported' },
    { type: 'turn.completed', turnId: 't1', expectsReply: true },
  ])('rejects invalid client message %#', message => {
    expect(isClientMessage(message)).toBe(false);
  });

  test.each([
    { type: 'session.ready', protocol: 'ambrogio.v1' },
    { type: 'session.error', code: 'unknown_type', message: 'Messaggio non valido.' },
    { type: 'session.error', code: 'audio_busy', message: 'Audio già in corso.', requestId: 'r2' },
    { type: 'turn.accepted', requestId: 'r1', conversationId: 'c1', turnId: 't1', text: '  ciao  ' },
    { type: 'output.start', requestId: 'r1', turnId: 't1', stream: 1, content: { type: 'text' } },
    { type: 'output.start', requestId: 'r1', stream: 2, content: { type: 'audio', sampleRate: 22050 } },
    { type: 'output.chunk', stream: 1, text: 'Ciao' },
    { type: 'output.end', stream: 1 },
    { type: 'turn.completed', turnId: 't1', expectsReply: false },
    { type: 'turn.failed', turnId: 't1', message: 'Non riesco a completare la risposta.' },
    { type: 'turn.interrupted', turnId: 't1' },
    ...['invalid', 'conversation_not_found', 'occupied', 'unavailable', 'too_large',
      'transcription_failed', 'audio_unavailable', 'failure'].map(reason =>
      ({ type: 'turn.rejected', requestId: 'r1', reason, message: 'Messaggio.' })),
  ])('accepts server message %#', message => {
    expect(isServerMessage(message)).toBe(true);
    expect(isClientMessage(message)).toBe(false);
  });

  test.each([
    { type: 'session.ready', protocol: 'ambrogio.v2' },
    { type: 'session.error', code: 'boom', message: 'x' },
    { type: 'turn.accepted', requestId: 'r1', conversationId: 'c1', turnId: 't1', text: '' },
    { type: 'output.chunk', stream: 1, text: '' },
    { type: 'turn.completed', turnId: 't1' },
    { type: 'turn.completed', turnId: 't1', expectsReply: 'false' },
    { type: 'turn.rejected', requestId: 'r1', reason: 'teapot', message: 'x' },
    { type: 'turn.rejected', turnId: 't1', reason: 'occupied', message: 'x' },
    { type: 'turn.failed', turnId: 't1', message: 'x', stack: 'Error: secret' },
  ])('rejects invalid server message %#', message => {
    expect(isServerMessage(message)).toBe(false);
  });
});
