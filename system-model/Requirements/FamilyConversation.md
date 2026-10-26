# Elements

### Adapter tecnici nel package Conversazioni

Quando un componente tecnico esterno viene integrato come ingresso del modulo «Conversazioni» o come implementazione di una sua porta Application, l'adapter deve risiedere nel package «Conversazioni», rispettivamente in `src/adapters/in/` o `src/adapters/out/`.

#### Details
Origine: baseline Reqvire «Technical adapters inside the module package», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * derivedFrom: [Struttura in layer dei componenti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#struttura-in-layer-dei-componenti)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Agente specializzato senza connettore MCP

Quando il file di un agente specializzato non contiene un connettore MCP, Ambrogio deve attivare l'agente e, quando l'orchestratore lo sceglie, fargli formulare la risposta con il proprio modello e le proprie istruzioni, senza strumenti.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Assemblaggio delle porte nella composition root

Quando l'applicazione server assembla il modulo «Conversazioni», deve scegliere e fornire le implementazioni delle porte Application tramite la propria composition root.

#### Details
Origine: baseline Reqvire «Explicit wiring without service locator», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * derivedFrom: [Capacità dell'ambiente fornite dalla composition root](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#capacità-dellambiente-fornite-dalla-composition-root)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Assenza di accodamento dei turni

Quando Ambrogio non è in grado di avviare l'elaborazione di un nuovo turno al momento della richiesta, deve rifiutarlo come esito previsto senza accettarlo né conservarlo per eseguirlo in seguito.

#### Metadata
  * type: requirement

#### Contract References
  * [Occupazione della conversazione e ammissione dei turni](../Contracts/FamilyConversation.md#occupazione-della-conversazione-e-ammissione-dei-turni)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Autenticazione Bearer del client MCP

Quando un agente specializzato accede al proprio server MCP tramite Streamable HTTP, il client MCP comune deve poter usare un Bearer token, letto dalla variabile d'ambiente nominata nel file di quell'agente, per autenticare le richieste verso l'endpoint configurato.

#### Metadata
  * type: requirement

#### Contract References
  * [Formato JSON dei file degli agenti](../Contracts/FamilyConversation.md#formato-json-dei-file-degli-agenti)

#### Relations
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Autenticazione OAuth tra servizi del client MCP

Quando il file di un agente specializzato richiede OAuth `client_credentials`, il client MCP comune deve ottenere e usare un token di accesso per il server MCP di quell'agente, senza richiedere un accesso interattivo della persona e senza presentare le credenziali a un authorization server diverso da quello configurato.

#### Metadata
  * type: requirement

#### Contract References
  * [Formato JSON dei file degli agenti](../Contracts/FamilyConversation.md#formato-json-dei-file-degli-agenti)

#### Relations
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Avvio dell'ingresso dei turni conversazionali

Quando il server avvia la conversazione con agenti configurati, deve rendere disponibile il canale conversazionale insieme alle rotte HTTP di elenco e storico, dopo aver validato i file degli agenti e preparato i loro connettori.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [http-surface.ts](../../apps/server/src/composition/http-surface.ts)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Azioni dell'agente nello storico

Quando un agente specializzato con connettore MCP conclude un turno con risposta dopo aver chiamato strumenti, Ambrogio deve conservare con il turno le chiamate eseguite e i loro risultati e, nei turni successivi della stessa conversazione, deve presentarle soltanto allo stesso agente, senza mostrarle all'orchestratore, agli altri agenti o ai client.

#### Details
Tutti i framework esaminati conservano nello storico le chiamate agli strumenti e i loro risultati: la persistenza dei messaggi di AI SDK, il registro conversazionale di Home Assistant, il contesto di LiveKit Agents, Pipecat e le sessioni di OpenAI Agents SDK. Con le proprie azioni nello storico l'agente sa su quale dispositivo ha agito, per esempio quando la famiglia dice «spegnila» dopo aver acceso una luce, e un turno con azioni resta un messaggio valido per il provider anche quando il testo della risposta è breve.

Sono state considerate e non adottate: mostrare le azioni a tutti gli agenti, che vedrebbero chiamate a strumenti di cui non dispongono; mostrarle anche all'orchestratore, che sceglie l'agente dai testi e dalle descrizioni; esporle nell'API HTTP dello storico, che cambierebbe un'interfaccia pubblica per un dato che serve soltanto ai modelli.

Fonti: persistenza dei messaggi di AI SDK, https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence ; contesto di LiveKit Agents, https://docs.livekit.io/agents/logic/chat-context/ ; memoria delle sessioni di OpenAI Agents SDK, https://developers.openai.com/cookbook/examples/agents_sdk/session_memory .

#### Metadata
  * type: requirement

#### Contract References
  * [API dei provider di modelli linguistici](../Contracts/ExternalContracts.md#api-dei-provider-di-modelli-linguistici)
  * [Archivio SQLite con Kysely](../Contracts/FamilyConversation.md#archivio-sqlite-con-kysely)

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * satisfiedBy: [migrations.ts](../../packages/conversations/src/adapters/out/sqlite/migrations.ts)
  * satisfiedBy: [sqlite-turn-mapper.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-mapper.ts)
  * satisfiedBy: [complete-turn.use-case.ts](../../packages/conversations/src/application/complete-turn.use-case.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * satisfiedBy: [get-conversation.use-case.ts](../../packages/conversations/src/application/get-conversation.use-case.ts)
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Caricamento completo del turno

Quando il repository del turno carica un turno dall'archivio, deve distinguere prima della ricostruzione il turno assente, che è assenza normale, il turno con record completi e coerenti, e il turno il cui record di conversazione o di occupazione manca, è duplicato o non è associabile; questi ultimi, come i dati incompatibili con il modello corrente, devono interrompere il caricamento come guasto inatteso, mai come assenza o turno valido.

#### Details
Origine: baseline Reqvire «Complete aggregate loading», adottata; «Incompatible persisted data as unexpected failure», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Repository del turno](../Contracts/FamilyConversation.md#repository-del-turno)

#### Relations
  * satisfiedBy: [sqlite-turn-repository.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Cartelle del modulo Conversazioni

Il package del modulo business «Conversazioni» deve collocare il codice Domain in `src/domain/`, Application in `src/application/` e gli adapter che appartengono al package in `src/adapters/`.

#### Details
Origine: baseline Reqvire «Layer folders of a business module», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * derivedFrom: [Struttura in layer dei componenti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#struttura-in-layer-dei-componenti)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Chiusura della risorsa SQLite conversazionale

Quando il server termina normalmente o fallisce durante l'avvio dopo aver creato la risorsa SQLite/Kysely dell'archivio, il proprietario deve chiudere la risorsa dopo le operazioni che ne dipendono.

#### Details
Origine: baseline Reqvire «Closing the database resource», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Ciclo di vita della risorsa SQLite conversazionale](../Contracts/FamilyConversation.md#ciclo-di-vita-della-risorsa-sqlite-conversazionale)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Chiusura della sessione conversazionale

Quando la sessione conversazionale di un client si chiude, Ambrogio deve rilasciarne le risorse senza interrompere i turni già ammessi e senza influenzare le sessioni degli altri client.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Classi TypeScript del Domain conversazionale

Quando il Domain del modulo «Conversazioni» rappresenta Root, Entità o Value Object, identità comprese, deve realizzarli come classi TypeScript con costruttore privato e ingressi statici espliciti, con lo stato in campi privati JavaScript.

#### Details
Origine: baseline Reqvire «Domain classes in TypeScript», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [identities.ts](../../packages/conversations/src/domain/identities.ts)
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Classificazione degli esiti delle scritture conversazionali

Quando l'adapter SQLite dell'archivio esegue una mutazione conversazionale, deve comunicare un rifiuto previsto della porta soltanto se l'esito tecnico dimostra la condizione prevista dal contratto dell'operazione; deve propagare come guasto inatteso gli esiti non classificabili e non deve comunicare un successo senza che la postcondizione della mutazione sia soddisfatta.

#### Details
Origine: baseline Reqvire «Classified outcomes of database writes», adottata; «Failed update outcomes by ascertained cause», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [sqlite-turn-repository.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Client MCP comune ai connettori

Quando Ambrogio abilita un connettore a un server MCP configurato, deve usare un client MCP comune per stabilire la connessione, scoprire i tool disponibili e invocare quelli richiesti, senza richiedere un'implementazione del protocollo distinta per ogni server.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Completamento del turno accettato dopo disconnessione

Quando il backend ha ammesso un turno e la sessione del client si chiude durante l'elaborazione, il backend deve proseguire il turno fino a un esito di risposta o di errore e conservarne lo scambio nella conversazione, indipendentemente dalla possibilità di consegnare la risposta.

#### Metadata
  * type: requirement

#### Contract References
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Comunicazione degli identificativi del turno ammesso

Quando ammette un turno, il backend deve comunicare al client l'identificativo della conversazione e quello del turno nel messaggio di ammissione, prima di ogni trasmissione della risposta, anche quando il turno continua una conversazione esistente.

#### Metadata
  * type: requirement

#### Contract References
  * [Esiti del turno nel protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#esiti-del-turno-nel-protocollo-ambrogio-v1)
  * [Identità di conversazioni e turni](../Contracts/FamilyConversation.md#identità-di-conversazioni-e-turni)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Conferma del completamento del turno

Quando il backend completa correttamente un turno, deve inviare al client la conferma di completamento come ultimo messaggio del turno, dopo tutte le trasmissioni della risposta e dopo la conferma del commit dell'esito riuscito.

#### Metadata
  * type: requirement

#### Contract References
  * [Confini atomici dell'archivio conversazioni](../Contracts/FamilyConversation.md#confini-atomici-dellarchivio-conversazioni)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Configurazione MCP dell'agente specializzato

Quando il server attiva un agente con connettore MCP, deve leggere la configurazione della sua connessione MCP dal file dell'agente e consegnarla al client MCP comune.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Configurazione del fuso orario della conversazione

Il server deve leggere il fuso orario della famiglia dalla configurazione del componente «Conversazioni» e impedire l'avvio quando il valore indicato non è un fuso orario valido.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo dell'ambiente di esecuzione e del file d'ambiente locale](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#profilo-dellambiente-di-esecuzione-e-del-file-dambiente-locale)

#### Relations
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Configurazione del modello per agente

Quando il server attiva un agente, incluso l'orchestratore, deve leggere il file dedicato a quell'agente e selezionare l'adapter del provider indicato, fornendogli l'identificativo del modello, la chiave API letta dalla variabile d'ambiente nominata, l'indirizzo dell'endpoint quando il provider lo richiede e soltanto le opzioni specifiche validate.

#### Metadata
  * type: requirement

#### Contract References
  * [Formato JSON dei file degli agenti](../Contracts/FamilyConversation.md#formato-json-dei-file-degli-agenti)

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Configurazione della paginazione conversazionale

Quando il server prepara la consultazione dell'elenco delle conversazioni, deve usare la dimensione della pagina e la dimensione massima della configurazione del componente «Conversazioni», con i valori predefiniti del modulo di configurazione quando mancano, e impedire l'attivazione se i valori sono invalidi.

#### Metadata
  * type: requirement

#### Contract References
  * [Pagine dell'elenco conversazioni](../Contracts/FamilyConversation.md#pagine-dellelenco-conversazioni)
  * [Profilo di bootstrap della configurazione del backend](../Contracts/ServerFoundation.md#profilo-di-bootstrap-della-configurazione-del-backend)
  * [Profilo dell'ambiente di esecuzione e del file d'ambiente locale](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#profilo-dellambiente-di-esecuzione-e-del-file-dambiente-locale)

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Configurazione pronta del connettore Home Assistant

Il repository deve fornire un file JSON pronto dell'agente Home Assistant, accettato dalla validazione dei file degli agenti, che chi installa completa con l'indirizzo di Home Assistant e con le variabili d'ambiente delle proprie credenziali senza modificarne la struttura.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Profilo del connettore Home Assistant](../Contracts/FamilyConversation.md#profilo-del-connettore-home-assistant)

#### Relations
  * satisfiedBy: [home-assistant.json](../../examples/agents/home-assistant.json)
  * specify: [Interazione domestica tramite Home Assistant](../../../ambrogio-model/system-model/Capabilities/Product.md#interazione-domestica-tramite-home-assistant)
---

### Confine dell'aggregato del turno secondo gli invarianti

Quando il modulo «Conversazioni» raggruppa stato del Domain in un aggregato, il confine dell'aggregato deve comprendere lo stato che richiede coerenza congiunta secondo gli invarianti e il ciclo di vita del turno, e non deve derivare dalle relazioni fra i dati persistenti.

#### Details
Origine: baseline Reqvire «Aggregate boundary by invariants», adottata. Il `Turn` è il Root del proprio aggregato: identità, conversazione di appartenenza, testo, istante di accettazione, stato ed esito. La conversazione non è un aggregato del Domain: l'unicità del turno attivo per conversazione e l'ordine dei turni sono garanzie dell'archivio.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Connettore Home Assistant tramite il server MCP di Home Assistant

Dove l'installazione abilita il connettore Home Assistant, il server deve raggiungere Home Assistant attraverso un agente specializzato con connettore MCP collegato all'integrazione ufficiale «Model Context Protocol Server» di Home Assistant e autenticato con un token di accesso di lunga durata di Home Assistant.

#### Metadata
  * type: requirement

#### Contract References
  * [Protocollo Model Context Protocol](../Contracts/ExternalContracts.md#protocollo-model-context-protocol)

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [home-assistant.json](../../examples/agents/home-assistant.json)
  * specify: [Interazione domestica tramite Home Assistant](../../../ambrogio-model/system-model/Capabilities/Product.md#interazione-domestica-tramite-home-assistant)
---

### Conservazione del testo originale del turno

Quando Ambrogio accetta un turno testuale dalla chat o dalla trascrizione vocale, deve conservare il testo ricevuto senza rimuovere né modificare gli spazi iniziali, finali o interni. L'eventuale rimozione degli spazi per verificare se il testo è vuoto non modifica il testo accettato.

#### Details
Origine: baseline Reqvire «Meaningful distinctions preserved», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Conservazione dello scambio testuale

Quando Ambrogio comunica l'esito di un turno rappresentato come testo, deve conservare nello stesso scambio il testo del turno e il testo della risposta o del messaggio di errore.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Conservazione dell'errore dopo risposta parziale

Quando il backend ha trasmesso parte della risposta a un turno e poi lo conclude con un errore, deve conservare lo scambio con esito di errore e con il messaggio pubblico comunicato nell'esito, senza registrare la parte già trasmessa come risposta completata.

#### Metadata
  * type: requirement

#### Contract References
  * [Esiti del turno nel protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#esiti-del-turno-nel-protocollo-ambrogio-v1)
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * derivedFrom: [Conservazione dello scambio testuale](#conservazione-dello-scambio-testuale)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Conservazione solo testuale della conversazione

Quando Ambrogio conserva una conversazione, deve conservarne la rappresentazione testuale senza conservare registrazioni audio.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Continuazione di ogni conversazione da qualunque client

Quando un client invia un turno con l'identificativo di una conversazione conservata, Ambrogio deve aggiungere il nuovo scambio alla stessa conversazione, indipendentemente dall'ingresso in cui la conversazione è iniziata e dal tipo di contenuto del turno.

#### Metadata
  * type: requirement

#### Contract References
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Continuità del turno dopo un guasto di consegna

Quando la consegna di una notifica di un turno già ammesso all'ingresso fallisce, Ambrogio deve proseguire l'elaborazione e conservare l'esito del turno indipendentemente da quel guasto di consegna.

#### Metadata
  * type: requirement

#### Contract References
  * [Dati dei casi d'uso indipendenti dagli ingressi](../Contracts/FamilyConversation.md#dati-dei-casi-duso-indipendenti-dagli-ingressi)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Contratti delle porte nei termini di Conversazioni

Quando un caso d'uso del modulo «Conversazioni» richiede una capacità esterna, la sua porta Application deve esprimere le operazioni e i dati necessari nel linguaggio del modulo, senza esporre tipi o chiamate specifici del fornitore; l'adapter deve tradurre tra tale contratto e l'integrazione concreta.

#### Metadata
  * type: requirement

#### Contract References
  * [Adozione di AI SDK nei layer conversazionali](../Contracts/AiSdkIntegration.md#adozione-di-ai-sdk-nei-layer-conversazionali)

#### Relations
  * derivedFrom: [Contratti Application nei termini del componente](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#contratti-application-nei-termini-del-componente)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Contratti di lettura separati dell'archivio conversazioni

Quando Application del modulo «Conversazioni» consulta lo storico o l'elenco delle conversazioni, deve ottenere proiezioni con tipi di lettura propri tramite porte di lettura, senza usare il repository del turno né oggetti del Domain; quando un caso d'uso di comando richiede un fatto ausiliario, come l'esistenza della conversazione da continuare, deve ottenerlo tramite una porta di lookup specifica. Il repository del turno deve servire soltanto il ciclo di vita dell'aggregato, e i contratti di lettura, di lookup e del repository non devono essere uniti perché condividono l'adapter o il database.

#### Details
Origine: baseline Reqvire «Separate read contracts for queries», adottata; «Read-model, lookup and repository contracts kept separate», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-history-read.port.ts](../../packages/conversations/src/application/conversation-history-read.port.ts)
  * satisfiedBy: [conversation-list-read.port.ts](../../packages/conversations/src/application/conversation-list-read.port.ts)
  * satisfiedBy: [conversation-lookup.port.ts](../../packages/conversations/src/application/conversation-lookup.port.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Contratto di scrittura dell'archivio conversazioni

Quando Application del modulo «Conversazioni» conserva turni o esiti, deve usare il repository dedicato all'aggregato `Turn`, che offre soltanto l'ammissione di un turno nuovo, il caricamento dei turni e il salvataggio del turno concluso o interrotto dal Domain; il contratto non deve esporre operazioni di transizione del turno né un'interfaccia CRUD universale ai casi d'uso.

#### Details
Origine: baseline Reqvire «Dedicated write contract without universal CRUD», adattata: il contratto di scrittura è il repository dell'aggregato, senza operazioni di transizione esplicite, come richiedono «Changes through the aggregate Root» e «Repository without Domain decisions».

#### Metadata
  * type: requirement

#### Contract References
  * [Garanzie di concorrenza del repository del turno](../Contracts/FamilyConversation.md#garanzie-di-concorrenza-del-repository-del-turno)

#### Relations
  * satisfiedBy: [turn-repository.port.ts](../../packages/conversations/src/application/turn-repository.port.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Conversione esplicita dei dati conversazionali persistenti

Quando un adapter del modulo «Conversazioni» legge o scrive l'archivio SQLite, deve convertire esplicitamente tra le rappresentazioni tecniche delle righe e i valori Domain o le proiezioni Application previsti dai rispettivi contratti, senza esporre righe o tipi Kysely a Domain e Application.

#### Details
Origine: baseline Reqvire «Explicit conversion at the persistence boundary», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Creazione della conversazione all'ammissione del turno

Quando un client invia un turno senza identificativo di conversazione, Ambrogio deve creare una nuova conversazione insieme all'ammissione di quel turno; un turno rifiutato non deve creare una conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Occupazione della conversazione e ammissione dei turni](../Contracts/FamilyConversation.md#occupazione-della-conversazione-e-ammissione-dei-turni)

#### Relations
  * satisfiedBy: [sqlite-turn-repository.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Data e ora correnti per gli agenti specializzati

Quando un agente specializzato formula la risposta di un turno, Ambrogio deve fornirgli la data, il giorno della settimana e l'ora correnti nel fuso orario configurato per il componente «Conversazioni».

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Dati Application dei casi d'uso conversazionali

Quando un caso d'uso del modulo «Conversazioni» riceve dati di ingresso o produce dati di successo, deve usare contratti definiti in Application e indipendenti dai formati HTTP e voce. Gli adapter di ingresso devono tradurre i rispettivi dati di protocollo in tali contratti e rappresentarne gli esiti nel proprio formato.

#### Metadata
  * type: requirement

#### Contract References
  * [Adozione di AI SDK nei layer conversazionali](../Contracts/AiSdkIntegration.md#adozione-di-ai-sdk-nei-layer-conversazionali)

#### Relations
  * derivedFrom: [Contratti Application nei termini del componente](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#contratti-application-nei-termini-del-componente)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Descrizione degli agenti specializzati per l'orchestrazione

Quando Ambrogio prepara un agente specializzato dal suo file, deve rendere disponibile all'orchestratore una descrizione dell'agente per permettere la scelta della delega.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Determinazione della replica attesa

Quando produce la risposta a un turno, il backend deve determinare se essa richiede una replica della famiglia, indipendentemente dal tipo di contenuto del turno e della risposta, mantenendo sul backend la responsabilità di questa decisione.

#### Details
La decisione è presa dopo la risposta, e con il modello soltanto quando la risposta contiene una domanda. AI SDK e Home Assistant concludono la risposta quando il modello smette di chiamare strumenti, senza uno strumento conclusivo. Home Assistant resta in ascolto quando la risposta termina con un punto di domanda; la sola punteggiatura riaprirebbe l'ascolto anche dopo un'offerta di cortesia come «Vuoi altro?», per questo una risposta con una domanda è valutata dal modello dell'orchestratore, mentre una risposta senza domande non richiede altre chiamate. Il punto di domanda finale resta la regola di ripiego quando la valutazione fallisce, perché la risposta è già stata trasmessa.

Sono state considerate e non adottate: uno strumento finale `finish` con l'argomento `expectsReply` e la chiamata a uno strumento richiesta a ogni passo, perché su un'installazione reale, con i risultati lunghi di una ricerca web, mistral-medium ne scriveva gli argomenti nel testo in due prove su tre e proseguiva con ripetizioni e con il proprio ragionamento, che la voce pronunciava, mentre mistral-small e mistral-large non lo facevano; la valutazione con il modello a ogni risposta, che aggiunge una chiamata anche quando non c'è alcuna domanda; la sola regola del punto di domanda finale di Home Assistant; il riconoscimento nel testo degli argomenti di `finish` scritti dal modello, che non evita il ragionamento pronunciato.

Fonti: registro conversazionale di Home Assistant, https://github.com/home-assistant/core/blob/dev/homeassistant/components/conversation/chat_log.py ; documentazione AI SDK sul controllo del ciclo, https://ai-sdk.dev/docs/agents/loop-control .

#### Metadata
  * type: requirement

#### Contract References
  * [Indicazione della replica attesa](../Contracts/FamilyConversation.md#indicazione-della-replica-attesa)

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Diagnostica del guasto nella produzione della risposta

Quando un turno ammesso si conclude con l'errore pubblico per un guasto tecnico nella lettura dello storico o nella produzione della risposta, il componente che comunica l'esito al client deve registrare un solo evento diagnostico con la causa tecnica del guasto, senza esporla nel messaggio pubblico né conservarla nello storico.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Diagnostica dei guasti nei componenti tecnici](ServerFoundation.md#diagnostica-dei-guasti-nei-componenti-tecnici)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Diagnostica del guasto tecnico di consegna

Quando la consegna di una notifica conversazionale fallisce per un guasto tecnico diverso dalla disconnessione del client, il componente tecnico che gestisce la consegna deve registrare il guasto nel canale diagnostico del server.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Diagnostica dei guasti nei componenti tecnici](ServerFoundation.md#diagnostica-dei-guasti-nei-componenti-tecnici)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Disabilitazione degli ingressi durante un turno

Quando un client elabora un turno o ne riproduce la risposta, deve impedire nuovi turni nella medesima interazione fino alla conclusione o all'interruzione, senza bloccare gli ingressi di altre conversazioni.

#### Metadata
  * type: requirement

#### Contract References
  * [Occupazione della conversazione e ammissione dei turni](../Contracts/FamilyConversation.md#occupazione-della-conversazione-e-ammissione-dei-turni)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Disponibilità degli agenti dai file della directory

Quando il server avvia la conversazione con la directory degli agenti, deve rendere disponibile all'orchestratore ogni agente specializzato descritto da un file `<id>.json` valido presente nella directory, con o senza connettore MCP, senza richiedere un elenco separato di agenti da abilitare, e non deve avviare la conversazione se la directory non contiene almeno un agente specializzato.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Disponibilità dello storico dopo riavvio

Quando Ambrogio viene riavviato, deve rendere nuovamente disponibili alla famiglia le conversazioni e gli scambi testuali conservati prima del riavvio.

#### Details
L'archivio è un database SQLite letto e scritto con Kysely secondo «Archivio SQLite con Kysely».

Origine: baseline Reqvire «Kysely for SQLite access», adottata.

#### Concept References
  * [Famiglia](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#famiglia)
  * [Conversazione](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#conversazione)
  * [Scambio](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#scambio)

#### Metadata
  * type: requirement

#### Contract References
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Elaborazione parallela di conversazioni diverse

Quando riceve turni validi destinati a conversazioni diverse mentre è operativo, Ambrogio deve consentirne l'ammissione e l'elaborazione in parallelo senza attendere la conclusione dei turni delle altre conversazioni.

#### Metadata
  * type: requirement

#### Contract References
  * [Occupazione della conversazione e ammissione dei turni](../Contracts/FamilyConversation.md#occupazione-della-conversazione-e-ammissione-dei-turni)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [sqlite-turn-repository.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Elenco paginato delle conversazioni

Quando la famiglia consulta l'elenco delle conversazioni conservate, Ambrogio deve fornirlo a pagine invece di restituire l'intero elenco in una sola risposta.

#### Details
Origine: baseline Reqvire «List or pagination chosen per query», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [list-conversations.handler.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.handler.ts)
  * satisfiedBy: [sqlite-conversation-list-read.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-list-read.adapter.ts)
  * satisfiedBy: [list-conversations.use-case.ts](../../packages/conversations/src/application/list-conversations.use-case.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Esempi degli agenti in inglese

Quando il progetto distribuisce file d'esempio di agenti, come `generic.json`, `orchestrator.json` o altri agenti specializzati, deve scrivere in inglese le istruzioni e le descrizioni degli agenti, senza fissare nelle istruzioni una lingua diversa da quella selezionata dall'installazione.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esempi distribuiti in inglese](../../../ambrogio-model/system-model/Requirements/ModelDrivenDevelopment.md#esempi-distribuiti-in-inglese)
  * satisfiedBy: [generic.json](../../examples/agents/generic.json)
  * satisfiedBy: [orchestrator.json](../../examples/agents/orchestrator.json)
  * specify: [Sviluppo governato dal modello](../../../ambrogio-model/system-model/Capabilities/Engineering.md#sviluppo-governato-dal-modello)
---

### Forma TypeScript dei contratti Application nel backend

Quando Application del modulo «Conversazioni» dichiara una porta outbound a oggetto con metodi nominati, deve usare `interface`; quando dichiara dati, unioni o contratti callable, deve usare `type`.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Forma TypeScript dei contratti Application](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#forma-typescript-dei-contratti-application)
  * satisfiedBy: [turn-repository.port.ts](../../packages/conversations/src/application/turn-repository.port.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Fornitura esplicita dell'ora corrente alla conversazione

Quando un caso d'uso Application del modulo «Conversazioni» richiede l'ora corrente per accettare un turno o valutare una regola temporale, deve ottenerla da una capacità di orologio fornita dalla composition root e passare l'istante necessario al Domain, senza leggere l'ora ambientale nel Domain.

#### Details
Origine: baseline Reqvire «External facts supplied by the Application», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Capacità dell'ambiente fornite dalla composition root](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#capacità-dellambiente-fornite-dalla-composition-root)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Garanzia di concorrenza dichiarata per ogni scrittura dell'archivio

Quando un'operazione di scrittura dell'archivio delle conversazioni dipende da stato modificabile da richieste concorrenti, la sua porta deve dichiarare nel contratto la garanzia di concorrenza offerta, e l'adapter deve realizzarla con una protezione proporzionata ai dati da cui dipende la decisione, che copra ogni percorso di modifica di quei dati.

#### Details
Origine: baseline Reqvire «Declared concurrency guarantee per operation», adottata; «Protection proportionate to the decision», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [sqlite-turn-repository.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.ts)
  * satisfiedBy: [turn-repository.port.ts](../../packages/conversations/src/application/turn-repository.port.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Garanzie di concorrenza provate da esecuzioni concorrenti reali

Quando una verifica prova una garanzia di concorrenza dell'archivio delle conversazioni, deve usare l'archivio SQLite reale con le migrazioni di produzione, esecuzioni indipendenti in processi distinti con connessioni proprie e una sincronizzazione esplicita, e deve confrontare esiti e stato finale con l'intera intenzione tramite una sonda indipendente; un avvio in parallelo nello stesso processo, il successo delle chiamate o la presenza di un blocco non devono essere considerati prova.

#### Details
Origine: baseline Reqvire «Concurrency guarantee proven by real concurrent executions», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Generazione degli identificativi prima del Domain

Quando un caso d'uso Application del modulo «Conversazioni» crea una conversazione o un turno, deve ottenere il nuovo identificativo tramite una capacità di generazione fornita dalla composition root e passarlo al Domain prima della creazione dello stato, senza generarlo dentro Domain o l'adapter di persistenza.

#### Details
Origine: baseline Reqvire «External facts supplied by the Application», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Identità di conversazioni e turni](../Contracts/FamilyConversation.md#identità-di-conversazioni-e-turni)

#### Relations
  * derivedFrom: [Capacità dell'ambiente fornite dalla composition root](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#capacità-dellambiente-fornite-dalla-composition-root)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Gestione del turno ammesso senza storico utilizzabile

Quando, dopo l'ammissione di un turno, il server non riesce a leggere uno storico utilizzabile per elaborarlo, Ambrogio deve provare a conservarne l'esito «Errore» e liberare l'occupazione; se la conservazione dell'esito fallisce, il server deve smettere di accettare nuovi turni fino al riavvio.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Identificativi UUID v4 di conversazioni e turni

Quando Ambrogio crea una nuova conversazione o accetta un nuovo turno, deve assegnargli un identificativo UUID v4 distinto, stabile nello storico e dopo il riavvio.

#### Details
Origine: baseline Reqvire «Identifiers preserved by persistence», adottata; «Stable Entity identity», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Identità distinte di conversazioni e turni

Quando il Domain del modulo «Conversazioni» rappresenta l'identità di una conversazione o di un turno, deve usare tipi distinti e non intercambiabili per i due significati; il caso d'uso Application deve convertire esplicitamente gli identificativi semplici dei propri ingressi e delle proprie uscite da e verso le classi di identità, l'adapter di persistenza deve convertirli da e verso le colonne preservandone il valore, e la distinzione del tipo non deve essere trattata come prova che la conversazione o il turno esistano.

#### Details
Origine: baseline Reqvire «Distinct identity types by meaning», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [begin-turn.use-case.ts](../../packages/conversations/src/application/begin-turn.use-case.ts)
  * satisfiedBy: [complete-turn.use-case.ts](../../packages/conversations/src/application/complete-turn.use-case.ts)
  * satisfiedBy: [identities.ts](../../packages/conversations/src/domain/identities.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Igiene delle migrazioni dell'archivio conversazioni

Quando il backend evolve lo schema dell'archivio SQLite, le migrazioni devono formare un'unica sequenza ordinata con un solo registro nel database; una migrazione distribuita deve restare immutabile e disponibile nella sequenza, una migrazione non deve importare codice business soggetto a modifiche, e i dati di prova o di sviluppo non devono essere inseriti tramite le migrazioni.

#### Details
Origine: baseline Reqvire «Separate migration process», adattata: le migrazioni restano applicate all'avvio del backend secondo «Automatic schema migrations at startup»; del processo separato si adottano soltanto le regole sulla sequenza unica, sull'immutabilità e la disponibilità delle migrazioni distribuite, sugli import e sui dati di prova, senza processo, comandi di stato o annullamento delle migrazioni.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [migrations.ts](../../packages/conversations/src/adapters/out/sqlite/migrations.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Import del Domain entro il proprio componente

Il codice di produzione Domain del modulo «Conversazioni» deve importare soltanto codice Domain dello stesso modulo, anche quando l'importazione riguarda solo tipi.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * derivedFrom: [Indipendenza tecnica di Domain e Application](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#indipendenza-tecnica-di-domain-e-application)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Import dell'Application entro il proprio modulo

Il codice di produzione Application del modulo «Conversazioni» deve importare soltanto codice Application o Domain dello stesso modulo, anche quando l'importazione riguarda solo tipi.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * derivedFrom: [Indipendenza tecnica di Domain e Application](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#indipendenza-tecnica-di-domain-e-application)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Indipendenza tecnica di Domain e Application nel backend

Il codice di produzione Domain e Application del modulo «Conversazioni» deve usare API standard ECMAScript indipendenti dall'ambiente e non deve dipendere da API Node.js né da package npm usati a runtime.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * derivedFrom: [Indipendenza tecnica di Domain e Application](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#indipendenza-tecnica-di-domain-e-application)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Ingressi testuali indipendenti dalla voce

Quando la voce non è abilitata nell'installazione, Ambrogio deve consentire l'uso della chat testuale senza richiedere la configurazione o l'avvio dei componenti necessari soltanto alla voce.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [voice-config.ts](../../packages/conversations/src/adapters/out/voice-config.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Integrazione esterna tramite porte e adapter

Quando un caso d'uso del modulo «Conversazioni» richiede una capacità tecnica esterna, Application deve dichiarare una porta per tale capacità e un adapter deve realizzarne l'integrazione concreta.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * derivedFrom: [Struttura in layer dei componenti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#struttura-in-layer-dei-componenti)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Integrità dello stato del turno nel Domain

Quando il modulo «Conversazioni» crea, modifica o ricostruisce lo stato di un turno, Domain deve ammettere soltanto stati e transizioni validi per quel turno, preservando identità e testo, e lasciare invariato lo stato se una transizione è rifiutata.

#### Details
Origine: baseline Reqvire «Entity by identity», adottata; «Invariants preserved on every Domain path», adottata; «Distinct birth and reconstruction paths», adottata; «Invariant in the smallest owner», adottata; «Refused operation leaves the aggregate unchanged», adattata: il Domain non registra eventi, quindi la garanzia riguarda il solo stato del turno.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Istanti distinti dai concetti di calendario nella conversazione

Quando un adapter di ingresso del modulo «Conversazioni» riceve o restituisce un istante, deve convertirlo esplicitamente fra la stringa ISO 8601 in UTC del proprio formato e un `Date` valido ed esporre gli istanti nelle risposte in ISO UTC; il fuso orario con significato per la conversazione deve restare un valore distinto dagli istanti, e il nucleo non deve normalizzare una seconda volta il fuso di un istante.

#### Details
Origine: baseline Reqvire «Instants distinct from calendar concepts», adattata: l'unico istante ricevuto da un ingresso è quello del cursore opaco dell'elenco, prodotto dal backend, che accetta soltanto la forma canonica restituita da `toISOString()` invece di ogni offset RFC 3339 equivalente; il fuso orario è il nome IANA della configurazione conversazionale e serve soltanto alla data e all'ora correnti date agli agenti.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [get-conversation.handler.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.handler.ts)
  * satisfiedBy: [list-conversations.handler.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.handler.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Istanti validi e protetti della conversazione

Quando Application e Domain rappresentano un istante della conversazione, devono usare un `Date` valido. Gli oggetti Domain che ricevono o espongono un `Date` devono proteggerlo con copie difensive in ingresso e in uscita.

#### Details
Origine: baseline Reqvire «Valid and protected Date values», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Istruzioni del server MCP per l'agente

Quando un agente specializzato con connettore MCP elabora un turno delegato e il suo server MCP offre prompt senza argomenti obbligatori, Ambrogio deve leggerne il testo dal server durante quel turno e consegnarlo al modello dell'agente insieme alle istruzioni del modulo TypeScript dell'agente.

#### Details
Se la lettura dei prompt fallisce, Ambrogio deve concludere il turno con il guasto comunicato secondo il contratto pubblico del turno, senza produrre la risposta con le sole istruzioni del modulo TypeScript.

#### Metadata
  * type: requirement

#### Contract References
  * [Protocollo Model Context Protocol](../Contracts/ExternalContracts.md#protocollo-model-context-protocol)
  * [Server MCP di Home Assistant](../Contracts/ExternalContracts.md#server-mcp-di-home-assistant)

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Istruzioni dell'agente nel file dell'utente

Quando il server attiva un agente, incluso l'orchestratore, deve leggere le istruzioni destinate a quell'agente dal suo file gestito dall'utente e consegnarle soltanto al modello dell'agente interessato.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Lettura HTTP dell'elenco conversazioni

Quando un client della chat testuale consulta l'elenco delle conversazioni conservate, il backend deve restituire una pagina dell'elenco e un riferimento utilizzabile per richiedere la pagina successiva secondo il contratto HTTP pubblico dell'elenco.

#### Metadata
  * type: requirement

#### Contract References
  * [Pagine dell'elenco conversazioni](../Contracts/FamilyConversation.md#pagine-dellelenco-conversazioni)
  * [Forma dei Problem Details dell'API HTTP](../Contracts/HttpApi.md#forma-dei-problem-details-dellapi-http)
  * [Versioni dell'API HTTP pubblica](../Contracts/HttpApi.md#versioni-dellapi-http-pubblica)

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [list-conversations.handler.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.handler.ts)
  * satisfiedBy: [list-conversations.route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.route.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Lettura HTTP dello storico conversazionale

Quando un client della chat testuale consulta una conversazione conservata, il backend deve restituire lo storico testuale ordinato e lo stato corrente dei suoi turni mediante la risposta alla richiesta HTTP di lettura, secondo il contratto pubblico dello storico conversazionale.

#### Metadata
  * type: requirement

#### Contract References
  * [Forma dei Problem Details dell'API HTTP](../Contracts/HttpApi.md#forma-dei-problem-details-dellapi-http)
  * [Versioni dell'API HTTP pubblica](../Contracts/HttpApi.md#versioni-dellapi-http-pubblica)

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [get-conversation.handler.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.handler.ts)
  * satisfiedBy: [get-conversation.route.adapter.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.route.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Limite delle chiamate agli strumenti per agente

Quando un agente specializzato usa gli strumenti del proprio connettore MCP per elaborare un turno, Ambrogio deve arrestare ulteriori chiamate agli strumenti al raggiungimento del limite configurato nel modulo TypeScript di quell'agente e comunicare il guasto secondo il contratto pubblico del turno.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Limite dello storico inviato ai modelli

Quando Ambrogio prepara il contesto di un turno per l'orchestratore e per l'agente scelto, deve includere soltanto gli ultimi turni della conversazione, fino al numero configurato nel componente «Conversazioni» e compreso il turno in elaborazione, e deve impedire l'attivazione se il numero configurato è invalido.

#### Details
Tutti i framework esaminati limitano il contesto inviato al modello: per numero di elementi o di turni il contesto di LiveKit Agents, l'integrazione Ollama di Home Assistant e le sessioni di OpenAI Agents SDK; per tempo le sessioni conversazionali di Home Assistant, che scadono dopo cinque minuti d'inattività; con un riassunto Pipecat. Un limite per numero di turni conserva il contesto recente di una chat ripresa dopo ore. Sono stati considerati e non adottati il limite per tempo, che farebbe ripartire senza contesto una chat ripresa più tardi mentre i client mostrano ancora i turni precedenti, e il doppio limite per numero e per tempo, che richiede due valori da configurare. L'archivio e la consultazione HTTP dello storico restano completi.

Fonti: contesto di LiveKit Agents, https://docs.livekit.io/agents/logic/chat-context/ ; gestione del contesto di Pipecat, https://docs.pipecat.ai/guides/learn/context-management ; memoria delle sessioni di OpenAI Agents SDK, https://developers.openai.com/cookbook/examples/agents_sdk/session_memory ; sessioni di Home Assistant, https://github.com/home-assistant/core/blob/dev/homeassistant/helpers/chat_session.py .

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di bootstrap della configurazione del backend](../Contracts/ServerFoundation.md#profilo-di-bootstrap-della-configurazione-del-backend)
  * [Profilo dell'ambiente di esecuzione e del file d'ambiente locale](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#profilo-dellambiente-di-esecuzione-e-del-file-dambiente-locale)

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Lingua configurata nelle risposte degli agenti

Quando un agente specializzato produce una risposta per la famiglia, il backend deve aggiungere alle sue istruzioni la lingua effettiva configurata per la conversazione, italiana o inglese. La regola deve applicarsi agli agenti con e senza MCP e non deve cambiare il ruolo dell'orchestratore, che seleziona soltanto l'agente.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Localizzazione dell'errore conversazionale inatteso

Quando un turno ammesso termina con un guasto inatteso, Ambrogio deve comunicare e conservare lo stesso messaggio pubblico standard tradotto nella lingua della configurazione del componente «Conversazioni».

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo dell'ambiente di esecuzione e del file d'ambiente locale](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#profilo-dellambiente-di-esecuzione-e-del-file-dambiente-locale)

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Migrazione automatica dell'archivio delle conversazioni

Quando l'archivio SQLite richiede migrazioni per la versione del server avviata, Ambrogio deve applicarle automaticamente prima di accettare nuovi turni e impedire l'avvio degli ingressi conversazionali se una migrazione fallisce.

#### Details
Origine: baseline Reqvire «Automatic schema migrations at startup», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Modifiche del turno attraverso il Root

Quando un caso d'uso Application conclude, fa fallire o interrompe un turno, deve caricare il Root `Turn` dal repository del turno, richiedere la transizione con l'operazione del Root e chiedere al repository il salvataggio del turno modificato; il rifiuto della transizione da parte del Domain deve essere un esito previsto del caso d'uso, senza salvataggio.

#### Details
Origine: baseline Reqvire «Changes through the aggregate Root», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Repository del turno](../Contracts/FamilyConversation.md#repository-del-turno)

#### Relations
  * satisfiedBy: [complete-turn.use-case.ts](../../packages/conversations/src/application/complete-turn.use-case.ts)
  * satisfiedBy: [interrupt-pending-turns.use-case.ts](../../packages/conversations/src/application/interrupt-pending-turns.use-case.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Modulo business unico per la conversazione

I flussi applicativi di conversazione testuale e vocale del server devono appartenere al medesimo modulo business «Conversazioni».

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Nessuna ripetizione automatica del turno interrotto

Quando Ambrogio riconosce dopo un riavvio un turno interrotto senza esito conservato, non deve ripeterne automaticamente l'elaborazione né richiamare i connettori per quel turno.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati persistenti dei turni conversazionali](../Contracts/FamilyConversation.md#stati-persistenti-dei-turni-conversazionali)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Nomi degli strumenti MCP offerti al modello

Quando offre al modello di un agente specializzato gli strumenti del proprio connettore MCP, Ambrogio deve presentare ciascuno strumento con il nome dichiarato dal server MCP, se il nome è ammesso dal fornitore del modello, e inoltrare le chiamate del modello allo strumento corrispondente.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Nomi delle porte Application secondo la capacità richiesta

Quando Application del modulo «Conversazioni» dichiara una porta verso una capacità esterna, deve darle un nome che descriva la capacità richiesta dal caso d'uso, senza incorporare il nome del prodotto, del protocollo o della libreria dell'implementazione tecnica.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Contratti Application nei termini del componente](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#contratti-application-nei-termini-del-componente)
  * satisfiedBy: [turn-capabilities.port.ts](../../packages/conversations/src/application/turn-capabilities.port.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Orchestrazione della risposta conversazionale

Quando Ambrogio elabora un turno della famiglia, l'agente orchestratore deve scegliere un solo agente fra quelli configurati, senza formulare esso stesso la risposta; l'agente scelto deve formulare la risposta del turno e l'esito deve appartenere alla stessa conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [API dei provider di modelli linguistici](../Contracts/ExternalContracts.md#api-dei-provider-di-modelli-linguistici)

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Continuità dell'agente nella conversazione

Quando l'orchestratore sceglie l'agente per un turno di una conversazione con turni precedenti conclusi da una risposta, Ambrogio deve fargli conoscere quale agente ha formulato ciascuna di quelle risposte, così che una replica a una domanda di un agente possa tornare allo stesso agente.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Orchestrazione della risposta conversazionale](#orchestrazione-della-risposta-conversazionale)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * satisfiedBy: [migrations.ts](../../packages/conversations/src/adapters/out/sqlite/migrations.ts)
  * satisfiedBy: [sqlite-turn-mapper.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-mapper.ts)
  * satisfiedBy: [sqlite-turn-repository.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * satisfiedBy: [get-conversation.use-case.ts](../../packages/conversations/src/application/get-conversation.use-case.ts)
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Ordinamento delle conversazioni per ultima attività

Quando Ambrogio fornisce una pagina dell'elenco delle conversazioni, deve ordinare le conversazioni dalla più recente per ultima attività alla meno recente, mantenendo un ordine deterministico anche a parità di ultima attività.

#### Metadata
  * type: requirement

#### Contract References
  * [Istanti della conversazione e orologio applicativo](../Contracts/FamilyConversation.md#istanti-della-conversazione-e-orologio-applicativo)
  * [Pagine dell'elenco conversazioni](../Contracts/FamilyConversation.md#pagine-dellelenco-conversazioni)

#### Relations
  * satisfiedBy: [sqlite-conversation-list-read.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-list-read.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Persistenza degli istanti conversazionali in millisecondi Unix

Quando l'adapter dell'archivio salva o ricostruisce un istante della conversazione, deve convertirlo esplicitamente tra un `Date` valido nel codice e un intero di millisecondi trascorsi dall'epoca Unix nella riga SQLite, preservando esattamente l'istante.

#### Details
Origine: baseline Reqvire «Instants stored as Unix milliseconds», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [sqlite-turn-repository.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Precondizioni contestuali nel caso d'uso conversazionale

Quando un turno supera la validazione dell'ingresso, il caso d'uso Application deve coordinare le precondizioni dipendenti dal contesto della conversazione tramite le proprie porte e interrompere il flusso con un rifiuto previsto quando esse non sono soddisfatte, lasciando al Domain gli invarianti del turno e all'archivio SQLite la garanzia atomica dell'unico turno attivo per conversazione.

#### Details
Origine: baseline Reqvire «Contextual preconditions in the use case», adottata; «Global guarantees assigned to their enforcer», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Proprietà dei controlli del turno conversazionale](../Contracts/FamilyConversation.md#proprietà-dei-controlli-del-turno-conversazionale)

#### Relations
  * satisfiedBy: [begin-turn.use-case.ts](../../packages/conversations/src/application/begin-turn.use-case.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Proprietà della risorsa SQLite conversazionale

Quando il server usa l'archivio delle conversazioni, la sua composition root deve creare un solo proprietario della risorsa SQLite/Kysely per quell'archivio e fornire agli adapter le capacità necessarie senza trasferire loro la responsabilità di chiuderla.

#### Details
Origine: baseline Reqvire «Explicit wiring without service locator», adottata; «Single owner of the database resource», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Recupero dello storico per il turno

Quando il backend riceve un nuovo turno con l'identificativo di una conversazione conservata, deve recuperare dall'archivio lo storico testuale di quella conversazione per elaborare il turno, senza riceverlo dal client.

#### Metadata
  * type: requirement

#### Contract References
  * [Trasmissione in ingresso del protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#trasmissione-in-ingresso-del-protocollo-ambrogio-v1)
  * [Archivio SQLite con Kysely](../Contracts/FamilyConversation.md#archivio-sqlite-con-kysely)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Registrazione dei tempi dei turni vocali

Quando un turno con ingresso audio si conclude con una risposta, il backend deve registrare un evento diagnostico informativo con la durata dell'audio ricevuto e con i tempi della trascrizione, del primo testo della risposta, del primo audio della risposta e della conclusione del turno, misurati dalla fine della richiesta, senza testi, audio o identificativi della conversazione e del turno.

#### Details
L'evento rende misurabile, su ogni installazione, il ritardo fra la fine della richiesta e la risposta parlata e mostra quale fase lo determina: trascrizione, risposta degli agenti o sintesi. Ha livello `info` perché registra un esito riuscito e non un guasto.

#### Concept References
  * [Turno vocale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#turno-vocale)

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Registrazione dei tempi della risposta degli agenti

Quando la produzione della risposta di un turno si conclude, il backend deve registrare un evento diagnostico informativo con l'agente scelto, la durata della scelta dell'orchestratore e del lavoro dell'agente, il numero di chiamate dell'agente al modello e agli strumenti, il tempo passato negli strumenti e, quando c'è, la durata della valutazione della replica attesa, senza testi della conversazione.

#### Details
L'evento mostra in quale fase si spende il tempo fra la richiesta e la risposta: la scelta dell'agente, le chiamate al modello linguistico o le chiamate agli strumenti. Ha livello `info` perché registra un esito riuscito e non un guasto.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Registrazione dei turni conversazionali accettati

Quando Ambrogio accetta un turno rappresentato come testo dalla chat o dalla trascrizione vocale, deve conservarne il testo e lo stato in elaborazione prima di avviarne l'elaborazione, affinché il turno sia riconoscibile dopo un riavvio.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati persistenti dei turni conversazionali](../Contracts/FamilyConversation.md#stati-persistenti-dei-turni-conversazionali)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Repository del turno senza decisioni di Domain

Quando l'adapter SQLite del repository del turno ammette, carica o salva un turno, deve limitarsi a convertire e conservare lo stato già valido del Domain: non deve scegliere lo stato iniziale, generare identificativi, leggere l'ora corrente né invocare transizioni del turno, e la conversione in scrittura deve leggere lo stato tramite i getter del Root senza invocarne la creazione o la ricostruzione.

#### Details
Origine: baseline Reqvire «Repository without Domain decisions», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Repository del turno](../Contracts/FamilyConversation.md#repository-del-turno)

#### Relations
  * satisfiedBy: [sqlite-turn-mapper.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-mapper.ts)
  * satisfiedBy: [sqlite-turn-repository.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Riconoscimento del turno interrotto dopo riavvio

Quando il server si avvia e trova turni conservati come «In elaborazione» senza esito, Ambrogio deve contrassegnarli tutti come «Interrotti» prima di accettare nuovi turni e mostrarli come tali nelle rispettive conversazioni.

#### Details
Origine: baseline Reqvire «Ordered startup before accepting work», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Rifiuto dei turni concorrenti nella stessa conversazione

Quando una conversazione ha un turno accettato il cui esito non è ancora conservato, Ambrogio deve rifiutare come esito previsto ogni nuovo turno destinato alla stessa conversazione, da qualunque client o ingresso, senza accettarlo né conservarlo.

#### Details
Origine: baseline Reqvire «Declared concurrency guarantee per operation», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [sqlite-turn-repository.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Rifiuto del turno prima dell'ammissione

Quando un turno non è ammesso, il backend deve comunicare al client il rifiuto con il motivo previsto e trasmettere il messaggio pubblico sicuro nella lingua configurata, senza conservare il turno; se l'archivio rifiuta temporaneamente l'ammissione, il server sta arrestandosi o gli ingressi sono disabilitati dopo una conclusione non conservata deve usare il motivo `unavailable`, e se un guasto tecnico inatteso avviene prima dell'ammissione deve usare il motivo `failure` con il messaggio standard nella lingua configurata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esclusione dei dettagli tecnici dal messaggio pubblico](ServerFoundation.md#esclusione-dei-dettagli-tecnici-dal-messaggio-pubblico)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Rifiuto del turno nella conversazione occupata

Quando il backend riceve un turno valido destinato a una conversazione che sta già elaborando un altro turno, deve rifiutarlo con il motivo `occupied`, senza avviare la risposta né conservare il turno rifiutato.

#### Metadata
  * type: requirement

#### Contract References
  * [Motivi di rifiuto del turno](../Contracts/ConversationProtocol.md#motivi-di-rifiuto-del-turno)

#### Relations
  * derivedFrom: [Rifiuto del turno prima dell'ammissione](#rifiuto-del-turno-prima-dellammissione)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Rifiuto del turno testuale vuoto

Quando il testo di un turno testuale è vuoto o contiene soltanto spazi bianchi, il backend deve rifiutare il turno con il motivo `invalid`, senza creare una conversazione né aggiungere uno scambio.

#### Details
Origine: baseline Reqvire «Meaningful distinctions preserved», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Motivi di rifiuto del turno](../Contracts/ConversationProtocol.md#motivi-di-rifiuto-del-turno)
  * [Trasmissione in ingresso del protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#trasmissione-in-ingresso-del-protocollo-ambrogio-v1)

#### Relations
  * derivedFrom: [Rifiuto del turno prima dell'ammissione](#rifiuto-del-turno-prima-dellammissione)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Rifiuto della continuazione con conversazione inesistente

Quando un turno contiene un testo valido o un audio e un identificativo di conversazione che non identifica una conversazione conservata, il backend deve rifiutarlo con il motivo `conversation_not_found`, senza creare una nuova conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Motivi di rifiuto del turno](../Contracts/ConversationProtocol.md#motivi-di-rifiuto-del-turno)

#### Relations
  * derivedFrom: [Rifiuto del turno prima dell'ammissione](#rifiuto-del-turno-prima-dellammissione)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Trascrizione vocale non riuscita

Se Ambrogio non ottiene una trascrizione utilizzabile di un turno vocale, non deve creare uno scambio per quel turno e deve rifiutarlo con il motivo `transcription_failed`.

#### Metadata
  * type: requirement

#### Contract References
  * [Motivi di rifiuto del turno](../Contracts/ConversationProtocol.md#motivi-di-rifiuto-del-turno)

#### Relations
  * derivedFrom: [Rifiuto del turno prima dell'ammissione](#rifiuto-del-turno-prima-dellammissione)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Rifiuto dell'avvio con uno strumento MCP elencato non disponibile

Se un nome dell'elenco degli strumenti MCP ammessi di un agente specializzato non corrisponde a nessuno strumento scoperto all'avvio sul server MCP di quell'agente, allora il server non deve avviarsi e deve indicare nel messaggio diagnostico l'agente interessato.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Elenco degli strumenti MCP ammessi per agente](../Contracts/FamilyConversation.md#elenco-degli-strumenti-mcp-ammessi-per-agente)

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Risposta dopo le azioni degli agenti con connettore MCP

Quando un agente specializzato con connettore MCP elabora un messaggio della famiglia che chiede un'azione, l'agente deve eseguire con i propri strumenti ogni azione chiesta da quel messaggio, anche quando ripete o richiama una richiesta precedente, e deve rispondere soltanto dopo le chiamate agli strumenti, dicendo brevemente che cosa ha fatto oppure che cosa non è riuscito.

#### Details
La risposta arriva quando l'agente sa com'è andata. È stata provata e tolta una frase breve che l'agente scriveva prima di chiamare gli strumenti, sul modello della preamble dei modelli vocali raccomandata dalla guida OpenAI per i modelli realtime: il modello la scriveva prima di conoscere l'esito, e quanto è già stato pronunciato non si ritira. Su un'installazione reale ha annunciato «Non riesco a trovare un lettore chiamato Ambrogio» prima di cercare il lettore, che poi ha trovato, e ha detto «sto per spegnere la luce» quando Home Assistant l'aveva già spenta, perché un'azione di Home Assistant dura pochi millisecondi. Con un server veloce la risposta dopo le azioni arriva in circa due secondi per un comando di Home Assistant e in tre o quattro per la ricerca e l'avvio di un brano.

Le istruzioni aggiunte dal backend sono poche: rispondere dopo l'ultima chiamata agli strumenti, non dire fatto ciò che nessuno strumento ha fatto nella stessa risposta, dire brevemente l'esito. In prove con mistral-medium e strumenti simulati di Home Assistant, con queste sole regole l'agente ha eseguito ogni richiesta, anche ripetuta o richiamata con «spegnila» dopo una risposta «Fatto.», ha soltanto letto lo stato per una domanda sullo stato, non ha chiamato strumenti per un ringraziamento e non ha scritto testo prima delle chiamate, in tutte le prove. Non sono adottate regole più dettagliate, cioè una chiamata propria per ogni richiesta, il divieto di rispondere soltanto «Fatto» e l'eccezione esplicita per i ringraziamenti: compensavano uno storico che mostrava soltanto i testi delle risposte e una chiamata a uno strumento richiesta a ogni passo, mentre l'agente vede le proprie azioni conservate. Le istruzioni non contengono frasi d'esempio: con un esempio il modello ne copiava il verbo anche per azioni diverse, fino a chiamare lo strumento opposto.

Sono state considerate e non adottate per riempire l'attesa: una parola fissa come «Ok» trasmessa dal backend appena l'orchestratore sceglie l'agente, che suonerebbe superflua prima delle risposte rapide; un suono d'attesa riprodotto dal satellite fra la fine della richiesta e la risposta. Sono state scartate per annunciare l'azione: una seconda chiamata breve al modello dell'agente in parallelo alla risposta, perché con le istruzioni del server MCP il modello lasciava l'annuncio vuoto; l'annuncio dell'orchestratore, che conosce soltanto le descrizioni degli agenti; uno strumento locale di annuncio, che costringe il modello a fingere un'azione per parlare; un campo di annuncio nell'uscita strutturata, che il modello scrive soltanto dopo l'ultima chiamata agli strumenti.

Fonti: guida OpenAI ai modelli realtime, https://developers.openai.com/api/docs/guides/realtime-models-prompting ; documentazione AI SDK sul controllo del ciclo, https://ai-sdk.dev/docs/agents/loop-control .

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Risposta non vuota dell'agente specializzato

Quando un agente specializzato conclude la generazione della risposta senza aver scritto testo, Ambrogio deve chiedere una sola volta allo stesso agente di scrivere la risposta del turno e, se anche questa resta senza testo, deve concludere il turno con errore senza conservare una risposta vuota.

#### Details
Un modello può concludere la generazione subito dopo l'ultima azione senza scrivere nulla: il turno risulterebbe riuscito con una risposta vuota, la famiglia non sentirebbe alcuna conferma e lo storico conterrebbe un messaggio dell'assistente vuoto, che l'API di Mistral rifiuta con l'errore «Assistant message must have either content or tool_calls, but not none», facendo fallire i turni successivi della conversazione. La documentazione AI SDK tratta il testo finale vuoto dopo le chiamate agli strumenti come comportamento del modello, da correggere istruendolo o costringendolo a scrivere.

Sono state considerate e non adottate: concludere subito il turno con errore, che farebbe sentire un errore anche quando l'azione è riuscita; accettare la risposta vuota come silenzio, come fa il registro conversazionale di Home Assistant, che lascia la famiglia senza conferma; scrivere la risposta come argomento dello strumento finale, schema indicato dalla documentazione AI SDK per lo strumento conclusivo, che impedirebbe di trasmettere alla voce il testo mentre viene scritto.

Fonti: documentazione AI SDK sul controllo del ciclo, https://ai-sdk.dev/docs/agents/loop-control ; registro conversazionale di Home Assistant, https://github.com/home-assistant/core/blob/dev/homeassistant/components/conversation/chat_log.py .

#### Metadata
  * type: requirement

#### Contract References
  * [API dei provider di modelli linguistici](../Contracts/ExternalContracts.md#api-dei-provider-di-modelli-linguistici)

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Risposta parlata su richiesta del client

Quando un client chiede la risposta in audio e la voce è abilitata nell'installazione, Ambrogio deve pronunciare alla famiglia la risposta e ogni messaggio pubblico del turno, trasmettendoli in audio.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Esclusione dell'audio persistente](../Contracts/FamilyConversation.md#esclusione-dellaudio-persistente)
  * [Catalogo bilingue dei modelli vocali nell'immagine backend](../Contracts/ServerFoundation.md#catalogo-bilingue-dei-modelli-vocali-nellimmagine-backend)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [sherpa-synthesizer.ts](../../packages/conversations/src/adapters/in/session/sherpa-synthesizer.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Risposta parlata senza marcatura testuale

Quando Ambrogio pronuncia una risposta o un messaggio pubblico che contiene marcatura di formattazione Markdown, deve pronunciare soltanto il testo leggibile, senza leggere i simboli di formattazione; il testo conservato e trasmesso resta invariato.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Risposta parlata su richiesta del client](#risposta-parlata-su-richiesta-del-client)
  * satisfiedBy: [sentences.ts](../../packages/conversations/src/adapters/in/session/sentences.ts)
  * satisfiedBy: [sherpa-synthesizer.ts](../../packages/conversations/src/adapters/in/session/sherpa-synthesizer.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Sintesi con la voce Piper configurata

Quando la voce è abilitata nell'installazione, Ambrogio deve pronunciare le risposte con la voce Piper VITS indicata nella configurazione vocale dell'installazione, senza limitare la lingua o la voce a un elenco fissato dal prodotto.

#### Details
Il prodotto usa un solo motore di sintesi, le voci Piper VITS eseguite da `sherpa-onnx-node`: una voce Piper inclusa nell'immagine o montata dall'installazione si sceglie con la sola directory del modello, senza variabili di motore, di voce o di lingua.

È stato considerato il modello Kokoro multilingue, eseguito dalla stessa libreria come motore alternativo scelto per lingua, con la voce indicata dall'identificativo numerico nel modello e la lingua di fonetizzazione indicata da un codice espeak-ng. Non è adottato: il backend sintetizza una frase alla volta e una frase si ascolta solo quando è completa, e Kokoro impiega alcuni secondi per ogni frase anche su una CPU desktop a 4 core, dove una voce Piper ne impiega meno di mezzo, mentre su CPU di classe bassa senza AVX è più lento del parlato. Il ritardo prima della risposta parlata annullerebbe il vantaggio della trascrizione in streaming, e un solo motore mantiene più semplici configurazione, codice e immagine.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Configurazione facoltativa della voce](../Contracts/FamilyConversation.md#configurazione-facoltativa-della-voce)
  * [Modelli vocali scaricati nell'immagine del backend](../Contracts/ExternalContracts.md#modelli-vocali-scaricati-nellimmagine-del-backend)

#### Relations
  * derivedFrom: [Risposta parlata su richiesta del client](#risposta-parlata-su-richiesta-del-client)
  * satisfiedBy: [local-speech-components.ts](../../packages/conversations/src/adapters/in/session/local-speech-components.ts)
  * satisfiedBy: [sherpa-synthesizer.ts](../../packages/conversations/src/adapters/in/session/sherpa-synthesizer.ts)
  * satisfiedBy: [voice-config.ts](../../packages/conversations/src/adapters/out/voice-config.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Risposta testuale nella conversazione

Quando la famiglia invia un turno, Ambrogio deve produrre una risposta testuale o un messaggio di errore nella conversazione a cui appartiene il turno, qualunque sia il tipo di contenuto con cui la risposta viene trasmessa.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Scoperta delle configurazioni degli agenti

Quando il server prepara gli agenti attivi, deve cercare i rispettivi file nella directory degli agenti configurata e distinguere la configurazione dell'orchestratore da quelle degli agenti specializzati.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Scritture atomiche dello stato dei turni

Quando Ambrogio accetta, conclude o interrompe un turno, deve confermare insieme lo stato persistente del turno e l'occupazione della conversazione interessata in una transazione SQLite.

#### Details
Origine: baseline Reqvire «Atomic persistent state transitions», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [migrations.ts](../../packages/conversations/src/adapters/out/sqlite/migrations.ts)
  * satisfiedBy: [sqlite-turn-repository.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.ts)
  * satisfiedBy: [interrupt-pending-turns.use-case.ts](../../packages/conversations/src/application/interrupt-pending-turns.use-case.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Segnalazione dell'errore dopo l'ammissione

Quando un errore impedisce di completare la risposta a un turno ammesso, il backend deve chiudere l'eventuale trasmissione in corso, trasmettere il messaggio pubblico sicuro e concludere il turno con l'esito di errore, senza la conferma di completamento.

#### Metadata
  * type: requirement

#### Contract References
  * [Esiti del turno nel protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#esiti-del-turno-nel-protocollo-ambrogio-v1)
  * [Trasmissione in uscita del protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#trasmissione-in-uscita-del-protocollo-ambrogio-v1)

#### Relations
  * derivedFrom: [Esclusione dei dettagli tecnici dal messaggio pubblico](ServerFoundation.md#esclusione-dei-dettagli-tecnici-dal-messaggio-pubblico)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Segnalazione della replica attesa

Quando conferma il completamento di un turno, il backend deve indicare esplicitamente al client se la risposta attende oppure non attende una replica della famiglia.

#### Metadata
  * type: requirement

#### Contract References
  * [Esiti del turno nel protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#esiti-del-turno-nel-protocollo-ambrogio-v1)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Selezione degli strumenti MCP offerti all'agente

Dove il file di un agente specializzato elenca gli strumenti MCP ammessi, Ambrogio deve offrire al modello di quell'agente soltanto gli strumenti elencati fra quelli scoperti sul suo server MCP e non deve inoltrare al server chiamate a strumenti non elencati.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Selezione dei modelli vocali inclusi per lingua

Quando la voce è abilitata con profili vocali per lingua, Ambrogio deve selezionare il modello di trascrizione e la voce Piper indicati dalle variabili del profilo della lingua effettiva della conversazione, accettando sia modelli inclusi nell'immagine sia modelli montati dall'installazione, e non deve caricare modelli vocali quando la voce è disabilitata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [voice-config.spec.ts](../../packages/conversations/src/adapters/out/voice-config.spec.ts)
  * satisfiedBy: [voice-config.ts](../../packages/conversations/src/adapters/out/voice-config.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Selezione dell'archivio conversazionale all'avvio

Quando il server prepara l'ingresso conversazionale, deve aprire l'archivio SQLite al percorso dichiarato nella configurazione del componente «Conversazioni» e impedire l'avvio se il percorso manca o è invalido.

#### Details
Origine: baseline Reqvire «SQLite as embedded database», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo dell'ambiente di esecuzione e del file d'ambiente locale](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#profilo-dellambiente-di-esecuzione-e-del-file-dambiente-locale)

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Separazione degli adapter di ingresso e uscita

Nel package del modulo business «Conversazioni», gli adapter d'ingresso presenti devono risiedere in `src/adapters/in/` e gli adapter che implementano porte Application presenti devono risiedere in `src/adapters/out/`.

#### Details
Origine: baseline Reqvire «Inbound and outbound adapter folders», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * derivedFrom: [Struttura in layer dei componenti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#struttura-in-layer-dei-componenti)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Separazione delle responsabilità nel modulo Conversazioni

Il modulo business «Conversazioni» deve distinguere Domain, Application e adapter secondo le rispettive responsabilità definite per il modulo.

#### Details
Alternative per il trasporto della chat: un trasporto SSE locale, `@fastify/sse` o il protocollo UI di AI SDK (regole diverse per testo e voce, contro il protocollo conversazionale comune di «Adozione del protocollo conversazionale Ambrogio v1»).

Alternative per più provider: il client ufficiale `openai` per i provider compatibili con OpenAI e gli SDK nativi degli altri provider (per ogni famiglia di API vanno reimplementati lo streaming dell'output strutturato, il ciclo delle chiamate agli strumenti e la propagazione dell'annullamento); un gateway self-hosted (un servizio in più da gestire in ogni installazione); un servizio di instradamento esterno (le conversazioni passano da un intermediario invece che dalla chiave diretta del provider).

Motivo: AI SDK offre negli adapter degli agenti generazione, tool calling, output strutturato e streaming senza meccanismi tecnici duplicati; ogni pacchetto `@ai-sdk/<provider>` dipende soltanto da `@ai-sdk/provider` e `@ai-sdk/provider-utils`, già presenti, quindi un provider in più aggiunge un solo pacchetto, nessuna dipendenza transitiva nuova e nessun secondo percorso di generazione.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Struttura in layer dei componenti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#struttura-in-layer-dei-componenti)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Stato del turno senza riferimenti mutabili condivisi

Quando un oggetto del Domain conversazionale espone il proprio stato, deve esporre soltanto le informazioni richieste dai chiamanti, senza un accesso generico all'intero stato, e deve isolare ogni riferimento mutabile ricevuto o restituito, così che i chiamanti non possano modificarne lo stato indirettamente.

#### Details
Origine: baseline Reqvire «Domain state without shared mutable references», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Classi del Domain conversazionale con TypeScript](../Contracts/FamilyConversation.md#classi-del-domain-conversazionale-con-typescript)

#### Relations
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Storico senza risposte vuote

Quando Ambrogio prepara il contesto di un turno per l'orchestratore o per un agente specializzato, deve omettere il testo delle risposte conservate che non contengono caratteri diversi da spazi bianchi, mantenendo il messaggio della famiglia di quei turni.

#### Metadata
  * type: requirement

#### Contract References
  * [API dei provider di modelli linguistici](../Contracts/ExternalContracts.md#api-dei-provider-di-modelli-linguistici)

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Streaming soltanto quando l'intenzione lo richiede

Quando una porta Application del modulo «Conversazioni» consegna dati, deve esporre una consegna in streaming soltanto se l'intenzione richiede elaborazione incrementale, volumi non materializzabili o una fonte potenzialmente illimitata; le porte di lettura, la porta di lookup e il repository del turno devono restituire valori materializzati, e una porta in streaming deve produrre valori Application tramite `AsyncIterable` senza esporre stream del runtime, cursori del database o tipi di libreria.

#### Details
Origine: baseline Reqvire «Streaming only when the intention requires it», adottata. L'unica porta in streaming è `ProduceConversationReply`, che consegna le parti della risposta per la trasmissione progressiva; nessuna lettura dell'archivio è in streaming.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [produce-conversation-reply.port.ts](../../packages/conversations/src/application/produce-conversation-reply.port.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Tempo massimo della produzione della risposta

Quando la produzione della risposta di un turno ammesso non termina entro il tempo massimo previsto, Ambrogio deve annullare le richieste ancora in corso verso modelli e connettori e concludere il turno con il messaggio pubblico di errore, liberando la conversazione per i turni successivi.

#### Details
Origine: baseline Reqvire «Time limit with cancellation of remote work», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * satisfiedBy: [system-deadlines.adapter.ts](../../packages/conversations/src/adapters/out/system-deadlines.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Transazioni brevi dell'archivio conversazioni

Quando Ambrogio esegue chiamate ad agenti o connettori oppure trasmette la risposta progressiva di un turno, non deve mantenere aperta una transazione SQLite relativa a quel turno.

#### Details
Origine: baseline Reqvire «No open transaction during remote work», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Confini atomici dell'archivio conversazioni](../Contracts/FamilyConversation.md#confini-atomici-dellarchivio-conversazioni)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Trascrizione del turno vocale

Quando la famiglia pronuncia un turno vocale trascrivibile, Ambrogio deve rappresentare quel turno nella conversazione mediante la sua trascrizione testuale.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Esclusione dell'audio persistente](../Contracts/FamilyConversation.md#esclusione-dellaudio-persistente)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [streaming-transcriber.ts](../../packages/conversations/src/adapters/in/session/streaming-transcriber.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Trascrizione in streaming del turno vocale

Quando la voce è abilitata nell'installazione, Ambrogio deve trascrivere l'audio di ogni turno vocale mentre la richiesta è aperta, con il modello transducer in streaming di sherpa-onnx indicato dal profilo vocale della lingua effettiva, così che alla chiusura della richiesta resti da decodificare soltanto l'ultima parte, e deve impedire l'avvio quando il modello non è caricabile.

#### Details
Il backend supporta una sola famiglia di modelli di trascrizione, i transducer in streaming di sherpa-onnx. Il modello incluso nell'immagine è Nemotron 3.5 ASR streaming 0.6B di NVIDIA, multilingue con l'italiano, che riconosce da sé la lingua parlata. Un modello della stessa famiglia si sostituisce cambiando la directory; un'altra famiglia richiede una modifica del codice.

La trascrizione durante il parlato è una richiesta della persona: rende il ritardo dopo la fine della frase indipendente dalla durata del turno. Sono stati scartati i modelli offline, come Parakeet TDT v3 e Whisper, che decodificano soltanto alla chiusura della richiesta pur con un'accuratezza simile in italiano; il supporto di più famiglie selezionabili dalla configurazione, per mantenere un solo percorso di codice; Qwen3-ASR e Omnilingual, più lenti del tempo reale.

Ogni flusso comincia con un secondo di silenzio perché il modello incluso perde la prima parola quando il parlato inizia subito; il satellite invia già una riserva di audio precedente al parlato, ma la trascrizione non deve dipendere dal client. La trascrizione in tempo reale richiede una CPU x86_64 con istruzioni AVX2; su una CPU senza AVX2 la decodifica resta indietro rispetto al parlato e il testo arriva dopo la fine della frase con un ritardo che cresce con la durata del turno.

#### Concept References
  * [Turno vocale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#turno-vocale)

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Configurazione facoltativa della voce](../Contracts/FamilyConversation.md#configurazione-facoltativa-della-voce)
  * [Modelli vocali scaricati nell'immagine del backend](../Contracts/ExternalContracts.md#modelli-vocali-scaricati-nellimmagine-del-backend)

#### Relations
  * derivedFrom: [Elaborazione vocale locale con sherpa-onnx](../../../ambrogio-model/system-model/Requirements/VoiceConversation.md#elaborazione-vocale-locale-con-sherpa-onnx)
  * satisfiedBy: [local-speech-components.ts](../../packages/conversations/src/adapters/in/session/local-speech-components.ts)
  * satisfiedBy: [streaming-recognition.ts](../../packages/conversations/src/adapters/in/session/streaming-recognition.ts)
  * satisfiedBy: [streaming-recognizer.worker.ts](../../packages/conversations/src/adapters/in/session/streaming-recognizer.worker.ts)
  * satisfiedBy: [streaming-transcriber.ts](../../packages/conversations/src/adapters/in/session/streaming-transcriber.ts)
  * satisfiedBy: [voice-config.ts](../../packages/conversations/src/adapters/out/voice-config.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Trasmissione progressiva della risposta del turno

Quando il backend produce la risposta a un turno ammesso, deve trasmetterla progressivamente durante la generazione nella sessione del client che ha inviato il turno, nel tipo di contenuto richiesto dal client, conforme alla trasmissione in uscita del protocollo conversazionale.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Trasporto HTTP dei connettori MCP

Quando Ambrogio connette un agente specializzato al suo server MCP nella prima implementazione, deve usare il trasporto MCP Streamable HTTP verso l'endpoint configurato per quell'agente.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * specify: [Estensione tramite connettori MCP](../../../ambrogio-model/system-model/Capabilities/Product.md#estensione-tramite-connettori-mcp)
---

### Validazione del formato negli ingressi conversazionali

Quando il canale conversazionale riceve un messaggio, il suo adapter deve verificarne forma e decodifica rispetto allo schema del protocollo prima di invocare il caso d'uso conversazionale, interrompendo il flusso per input non validi senza attribuirsi le regole di stato della conversazione.

#### Details
Origine: baseline Reqvire «Shape validation in inbound adapters», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [protocol-decoder.ts](../../packages/conversations/src/adapters/in/session/protocol-decoder.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Validazione strutturale delle richieste conversazionali HTTP

Quando un ingresso HTTP riceve una richiesta per le operazioni conversazionali, deve verificare la forma dei dati ricevuti prima di invocare il caso d'uso, rifiutando le rappresentazioni non valide senza modificare implicitamente i valori.

#### Details
Origine: baseline Reqvire «Shape validation in inbound adapters», adottata; «Structural validation of HTTP requests», adottata; «Declared policy for unknown input fields», adottata; «Explicit field-wise conversion in inbound adapters», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * satisfiedBy: [get-conversation.schemas.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.schemas.ts)
  * satisfiedBy: [list-conversations.schemas.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.schemas.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Value Object immutabili con uguaglianza esplicita

Quando il Domain del modulo «Conversazioni» rappresenta un concetto confrontato per valore con regole proprie, come un'identità, deve usare un Value Object che conserva il valore invariato dopo la costruzione e definisce l'uguaglianza esplicitamente sui componenti significativi, non sull'identità del riferimento, su una serializzazione generica o sull'enumerazione automatica delle proprietà.

#### Details
Origine: baseline Reqvire «Value Object for meaningful values», adottata; «Immutable Value Objects with explicit equality», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Classi di identità di conversazioni e turni](../Contracts/FamilyConversation.md#classi-di-identità-di-conversazioni-e-turni)

#### Relations
  * satisfiedBy: [identities.ts](../../packages/conversations/src/domain/identities.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---
