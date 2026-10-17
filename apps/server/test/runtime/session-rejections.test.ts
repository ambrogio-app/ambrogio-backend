import { afterEach, describe, expect, test } from 'vitest';
import { closeAllClients, pcm, ProtocolClient, takeSchemaViolations, type TurnResult } from './protocol-client.js';
import { echoReply, expectation, gate, maxAudioBytes, maxTextBytes, scriptedReply, startSessionServer, text,
  type Language, type Reason, type SessionServer } from './session-fixture.js';

const servers: SessionServer[] = [];
afterEach(async () => {
  await closeAllClients();
  await Promise.all(servers.splice(0).map(server => server.close()));
  expect(takeSchemaViolations()).toEqual([]);
});

async function start(options: Parameters<typeof startSessionServer>[0] = {}) {
  const server = await startSessionServer(options);
  servers.push(server);
  return server;
}

function expectRejected(result: TurnResult, reason: Reason, message: string,
  content: 'text' | 'audio' = 'text') {
  expect(result.accepted).toBeUndefined();
  expect(result.final).toEqual({ type: 'turn.rejected', requestId: result.final.requestId, reason, message });
  expect(result.outputs).toHaveLength(1);
  const output = result.outputs[0]!;
  expect(output.start).not.toHaveProperty('turnId');
  expect(output.ended).toBe(true);
  if (content === 'text') {
    expect(output.start.content).toEqual({ type: 'text' });
    expect(output.text).toBe(message);
  } else {
    expect(output.start.content).toMatchObject({ type: 'audio' });
    expect(output.audio.toString('utf8')).toBe(message);
  }
  expect(result.sequence).toEqual(content === 'text'
    ? ['output.start', ...Array(result.sequence.length - 3).fill('output.chunk'), 'output.end', 'turn.rejected']
    : ['output.start', ...Array(result.sequence.length - 3).fill('binary'), 'output.end', 'turn.rejected']);
}

// Verification: Prova dei rifiuti prima dell'ammissione
describe.each<Language>(['en', 'it'])('rejections before admission in %s', language => {
  test('uses the localized reason message and leaves the archive unchanged', async () => {
    const pending = gate();
    const { reply } = scriptedReply(async function* () {
      await pending.waiting; yield text('ok'); yield expectation(false);
    });
    const server = await start({ reply, language, voice: true });
    const client = await ProtocolClient.ready(server.url);
    const busyId = client.requestId();
    client.startText(busyId);
    client.chunk(busyId, 'occupa');
    client.end(busyId);
    const busy = await client.waitFor(message => message.type === 'turn.accepted');
    const before = await server.conversationIds();

    expectRejected(await client.textTurn('   '), 'invalid', server.messages.invalid);
    expectRejected(await client.textTurn('ciao', { conversationId: 'missing' }),
      'conversation_not_found', server.messages.conversation_not_found);
    expectRejected(await client.textTurn('ciao', { conversationId: busy.conversationId as string }),
      'occupied', server.messages.occupied);
    expectRejected(await client.textTurn('ciao', { conversationId: busy.conversationId as string, reply: 'audio' }),
      'occupied', server.messages.occupied, 'audio');

    const write = server.prepared.write as unknown as { admit: (...args: unknown[]) => Promise<unknown> };
    const admit = write.admit.bind(write);
    write.admit = async () => ({ ok: false, error: { kind: 'archive_busy' } });
    expectRejected(await client.textTurn('ciao'), 'unavailable', server.messages.unavailable);
    write.admit = async () => { throw new Error('SQLITE_IOERR at /var/lib/secret.db'); };
    const failed = await client.textTurn('ciao');
    expectRejected(failed, 'failure', server.messages.failure);
    expect(JSON.stringify(failed)).not.toContain('SQLITE');
    write.admit = admit;

    expect(await server.conversationIds()).toEqual(before);
    pending.release();
    await client.result(busyId);
  });
});

// Verification: Prova dei rifiuti prima dell'ammissione
test('rejects new turns as unavailable once the server stops accepting', async () => {
  const server = await start();
  const client = await ProtocolClient.ready(server.url);
  await server.ingress.stopAccepting();
  expectRejected(await client.textTurn('troppo tardi'), 'unavailable', server.messages.unavailable);
  expect(await server.conversationIds()).toEqual([]);
});

// Verification: Prova del rifiuto del turno testuale vuoto
test('rejects empty text as invalid even with an unknown conversation', async () => {
  const server = await start();
  const client = await ProtocolClient.ready(server.url);
  const created = await client.textTurn('prima');
  const conversationId = created.accepted!.conversationId as string;
  for (const options of [{}, { conversationId }, { conversationId: 'missing' }]) {
    expectRejected(await client.textTurn('', options), 'invalid', server.messages.invalid);
    expectRejected(await client.textTurn(' \n\t ', options), 'invalid', server.messages.invalid);
  }
  expect(await server.conversationIds()).toEqual([conversationId]);
  expect(await server.turns(conversationId)).toHaveLength(1);
});

// Verification: Prova della continuazione con identificativo inesistente
test('rejects text and audio continuations of unknown conversations', async () => {
  const server = await start({ voice: true });
  const client = await ProtocolClient.ready(server.url);
  expectRejected(await client.textTurn('ciao', { conversationId: 'nope' }),
    'conversation_not_found', server.messages.conversation_not_found);
  expectRejected(await client.audioTurn(pcm('ciao'), { conversationId: 'nope' }),
    'conversation_not_found', server.messages.conversation_not_found, 'audio');
  expect(await server.conversationIds()).toEqual([]);
});

// Verification: Prova del rifiuto dei turni concorrenti
test('admits one turn per conversation across clients while other conversations progress', async () => {
  const pending = gate();
  const { reply } = scriptedReply(async function* (history) {
    if (history.turns.at(-1)!.text === 'blocca') await pending.waiting;
    yield text(`ok ${history.turns.at(-1)!.text}`);
    yield expectation(false);
  });
  const server = await start({ reply, voice: true });
  const chat = await ProtocolClient.ready(server.url, { clientId: 'cli', name: 'Terminale' });
  const satellite = await ProtocolClient.ready(server.url, { clientId: 'sat', name: 'Cucina' });
  const conversationA = (await chat.textTurn('apri')).accepted!.conversationId as string;
  const conversationB = (await chat.textTurn('altra')).accepted!.conversationId as string;

  const blocked = chat.requestId();
  chat.startText(blocked, { conversationId: conversationA });
  chat.chunk(blocked, 'blocca');
  chat.end(blocked);
  await chat.waitFor(message => message.type === 'turn.accepted' && message.requestId === blocked);

  expectRejected(await satellite.audioTurn(pcm('anche io'), { conversationId: conversationA }),
    'occupied', server.messages.occupied, 'audio');
  expectRejected(await satellite.textTurn('e io', { conversationId: conversationA }),
    'occupied', server.messages.occupied);
  expect((await satellite.textTurn('su B', { conversationId: conversationB })).final.type).toBe('turn.completed');
  expect((await satellite.audioTurn(pcm('nuova'))).final.type).toBe('turn.completed');
  expect(chat.view(blocked)).toBeUndefined();

  pending.release();
  expect((await chat.result(blocked)).final.type).toBe('turn.completed');
  expect((await satellite.textTurn('dopo', { conversationId: conversationA })).final.type).toBe('turn.completed');
  expect((await server.turns(conversationA)).map(turn => turn.text)).toEqual(['apri', 'blocca', 'dopo']);
});

// Verification: Prova del rifiuto oltre i limiti di trasmissione
test('rejects oversized text immediately and ignores the rest of the request', async () => {
  const { reply, histories } = echoReply();
  const server = await start({ reply });
  const client = await ProtocolClient.ready(server.url);
  const within = await client.textTurn('a'.repeat(maxTextBytes));
  expect(within.final.type).toBe('turn.completed');

  const requestId = client.requestId();
  client.startText(requestId);
  client.chunk(requestId, 'è'.repeat(maxTextBytes / 4));
  client.chunk(requestId, 'è'.repeat(maxTextBytes / 4));
  client.chunk(requestId, 'x');
  const rejected = await client.result(requestId);
  expectRejected(rejected, 'too_large', server.messages.too_large);
  client.chunk(requestId, 'ancora');
  client.end(requestId);
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(client.errors()).toEqual([]);
  expect(histories).toHaveLength(1);
  expect(await server.conversationIds()).toHaveLength(1);
});

// Verification: Prova del rifiuto oltre i limiti di trasmissione
test('rejects audio beyond 60 seconds without transcribing it', async () => {
  const server = await start({ voice: true, language: 'en' });
  const client = await ProtocolClient.ready(server.url);
  const within = await client.audioTurn(pcm('long question', maxAudioBytes));
  expect(within.accepted!.text).toBe('long question');
  expect(server.speech.transcriptions).toBe(1);

  const requestId = client.requestId();
  const stream = client.startAudio(requestId);
  client.sendAudio(stream, pcm('too long', maxAudioBytes + 2));
  const rejected = await client.result(requestId);
  expectRejected(rejected, 'too_large', server.messages.too_large, 'audio');
  client.sendFrame(stream, Buffer.alloc(320));
  client.end(requestId);
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(client.errors()).toEqual([]);
  expect(server.speech.transcriptions).toBe(1);
  expect(await server.conversationIds()).toHaveLength(1);
});

// Verification: Prova del rifiuto audio senza voce abilitata
test('rejects audio input or audio replies in text when voice is disabled', async () => {
  const server = await start();
  const client = await ProtocolClient.ready(server.url);
  expectRejected(await client.audioTurn(pcm('ciao')), 'audio_unavailable', server.messages.audio_unavailable);
  expectRejected(await client.textTurn('ciao', { reply: 'audio' }),
    'audio_unavailable', server.messages.audio_unavailable);
  expect(await server.conversationIds()).toEqual([]);
  expect((await client.textTurn('ciao', { reply: 'text' })).final.type).toBe('turn.completed');
  expect(client.errors()).toEqual([]);
});

// Verification: Prova della trascrizione non riuscita
test('rejects unusable transcriptions without creating exchanges', async () => {
  const server = await start({ voice: true });
  const client = await ProtocolClient.ready(server.url);
  expectRejected(await client.audioTurn(pcm('FAIL')), 'transcription_failed',
    server.messages.transcription_failed, 'audio');
  expectRejected(await client.audioTurn(pcm('', 3200)), 'transcription_failed',
    server.messages.transcription_failed, 'audio');
  expect(await server.conversationIds()).toEqual([]);
});
