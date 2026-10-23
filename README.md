<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
    <img src=".github/logo-light.svg" alt="Ambrogio" width="320">
  </picture>
</p>

# Ambrogio — backend

**Ambrogio** is an open source home assistant that you host yourself, for example in your homelab. Members of the family talk to it by typing or by voice. Ambrogio keeps the conversation history and can hand each request to a specialised AI agent.

This repository holds the **backend**: the server that receives turns from clients, picks an agent and produces the answer. It also stores conversations and turns speech into text and text into speech. It owns the public protocol that every client uses.

| Repository | Role |
|---|---|
| **ambrogio-backend** (this one) | Conversation server, agents, speech, storage, public protocol |
| [ambrogio-cli](https://github.com/ambrogio-app/ambrogio-cli) | Terminal chat client |
| [ambrogio-satellite](https://github.com/ambrogio-app/ambrogio-satellite) | Voice satellite with wake word, microphone and speaker |
| [ambrogio-web](https://github.com/ambrogio-app/ambrogio-web) | Optional web chat client |

> Ambrogio is in early development. Its own messages are in English or Italian, and the configuration format may still change between versions.

## How it works

```mermaid
flowchart LR
    subgraph Clients
        CLI[ambrogio-cli<br/>terminal chat]
        SAT[ambrogio-satellite<br/>voice]
    end

    subgraph Backend[ambrogio-backend]
        API[HTTP API<br/>+ WebSocket session]
        CONV[Conversations module]
        STT[Speech-to-text<br/>Vosk]
        TTS[Text-to-speech<br/>sherpa-onnx + Piper voices]
        ORCH[Orchestrator agent]
        AG[Specialised agents]
        DB[(SQLite archive)]
    end

    LLM[LLM provider]
    MCP[MCP servers<br/>your tools and services]

    CLI -- text --> API
    SAT -- audio --> API
    API --> CONV
    CONV --> STT
    CONV --> TTS
    CONV --> ORCH
    ORCH -- chooses --> AG
    ORCH --> LLM
    AG --> LLM
    AG -. optional tools .-> MCP
    CONV --> DB
```

- **One protocol for text and voice.** Clients open a WebSocket session on `/api/session` with the `ambrogio.v1` subprotocol. One session carries turns for many conversations. A request can be text or 16 kHz PCM audio, and the client chooses whether the answer comes back as text or as audio. The message schema is in [`protocol/ambrogio-v1.schema.json`](protocol/ambrogio-v1.schema.json).
- **Shared conversations.** Every conversation is stored, so any client can continue it. A chat started in the terminal can go on by voice, and the other way round. Plain HTTP endpoints list conversations and return their history.
- **Agents.** For each turn an *orchestrator* chooses which *specialised agent* should answer. It does not answer itself. Each agent has its own instructions and model. An agent can also connect to an [MCP](https://modelcontextprotocol.io/) server and call its tools, for example to reach your home automation or other services.
- **Optional voice.** Speech recognition and synthesis run inside the backend process. No cloud speech service is needed. Text chat works without any voice setup.
- **Reliable turns.** A conversation handles one turn at a time, and separate conversations run in parallel. Once the backend accepts a turn, it finishes and stores that turn even if the client disconnects. Each turn ends with exactly one outcome: completed, failed, rejected or interrupted.

Two base connectors are planned for the first version:

- **Home Assistant**: read the state of your home devices and control them during a conversation.
- **Memory**: answer questions about earlier conversations, both typed and spoken, by retrieving relevant passages from the shared history (RAG). Ambrogio will provide both the MCP client and the MCP server for this connector.

### A turn, step by step

```mermaid
sequenceDiagram
    participant C as Client
    participant B as Backend
    participant O as Orchestrator
    participant A as Agent
    C->>B: session.hello
    B-->>C: session.ready
    C->>B: input.start → text or audio → input.end
    B->>B: transcribe (if audio), store turn
    B-->>C: turn.accepted
    B->>O: which agent should answer?
    O-->>B: agent
    B->>A: produce answer (may call MCP tools)
    A-->>B: answer
    B-->>C: output.start → text or audio → output.end
    B->>B: store outcome
    B-->>C: turn.completed (expectsReply)
```

## Dependencies

**Runtime**

- Node.js 24 or later; pnpm to build from source
- Linux, or Docker (the published image is `linux/amd64`)
- An API key for each LLM provider you use. Agents reach Mistral, OpenAI, Anthropic, Google Gemini or any OpenAI-compatible API through the [Vercel AI SDK](https://ai-sdk.dev/). The models must support tool calling and structured JSON output
- For voice only when running from source: a [Vosk](https://alphacephei.com/vosk/models) speech model and a voice for the same language. The Docker image includes Italian and English Vosk, Piper and Kokoro models; see [`voices/README.md`](voices/README.md)

**Main libraries**

| Area | Library |
|---|---|
| HTTP and WebSocket | Fastify, `@fastify/websocket`, `@fastify/helmet`, `@fastify/cors` |
| Storage | SQLite (`better-sqlite3`) with Kysely |
| Validation | TypeBox, Ajv |
| Agents | Vercel AI SDK (`ai`, `@ai-sdk/mistral`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`), MCP client |
| Speech | `vosk-koffi` (speech-to-text), `sherpa-onnx-node` (text-to-speech) |
| Logging | Pino, as JSON lines on stdout |

## Quick start

The server imports one TypeScript configuration module per active component. Each module exports a default object and may read `process.env`; the values are validated before the server starts. Configuration modules and the SQLite archive stay outside the image.

The ready modules are [`examples/http.ts`](examples/http.ts), [`examples/conversations.ts`](examples/conversations.ts), [`examples/voice.ts`](examples/voice.ts), and the agent modules in [`examples/agents/`](examples/agents/). The voice module is optional. To configure the container with Docker Compose, use [`compose.example.yaml`](compose.example.yaml):

```bash
AMBROGIO_VERSION=v0.8.0 MISTRAL_API_KEY=replace-me docker compose -f compose.example.yaml up -d
```

You can put the values mapped in the Compose example in a local `.env` file. For additional variables, add them under the service's `environment` section. The example mounts only the orchestrator and generic agent. To enable the Home Assistant agent, mount [`examples/agents/home-assistant.ts`](examples/agents/home-assistant.ts) at `/etc/ambrogio/agents/home-assistant.ts` and provide `AMBROGIO_HOME_ASSISTANT_MCP_URL` and `HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN` in the service environment.

**From source**

```bash
pnpm install --frozen-lockfile
pnpm build
AMBROGIO_HTTP_CONFIG_PATH="$PWD/examples/http.ts" \
AMBROGIO_CONVERSATIONS_CONFIG_PATH="$PWD/examples/conversations.ts" \
MISTRAL_API_KEY=replace-me \
node apps/server/dist/main.js
```

Set `AMBROGIO_VOICE_CONFIG_PATH` to [`examples/voice.ts`](examples/voice.ts) to enable Piper voice, or to [`examples/voice-kokoro.ts`](examples/voice-kokoro.ts) for Kokoro. Set `AMBROGIO_LANGUAGE` to `it` or `en` to select the active profile. You can override model paths and other fields through the variables read by those modules. Node.js 24 runs the `.ts` modules directly; use syntax supported by Node's built-in TypeScript type stripping.

If the server cannot start, it writes one JSON line with `"event":"server_startup_failed"` to stdout, whose `err.message` names the cause (for example `Invalid agent configuration: general` or `Agent MCP connection failed: home-assistant`), then prints `Unable to start HTTP server.` to stderr and exits with code 1.

**Home Assistant.** [`examples/agents/home-assistant.ts`](examples/agents/home-assistant.ts) provides an agent for Home Assistant's [Model Context Protocol Server](https://www.home-assistant.io/integrations/mcp_server/) integration. Mount it in `/etc/ambrogio/agents/`, then set `AMBROGIO_HOME_ASSISTANT_MCP_URL` and `HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN` in the container environment. Only the entities exposed to Assist are available to Ambrogio.

> Ambrogio has no user accounts or authentication. Run it on a trusted network, or behind a reverse proxy that allows only your own clients.

## Repository layout

```
apps/server/              runnable server: runtime, composition, entry point
packages/conversations/   "Conversations" business module (domain, application, adapters)
protocol/                 JSON schema of the ambrogio.v1 protocol
examples/                 ready configuration files, with placeholder credentials
voices/                   provenance of the bundled Vosk, Piper and Kokoro models
system-model/             engineering model (requirements, contracts, verifications)
```

The code follows a ports-and-adapters design. Domain and application logic do not depend on Node.js or on external libraries; adapters connect them to HTTP, SQLite, the LLM provider and the speech engines.

## Development

```bash
pnpm test        # Vitest suite, including real SQLite adapters
pnpm typecheck
pnpm build
```

Secrets must never enter the history. CI scans the whole history with [gitleaks](https://github.com/gitleaks/gitleaks) 8.30.1 on every push and pull request, and no image is published if the scan fails. Locally, a versioned pre-commit hook runs gitleaks on staged changes. Install gitleaks 8.30.1 on your `PATH` and enable the hook once per clone:

```bash
git config core.hooksPath .githooks
```

Ambrogio is developed model first with [Reqvire](https://reqvire.org/). Capabilities, requirements, contracts and verifications live in [`system-model/`](system-model/) and are recorded before the code changes. [`AGENTS.md`](AGENTS.md) describes the workflow.

## License

[MIT](LICENSE). The bundled voice models have their own licenses; see [`voices/README.md`](voices/README.md).
