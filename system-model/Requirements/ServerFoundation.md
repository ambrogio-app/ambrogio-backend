# Elements

### Arresto controllato dei nuovi turni

Quando il server riceve una richiesta di arresto ordinato, deve smettere di accettare nuovi turni prima di interrompere quelli attivi e chiudere le risorse.

#### Metadata
  * type: requirement

#### Contract References
  * [Politica di interruzione nell'arresto ordinato](../Contracts/ServerFoundation.md#politica-di-interruzione-nellarresto-ordinato)

#### Relations
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Assenza dei log HTTP automatici

Quando il runtime HTTP del server abilita il logger di Fastify, non deve emettere automaticamente eventi diagnostici di ricezione della richiesta o invio della risposta.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Assenza di account e autenticazione applicativa nell'MVP

Durante l'MVP, il server Ambrogio non deve implementare account utente né autenticazione applicativa per i propri ingressi pubblici.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Assenza di consegna differita degli eventi di dominio

Nella prima versione, Ambrogio non deve conservare eventi di dominio per consegne successive né pubblicarli tramite code o outbox.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Assenza di log definitivi nei componenti intermedi

Quando un componente intermedio del server si limita a propagare un guasto inatteso, non deve registrarlo nuovamente come errore diagnostico definitivo.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [get-conversation.use-case.ts](../../packages/conversations/src/application/get-conversation.use-case.ts)
  * satisfiedBy: [list-conversations.use-case.ts](../../packages/conversations/src/application/list-conversations.use-case.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Assenza di logger in Domain e nei casi d'uso

Il codice Domain e i casi d'uso Application dei moduli business del server non devono dipendere da un logger, nemmeno tramite porte o import di soli tipi.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Assenza di un catalogo globale dei rifiuti dei casi d'uso

Il server non deve definire un catalogo globale condiviso dei rifiuti previsti dei casi d'uso Application.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Blocco locale dei commit con segreti

Quando un clone del repository ha attivato gli hook Git versionati e viene creato un commit, il commit deve essere impedito se le modifiche in staging contengono un segreto oppure se lo scanner dei segreti non è disponibile.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Profilo di scansione dei segreti con gitleaks](../Contracts/ServerFoundation.md#profilo-di-scansione-dei-segreti-con-gitleaks)

#### Relations
  * satisfiedBy: [pre-commit](../../.githooks/pre-commit)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Campi specifici dei rifiuti previsti

Le varianti di rifiuto previsto di Domain, Application e delle porte del server devono contenere, oltre a `kind`, soltanto eventuali campi specifici tipizzati, stabili nel loro significato e necessari al chiamante, senza imporre campi generici comuni obbligatori a tutte le varianti.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Caricamento iniziale dei JSON di configurazione

Quando un processo del server avvia un ingresso, deve leggere una volta all'avvio i file JSON locali dei componenti necessari a quell'ingresso, prima di attivarli, senza sostituire i valori di configurazione dei file con variabili d'ambiente.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Chiusura delle risorse dopo l'interruzione dei turni

Quando il server conclude un arresto ordinato, deve chiudere le risorse dei turni dopo averne richiesto l'interruzione e aver conservato lo stato dei turni interrotti.

#### Metadata
  * type: requirement

#### Contract References
  * [Politica di interruzione nell'arresto ordinato](../Contracts/ServerFoundation.md#politica-di-interruzione-nellarresto-ordinato)

#### Relations
  * satisfiedBy: [main.ts](../../apps/server/src/main.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Compilazione TypeScript strict del server

La compilazione TypeScript del server deve avere l'opzione effettiva `strict` abilitata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Configurazione esplicita dell'ascolto HTTP

Quando il processo avvia l'ingresso HTTP, deve usare un indirizzo host e una porta dichiarati esplicitamente nel JSON locale del componente HTTP e impedire l'avvio se tali valori sono assenti o invalidi.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [http-config.ts](../../apps/server/src/runtime/http-config.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Conservazione dell'errore originale durante la serializzazione

Quando il logger del server serializza il campo `err` di un log diagnostico definitivo, la serializzazione non deve modificare l'oggetto `Error` originale né gli oggetti della sua catena `cause` mantenuti in memoria.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Contesto operativo con Error e cause

Quando un `catch` del server aggiunge un contesto operativo concreto a un guasto inatteso, deve costruire un nuovo `Error` con un messaggio che descriva l'operazione fallita nel linguaggio del componente e con l'opzione `cause` pari per identità al valore originale, senza modificarlo.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Controlli CI delle modifiche funzionali del server

Quando il server contiene codice applicativo e una modifica funzionale viene proposta per l'integrazione, la CI deve eseguire la validazione e il lint del modello Reqvire, la compilazione TypeScript del server e la suite backend con Vitest, comprendente prove degli adapter di persistenza su SQLite reale quando tali adapter esistono. L'integrazione deve essere impedita se uno di questi controlli fallisce.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Controllo dell'accesso nell'installazione

Quando l'MVP è installato senza autenticazione applicativa, il deployment deve limitare la raggiungibilità degli ingressi del server ai client ammessi dall'installatore tramite controlli di rete e, se presente, reverse proxy.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Credenziali API nel JSON del componente

Quando un componente del server usa credenziali per un'API esterna, deve leggere tali credenziali dal proprio file JSON di configurazione locale effettivo.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Definizione locale del tipo Result

Ogni modulo business del server che usa `Result<T, E>` deve definire il tipo nel proprio package, senza importarlo da un altro package.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Diagnostica dei guasti nei componenti tecnici

Quando un guasto inatteso del server richiede diagnostica, la diagnostica deve essere gestita dai componenti tecnici che trattano il guasto.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Diagnostica del mancato avvio del server

Se la preparazione del processo server fallisce prima che il server sia in ascolto, il processo deve emettere un unico log diagnostico definitivo che identifichi la causa del mancato avvio senza riprodurre valori segreti, comunicare il mancato avvio su stderr e terminare con un codice di uscita non riuscito.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [main.ts](../../apps/server/src/main.ts)
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [startup-failure.ts](../../apps/server/src/runtime/startup-failure.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Dichiarazioni del caso d'uso nello stesso file

Quando un caso d'uso Application del server espone rifiuti previsti, la sua firma callable, la factory e l'unione dei rifiuti osservabili devono essere dichiarate nello stesso file `<use-case>.use-case.ts`.

#### Metadata
  * type: requirement

#### Contract References
  * [Convenzione dei nomi di casi d'uso e adapter](../Contracts/ServerFoundation.md#convenzione-dei-nomi-di-casi-duso-e-adapter)

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Discriminante kind dei rifiuti previsti

Ogni variante di rifiuto previsto di Domain, Application o di una porta del server deve avere un campo `kind` con un valore letterale distinto da quello delle altre varianti della stessa unione.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Distinzione dei rifiuti senza classi o instanceof

Le varianti di rifiuto previsto di Domain, Application e delle porte del server non devono essere classi né essere distinte tramite `instanceof`.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Distribuzione del server come immagine Docker

Quando il progetto distribuisce il server, deve fornire un'immagine Docker eseguibile del server.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [Dockerfile](../../Dockerfile)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Distribuzione mirata della configurazione validata

Quando il processo ha validato i JSON dei componenti attivi, la composition root deve fornire a ciascun componente soltanto i valori di configurazione che gli servono, già convertiti nei tipi previsti, senza far leggere direttamente file o variabili d'ambiente a Domain e ai casi d'uso Application.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di bootstrap dei JSON dei componenti](../Contracts/ServerFoundation.md#profilo-di-bootstrap-dei-json-dei-componenti)

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Eccezioni costruite come Error

Quando il codice TypeScript del server costruisce un'eccezione per un guasto tecnico non tradotto o un bug, deve costruire un oggetto `Error`.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Esclusione dalla cache delle risposte conversazionali HTTP

Quando l'API HTTP risponde con dati di una conversazione, inclusi storico, elenco e flussi di aggiornamento, deve includere l'header `Cache-Control: no-store`.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Esclusione dei dettagli tecnici dal messaggio pubblico

Quando un confine del server comunica alla famiglia un messaggio per un guasto, il messaggio pubblico non deve contenere cause, stack, messaggi tecnici del provider o il valore originale dell'eccezione.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [history-route.adapter.ts](../../packages/conversations/src/adapters/in/http/history-route.adapter.ts)
  * satisfiedBy: [list-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Esclusione dei file di configurazione effettivi dagli artefatti

Quando il server usa file di configurazione locali effettivi, tali file devono restare esterni al repository Git e all'immagine container.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [.dockerignore](../../.dockerignore)
  * satisfiedBy: [Dockerfile](../../Dockerfile)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Esclusione della raccolta automatica di dati nei log

Quando il runtime HTTP del server emette eventi diagnostici, il logger e le loro integrazioni non devono acquisire automaticamente testi delle conversazioni, corpi o header HTTP, input o output dei casi d'uso e credenziali.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Esecuzione del server senza Docker Compose

Quando un installatore avvia l'immagine Docker del server, deve poterlo fare senza usare Docker Compose; un eventuale file Compose del progetto ha solo il ruolo di esempio di avvio.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [Dockerfile](../../Dockerfile)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Esempi di configurazione privi di credenziali

Quando il repository fornisce esempi di file di configurazione JSON, tali esempi non devono contenere credenziali effettive.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [home-assistant.json](../../examples/agents/home-assistant.json)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### File JSON separato per componente configurabile

Quando un componente del server richiede configurazione locale, la sua configurazione deve risiedere in un file JSON dedicato, separato dai file di configurazione degli altri componenti.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di bootstrap dei JSON dei componenti](../Contracts/ServerFoundation.md#profilo-di-bootstrap-dei-json-dei-componenti)

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Firma Result dei casi d'uso con rifiuti previsti

Quando un caso d'uso Application del server prevede rifiuti, la sua firma TypeScript deve restituire `Result<T, E>`, eventualmente racchiuso in `Promise`, con `E` pari all'unione chiusa delle varianti dichiarate nel contratto del caso d'uso.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Firma Result delle porte con rifiuti previsti

Quando una porta Application del server prevede rifiuti, la sua firma TypeScript deve restituire `Result<T, E>`, eventualmente racchiuso in `Promise`, con `E` pari all'unione chiusa delle varianti dichiarate nel contratto della porta.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Formato e flussi dei log tecnici

Quando il runtime del server HTTP emette un evento diagnostico tecnico, deve scrivere un evento JSON strutturato per riga nel flusso predefinito definito per il relativo ingresso.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Gestione esaustiva dei rifiuti negli adapter inbound

Quando un adapter inbound del server rappresenta gli esiti di un caso d'uso, deve gestire tutte le varianti dell'unione dei rifiuti osservabili dichiarata dal caso d'uso.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Gestione esplicita dei rifiuti delle porte

Quando un caso d'uso Application del server riceve da una porta un rifiuto previsto, deve gestire esplicitamente ogni variante dichiarata dal contratto della porta nel proprio flusso.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [begin-turn.use-case.ts](../../packages/conversations/src/application/begin-turn.use-case.ts)
  * satisfiedBy: [complete-turn.use-case.ts](../../packages/conversations/src/application/complete-turn.use-case.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### HSTS legato all'HTTPS pubblico

Quando il deployment dichiara che l'origine pubblica dell'API HTTP usa HTTPS, il server deve emettere `Strict-Transport-Security` secondo una politica esplicita; quando l'origine pubblica non usa HTTPS, non deve emettere tale header.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [http-config.ts](../../apps/server/src/runtime/http-config.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Header di sicurezza sulle risposte HTTP

Quando il server HTTP emette una risposta, incluse risposte di errore e rotte non trovate, deve applicare il profilo di header di sicurezza fornito da `@fastify/helmet` registrato globalmente, con sole eccezioni esplicite motivate dal contratto della rotta o del deployment.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Identificativo di correlazione delle richieste HTTP

Quando il server riceve una richiesta HTTP, il confine HTTP deve generare per quella richiesta un `correlationId` UUID v4 distinto e includerlo negli eventi diagnostici relativi alla richiesta.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Identificativo di richiesta nelle risposte HTTP

Quando il server emette una risposta HTTP gestita, inclusa una risposta di errore, deve riportare nell'header `X-Request-Id` il medesimo `correlationId` generato per la richiesta.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Implementazione Fastify dell'API HTTP

L'API HTTP del server deve essere implementata con Fastify.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Inoltro dei log affidato al deployment

Quando è richiesta la raccolta centralizzata dei log tecnici del server HTTP, l'inoltro verso il sistema di raccolta deve essere configurato nel deployment, senza integrare nel codice applicativo un backend di log specifico.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Interruzione dei turni durante l'arresto

Quando il server riceve una richiesta di arresto ordinato, deve interrompere i turni attivi senza attendere che completino la risposta.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [main.ts](../../apps/server/src/main.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Isolamento degli adapter inbound dai rifiuti interni

Quando un adapter inbound del server rappresenta gli esiti di un caso d'uso, non deve importare né riconoscere i tipi di rifiuto interni delle porte o del Domain, inclusi gli import di soli tipi.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Limite dei corpi delle richieste HTTP

Quando una rotta HTTP riceve un corpo, il server deve applicare un limite esplicito e positivo alla sua dimensione prima di invocare il caso d'uso; se il corpo supera il limite, deve rispondere con HTTP 413 e un errore JSON pubblico sicuro senza avviare l'operazione richiesta.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Log error del fallback pubblico

Quando un guasto tecnico inatteso, un bug o un valore lanciato sconosciuto raggiunge il fallback pubblico HTTP del server e il canale diagnostico è disponibile, il confine che decide l'esito esterno deve emettere un log diagnostico definitivo di livello `error` per quel guasto.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Mapping esaustivo dei rifiuti previsti

Quando un mapping del server deve gestire tutte le varianti di un'unione di rifiuti previsti, il codice TypeScript deve usare uno `switch` su `kind` con un ramo per ogni variante e un `default` che passi il valore completo della variante a `assertNever`.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Nessun log automatico per esiti previsti

Quando il server gestisce un rifiuto previsto di Domain o Application, un errore di protocollo previsto o un guasto tecnico tradotto in un esito previsto, non deve emettere automaticamente un log dedicato di livello `warn` o `error` per il solo verificarsi di tale esito.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Nome stabile degli eventi diagnostici

Quando il logger del server HTTP emette un evento diagnostico, la riga JSON deve contenere un campo `event` con un nome stabile dichiarato nel punto di emissione, indipendente dai dati della singola esecuzione.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Nomi dei file secondo il ruolo architetturale

I file del codice di produzione devono seguire una convenzione esplicita e uniforme che renda riconoscibili i casi d'uso e gli adapter secondo la responsabilità effettivamente realizzata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [session-route.adapter.ts](../../apps/server/src/adapters/in/session-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Normalizzazione diagnostica nel confine definitivo

Quando il confine tecnico HTTP del server gestisce definitivamente un guasto inatteso, deve normalizzare una sola volta il valore catturato per la diagnostica, conservando l'identità di un `Error` già presente oppure creando un `Error` per un valore diverso, secondo il contratto di normalizzazione diagnostica. I componenti intermedi non devono normalizzare nuovamente il guasto.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [history-route.adapter.ts](../../packages/conversations/src/adapters/in/http/history-route.adapter.ts)
  * satisfiedBy: [list-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Oggetto Error nel campo err del log definitivo

Quando il confine HTTP del server chiama il logger per un log diagnostico definitivo, il campo strutturato `err` deve contenere l'oggetto `Error` che rappresenta il guasto, conservando in memoria la catena `cause` presente.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Origini CORS esplicite dell'API HTTP

Quando l'API HTTP riceve una richiesta con un'origine cross-origin, deve autorizzare CORS solo se tale origine è esplicitamente configurata per il componente HTTP; in assenza di origini configurate non deve autorizzare alcuna origine.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [http-config.ts](../../apps/server/src/runtime/http-config.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Perimetro iniziale dei segnali di osservabilità

Nella prima versione, il runtime HTTP del server deve usare i log tecnici strutturati e gli identificativi di correlazione già previsti come segnali di osservabilità, senza introdurre sistemi separati di metriche, tracing distribuito o audit degli eventi applicativi.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Preparazione del server TypeScript ESM

Quando viene preparato il server per l'esecuzione, il progetto deve produrre a partire da sorgenti TypeScript un artefatto JavaScript ESM avviabile con Node.js 24 o successivo.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Proiezione dei rifiuti bloccanti delle porte

Quando un rifiuto previsto ricevuto da una porta impedisce di completare un caso d'uso Application del server, il caso d'uso deve tradurlo mediante un mapping esplicito in una variante dichiarata dal proprio contratto.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [begin-turn.use-case.ts](../../packages/conversations/src/application/begin-turn.use-case.ts)
  * satisfiedBy: [complete-turn.use-case.ts](../../packages/conversations/src/application/complete-turn.use-case.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Propagazione dei guasti inattesi

Quando un guasto tecnico inatteso o un bug si verifica nel server, il componente che lo rileva deve propagarlo come eccezione fino al confine che lo gestisce.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [get-conversation.use-case.ts](../../packages/conversations/src/application/get-conversation.use-case.ts)
  * satisfiedBy: [list-conversations.use-case.ts](../../packages/conversations/src/application/list-conversations.use-case.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Propagazione senza wrapper superflui

Quando un guasto inatteso attraversa un layer del server senza che sia aggiunto un contesto operativo concreto, il layer deve propagare il valore originale senza costruire un nuovo wrapper.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Proprietà e unicità del log diagnostico definitivo

Quando un componente del server decide definitivamente l'esito esterno di un guasto inatteso, deve possedere l'eventuale log diagnostico definitivo e non emetterne più di uno per quel guasto.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [history-route.adapter.ts](../../packages/conversations/src/adapters/in/http/history-route.adapter.ts)
  * satisfiedBy: [list-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Pubblicazione dell'immagine Docker del server

Quando viene creato un tag di release `v*` del backend, il progetto deve pubblicare l'immagine Docker eseguibile del server in un registro accessibile all'installazione homelab.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [publish-image.yml](../../.github/workflows/publish-image.yml)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
  * verifiedBy: [Dimostrazione della pubblicazione dell'immagine Docker del server](../Verifications/ServerFoundation.md#dimostrazione-della-pubblicazione-dellimmagine-docker-del-server)
---

### Rappresentazione di err nel log JSON

Quando il logger del server emette la riga JSON di un log diagnostico definitivo HTTP, la riga deve contenere una rappresentazione serializzata del campo `err` conforme al profilo controllato di serializzazione.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [project-error.ts](../../packages/conversations/src/project-error.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Rifiuti osservabili dichiarati per caso d'uso

Quando un caso d'uso Application del server prevede rifiuti, il suo contratto Application deve dichiarare un insieme chiuso che contenga soltanto i rifiuti osservabili dal chiamante.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Rifiuti previsti come valori di esito

Quando un'operazione Domain, un caso d'uso Application o una porta Application del server prevede un rifiuto dichiarato nel proprio contratto, deve restituirlo come valore distinguibile dal successo.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [sqlite-conversation-write.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-write.adapter.ts)
  * satisfiedBy: [begin-turn.use-case.ts](../../packages/conversations/src/application/begin-turn.use-case.ts)
  * satisfiedBy: [complete-turn.use-case.ts](../../packages/conversations/src/application/complete-turn.use-case.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Scansione dei segreti nella CI del backend

Quando una modifica viene inviata al repository remoto o proposta per l'integrazione, e prima della pubblicazione di un'immagine di release, la CI deve scansionare l'intera storia Git del repository alla ricerca di segreti e impedire integrazione e pubblicazione se la scansione rileva un segreto o non può essere completata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [publish-image.yml](../../.github/workflows/publish-image.yml)
  * satisfiedBy: [secret-scan.yml](../../.github/workflows/secret-scan.yml)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Selezione esplicita dei campi diagnostici

Quando il runtime HTTP del server emette un evento diagnostico applicativo, la riga del log deve contenere soltanto i campi diagnostici scelti esplicitamente per quell'evento o per la configurazione del logger, senza acquisire automaticamente gli oggetti di ingresso, uscita o contesto.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [history-route.adapter.ts](../../packages/conversations/src/adapters/in/http/history-route.adapter.ts)
  * satisfiedBy: [list-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-route.adapter.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Separazione del messaggio pubblico dalla diagnosi tecnica

Quando un confine del server produce per lo stesso guasto un messaggio per la famiglia e una diagnosi tecnica, deve costruire le due rappresentazioni separatamente.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [consultation-server.ts](../../apps/server/src/runtime/consultation-server.ts)
  * satisfiedBy: [history-route.adapter.ts](../../packages/conversations/src/adapters/in/http/history-route.adapter.ts)
  * satisfiedBy: [list-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Struttura del tipo Result

Il tipo `Result<T, E>` definito da un modulo business del server deve rappresentare successo e rifiuto mediante un'unione discriminata immutabile conforme alla specifica della forma di Result.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Tipi distinti per i rifiuti di porte e casi d'uso

Quando un caso d'uso Application del server espone un rifiuto originato da una porta, la variante esposta deve avere un tipo nominato distinto dal tipo del rifiuto della porta; il contratto del caso d'uso non deve riutilizzare il tipo interno della porta.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Tipi nominati immutabili per i rifiuti previsti

Ogni variante di rifiuto previsto di Domain, Application o di una porta del server deve essere un tipo TypeScript nominato indipendente rappresentato da un oggetto `Readonly`.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Uso di Pino per il logging tecnico

Quando il server HTTP emette un evento diagnostico tecnico, deve usare Pino come logger del proprio runtime.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Validazione preventiva della configurazione attiva

Quando un processo del server prepara un ingresso, deve verificare presenza, formato e valori richiesti dei JSON dei componenti effettivamente attivi prima di creare o attivare le risorse che li usano; una configurazione non valida deve impedire l'attivazione dell'ingresso e produrre un errore sicuro al confine di avvio.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di bootstrap dei JSON dei componenti](../Contracts/ServerFoundation.md#profilo-di-bootstrap-dei-json-dei-componenti)

#### Relations
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Varianti Application negli esiti degli adapter inbound

Quando un adapter inbound del server rappresenta un rifiuto di un caso d'uso, deve usare soltanto le varianti esportate dall'API Application di quel caso d'uso.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Vitest come runner del backend

Quando la suite automatica del backend esegue le verifiche implementate nei package e nell'app server, deve usare Vitest come runner.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Voci italiane incluse nell'immagine

Quando il progetto distribuisce l'immagine Docker del backend, deve includere le voci italiane Riccardo x_low e Paola medium nel formato sherpa-onnx, ciascuna come directory con modello, `tokens.txt`, `espeak-ng-data/` e informazioni di provenienza, permettendo all'installazione di sostituire la directory delle voci senza ricostruire l'immagine.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [Dockerfile](../../Dockerfile)
  * satisfiedBy: [fetch-voices.mjs](../../scripts/fetch-voices.mjs)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

