import { afterEach, expect, test } from 'vitest';
import { closeAllClients, ProtocolClient, rejectedUpgradeStatus, takeSchemaViolations } from './protocol-client.js';
import { echoReply, expectation, gate, scriptedReply, startSessionServer, text, waitUntil,
  type SessionServer } from './session-fixture.js';

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

// Verification: Prova dell'apertura della sessione conversazionale
test('accepts the upgrade only for the ambrogio.v1 subprotocol', async () => {
  const server = await start();
  const client = await ProtocolClient.open(server.url);
  expect(client.protocol).toBe('ambrogio.v1');
  expect(await rejectedUpgradeStatus(server.url, { protocols: [] })).toBeGreaterThanOrEqual(400);
  expect(await rejectedUpgradeStatus(server.url, { protocols: ['ambrogio.v2'] })).toBeGreaterThanOrEqual(400);
  expect(await server.conversationIds()).toEqual([]);
});

// Verification: Prova dell'apertura della sessione conversazionale
test('requires session.hello before transmissions and rejects a second hello', async () => {
  const server = await start();
  const client = await ProtocolClient.open(server.url);
  client.startText('early');
  const early = await client.waitFor(message => message.type === 'session.error');
  expect(early).toMatchObject({ code: 'session_not_ready', requestId: 'early' });

  expect(await client.hello('cucina-01', 'Cucina')).toEqual({ type: 'session.ready', protocol: 'ambrogio.v1' });
  client.send({ type: 'session.hello', clientId: 'cucina-01', name: 'Cucina' });
  await client.until(() => client.errors().length === 2 ? true : undefined);
  expect(client.errors()[1]).toMatchObject({ code: 'invalid_message' });

  const result = await client.textTurn('ciao');
  expect(result.final).toMatchObject({ type: 'turn.completed' });
  expect(client.isClosed).toBe(false);
  expect(await server.conversationIds()).toHaveLength(1);
});

// Verification: Prova dell'apertura della sessione conversazionale
test('keeps sessions with the same clientId independent', async () => {
  const server = await start();
  const first = await ProtocolClient.ready(server.url, { clientId: 'satellite', name: 'Cucina' });
  const second = await ProtocolClient.ready(server.url, { clientId: 'satellite', name: 'Cucina' });
  const one = await first.textTurn('primo');
  await first.close();
  const two = await second.textTurn('secondo');
  expect(one.final.type).toBe('turn.completed');
  expect(two.final.type).toBe('turn.completed');
  expect(two.accepted!.conversationId).not.toBe(one.accepted!.conversationId);
});

// Verification: Prova dell'apertura della sessione conversazionale
test('closes a session that stops answering pings while its admitted turn completes', async () => {
  const pending = gate();
  const { reply } = scriptedReply(async function* () {
    await pending.waiting;
    yield text('risposta tardiva');
    yield expectation(false);
  });
  const server = await start({ reply, pingIntervalMs: 50 });
  const silent = await ProtocolClient.ready(server.url, { autoPong: false });
  const healthy = await ProtocolClient.ready(server.url);
  const requestId = silent.requestId();
  silent.startText(requestId);
  silent.chunk(requestId, 'domanda');
  silent.end(requestId);
  const accepted = await silent.waitFor(message => message.type === 'turn.accepted');
  await silent.closed;
  await new Promise(resolve => setTimeout(resolve, 150));
  expect(healthy.isClosed).toBe(false);
  pending.release();
  await waitUntil(async () => (await server.turns(accepted.conversationId as string))[0]?.status === 'answered',
    'turn answered after ping timeout');
});

// Verification: Prova del controllo dell'origine della sessione
test('accepts requests without Origin and rejects undeclared origins without allowed list', async () => {
  const server = await start();
  await ProtocolClient.ready(server.url);
  expect(await rejectedUpgradeStatus(server.url, { origin: 'http://casa.lan' })).toBe(403);
  expect(await server.conversationIds()).toEqual([]);
});

// Verification: Prova del controllo dell'origine della sessione
test('accepts only exact matches of configured origins', async () => {
  const server = await start({ allowedOrigins: ['https://ambrogio.casa.lan'] });
  const allowed = await ProtocolClient.ready(server.url, { origin: 'https://ambrogio.casa.lan' });
  expect(allowed.protocol).toBe('ambrogio.v1');
  for (const origin of ['https://evil.lan', 'https://ambrogio.casa.lan.evil', 'https://ambrogio.casa',
    'http://ambrogio.casa.lan']) {
    expect(await rejectedUpgradeStatus(server.url, { origin })).toBe(403);
  }
});

// Verification: Prova degli errori di protocollo
test('answers malformed messages with session.error while the session and its turn survive', async () => {
  const pending = gate();
  const { reply } = scriptedReply(async function* () {
    yield text('prima parte');
    await pending.waiting;
    yield text(' e seconda');
    yield expectation(false);
  });
  const server = await start({ reply });
  const client = await ProtocolClient.ready(server.url);
  const requestId = client.requestId();
  client.startText(requestId);
  client.chunk(requestId, 'domanda');
  client.end(requestId);
  await client.waitFor(message => message.type === 'output.chunk');

  client.sendRaw('{not json');
  client.send({ hello: true });
  client.send({ type: 'telepathy.start' });
  client.send({ type: 'input.start', requestId: 'extra', stream: 90, content: { type: 'text' }, reply: 'text',
    secret: true });
  client.send({ type: 'input.chunk', requestId: 'ghost', text: 'boo' });
  client.sendFrame(4242, Buffer.from('rumore'));
  client.send({ type: 'client.result', id: 'never-issued', ok: true });
  await client.until(() => client.errors().length >= 6 ? true : undefined);

  expect(client.errors().map(error => [error.code, error.requestId])).toEqual([
    ['invalid_message', undefined],
    ['invalid_message', undefined],
    ['unknown_type', undefined],
    ['invalid_message', 'extra'],
    ['unknown_stream', 'ghost'],
    ['unknown_stream', undefined],
  ]);
  for (const error of client.errors()) {
    expect(error.message).toEqual(expect.any(String));
    expect(error.message as string).not.toMatch(/stack|Error:|at /);
  }
  pending.release();
  const result = await client.result(requestId);
  expect(result.final).toMatchObject({ type: 'turn.completed' });
  expect(result.outputs[0]!.text).toBe('prima parte e seconda');
  expect(client.isClosed).toBe(false);
  expect(await server.conversationIds()).toHaveLength(1);
});

// Verification: Prova dell'arresto per input conversazionale non valido
test('stops shape-invalid input at the adapter without invoking the use case', async () => {
  const { reply, histories } = echoReply();
  const server = await start({ reply });
  const client = await ProtocolClient.ready(server.url);
  client.send({ type: 'input.start', requestId: 'a', conversationId: 7, stream: 1,
    content: { type: 'text' }, reply: 'text' });
  client.send({ type: 'input.start', requestId: 'b', stream: '2', content: { type: 'text' }, reply: 'text' });
  client.send({ type: 'input.start', requestId: 'c', stream: 3, content: { type: 'audio', sampleRate: 44100 },
    reply: 'audio' });
  client.startText('d');
  client.send({ type: 'input.chunk', requestId: 'd', text: 42 });
  await client.until(() => client.errors().length >= 4 ? true : undefined);
  expect(client.errors().map(error => error.code)).toEqual(
    ['invalid_message', 'invalid_message', 'invalid_message', 'invalid_message']);
  expect(histories).toEqual([]);
  expect(await server.conversationIds()).toEqual([]);
});
