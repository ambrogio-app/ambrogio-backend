# Elements

### Adapter tecnici nel package Conversazioni

Quando un componente tecnico esterno viene integrato come ingresso del modulo «Conversazioni» o come implementazione di una sua porta Application, l'adapter deve risiedere nel package «Conversazioni», rispettivamente in `src/adapters/in/` o `src/adapters/out/`.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Assemblaggio delle porte nella composition root

Quando l'applicazione server assembla il modulo «Conversazioni», deve scegliere e fornire le implementazioni delle porte Application tramite la propria composition root.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Assenza di accodamento dei turni

Quando Ambrogio non può avviare l'elaborazione di un nuovo turno al momento della richiesta, deve rifiutarlo come esito previsto senza accettarlo né conservarlo per eseguirlo in seguito.

#### Metadata
  * type: requirement

#### Contract References
  * [Occupazione della conversazione e ammissione dei turni](../Contracts/FamilyConversation.md#occupazione-della-conversazione-e-ammissione-dei-turni)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Autenticazione Bearer del client MCP

Quando un agente specializzato accede al proprio server MCP tramite Streamable HTTP, il client MCP comune deve poter usare un Bearer token letto dalla configurazione JSON di quell'agente per autenticare le richieste verso l'endpoint configurato.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * specify: [Estensione tramite connettori MCP](../Capabilities/FamilyAssistance.md#estensione-tramite-connettori-mcp)
---

### Autenticazione OAuth tra servizi del client MCP

Quando la configurazione JSON di un agente specializzato richiede OAuth `client_credentials`, il client MCP comune deve ottenere e usare un token di accesso per il server MCP di quell'agente, senza richiedere un accesso interattivo della persona e senza presentare le credenziali a un authorization server diverso da quello configurato.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * specify: [Estensione tramite connettori MCP](../Capabilities/FamilyAssistance.md#estensione-tramite-connettori-mcp)
---

### Avvio consultivo dell'API conversazioni

Quando il processo avvia l'ingresso HTTP di consultazione delle conversazioni, deve rendere disponibili le rotte di elenco e storico dopo aver validato le configurazioni attive e preparato l'archivio.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [main.ts](../../apps/server/src/main.ts)
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Avvio dell'ingresso dei turni conversazionali

Quando il server avvia la conversazione con agenti configurati, deve rendere disponibile il canale conversazionale insieme alle rotte HTTP di elenco e storico, dopo aver validato i file degli agenti e preparato i loro connettori.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Cartelle del modulo Conversazioni

Il package del modulo business «Conversazioni» deve collocare il codice Domain in `src/domain/`, Application in `src/application/` e gli adapter che appartengono al package in `src/adapters/`.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Chiusura della risorsa SQLite conversazionale

Quando il server termina normalmente o fallisce durante l'avvio dopo aver creato la risorsa SQLite/Kysely dell'archivio, il proprietario deve chiudere la risorsa dopo le operazioni che ne dipendono.

#### Metadata
  * type: requirement

#### Contract References
  * [Ciclo di vita della risorsa SQLite conversazionale](../Contracts/FamilyConversation.md#ciclo-di-vita-della-risorsa-sqlite-conversazionale)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Chiusura della sessione conversazionale

Quando la sessione conversazionale di un client si chiude, Ambrogio deve rilasciarne le risorse senza interrompere i turni già ammessi e senza influenzare le sessioni degli altri client.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Classificazione degli esiti delle scritture conversazionali

Quando l'adapter SQLite dell'archivio esegue una mutazione conversazionale, deve comunicare un rifiuto previsto della porta soltanto se l'esito tecnico dimostra la condizione prevista dal contratto dell'operazione; deve propagare come guasto inatteso gli esiti non classificabili e non deve comunicare un successo senza che la postcondizione della mutazione sia soddisfatta.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [sqlite-conversation-write.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-write.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Client MCP comune ai connettori

Quando Ambrogio abilita un connettore a un server MCP configurato, deve usare un client MCP comune per stabilire la connessione, scoprire i tool disponibili e invocare quelli richiesti, senza richiedere un'implementazione del protocollo distinta per ogni server.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * specify: [Estensione tramite connettori MCP](../Capabilities/FamilyAssistance.md#estensione-tramite-connettori-mcp)
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
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
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
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
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
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Configurazione MCP dell'agente specializzato

Quando il server attiva un agente con connettore MCP, deve leggere la configurazione della sua connessione MCP dal file JSON dell'agente e consegnarla al client MCP comune.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * specify: [Estensione tramite connettori MCP](../Capabilities/FamilyAssistance.md#estensione-tramite-connettori-mcp)
---

### Configurazione del modello per agente

Quando il server attiva un agente, incluso l'orchestratore, deve leggere il file JSON locale dedicato a quell'agente e selezionare l'adapter del provider indicato, fornendogli l'identificativo del modello, la chiave API e soltanto le opzioni specifiche validate.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Configurazione della paginazione conversazionale

Quando il server prepara la consultazione dell'elenco delle conversazioni, deve individuare il file JSON locale del componente «Conversazioni» tramite `AMBROGIO_CONVERSATIONS_CONFIG_PATH` e usare i valori di dimensione della pagina e dimensione massima scelti dall'utente nel file, applicando i valori predefiniti concordati se i campi sono assenti e impedendo l'attivazione se il percorso o i valori sono invalidi.

#### Metadata
  * type: requirement

#### Contract References
  * [Pagine dell'elenco conversazioni](../Contracts/FamilyConversation.md#pagine-dellelenco-conversazioni)
  * [Profilo di bootstrap dei JSON dei componenti](../Contracts/ServerFoundation.md#profilo-di-bootstrap-dei-json-dei-componenti)

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [conversation-config-path.ts](../../apps/server/src/runtime/conversation-config-path.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conservazione del testo originale del turno

Quando Ambrogio accetta un turno testuale dalla chat o dalla trascrizione vocale, deve conservare il testo ricevuto senza rimuovere né modificare gli spazi iniziali, finali o interni. L'eventuale rimozione degli spazi per verificare se il testo è vuoto non modifica il testo accettato.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conservazione dello scambio testuale

Quando Ambrogio comunica l'esito di un turno rappresentato come testo, deve conservare nello stesso scambio il testo del turno e il testo della risposta o del messaggio di errore.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
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
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conservazione solo testuale della conversazione

Quando Ambrogio conserva una conversazione, deve conservarne la rappresentazione testuale senza conservare registrazioni audio.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Continuazione di ogni conversazione da qualunque client

Quando un client invia un turno con l'identificativo di una conversazione conservata, Ambrogio deve aggiungere il nuovo scambio alla stessa conversazione, indipendentemente dall'ingresso in cui la conversazione è iniziata e dal tipo di contenuto del turno.

#### Metadata
  * type: requirement

#### Contract References
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
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
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Contratti delle porte nei termini di Conversazioni

Quando un caso d'uso del modulo «Conversazioni» richiede una capacità esterna, la sua porta Application deve esprimere le operazioni e i dati necessari nel linguaggio del modulo, senza esporre tipi o chiamate specifici del fornitore; l'adapter deve tradurre tra tale contratto e l'integrazione concreta.

#### Metadata
  * type: requirement

#### Contract References
  * [Adozione di AI SDK nei layer conversazionali](../Contracts/AiSdkIntegration.md#adozione-di-ai-sdk-nei-layer-conversazionali)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Contratti di lettura separati dell'archivio conversazioni

Quando Application del modulo «Conversazioni» consulta lo storico o l'elenco delle conversazioni, deve usare contratti di lettura distinti dalle operazioni di scrittura e adatti ai dati richiesti dal caso d'uso.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-history-read.ts](../../packages/conversations/src/application/conversation-history-read.ts)
  * satisfiedBy: [conversation-list-read.ts](../../packages/conversations/src/application/conversation-list-read.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Contratto di scrittura dell'archivio conversazioni

Quando Application del modulo «Conversazioni» conserva turni o esiti, deve usare un contratto di persistenza dedicato al modello di scrittura della conversazione, con semantica sufficiente alle transizioni richieste dai casi d'uso. Il contratto può esporre il salvataggio dell'aggregato oppure operazioni di transizione esplicite; non deve imporre un'interfaccia CRUD universale ai casi d'uso.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-write.ts](../../packages/conversations/src/application/conversation-write.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conversione esplicita dei dati conversazionali persistenti

Quando un adapter del modulo «Conversazioni» legge o scrive l'archivio SQLite, deve convertire esplicitamente tra le rappresentazioni tecniche delle righe e i valori Domain o le proiezioni Application previsti dai rispettivi contratti, senza esporre righe o tipi Kysely a Domain e Application.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Creazione della conversazione all'ammissione del turno

Quando un client invia un turno senza identificativo di conversazione, Ambrogio deve creare una nuova conversazione insieme all'ammissione di quel turno; un turno rifiutato non deve creare una conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Occupazione della conversazione e ammissione dei turni](../Contracts/FamilyConversation.md#occupazione-della-conversazione-e-ammissione-dei-turni)

#### Relations
  * satisfiedBy: [sqlite-conversation-write.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-write.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Dati Application dei casi d'uso conversazionali

Quando un caso d'uso del modulo «Conversazioni» riceve dati di ingresso o produce dati di successo, deve usare contratti definiti in Application e indipendenti dai formati HTTP e voce. Gli adapter di ingresso devono tradurre i rispettivi dati di protocollo in tali contratti e rappresentarne gli esiti nel proprio formato.

#### Metadata
  * type: requirement

#### Contract References
  * [Adozione di AI SDK nei layer conversazionali](../Contracts/AiSdkIntegration.md#adozione-di-ai-sdk-nei-layer-conversazionali)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Descrizione degli agenti specializzati per l'orchestrazione

Quando Ambrogio prepara un agente specializzato da un file JSON, deve rendere disponibile all'orchestratore una descrizione dell'agente per permettere la scelta della delega.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Determinazione della replica attesa

Quando produce la risposta a un turno, il backend deve determinare se essa richiede una replica della famiglia, indipendentemente dal tipo di contenuto del turno e della risposta, mantenendo sul backend la responsabilità di questa decisione.

#### Metadata
  * type: requirement

#### Contract References
  * [Indicazione della replica attesa](../Contracts/FamilyConversation.md#indicazione-della-replica-attesa)

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Diagnostica del guasto nella produzione della risposta

Quando un turno ammesso si conclude con l'errore pubblico per un guasto tecnico nella lettura dello storico o nella produzione della risposta, il componente che comunica l'esito al client deve registrare un solo evento diagnostico con la causa tecnica del guasto, senza esporla nel messaggio pubblico né conservarla nello storico.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Diagnostica dei guasti nei componenti tecnici](ServerFoundation.md#diagnostica-dei-guasti-nei-componenti-tecnici)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Diagnostica del guasto tecnico di consegna

Quando la consegna di una notifica conversazionale fallisce per un guasto tecnico diverso dalla disconnessione del client, il componente tecnico che gestisce la consegna deve registrare il guasto nel canale diagnostico del server.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Diagnostica dei guasti nei componenti tecnici](ServerFoundation.md#diagnostica-dei-guasti-nei-componenti-tecnici)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Disabilitazione degli ingressi durante un turno

Quando un client elabora un turno o ne riproduce la risposta, deve impedire nuovi turni nella medesima interazione fino alla conclusione o all'interruzione, senza bloccare gli ingressi di altre conversazioni.

#### Metadata
  * type: requirement

#### Contract References
  * [Occupazione della conversazione e ammissione dei turni](../Contracts/FamilyConversation.md#occupazione-della-conversazione-e-ammissione-dei-turni)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Disponibilità degli agenti MCP dai file JSON

Quando il server avvia la conversazione con la directory degli agenti, deve rendere disponibile all'orchestratore ogni agente specializzato descritto da un file `<id>.json` valido presente nella directory, senza richiedere un elenco separato di agenti da abilitare.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * specify: [Estensione tramite connettori MCP](../Capabilities/FamilyAssistance.md#estensione-tramite-connettori-mcp)
---

### Disponibilità dello storico dopo riavvio

Quando Ambrogio viene riavviato, deve rendere nuovamente disponibili alla famiglia le conversazioni e gli scambi testuali conservati prima del riavvio.

#### Concept References
  * [Famiglia](../Thesaurus/Lessico.md#famiglia)
  * [Conversazione](../Thesaurus/Lessico.md#conversazione)
  * [Scambio](../Thesaurus/Lessico.md#scambio)

#### Metadata
  * type: requirement

#### Contract References
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Elaborazione parallela di conversazioni diverse

Quando riceve turni validi destinati a conversazioni diverse mentre è operativo, Ambrogio deve consentirne l'ammissione e l'elaborazione in parallelo senza attendere la conclusione dei turni delle altre conversazioni.

#### Metadata
  * type: requirement

#### Contract References
  * [Occupazione della conversazione e ammissione dei turni](../Contracts/FamilyConversation.md#occupazione-della-conversazione-e-ammissione-dei-turni)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [sqlite-conversation-write.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-write.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Elenco paginato delle conversazioni

Quando la famiglia consulta l'elenco delle conversazioni conservate, Ambrogio deve fornirlo a pagine invece di restituire l'intero elenco in una sola risposta.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [list-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-route.adapter.ts)
  * satisfiedBy: [sqlite-conversation-list-read.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-list-read.adapter.ts)
  * satisfiedBy: [list-conversations.use-case.ts](../../packages/conversations/src/application/list-conversations.use-case.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Forma TypeScript dei contratti Application

Quando Application del modulo «Conversazioni» dichiara una porta outbound a oggetto con metodi nominati, deve usare `interface`; quando dichiara dati, unioni o contratti callable, deve usare `type`.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-write.ts](../../packages/conversations/src/application/conversation-write.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Fornitura esplicita dell'ora corrente alla conversazione

Quando un caso d'uso Application del modulo «Conversazioni» richiede l'ora corrente per accettare un turno o valutare una regola temporale, deve ottenerla da una capacità di orologio fornita dalla composition root e passare l'istante necessario al Domain, senza leggere l'ora ambientale nel Domain.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Generazione degli identificativi prima del Domain

Quando un caso d'uso Application del modulo «Conversazioni» crea una conversazione o un turno, deve ottenere il nuovo identificativo tramite una capacità di generazione fornita dalla composition root e passarlo al Domain prima della creazione dello stato, senza generarlo dentro Domain o l'adapter di persistenza.

#### Metadata
  * type: requirement

#### Contract References
  * [Identità di conversazioni e turni](../Contracts/FamilyConversation.md#identità-di-conversazioni-e-turni)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Gestione del turno ammesso senza storico utilizzabile

Quando, dopo l'ammissione di un turno, il server non riesce a leggere uno storico utilizzabile per elaborarlo, Ambrogio deve provare a conservarne l'esito «Errore» e liberare l'occupazione; se la conservazione dell'esito fallisce, il server deve smettere di accettare nuovi turni fino al riavvio.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Identificativi UUID v4 di conversazioni e turni

Quando Ambrogio crea una nuova conversazione o accetta un nuovo turno, deve assegnargli un identificativo UUID v4 distinto, stabile nello storico e dopo il riavvio.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Import del Domain entro il proprio componente

Il codice di produzione Domain del modulo «Conversazioni» deve importare soltanto codice Domain dello stesso modulo, anche quando l'importazione riguarda solo tipi.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Import dell'Application entro il proprio modulo

Il codice di produzione Application del modulo «Conversazioni» deve importare soltanto codice Application o Domain dello stesso modulo, anche quando l'importazione riguarda solo tipi.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Indipendenza tecnica di Domain e Application

Il codice di produzione Domain e Application del modulo «Conversazioni» deve usare API standard ECMAScript indipendenti dall'ambiente e non deve dipendere da API Node.js né da package npm usati a runtime.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Ingressi testuali indipendenti dalla voce

Quando un'installazione non abilita l'interazione vocale, Ambrogio deve consentire l'uso della chat testuale senza richiedere la configurazione o l'avvio dei componenti necessari soltanto alla voce.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [voice-config.ts](../../packages/conversations/src/adapters/out/voice-config.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Integrazione esterna tramite porte e adapter

Quando un caso d'uso del modulo «Conversazioni» richiede una capacità tecnica esterna, Application deve dichiarare una porta per tale capacità e un adapter deve realizzarne l'integrazione concreta.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Integrità dello stato del turno nel Domain

Quando il modulo «Conversazioni» crea, modifica o ricostruisce lo stato di un turno, Domain deve ammettere soltanto stati e transizioni validi per quel turno, preservando identità e testo, e lasciare invariato lo stato se una transizione è rifiutata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Istanti validi e protetti della conversazione

Quando Application e Domain rappresentano un istante della conversazione, devono usare un `Date` valido. Gli oggetti Domain che ricevono o espongono un `Date` devono proteggerlo con copie difensive in ingresso e in uscita.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Istruzioni dell'agente nel JSON dell'utente

Quando il server attiva un agente, incluso l'orchestratore, deve leggere le istruzioni destinate a quell'agente dal suo file JSON locale gestito dall'utente e consegnarle soltanto al modello dell'agente interessato.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Lettura HTTP dell'elenco conversazioni

Quando un client della chat testuale consulta l'elenco delle conversazioni conservate, il backend deve restituire una pagina dell'elenco e un riferimento utilizzabile per richiedere la pagina successiva secondo il contratto HTTP pubblico dell'elenco.

#### Metadata
  * type: requirement

#### Contract References
  * [Pagine dell'elenco conversazioni](../Contracts/FamilyConversation.md#pagine-dellelenco-conversazioni)

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [list-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-route.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Lettura HTTP dello storico conversazionale

Quando un client della chat testuale consulta una conversazione conservata, il backend deve restituire lo storico testuale ordinato e lo stato corrente dei suoi turni mediante la risposta alla richiesta HTTP di lettura, secondo il contratto pubblico dello storico conversazionale.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [history-route.adapter.ts](../../packages/conversations/src/adapters/in/http/history-route.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Limite delle chiamate agli strumenti per agente

Quando un agente specializzato usa gli strumenti del proprio connettore MCP per elaborare un turno, Ambrogio deve arrestare ulteriori chiamate agli strumenti al raggiungimento del limite configurato nel file JSON di quell'agente e comunicare il guasto secondo il contratto pubblico del turno.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Estensione tramite connettori MCP](../Capabilities/FamilyAssistance.md#estensione-tramite-connettori-mcp)
---

### Localizzazione dell'errore conversazionale inatteso

Quando un turno ammesso termina con un guasto inatteso, Ambrogio deve comunicare e conservare lo stesso messaggio pubblico standard tradotto nella lingua scelta dall'utente nel file JSON locale del componente «Conversazioni».

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Migrazione automatica dell'archivio delle conversazioni

Quando l'archivio SQLite richiede migrazioni per la versione del server avviata, Ambrogio deve applicarle automaticamente prima di accettare nuovi turni e impedire l'avvio degli ingressi conversazionali se una migrazione fallisce.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Modulo business unico per la conversazione

I flussi applicativi di conversazione testuale e vocale del server devono appartenere al medesimo modulo business «Conversazioni».

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Nessuna ripetizione automatica del turno interrotto

Quando Ambrogio riconosce dopo un riavvio un turno interrotto senza esito conservato, non deve ripeterne automaticamente l'elaborazione né richiamare i connettori per quel turno.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati persistenti dei turni conversazionali](../Contracts/FamilyConversation.md#stati-persistenti-dei-turni-conversazionali)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Nomi delle porte Application secondo la capacità richiesta

Quando Application del modulo «Conversazioni» dichiara una porta verso una capacità esterna, deve darle un nome che descriva la capacità richiesta dal caso d'uso, senza incorporare il nome del prodotto, del protocollo o della libreria dell'implementazione tecnica.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [turn-capabilities.ts](../../packages/conversations/src/application/turn-capabilities.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Orchestrazione della risposta conversazionale

Quando Ambrogio elabora un turno della famiglia, l'agente orchestratore deve scegliere se formulare la risposta direttamente oppure affidare il compito a un agente con connettore MCP configurato, e l'esito deve appartenere alla stessa conversazione.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
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
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Persistenza degli istanti conversazionali in millisecondi Unix

Quando l'adapter dell'archivio salva o ricostruisce un istante della conversazione, deve convertirlo esplicitamente tra un `Date` valido nel codice e un intero di millisecondi trascorsi dall'epoca Unix nella riga SQLite, preservando esattamente l'istante.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [sqlite-conversation-write.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-write.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Precondizioni contestuali nel caso d'uso conversazionale

Quando un turno supera la validazione dell'ingresso, il caso d'uso Application deve coordinare le precondizioni dipendenti dal contesto della conversazione tramite le proprie porte e interrompere il flusso con un rifiuto previsto quando esse non sono soddisfatte, lasciando al Domain gli invarianti del turno e all'archivio SQLite la garanzia atomica dell'unico turno attivo per conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Proprietà dei controlli del turno conversazionale](../Contracts/FamilyConversation.md#proprietà-dei-controlli-del-turno-conversazionale)

#### Relations
  * satisfiedBy: [begin-turn.use-case.ts](../../packages/conversations/src/application/begin-turn.use-case.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Proprietà della risorsa SQLite conversazionale

Quando il server usa l'archivio delle conversazioni, la sua composition root deve creare un solo proprietario della risorsa SQLite/Kysely per quell'archivio e fornire agli adapter le capacità necessarie senza trasferire loro la responsabilità di chiuderla.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Recupero dello storico per il turno

Quando il backend riceve un nuovo turno con l'identificativo di una conversazione conservata, deve recuperare dall'archivio lo storico testuale di quella conversazione per elaborare il turno, senza riceverlo dal client.

#### Metadata
  * type: requirement

#### Contract References
  * [Trasmissione in ingresso del protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#trasmissione-in-ingresso-del-protocollo-ambrogio-v1)
  * [Archivio SQLite con Kysely](../Contracts/FamilyConversation.md#archivio-sqlite-con-kysely)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Registrazione dei turni conversazionali accettati

Quando Ambrogio accetta un turno rappresentato come testo dalla chat o dalla trascrizione vocale, deve conservarne il testo e lo stato in elaborazione prima di avviarne l'elaborazione, affinché il turno sia riconoscibile dopo un riavvio.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati persistenti dei turni conversazionali](../Contracts/FamilyConversation.md#stati-persistenti-dei-turni-conversazionali)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Riconoscimento del turno interrotto dopo riavvio

Quando il server si avvia e trova turni conservati come «In elaborazione» senza esito, Ambrogio deve contrassegnarli tutti come «Interrotti» prima di accettare nuovi turni e mostrarli come tali nelle rispettive conversazioni.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Rifiuto dei turni concorrenti nella stessa conversazione

Quando una conversazione ha un turno accettato il cui esito non è ancora conservato, Ambrogio deve rifiutare come esito previsto ogni nuovo turno destinato alla stessa conversazione, da qualunque client o ingresso, senza accettarlo né conservarlo.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [sqlite-conversation-write.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-write.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Rifiuto del turno prima dell'ammissione

Quando un turno non può essere ammesso, il backend deve comunicare al client il rifiuto con il motivo previsto e trasmettere il messaggio pubblico sicuro nella lingua configurata, senza conservare il turno; se l'archivio rifiuta temporaneamente l'ammissione, il server sta arrestandosi o gli ingressi sono disabilitati dopo una conclusione non conservata deve usare il motivo `unavailable`, e se un guasto tecnico inatteso avviene prima dell'ammissione deve usare il motivo `failure` con il messaggio standard nella lingua configurata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esclusione dei dettagli tecnici dal messaggio pubblico](ServerFoundation.md#esclusione-dei-dettagli-tecnici-dal-messaggio-pubblico)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
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
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Rifiuto del turno testuale vuoto

Quando il testo di un turno testuale è vuoto o contiene soltanto spazi bianchi, il backend deve rifiutare il turno con il motivo `invalid`, senza creare una conversazione né aggiungere uno scambio.

#### Metadata
  * type: requirement

#### Contract References
  * [Motivi di rifiuto del turno](../Contracts/ConversationProtocol.md#motivi-di-rifiuto-del-turno)
  * [Trasmissione in ingresso del protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#trasmissione-in-ingresso-del-protocollo-ambrogio-v1)

#### Relations
  * derivedFrom: [Rifiuto del turno prima dell'ammissione](#rifiuto-del-turno-prima-dellammissione)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
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
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
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
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Risposta parlata su richiesta del client

Quando un client chiede la risposta in audio e l'interazione vocale è abilitata, Ambrogio deve pronunciare alla famiglia la risposta e ogni messaggio pubblico del turno, trasmettendoli in audio.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Esclusione dell'audio persistente](../Contracts/FamilyConversation.md#esclusione-dellaudio-persistente)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [sherpa-synthesizer.ts](../../packages/conversations/src/adapters/in/session/sherpa-synthesizer.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Risposta parlata senza marcatura testuale

Quando Ambrogio pronuncia una risposta o un messaggio pubblico che contiene marcatura di formattazione Markdown, deve pronunciare soltanto il testo leggibile, senza leggere i simboli di formattazione; il testo conservato e trasmesso resta invariato.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Risposta parlata su richiesta del client](#risposta-parlata-su-richiesta-del-client)
  * satisfiedBy: [sentences.ts](../../packages/conversations/src/adapters/in/session/sentences.ts)
  * satisfiedBy: [sherpa-synthesizer.ts](../../packages/conversations/src/adapters/in/session/sherpa-synthesizer.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Risposta testuale nella conversazione

Quando la famiglia invia un turno, Ambrogio deve produrre una risposta testuale o un messaggio di errore nella conversazione a cui appartiene il turno, qualunque sia il tipo di contenuto con cui la risposta viene trasmessa.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Scoperta delle configurazioni degli agenti

Quando il server prepara gli agenti attivi, deve cercare i rispettivi file JSON in una directory dedicata stabilita dal prodotto e distinguere la configurazione dell'orchestratore da quelle degli agenti specializzati.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Scritture atomiche dello stato dei turni

Quando Ambrogio accetta, conclude o interrompe un turno, deve confermare insieme lo stato persistente del turno e l'occupazione della conversazione interessata in una transazione SQLite.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [migrations.ts](../../packages/conversations/src/adapters/out/sqlite/migrations.ts)
  * satisfiedBy: [recover-pending-turns.ts](../../packages/conversations/src/adapters/out/sqlite/recover-pending-turns.ts)
  * satisfiedBy: [sqlite-conversation-write.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-write.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
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
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Segnalazione della replica attesa

Quando conferma il completamento di un turno, il backend deve indicare esplicitamente al client se la risposta attende oppure non attende una replica della famiglia.

#### Metadata
  * type: requirement

#### Contract References
  * [Esiti del turno nel protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#esiti-del-turno-nel-protocollo-ambrogio-v1)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Selezione dell'archivio conversazionale all'avvio

Quando il processo prepara l'ingresso HTTP di consultazione, deve aprire l'archivio SQLite al percorso dichiarato nel JSON locale del componente «Conversazioni» e impedire l'avvio se il percorso manca o è invalido.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Separazione degli adapter di ingresso e uscita

Nel package del modulo business «Conversazioni», gli adapter d'ingresso presenti devono risiedere in `src/adapters/in/` e gli adapter che implementano porte Application presenti devono risiedere in `src/adapters/out/`.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Separazione delle responsabilità nel modulo Conversazioni

Il modulo business «Conversazioni» deve distinguere Domain, Application e adapter secondo le rispettive responsabilità definite per il modulo.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Transazioni brevi dell'archivio conversazioni

Quando Ambrogio esegue chiamate ad agenti o connettori oppure trasmette la risposta progressiva di un turno, non deve mantenere aperta una transazione SQLite relativa a quel turno.

#### Metadata
  * type: requirement

#### Contract References
  * [Confini atomici dell'archivio conversazioni](../Contracts/FamilyConversation.md#confini-atomici-dellarchivio-conversazioni)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Trascrizione del turno vocale

Quando la famiglia pronuncia un turno vocale trascrivibile, Ambrogio deve rappresentare quel turno nella conversazione mediante la sua trascrizione testuale.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Esclusione dell'audio persistente](../Contracts/FamilyConversation.md#esclusione-dellaudio-persistente)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [vosk-transcriber.ts](../../packages/conversations/src/adapters/in/session/vosk-transcriber.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Trasmissione progressiva della risposta del turno

Quando il backend produce la risposta a un turno ammesso, deve trasmetterla progressivamente durante la generazione nella sessione del client che ha inviato il turno, nel tipo di contenuto richiesto dal client, conforme alla trasmissione in uscita del protocollo conversazionale.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Trasporto HTTP dei connettori MCP

Quando Ambrogio connette un agente specializzato al suo server MCP nella prima implementazione, deve usare il trasporto MCP Streamable HTTP verso l'endpoint configurato per quell'agente.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * specify: [Estensione tramite connettori MCP](../Capabilities/FamilyAssistance.md#estensione-tramite-connettori-mcp)
---

### Validazione del formato negli ingressi conversazionali

Quando il canale conversazionale riceve un messaggio, il suo adapter deve verificarne forma e decodifica rispetto allo schema del protocollo prima di invocare il caso d'uso conversazionale, interrompendo il flusso per input non validi senza attribuirsi le regole di stato della conversazione.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [protocol-decoder.ts](../../packages/conversations/src/adapters/in/session/protocol-decoder.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Validazione strutturale delle richieste conversazionali HTTP

Quando un ingresso HTTP riceve una richiesta per le operazioni conversazionali, deve verificare la forma dei dati ricevuti prima di invocare il caso d'uso, rifiutando le rappresentazioni non valide senza modificare implicitamente i valori.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [history-route.adapter.ts](../../packages/conversations/src/adapters/in/http/history-route.adapter.ts)
  * satisfiedBy: [list-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-route.adapter.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

