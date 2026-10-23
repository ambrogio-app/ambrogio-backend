import { writeConfigFile } from '../support/config-fixture.js';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { closeAllClients, pcm, ProtocolClient, takeSchemaViolations } from './protocol-client.js';
import { expectation, gate, publicMessages, scriptedReply, startSessionServer, text, waitUntil,
  type SessionServer } from './session-fixture.js';
import { startConversationServer } from '../../src/runtime/conversation-server.js';

const servers: SessionServer[] = [];
const directories: string[] = [];
afterEach(async () => {
  await closeAllClients();
  await Promise.all(servers.splice(0).map(server => server.close()));
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
  expect(takeSchemaViolations()).toEqual([]);
});

async function start(options: Parameters<typeof startSessionServer>[0] = {}) {
  const server = await startSessionServer(options);
  servers.push(server);
  return server;
}

// Verification: Prova del ciclo della sessione conversazionale
test('closing a session releases only its own resources', async () => {
  const pending = gate();
  const { reply } = scriptedReply(async function* (history) {
    if (history.turns.at(-1)!.text === 'attendi') await pending.waiting;
    yield text(`risposta a ${history.turns.at(-1)!.text}`);
    yield expectation(false);
  });
  const server = await start({ reply, voice: true });
  const leaving = await ProtocolClient.ready(server.url);
  const staying = await ProtocolClient.ready(server.url);

  const requestId = leaving.requestId();
  leaving.startText(requestId);
  leaving.chunk(requestId, 'attendi');
  leaving.end(requestId);
  const admitted = await leaving.waitFor(message => message.type === 'turn.accepted');
  const partialAudio = leaving.requestId();
  leaving.sendAudio(leaving.startAudio(partialAudio), pcm('mai finita'));
  await leaving.close();

  expect((await staying.textTurn('ci sono')).final.type).toBe('turn.completed');
  pending.release();
  await waitUntil(async () => (await server.turns(admitted.conversationId as string))[0]?.status === 'answered',
    'admitted turn answered after close');
  // The unfinished audio request was being transcribed while received; closing discards it.
  expect(server.speech.transcriptions).toBe(1);
  expect(await server.conversationIds()).toHaveLength(2);
});

// Verification: Prova del ciclo della sessione conversazionale
test('aborts an in-progress spoken reply when its session closes', async () => {
  const server = await start({ voice: true });
  const synthesis = gate();
  server.speech.synthesisGate = synthesis.waiting;
  const client = await ProtocolClient.ready(server.url);
  const requestId = client.requestId();
  client.startText(requestId, { reply: 'audio' });
  client.chunk(requestId, 'parla a lungo');
  client.end(requestId);
  await client.waitFor(message => message.type === 'output.start');
  await client.close();
  await waitUntil(() => server.speech.synthesisAborts === 1, 'synthesis aborted');
  synthesis.release();
});

// Verification: Prova del completamento dopo la chiusura della sessione
test('completes and stores admitted turns after the session closes', async () => {
  const resume = gate();
  const { reply } = scriptedReply(async function* (history) {
    yield text('parte uno, ');
    await resume.waiting;
    if (history.turns.at(-1)!.text === 'guasto') throw new Error('provider exploded');
    yield text('parte due');
    yield expectation(false);
  });
  const server = await start({ reply, voice: true });
  const ids: string[] = [];
  for (const [question, replyType] of [['bene', 'text'], ['guasto', 'text'], ['bene', 'audio']] as const) {
    const client = await ProtocolClient.ready(server.url);
    const requestId = client.requestId();
    client.startText(requestId, { reply: replyType });
    client.chunk(requestId, question);
    client.end(requestId);
    const accepted = await client.waitFor(message => message.type === 'turn.accepted');
    await client.waitFor(message => message.type === 'output.start');
    client.terminate();
    await client.closed;
    ids.push(accepted.conversationId as string);
  }
  resume.release();
  await waitUntil(async () => {
    const outcomes = await Promise.all(ids.map(async id => (await server.turns(id))[0]?.status));
    return outcomes.every(status => status === 'answered' || status === 'failed');
  }, 'outcomes stored after close');
  expect(await server.turns(ids[0]!)).toMatchObject([{ status: 'answered', answer: 'parte uno, parte due' }]);
  expect(await server.turns(ids[1]!)).toMatchObject([{ status: 'failed', error: server.messages.failure }]);
  expect(await server.turns(ids[2]!)).toMatchObject([{ status: 'answered', answer: 'parte uno, parte due' }]);

  const fresh = await ProtocolClient.ready(server.url);
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(fresh.json().map(message => message.type)).toEqual(['session.ready']);
});

// Verification: Prova dell'errore dopo l'ammissione
test('closes the partial reply and transmits the failure message before turn.failed', async () => {
  const { reply } = scriptedReply(async function* () {
    yield text('Inizio della risposta');
    throw new Error('stack secret: provider key sk-123');
  });
  const server = await start({ reply, voice: true, language: 'en' });
  const client = await ProtocolClient.ready(server.url);
  for (const replyType of ['text', 'audio'] as const) {
    const result = await client.textTurn('domanda', { reply: replyType });
    expect(result.outputs).toHaveLength(2);
    const [partial, failure] = result.outputs;
    expect(partial!.ended && failure!.ended).toBe(true);
    const spoken = (output: typeof partial) => replyType === 'text' ? output!.text : output!.audio.toString('utf8');
    expect(spoken(partial)).toBe('Inizio della risposta');
    expect(spoken(failure)).toBe(publicMessages.en.failure);
    expect(failure!.start.turnId).toBe(result.accepted!.turnId);
    expect(result.sequence.indexOf('output.end')).toBeLessThan(result.sequence.lastIndexOf('output.start'));
    expect(result.final).toEqual({ type: 'turn.failed', turnId: result.accepted!.turnId,
      message: publicMessages.en.failure });
    expect(JSON.stringify(client.json())).not.toContain('sk-123');
    expect((await server.turns(result.accepted!.conversationId as string))[0])
      .toMatchObject({ status: 'failed', error: publicMessages.en.failure });
  }
});

// Verification: Prova della trascrizione e della risposta parlata
test('stores the transcript of a spoken turn and speaks the reply', async () => {
  const { reply } = scriptedReply(async function* (history) {
    yield text(`Hai detto: ${history.turns.at(-1)!.text}`);
    yield expectation(false);
  });
  const server = await start({ reply, voice: true });
  const client = await ProtocolClient.ready(server.url);
  for (const result of [await client.audioTurn(pcm('che ore sono')),
    await client.textTurn('che ore sono', { reply: 'audio' })]) {
    expect(result.accepted!.text).toBe('che ore sono');
    expect(result.outputs[0]!.audio.toString('utf8')).toBe('Hai detto: che ore sono');
    expect(await server.turns(result.accepted!.conversationId as string)).toMatchObject([
      { text: 'che ore sono', status: 'answered', answer: 'Hai detto: che ore sono' }]);
  }
});

// Verification: Prova dell'assenza di audio persistente
test('persists only the text of spoken turns and replies, never their audio', async () => {
  const { reply } = scriptedReply(async function* () {
    yield text('Sono le dieci.');
    yield expectation(false);
  });
  const server = await start({ reply, voice: true });
  const client = await ProtocolClient.ready(server.url);
  // About 64 KB of audio: a short utterance padded with silence-like filler bytes.
  const spoken = await client.audioTurn(pcm('che ore sono', 64_000), { reply: 'audio' });
  expect(spoken.final.type).toBe('turn.completed');
  expect(spoken.outputs[0]!.audio.length).toBeGreaterThan(0);
  expect(await server.turns(spoken.accepted!.conversationId as string)).toMatchObject([
    { text: 'che ore sono', answer: 'Sono le dieci.' }]);
  const files = await readdir(server.directory);
  expect(files.length).toBeGreaterThan(0);
  expect(files.every(name => name.startsWith('archive.sqlite'))).toBe(true);
  for (const name of files) {
    const content = (await readFile(join(server.directory, name))).toString('latin1');
    expect(content).not.toContain(' '.repeat(1_000));
  }
});

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address() as { port: number };
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return port;
}

// Verification: Prova dell'interruzione dei turni all'arresto
test('shutdown interrupts active turns, stores them and notifies open sessions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-session-shutdown-'));
  directories.push(directory);
  const port = await freePort();
  await writeConfigFile(join(directory, 'http.ts'), JSON.stringify({ host: '127.0.0.1', port }));
  await writeConfigFile(join(directory, 'conversations.ts'), JSON.stringify({
    archivePath: join(directory, 'archive.sqlite'), language: 'it' }));
  const never = gate();
  const { reply } = scriptedReply(async function* () {
    yield text('sto pensando');
    await never.waiting;
    yield expectation(false);
  });
  const runtime = await startConversationServer({
    AMBROGIO_HTTP_CONFIG_PATH: join(directory, 'http.ts'),
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: join(directory, 'conversations.ts'),
  }, join(directory, 'agents'), async () => ({ orchestrator: reply, async close() {} }));
  const client = await ProtocolClient.ready(`ws://127.0.0.1:${port}/api/session`);
  const requestId = client.requestId();
  client.startText(requestId);
  client.chunk(requestId, 'pensa');
  client.end(requestId);
  const accepted = await client.waitFor(message => message.type === 'turn.accepted');
  await client.waitFor(message => message.type === 'output.chunk');

  const closing = runtime.close();
  const result = await client.result(requestId);
  expect(result.final).toEqual({ type: 'turn.interrupted', turnId: accepted.turnId });
  expect(result.sequence.at(-2)).toBe('output.end');
  await closing;
  await client.closed;
  never.release();

  const restarted = await startConversationServer({
    AMBROGIO_HTTP_CONFIG_PATH: join(directory, 'http.ts'),
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: join(directory, 'conversations.ts'),
  }, join(directory, 'agents'), async () => ({ orchestrator: reply, async close() {} }));
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/conversations/${accepted.conversationId}`);
    expect((await response.json()).turns).toMatchObject([{ status: 'interrupted' }]);
  } finally { await restarted.close(); }
});
