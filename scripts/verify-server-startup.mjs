import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startConversationServer } from '../apps/server/dist/runtime/conversation-server.js';

const directory = await mkdtemp(join(tmpdir(), 'ambrogio-server-startup-'));
try {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No available port');
  await new Promise(resolve => probe.close(resolve));

  const http = join(directory, 'http.json');
  const conversations = join(directory, 'conversations.json');
  const agents = join(directory, 'agents');
  await mkdir(agents);
  await writeFile(http, JSON.stringify({ host: '127.0.0.1', port: address.port }));
  await writeFile(conversations, JSON.stringify({ archivePath: join(directory, 'archive.sqlite') }));
  await writeFile(join(agents, 'orchestrator.json'), JSON.stringify({
    instructions: 'Choose the agent.',
    llm: { provider: 'mistral', model: 'mistral-medium-latest', apiKey: 'startup-test-key' },
  }));
  // The orchestrator only chooses: at least one agent, here one without MCP, must answer.
  await writeFile(join(agents, 'generic.json'), JSON.stringify({
    description: 'Answers general questions.', instructions: 'Answer briefly.',
    llm: { provider: 'mistral', model: 'mistral-medium-latest', apiKey: 'startup-test-key' },
  }));

  const runtime = await startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: http,
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: conversations }, agents);
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/conversations`);
    const body = await response.json();
    if (response.status !== 200 || !Array.isArray(body.items)) {
      throw new Error(`Unexpected HTTP response: ${response.status}`);
    }
    console.log(`Node ${process.version}: compiled ESM server returned HTTP 200`);
  } finally { await runtime.close(); }
} finally { await rm(directory, { recursive: true, force: true }); }
