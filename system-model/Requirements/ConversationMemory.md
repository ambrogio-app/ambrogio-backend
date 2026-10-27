# Elements

### Ricerca testuale nello storico delle conversazioni

Quando l'agente del connettore Memory cerca un testo nello storico, Ambrogio deve restituire, fra i turni conclusi con risposta di tutte le conversazioni conservate, quelli che corrispondono alle parole cercate secondo la ricerca full-text nella lingua dell'installazione, dal più pertinente al meno pertinente, ciascuno con la sua conversazione, l'istante, il testo della famiglia e la risposta, entro il numero di risultati richiesto.

#### Details
La ricerca riconosce le forme della stessa parola, per esempio singolare e plurale o tempi diversi di un verbo, secondo il dizionario PostgreSQL della lingua. Le parafrasi con parole diverse sono affidate all'agente, che formula le ricerche e, secondo le istruzioni del suo file, riprova con sinonimi quando non trova risultati.

Alternative considerate e non adottate: la ricerca vettoriale con pgvector e la ricerca ibrida, che unisce full-text e similarità vettoriale. Riconoscerebbero anche le parafrasi, ma richiedono un provider di embedding, la sua configurazione e una pipeline di indicizzazione asincrona con recupero dei turni non indicizzati, che almeno raddoppiano il lavoro; per decisione della persona si parte con il solo full-text. L'immagine `pgvector/pgvector:pg18` resta in uso e lo strumento MCP non espone come i risultati sono trovati, così che la ricerca vettoriale si possa aggiungere con una migrazione senza cambiare lo strumento.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Memoria delle conversazioni](../../../ambrogio-model/system-model/Capabilities/Product.md#memoria-delle-conversazioni)
---

### Intervallo di date della ricerca nella memoria

Dove la ricerca nella memoria indica una data iniziale, una data finale o entrambe, Ambrogio deve restituire soltanto i turni accettati in quelle date, estremi compresi, secondo il fuso orario della famiglia.

#### Metadata
  * type: requirement

#### Contract References
  * [Strumento MCP search_conversations](../Contracts/ConversationMemory.md#strumento-mcp-search_conversations)

#### Relations
  * specify: [Memoria delle conversazioni](../../../ambrogio-model/system-model/Capabilities/Product.md#memoria-delle-conversazioni)
---

### Turni ricercabili dalla loro conclusione

Quando un turno si conclude con risposta, Ambrogio deve renderlo ricercabile nella memoria dal momento in cui la conclusione è confermata, senza un'elaborazione separata che possa restare indietro o fallire.

#### Details
Gli indici full-text sono indici del database sui turni, aggiornati da PostgreSQL nella stessa transazione della conclusione.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Memoria delle conversazioni](../../../ambrogio-model/system-model/Capabilities/Product.md#memoria-delle-conversazioni)
---

### Server MCP della memoria nel backend

Il backend deve offrire il server MCP del connettore Memory nel proprio processo, sul percorso `/mcp/memory` del proprio listener HTTP, fuori dal prefisso `/api`, leggendo l'archivio delle conversazioni del backend.

#### Details
Il percorso fuori da `/api` permette a un reverse proxy che inoltra soltanto `/api/*` di non esporlo. L'agente Memory si collega dopo l'apertura dell'ascolto, secondo «Connessione dei connettori MCP dopo l'apertura dell'ascolto».

Alternative considerate e non adottate: un processo o un container separato sullo stesso database, che aggiunge un servizio da configurare e rilasciare; il trasporto MCP in processo, che richiedeva un'estensione del formato dei file degli agenti ed era necessario soltanto finché i connettori si collegavano prima dell'ascolto; un servizio di memoria esistente, come mem0 o il server MCP di Qdrant, che conserva ricordi scritti esplicitamente dall'agente e non indicizza l'archivio di Ambrogio.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Memoria delle conversazioni](../../../ambrogio-model/system-model/Capabilities/Product.md#memoria-delle-conversazioni)
---

### Agente Memory d'esempio

Il backend deve fornire un file d'esempio dell'agente specializzato `memory`, collegato al server MCP della memoria del backend, con istruzioni che chiedono di cercare nello storico prima di rispondere a domande su conversazioni passate, di riprovare con sinonimi quando una ricerca non trova risultati e di indicare la data dei turni citati.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Memoria delle conversazioni](../../../ambrogio-model/system-model/Capabilities/Product.md#memoria-delle-conversazioni)
---
