# Elements

### API dei provider di modelli linguistici

Fonte: le API dei fornitori raggiunte dai pacchetti di provider ufficiali di AI SDK alle versioni fissate nel lockfile del backend, documentate da ciascun fornitore. L'adapter della risposta usa, per ciascun valore di `llm.provider`:

| Provider | API e versione | Endpoint predefinito | Credenziale |
|---|---|---|---|
| `mistral` | API Mistral AI `v1`, Chat Completions | `https://api.mistral.ai/v1/chat/completions` | `Authorization: Bearer` |
| `openai` | API OpenAI `v1`, Responses | `https://api.openai.com/v1/responses` | `Authorization: Bearer` |
| `anthropic` | API Anthropic Messages `v1`, intestazione `anthropic-version: 2023-06-01` | `https://api.anthropic.com/v1/messages` | `x-api-key` |
| `google` | API Gemini di Google AI Studio `v1beta`, `streamGenerateContent` | `https://generativelanguage.googleapis.com/v1beta/models/<modello>:streamGenerateContent` | `x-goog-api-key` |
| `openai-compatible` | API Chat Completions compatibile con OpenAI, con `response_format` di tipo `json_schema` | `<baseURL>/chat/completions` | `Authorization: Bearer` |

Fonti dell'informazione: gli indirizzi e le intestazioni inviati dai pacchetti `@ai-sdk/*` del lockfile, osservati dalla prova dell'adapter; la documentazione dei fornitori: https://docs.mistral.ai/api/ , https://platform.openai.com/docs/api-reference/responses , https://docs.anthropic.com/en/api/versioning , https://ai.google.dev/api . La versione dell'API cambia soltanto con l'aggiornamento del pacchetto di provider che la usa, governato dal lockfile.

Modello d'esempio: gli esempi distribuiti usano `mistral-medium-latest`, un alias mobile che Mistral AI assegna all'ultima versione di Mistral Medium; il modello effettivo cambia quando Mistral AI sposta l'alias, senza una modifica di Ambrogio. È il modello consigliato per l'orchestratore. Il prodotto non fissa un modello: lo sceglie l'installazione nel file di ciascun agente, e il modello scelto deve supportare tool calling e output strutturato con schema JSON.

Prova d'integrazione: «Prova della configurazione dell'adapter AI SDK» controlla per ogni provider indirizzo, credenziale e corpo della richiesta con risposte controllate; il supporto reale di tool calling e output strutturato è osservato soltanto con il modello linguistico reale della «Dimostrazione del connettore Home Assistant su un'installazione reale», che non registra provider né modello usati.

#### Metadata
  * type: source

#### Relations
  * define: [Risposta testuale nella conversazione](../Requirements/FamilyConversation.md#risposta-testuale-nella-conversazione)
---

### Modelli vocali scaricati nell'immagine del backend

Fonte: la release `tts-models` di k2-fsa/sherpa-onnx, https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models , per le voci Piper e il modello Kokoro, e la release `asr-models` della stessa organizzazione, https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models , per il modello Nemotron. Le due release non hanno versioni: ogni archivio è identificato dal nome e dall'impronta SHA-256 fissata. La build scarica gli archivi seguenti e ne verifica l'impronta prima dell'estrazione; la directory estratta di ciascuno ha il nome dell'archivio senza estensione.

| Archivio | Uso | Origine | SHA-256 | Licenza |
|---|---|---|---|---|
| `sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11.tar.bz2` | Trascrizione in streaming multilingue, italiano e inglese compresi | Release `asr-models` | `c6bf5e0df765f9d5b43bc9e0536d4b4b3e7d40bdf5ecf13e45f134c51c05ae3a` | OpenMDW 1.1, modello Nemotron 3.5 ASR streaming 0.6B di NVIDIA |
| `vits-piper-it_IT-riccardo-x_low.tar.bz2` | Sintesi Piper italiana | Release `tts-models` | `8ad0791558ae2b3e96054fc5756ae3ae2f6457fb1765bc01f43bbab85e0a7021` | MIT, voce di rhasspy/piper-voices |
| `vits-piper-it_IT-paola-medium.tar.bz2` | Sintesi Piper italiana | Release `tts-models` | `7541f75778afa164e44e34baaef63befad7698595df26a95ca944b63ef1a16b4` | MIT, voce di rhasspy/piper-voices |
| `vits-piper-en_US-kristin-medium.tar.bz2` | Sintesi Piper inglese | Release `tts-models` | `c2206f572df2956c50b1ae3367eebce3853c663e890cba8048cd62b1e4dbe6c7` | MIT, voce di rhasspy/piper-voices |
| `kokoro-multi-lang-v1_0.tar.bz2` | Sintesi Kokoro multilingue, voci italiane e inglesi | Release `tts-models` | `c5f7e2d2caf082bc1d20fb70334a61d99d20b484500aad32e7cf84c128ea3298` | Apache-2.0, file `LICENSE` nell'archivio |

L'archivio Nemotron contiene il modello Nemotron 3.5 ASR streaming 0.6B di NVIDIA, con blocchi da 560 ms, convertito per sherpa-onnx, con encoder, decoder e joiner int8, il file `tokens.txt`, un `README.md` e registrazioni di prova; l'immagine conserva soltanto `encoder.int8.onnx`, `decoder.int8.onnx`, `joiner.int8.onnx` e `tokens.txt`. La licenza OpenMDW 1.1 richiede che una distribuzione conservi una copia della licenza e le note d'origine: l'immagine aggiunge alla directory del modello il testo della licenza come `LICENSE`, da `voices/OpenMDW-1.1.txt`, e `voices/README.md` riporta l'origine.

Fonti dell'informazione: `scripts/fetch-speech-models.mjs` e `voices/README.md` del backend; la licenza e le lingue di Nemotron dalla scheda del modello https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b e il testo della licenza da https://openmdw.ai/license/1-1/ , le licenze delle voci dal catalogo https://huggingface.co/rhasspy/piper-voices e dal file `LICENSE` dell'archivio Kokoro.

Prova d'integrazione: la build dell'immagine verifica le impronte con `scripts/fetch-speech-models.mjs`; «Prova del catalogo vocale bilingue dell'immagine» e «Prova delle voci incluse e sostituibili» caricano i modelli nell'immagine e producono trascrizioni e sintesi; «Prova della coerenza dei modelli vocali registrati» confronta questa tabella con lo script di download e con `voices/README.md`.

#### Metadata
  * type: source

#### Relations
  * define: [Modelli vocali italiani e inglesi inclusi](../Requirements/ServerFoundation.md#modelli-vocali-italiani-e-inglesi-inclusi)
---

### Protocollo Model Context Protocol

Fonte: la specifica del Model Context Protocol, https://modelcontextprotocol.io/specification , e il client ufficiale `@modelcontextprotocol/client` alla versione fissata nel lockfile del backend.

Revisione da cui Ambrogio dipende: `2025-03-26` o successiva fra le revisioni con inizializzazione, perché il trasporto Streamable HTTP è definito a partire da quella revisione. Il client del lockfile propone nell'inizializzazione la revisione `2025-11-25` e accetta dal server anche `2025-06-18`, `2025-03-26`, `2024-11-05` e `2024-10-07`; con le ultime due il trasporto Streamable HTTP non è definito. Le parti del protocollo usate sono l'inizializzazione, la scoperta e l'invocazione degli strumenti, la lista e la lettura dei prompt e l'autenticazione Bearer o OAuth `client_credentials` sul trasporto Streamable HTTP.

Fonti dell'informazione: le costanti `LATEST_PROTOCOL_VERSION` e `SUPPORTED_PROTOCOL_VERSIONS` del pacchetto `@modelcontextprotocol/core` installato con il client, e la pagina delle revisioni della specifica, https://modelcontextprotocol.io/specification/versioning .

Prova d'integrazione: «Prova del client MCP comune», «Prova del Bearer token per i connettori MCP» e «Prova delle istruzioni del server MCP» usano server Streamable HTTP di prova che rispondono con la revisione `2025-11-25`; la revisione negoziata con Home Assistant è osservata soltanto dalla «Dimostrazione del connettore Home Assistant su un'installazione reale».

#### Metadata
  * type: source

#### Relations
  * define: [Trasporto HTTP dei connettori MCP](../Requirements/FamilyConversation.md#trasporto-http-dei-connettori-mcp)
---

### Server MCP di Home Assistant

Fonte: l'integrazione «Model Context Protocol Server» (`mcp_server`) di Home Assistant, documentata in https://www.home-assistant.io/integrations/mcp_server/ , con il sorgente in `homeassistant/components/mcp_server/` di https://github.com/home-assistant/core .

Versione da cui Ambrogio dipende: Home Assistant 2025.11.0 o successiva. L'integrazione è introdotta in Home Assistant 2025.2 secondo la documentazione, ma fino alla 2025.10 offre soltanto il trasporto SSE su `/mcp_server/sse`, che Ambrogio non usa; il sorgente dell'integrazione alla release 2025.11.0 è il primo che registra l'endpoint Streamable HTTP `/api/mcp`. Quella release usa l'SDK Python `mcp` 1.14.1, che risponde con la revisione `2025-06-18` del protocollo definito da «Protocollo Model Context Protocol». La documentazione e le note di rilascio non indicano la release che aggiunge l'endpoint: l'informazione viene dal sorgente ai tag delle release.

Interfaccia usata: endpoint `/api/mcp` con trasporto Streamable HTTP; autenticazione con un token di accesso di lunga durata di Home Assistant come Bearer, non con OAuth; strumenti limitati alle entità esposte ad Assist; capacità `prompts` con un prompt senza argomenti che contiene le indicazioni d'uso degli strumenti e l'elenco delle aree e dei dispositivi esposti.

Prova d'integrazione: «Dimostrazione del connettore Home Assistant su un'installazione reale». L'installazione di riferimento usa Home Assistant 2025.12.5, la versione che Home Assistant registra nella propria configurazione; la versione dichiarata come dipendenza resta la minima che offre l'interfaccia usata secondo il sorgente di Home Assistant. «Prova della configurazione pronta di Home Assistant» controlla il file d'esempio senza un'istanza di Home Assistant.

#### Metadata
  * type: source

#### Relations
  * define: [Connettore Home Assistant tramite il server MCP di Home Assistant](../Requirements/FamilyConversation.md#connettore-home-assistant-tramite-il-server-mcp-di-home-assistant)
---
