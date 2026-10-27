# Elements

### Strumento MCP search_conversations

Il server MCP della memoria dichiara un solo strumento, `search_conversations`, con descrizione `Search the family's past conversations by words. Returns matching exchanges, most relevant first, with their date.` e questo schema degli argomenti:

| Argomento | Tipo | Obbligatorio | Regole |
|---|---|---|---|
| `query` | stringa | sì | da 1 a 500 caratteri dopo aver tolto gli spazi iniziali e finali; sintassi di `websearch_to_tsquery`: parole, frasi fra virgolette, `or`, `-` per escludere |
| `from` | stringa | no | data `YYYY-MM-DD`, primo giorno compreso |
| `to` | stringa | no | data `YYYY-MM-DD`, ultimo giorno compreso, non precedente a `from` |
| `limit` | intero | no | da 1 a 20; 5 se assente |

Le date sono giorni del calendario nel fuso orario di `AMBROGIO_TIME_ZONE`. Lo strumento cerca soltanto nei turni con stato `answered`: i turni in elaborazione, conclusi con errore o interrotti non compaiono. Il testo della ricerca è confrontato con il testo della famiglia e con la risposta del turno, con la configurazione di ricerca testuale `italian` quando `AMBROGIO_LANGUAGE` è `it` e `english` quando è `en`. I risultati sono ordinati per `ts_rank_cd` decrescente, poi per istante di accettazione decrescente e infine per identificativo del turno.

Il risultato riuscito ha `structuredContent` con `results`, un array di oggetti con `conversationId` e `turnId`, gli UUID conservati, `acceptedAt`, l'istante di accettazione in ISO 8601 con lo scostamento del fuso orario della famiglia, `question`, il testo della famiglia, e `answer`, la risposta; `question` e `answer` più lunghi di 1000 caratteri sono troncati a 1000 caratteri seguiti da `…`. Il contenuto testuale del risultato è lo stesso oggetto serializzato in JSON, e lo strumento dichiara lo schema di `structuredContent` come `outputSchema`. Nessun turno corrispondente, compresa una ricerca fatta soltanto di parole vuote per la lingua, dà `results` vuoto. Agente che ha risposto e azioni del turno non compaiono nei risultati.

Argomenti invalidi danno un risultato con `isError: true` e un testo che nomina l'argomento e la regola violata, senza interrogare l'archivio. Un guasto dell'archivio dà un risultato con `isError: true` e il testo fisso `Conversation search failed`, e il server registra il guasto con livello `error` ed `event: "conversation_memory_search_failed"`; il testo della ricerca non compare nei log.

#### Metadata
  * type: input-output

#### Relations
  * define: [Ricerca testuale nello storico delle conversazioni](../Requirements/ConversationMemory.md#ricerca-testuale-nello-storico-delle-conversazioni)
---

### Indici full-text dei turni

La migrazione `002_turn_search` crea due indici GIN su espressione della tabella `turns`, limitati alle righe con `status = 'answered'`: `turns_search_italian` su `to_tsvector('italian', text || ' ' || answer)` e `turns_search_english` su `to_tsvector('english', text || ' ' || answer)`. La ricerca usa la stessa espressione con la configurazione della lingua dell'installazione e `websearch_to_tsquery` con la stessa configurazione, così che PostgreSQL usi l'indice corrispondente. Gli indici non aggiungono colonne: i tipi generati dello schema non cambiano. PostgreSQL li aggiorna nella stessa transazione della conclusione del turno.

Una colonna `tsvector` generata non è adottata perché la sua configurazione resterebbe fissata nella migrazione, mentre la lingua dipende da `AMBROGIO_LANGUAGE`. L'archivio non usa l'estensione `unaccent`: una parola scritta senza l'accento previsto non corrisponde.

La lettura è una porta Application `ConversationMemorySearch`, con un proprio adapter PostgreSQL che non scrive, secondo le regole delle porte di lettura dell'archivio.

#### Metadata
  * type: specification

#### Relations
  * define: [Turni ricercabili dalla loro conclusione](../Requirements/ConversationMemory.md#turni-ricercabili-dalla-loro-conclusione)
---

### Server MCP della memoria

Il server MCP della memoria usa `@modelcontextprotocol/server` della stessa versione del client MCP del lockfile, con trasporto Streamable HTTP senza stato, sulla rotta `POST /mcp/memory` del server Fastify del backend; `GET` e `DELETE` su quel percorso rispondono `405`. Si presenta con il nome `ambrogio-memory` e la versione del package server, dichiara soltanto la capacità `tools` e offre soltanto «Strumento MCP search_conversations». Segue la revisione del protocollo di «Protocollo Model Context Protocol».

Il percorso non richiede autenticazione applicativa, come il resto del backend, e non appartiene all'API HTTP `v1`. Una richiesta con l'intestazione `Origin` riceve `403` senza raggiungere il server MCP, così che una pagina web non possa usarlo attraverso il browser di chi la visita; i client MCP lato server, come gli agenti, non inviano `Origin`. Il server MCP è costruito dalla composition root con la porta di lettura della memoria e la configurazione già validata, ed è registrato prima dell'apertura dell'ascolto.

#### Metadata
  * type: specification

#### Relations
  * define: [Server MCP della memoria nel backend](../Requirements/ConversationMemory.md#server-mcp-della-memoria-nel-backend)
---

### Agente Memory d'esempio nel repository

Il file d'esempio è `examples/agents/memory.json`. La descrizione per l'orchestratore è `Searches the family's past conversations to answer questions about what was said before.`; `mcp.url` è `http://127.0.0.1:3000/mcp/memory`, l'indirizzo del backend nel proprio container con la porta degli esempi; `mcp.tools` elenca `search_conversations`; `maxToolCalls` è 4, per una ricerca e fino a tre nuovi tentativi con sinonimi. Il modello è quello degli altri esempi. Le istruzioni, in inglese come gli altri esempi, chiedono di cercare prima di rispondere a domande su conversazioni passate, di riprovare con sinonimi o parole più generali quando non ci sono risultati, di dire quando non trova nulla invece di inventare e di indicare la data delle conversazioni citate.

#### Metadata
  * type: specification

#### Relations
  * define: [Agente Memory d'esempio](../Requirements/ConversationMemory.md#agente-memory-desempio)
---
