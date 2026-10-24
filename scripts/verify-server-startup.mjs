import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareConversationServer } from '../apps/server/dist/runtime/conversation-server.js';
import { createBaseLogger } from '../apps/server/dist/runtime/logger.js';
import { listen } from '../apps/server/dist/runtime/server-process.js';

const writeAgent = (filename, value) => writeFile(filename, `${JSON.stringify(value)}\n`);

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

  const agents = join(directory, 'agents');
  await mkdir(agents);
  const llm = { provider: 'mistral', model: 'mistral-medium-latest', apiKeyEnv: 'MISTRAL_API_KEY' };
  await writeAgent(join(agents, 'orchestrator.json'), { instructions: 'Choose the agent.', llm });
  // The orchestrator only chooses: at least one agent, here one without MCP, must answer.
  await writeAgent(join(agents, 'generic.json'), {
    description: 'Answers general questions.', instructions: 'Answer briefly.', llm,
  });

  // Production values only: every setting without a production default is explicit.
  // Built without listening, then activated as the process runner does.
  const runtime = await prepareConversationServer({ AMBROGIO_ENV: 'production', AMBROGIO_HTTP_HOST: '127.0.0.1',
    AMBROGIO_HTTP_PORT: String(address.port), AMBROGIO_PUBLIC_HTTPS: 'false',
    AMBROGIO_ARCHIVE_PATH: join(directory, 'archive.sqlite'), AMBROGIO_AGENTS_DIR: agents,
    MISTRAL_API_KEY: 'startup-test-key' }, createBaseLogger());
  try {
    await listen(runtime);
    const response = await fetch(`http://127.0.0.1:${address.port}/api/conversations`);
    const body = await response.json();
    if (response.status !== 200 || !Array.isArray(body.items)) {
      throw new Error(`Unexpected HTTP response: ${response.status}`);
    }
    console.log(`Node ${process.version}: compiled ESM server returned HTTP 200`);
  } finally { await runtime.close(); }
} finally { await rm(directory, { recursive: true, force: true }); }
