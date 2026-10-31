# Elements

### Agente Memory d'esempio

Il backend deve fornire un file d'esempio dell'agente specializzato `memory`, collegato al server MCP della memoria del backend, con una descrizione che porta all'agente anche le richieste di ricordare qualcosa e le domande su piani, appuntamenti e scadenze della famiglia, e con istruzioni che chiedono di confermare brevemente, senza cercare, le richieste di ricordare, di cercare nello storico prima di rispondere a domande su conversazioni passate, di riprovare con sinonimi quando una ricerca non trova risultati e di indicare la data dei turni citati.

#### Details
La descrizione nomina le richieste di ricordare e le domande sulle scadenze della famiglia perché l'orchestratore le affidi all'agente Memory, che altrimenti finirebbero a un agente di conoscenza generale. Una richiesta di ricordare si conferma senza cercare perché ogni turno con risposta resta ricercabile. Il limite di 4 chiamate dei tool consente una ricerca e fino a tre nuovi tentativi con sinonimi.

#### Concept References
  * [Connettore MCP](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#connettore-mcp)
  * [Agente orchestratore](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#agente-orchestratore)

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [memory.json](../../examples/agents/memory.json)
  * specify: [Memoria delle conversazioni](../../../ambrogio-model/system-model/Capabilities/Product.md#memoria-delle-conversazioni)
---

### Intervallo di date della ricerca nella memoria

Dove la ricerca nella memoria indica una data iniziale, una data finale o entrambe, Ambrogio deve restituire soltanto i turni accettati in quelle date, estremi compresi, secondo il fuso orario della famiglia.

#### Concept References
  * [Turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#turno)

#### Metadata
  * type: requirement

#### Contract References
  * [Strumento MCP search_conversations](../Contracts/ConversationMemory.md#strumento-mcp-search_conversations)

#### Relations
  * satisfiedBy: [memory-mcp-server.adapter.ts](../../packages/conversations/src/adapters/in/mcp/memory-mcp-server.adapter.ts)
  * satisfiedBy: [postgres-conversation-memory-search.adapter.ts](../../packages/conversations/src/adapters/out/postgres/postgres-conversation-memory-search.adapter.ts)
  * specify: [Memoria delle conversazioni](../../../ambrogio-model/system-model/Capabilities/Product.md#memoria-delle-conversazioni)
---

### Ricerca testuale nello storico delle conversazioni

Quando l'agente del connettore Memory cerca un testo nello storico, Ambrogio deve restituire, fra i turni conclusi con risposta di tutte le conversazioni conservate, quelli che corrispondono alle parole cercate secondo la ricerca full-text nella lingua dell'installazione, dal più pertinente al meno pertinente, ciascuno con la sua conversazione, l'istante, il testo della famiglia e la risposta, entro il numero di risultati richiesto.

#### Details
La ricerca riconosce le forme della stessa parola, per esempio singolare e plurale o tempi diversi di un verbo, secondo il dizionario PostgreSQL della lingua. Le parafrasi con parole diverse sono affidate all'agente, che formula le ricerche e, secondo le istruzioni del suo file, riprova con sinonimi quando non trova risultati.

Alternative considerate e non adottate: la ricerca vettoriale con pgvector e la ricerca ibrida, che unisce full-text e similarità vettoriale. Riconoscerebbero anche le parafrasi, ma richiedono un provider di embedding, la sua configurazione e una pipeline di indicizzazione asincrona con recupero dei turni non indicizzati, che almeno raddoppiano il lavoro; per decisione della persona si parte con il solo full-text. L'immagine `pgvector/pgvector:pg18` resta in uso e lo strumento MCP non espone come i risultati sono trovati, così che la ricerca vettoriale si possa aggiungere con una migrazione senza cambiare lo strumento.

#### Concept References
  * [Conversazione](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#conversazione)
  * [Turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#turno)
  * [Connettore MCP](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#connettore-mcp)

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [memory-mcp-server.adapter.ts](../../packages/conversations/src/adapters/in/mcp/memory-mcp-server.adapter.ts)
  * satisfiedBy: [postgres-conversation-memory-search.adapter.ts](../../packages/conversations/src/adapters/out/postgres/postgres-conversation-memory-search.adapter.ts)
  * satisfiedBy: [conversation-memory-search.port.ts](../../packages/conversations/src/application/conversation-memory-search.port.ts)
  * satisfiedBy: [search-conversations.use-case.ts](../../packages/conversations/src/application/search-conversations/search-conversations.use-case.ts)
  * specify: [Memoria delle conversazioni](../../../ambrogio-model/system-model/Capabilities/Product.md#memoria-delle-conversazioni)
---

### Server MCP della memoria nel backend

Il backend deve offrire il server MCP del connettore Memory nel proprio processo, sul percorso `/mcp/memory` del proprio listener HTTP, fuori dal prefisso `/api`, leggendo l'archivio delle conversazioni del backend.

#### Details
Il percorso fuori da `/api` permette a un reverse proxy che inoltra soltanto `/api/*` di non esporlo. L'agente Memory si collega al server MCP del proprio backend, possibile perché i connettori MCP si collegano dopo l'apertura dell'ascolto. Una richiesta con `Origin` è rifiutata perché una pagina web non possa usare il server MCP attraverso il browser di chi la visita; i client MCP lato server, come gli agenti, non inviano `Origin`. Le risposte d'errore proprie della rotta seguono il trasporto MCP e non il formato Problem Details dell'API HTTP, perché i client sono client MCP.

Alternative considerate e non adottate: un processo o un container separato sullo stesso database, che aggiunge un servizio da configurare e rilasciare; il trasporto MCP in processo, che richiedeva un'estensione del formato dei file degli agenti ed era necessario soltanto finché i connettori si collegavano prima dell'ascolto; un servizio di memoria esistente, come mem0 o il server MCP di Qdrant, che conserva ricordi scritti esplicitamente dall'agente e non indicizza l'archivio di Ambrogio.

#### Concept References
  * [Connettore MCP](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#connettore-mcp)
  * [Backend](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#backend)

#### Metadata
  * type: requirement

#### Contract References
  * [Strumento MCP search_conversations](../Contracts/ConversationMemory.md#strumento-mcp-search_conversations)

#### Relations
  * derivedFrom: [Connessione dei connettori MCP dopo l'apertura dell'ascolto](FamilyConversation.md#connessione-dei-connettori-mcp-dopo-lapertura-dellascolto)
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [http-surface.ts](../../apps/server/src/composition/http-surface.ts)
  * satisfiedBy: [memory-mcp-server.adapter.ts](../../packages/conversations/src/adapters/in/mcp/memory-mcp-server.adapter.ts)
  * specify: [Memoria delle conversazioni](../../../ambrogio-model/system-model/Capabilities/Product.md#memoria-delle-conversazioni)
---

### Turni ricercabili dalla loro conclusione

Quando un turno si conclude con risposta, Ambrogio deve renderlo ricercabile nella memoria dal momento in cui la conclusione è confermata, senza un'elaborazione separata che possa restare indietro o fallire.

#### Details
Gli indici full-text sono indici del database sui turni, aggiornati da PostgreSQL nella stessa transazione della conclusione.

Alternativa non adottata: una colonna `tsvector` generata, la cui configurazione di ricerca testuale resterebbe fissata nella migrazione, mentre la lingua dipende da `AMBROGIO_LANGUAGE`.

#### Concept References
  * [Turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#turno)

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [migrations.ts](../../packages/conversations/src/adapters/out/postgres/migrations.ts)
  * specify: [Memoria delle conversazioni](../../../ambrogio-model/system-model/Capabilities/Product.md#memoria-delle-conversazioni)
---

