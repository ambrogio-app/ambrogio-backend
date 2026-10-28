// The distributed agent files are data only: they load unchanged with placeholder credentials taken
// from the environment, and they contain no secret.
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { loadAgentConfigs } from '../../src/runtime/agent-config.js';

const examples = new URL('../../../../examples/agents/', import.meta.url);
const placeholders = { MISTRAL_API_KEY: '<MISTRAL_API_KEY>', MUSIC_ASSISTANT_TOKEN: '<MUSIC_ASSISTANT_TOKEN>' };
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function install(...names: string[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-agent-examples-'));
  directories.push(directory);
  for (const name of names) await copyFile(new URL(name, examples), join(directory, name));
  return directory;
}

// Verification: Prova della configurazione pronta di Music Assistant
test('the ready Music Assistant agent is accepted unchanged by the agent loader', async () => {
  const directory = await install('orchestrator.json', 'music.json');
  const { specialists } = await loadAgentConfigs(directory, placeholders);
  expect(specialists).toHaveLength(1);
  const agent = specialists[0]!;
  expect(agent.id).toBe('music');
  expect(agent.maxToolCalls).toBe(6);
  expect(agent.llm).toEqual({ provider: 'mistral', model: 'mistral-medium-latest', apiKey: '<MISTRAL_API_KEY>' });
  expect(new URL(agent.mcp!.url).pathname).toBe('/mcp/v1');
  expect(agent.mcp!.auth).toEqual({ type: 'bearer', token: '<MUSIC_ASSISTANT_TOKEN>' });
  expect(agent.mcp!.tools).toEqual(['library_search_tracks', 'library_search_albums', 'library_search_artists',
    'library_list_library_playlists', 'players_list_players', 'playback_play_media', 'playback_pause',
    'playback_resume', 'playback_stop', 'playback_next_track', 'volume_volume_set', 'queue_add_to_queue',
    'media_add_to_favorites', 'media_remove_from_favorites']);
  expect(agent.description).toMatch(/Music Assistant/);
  expect(agent.instructions).not.toMatch(/Italian|selected language/);
  expect(agent.instructions).toMatch(/first find the item, then call players_list_players/);
  expect(agent.instructions).toMatch(/If no player is named and only one player is available, use it; otherwise ask/);
  expect(agent.instructions).toMatch(/only on the player in question/);
  expect(agent.instructions).toMatch(/Add or remove favorites only when asked/);
  expect(agent.instructions).toMatch(/up to three searches/);
  expect(agent.instructions).toMatch(/Never invent tracks, players or actions/);
  expect(agent.instructions).toMatch(/without lists or formatting, because the answer may be spoken/);
  await expect(loadAgentConfigs(directory, { MISTRAL_API_KEY: '<MISTRAL_API_KEY>' })).rejects
    .toThrow('Missing environment variable MUSIC_ASSISTANT_TOKEN for agent music');
  expect(await readFile(new URL('music.json', examples), 'utf8'))
    .toContain('"tokenEnv": "MUSIC_ASSISTANT_TOKEN"');
});
