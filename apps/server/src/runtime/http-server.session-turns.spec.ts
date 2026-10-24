import { afterEach, expect, test } from 'vitest';
import type { ReplyPart } from '@ambrogio/conversations/application/produce-conversation-reply';
import { closeAllClients, pcm, ProtocolClient, takeSchemaViolations } from '../../test/support/protocol-client.js';
import { echoReply, expectation, gate, scriptedReply, startSessionServer, text, voiceSampleRate,
  waitUntil, type SessionServer } from '../../test/support/session-fixture.js';

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

// Verification: Prova della trasmissione progressiva della risposta
test('streams a text reply progressively in its own transmission', async () => {
  const pending = gate();
  const { reply } = scriptedReply(async function* () {
    yield text('Ciao ');
    await pending.waiting;
    yield text('🌍\nmondo');
    yield expectation(true);
  });
  const server = await start({ reply });
  const client = await ProtocolClient.ready(server.url);
  const requestId = client.requestId();
  client.startText(requestId);
  client.chunk(requestId, 'saluta');
  client.end(requestId);

  const first = await client.waitFor(message => message.type === 'output.chunk');
  expect(first.text).toBe('Ciao ');
  expect(client.view(requestId)).toBeUndefined();
  pending.release();

  const result = await client.result(requestId);
  expect(result.sequence).toEqual(['turn.accepted', 'output.start', 'output.chunk', 'output.chunk',
    'output.end', 'turn.completed']);
  expect(result.outputs).toHaveLength(1);
  expect(result.outputs[0]!.start).toMatchObject({ requestId, turnId: result.accepted!.turnId,
    content: { type: 'text' } });
  expect(result.outputs[0]!.text).toBe('Ciao 🌍\nmondo');
  expect(result.final).toEqual({ type: 'turn.completed', turnId: result.accepted!.turnId, expectsReply: true });
  expect((await server.turns(result.accepted!.conversationId as string))[0])
    .toMatchObject({ status: 'answered', answer: 'Ciao 🌍\nmondo' });
});

// Verification: Prova della trasmissione progressiva della risposta
test('speaks the reply as framed audio at the configured voice rate', async () => {
  const { reply } = scriptedReply(async function* () {
    yield text('Ecco ');
    yield text('la risposta.');
    yield expectation(false);
  });
  const server = await start({ reply, voice: true });
  const client = await ProtocolClient.ready(server.url);
  const result = await client.textTurn('parla', { reply: 'audio' });
  expect(result.outputs).toHaveLength(1);
  const output = result.outputs[0]!;
  expect(output.start.content).toEqual({ type: 'audio', sampleRate: voiceSampleRate });
  expect(output.ended).toBe(true);
  expect(output.text).toBe('');
  expect(output.audio.toString('utf8')).toBe('Ecco la risposta.');
  expect(result.sequence.at(-2)).toBe('output.end');
  expect(result.final).toMatchObject({ type: 'turn.completed', expectsReply: false });
  expect((await server.turns(result.accepted!.conversationId as string))[0])
    .toMatchObject({ status: 'answered', answer: 'Ecco la risposta.' });
});

// Verification: Prova della conferma di completamento del turno
test('sends turn.completed only after the outcome commit', async () => {
  const server = await start({ reply: echoReply(true).reply });
  const write = server.prepared.turns as unknown as { saveConclusion: (...args: unknown[]) => Promise<unknown> };
  const original = write.saveConclusion.bind(write);
  const commit = gate();
  write.saveConclusion = async (...args) => { await commit.waiting; return original(...args); };
  const client = await ProtocolClient.ready(server.url);
  const requestId = client.requestId();
  client.startText(requestId);
  client.chunk(requestId, 'conferma');
  client.end(requestId);
  await client.waitFor(message => message.type === 'output.end');
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(client.view(requestId)).toBeUndefined();
  commit.release();
  const result = await client.result(requestId);
  expect(result.final).toMatchObject({ type: 'turn.completed', expectsReply: true });
  expect(result.sequence.filter(type => type === 'turn.completed')).toHaveLength(1);
});

// Verification: Prova della conferma di completamento del turno
test('never confirms an outcome whose commit failed and disables new admissions', async () => {
  const server = await start({ reply: echoReply().reply });
  const write = server.prepared.turns as unknown as { saveConclusion: (...args: unknown[]) => Promise<unknown> };
  write.saveConclusion = async () => { throw new Error('disk full'); };
  const client = await ProtocolClient.ready(server.url);
  const requestId = client.requestId();
  client.startText(requestId);
  client.chunk(requestId, 'conferma');
  client.end(requestId);
  await client.waitFor(message => message.type === 'output.end');
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(client.json().some(message => message.type === 'turn.completed')).toBe(false);
  const next = await client.textTurn('ancora');
  expect(next.final).toMatchObject({ type: 'turn.rejected', reason: 'unavailable' });
});

// Verification: Prova della trasmissione della richiesta del turno
test('assembles the request only at input.end and preserves the received text', async () => {
  const { reply, histories } = echoReply();
  const server = await start({ reply });
  const client = await ProtocolClient.ready(server.url);
  const requestId = client.requestId();
  client.startText(requestId);
  client.chunk(requestId, '  Buon');
  client.chunk(requestId, 'giorno 🌞\n');
  client.chunk(requestId, 'a tutti  ');
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(histories).toEqual([]);
  expect(await server.conversationIds()).toEqual([]);
  client.end(requestId);
  const result = await client.result(requestId);
  expect(result.accepted!.text).toBe('  Buongiorno 🌞\na tutti  ');
  expect((await server.turns(result.accepted!.conversationId as string))[0]!.text)
    .toBe('  Buongiorno 🌞\na tutti  ');
});

// Verification: Prova della trasmissione della richiesta del turno
test('transcribes only the frames of the open audio transmission and refuses a second one', async () => {
  const server = await start({ voice: true });
  const client = await ProtocolClient.ready(server.url);
  const requestId = client.requestId();
  const stream = client.startAudio(requestId);
  client.sendAudio(stream, pcm('accendi '));
  client.startAudio('second');
  const busy = await client.waitFor(message => message.type === 'session.error');
  expect(busy).toMatchObject({ code: 'audio_busy', requestId: 'second' });
  client.sendAudio(stream, pcm('la luce'));
  client.end(requestId);
  const result = await client.result(requestId);
  expect(result.accepted!.text).toBe('accendi la luce');
  expect(server.speech.transcriptions).toBe(1);
});

// Verification: Prova della trasmissione della richiesta del turno
test('transcribes audio while it is received and uses the transcript only after input.end', async () => {
  const { reply, histories } = echoReply();
  const server = await start({ reply, voice: true });
  const client = await ProtocolClient.ready(server.url);
  const requestId = client.requestId();
  const stream = client.startAudio(requestId);
  client.sendAudio(stream, pcm('spegni la luce'));
  await waitUntil(() => (server.speech.receivedBytes[0] ?? 0) > 0, 'frames reach the transcriber before input.end');
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(histories).toEqual([]);
  expect(await server.conversationIds()).toEqual([]);
  expect(client.view(requestId)).toBeUndefined();
  client.end(requestId);
  const result = await client.result(requestId);
  expect(result.accepted!.text).toBe('spegni la luce');
  expect(server.speech.transcriptions).toBe(1);
});

// Verification: Prova della trasmissione della richiesta del turno
test('lets text requests on different conversations progress in parallel', async () => {
  const pending = gate();
  const { reply } = scriptedReply(async function* (history): AsyncGenerator<ReplyPart> {
    if (history.turns.at(-1)!.text === 'lenta') await pending.waiting;
    yield text(`ok ${history.turns.at(-1)!.text}`);
    yield expectation(false);
  });
  const server = await start({ reply });
  const client = await ProtocolClient.ready(server.url);
  const slow = client.requestId();
  client.startText(slow);
  client.chunk(slow, 'lenta');
  client.end(slow);
  await client.waitFor(message => message.type === 'turn.accepted' && message.requestId === slow);
  const fast = await client.textTurn('veloce');
  expect(fast.final).toMatchObject({ type: 'turn.completed' });
  expect(client.view(slow)).toBeUndefined();
  pending.release();
  expect((await client.result(slow)).outputs[0]!.text).toBe('ok lenta');
});

// Verification: Prova degli identificativi del turno ammesso
test('announces stored identifiers before any transmission, also when continuing', async () => {
  const server = await start({ voice: true });
  const client = await ProtocolClient.ready(server.url);
  const created = await client.textTurn('nuova');
  const continued = await client.textTurn('seguito', { conversationId: created.accepted!.conversationId as string });
  const spoken = await client.audioTurn(pcm('parlata'));
  for (const result of [created, continued, spoken]) {
    expect(result.sequence[0]).toBe('turn.accepted');
    const turns = await server.turns(result.accepted!.conversationId as string);
    const stored = turns.find(turn => turn.id === result.accepted!.turnId);
    expect(stored?.text).toBe(result.accepted!.text);
    for (const output of result.outputs) expect(output.start.turnId).toBe(result.accepted!.turnId);
    expect(result.final.turnId).toBe(result.accepted!.turnId);
  }
  expect(continued.accepted!.conversationId).toBe(created.accepted!.conversationId);
  expect(spoken.accepted!.text).toBe('parlata');
  expect(spoken.accepted!.conversationId).not.toBe(created.accepted!.conversationId);
});

// Verification: Prova della continuazione delle conversazioni da qualunque client
test('continues any conversation from any client and content type using the stored history', async () => {
  const { reply, histories } = echoReply();
  const server = await start({ reply, voice: true });
  const chat = await ProtocolClient.ready(server.url, { clientId: 'cli', name: 'Terminale' });
  const satellite = await ProtocolClient.ready(server.url, { clientId: 'sat', name: 'Cucina' });

  const typed = await chat.textTurn('scritta');
  const spoken = await satellite.audioTurn(pcm('detta'));
  const typedId = typed.accepted!.conversationId as string;
  const spokenId = spoken.accepted!.conversationId as string;

  const voiceOnTyped = await satellite.audioTurn(pcm('a voce'), { conversationId: typedId });
  const textOnSpoken = await chat.textTurn('per iscritto', { conversationId: spokenId });
  expect(voiceOnTyped.accepted!.conversationId).toBe(typedId);
  expect(textOnSpoken.accepted!.conversationId).toBe(spokenId);
  expect(histories.at(-2)!.turns.map(turn => turn.text)).toEqual(['scritta', 'a voce']);
  expect(histories.at(-1)!.turns.map(turn => turn.text)).toEqual(['detta', 'per iscritto']);
  expect((await server.turns(typedId)).map(turn => turn.text)).toEqual(['scritta', 'a voce']);
  expect((await server.turns(spokenId)).map(turn => turn.text)).toEqual(['detta', 'per iscritto']);
  expect(await server.conversationIds()).toHaveLength(2);
});

// Verification: Prova della segnalazione della replica attesa
test('reports expectsReply on completed text and voice turns', async () => {
  const { reply } = scriptedReply(async function* (history) {
    const question = history.turns.at(-1)!.text;
    yield text(question.endsWith('?') ? 'Quale stanza?' : 'Fatto.');
    yield expectation(question.endsWith('?'));
  });
  const server = await start({ reply, voice: true });
  const client = await ProtocolClient.ready(server.url);
  expect((await client.textTurn('accendi?')).final).toMatchObject({ expectsReply: true });
  expect((await client.textTurn('accendi')).final).toMatchObject({ expectsReply: false });
  expect((await client.audioTurn(pcm('spegni?'))).final).toMatchObject({ expectsReply: true });
  expect((await client.audioTurn(pcm('spegni'), { reply: 'text' })).final).toMatchObject({ expectsReply: false });
});

// Verification: Prova della segnalazione della replica attesa
test('treats a missing reply expectation as a failure, never as false', async () => {
  const { reply } = scriptedReply(async function* () { yield text('Senza indicazione.'); });
  const server = await start({ reply });
  const client = await ProtocolClient.ready(server.url);
  const result = await client.textTurn('domanda');
  expect(result.final).toEqual({ type: 'turn.failed', turnId: result.accepted!.turnId,
    message: server.messages.failure });
  expect(result.final).not.toHaveProperty('expectsReply');
  await waitUntil(async () => (await server.turns(result.accepted!.conversationId as string))[0]?.status
    === 'failed', 'failed outcome stored');
});
