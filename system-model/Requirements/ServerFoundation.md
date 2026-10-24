# Elements

### Ambiente di esecuzione dichiarato del backend

Il processo del backend deve leggere l'ambiente di esecuzione da `AMBROGIO_ENV` prima di ogni altra configurazione, rifiutare l'avvio se la variabile manca o non è valida, e applicare i valori predefiniti di sviluppo del componente HTTP soltanto nell'ambiente `development`, richiedendone il valore esplicito in `test` e `production`.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo dell'ascolto HTTP](../Contracts/ServerFoundation.md#profilo-dellascolto-http)
  * [Profilo dell'ambiente di esecuzione e del file d'ambiente locale](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#profilo-dellambiente-di-esecuzione-e-del-file-dambiente-locale)

#### Relations
  * derivedFrom: [Ambiente di esecuzione dichiarato](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#ambiente-di-esecuzione-dichiarato)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [http-config.ts](../../apps/server/src/runtime/http-config.ts)
  * satisfiedBy: [environment-variables.ts](../../packages/conversations/src/adapters/out/environment-variables.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Arresto controllato dei nuovi turni

Quando il server riceve una richiesta di arresto ordinato, deve smettere di accettare nuovi turni prima di interrompere quelli attivi e chiudere le risorse.

#### Details
Origine: baseline Reqvire «New work refused on shutdown», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Politica di interruzione nell'arresto ordinato](../Contracts/ServerFoundation.md#politica-di-interruzione-nellarresto-ordinato)

#### Relations
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Arresto unico e ordinato del server

Quando riceve `SIGINT` o `SIGTERM`, il server deve avviare un solo arresto, smettere di accettare turni, interrompere quelli in corso, chiudere le sessioni conversazionali e poi, ciascuna una sola volta e in ordine inverso di acquisizione, il listener HTTP, i componenti vocali, l'archivio e le connessioni MCP degli agenti, e deve concludere l'arresto entro il tempo massimo del contratto «Finestra di arresto del server».

#### Metadata
  * type: requirement

#### Contract References
  * [Politica di interruzione nell'arresto ordinato](../Contracts/ServerFoundation.md#politica-di-interruzione-nellarresto-ordinato)
  * [Ciclo di vita dei processi di servizio con Node.js](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#ciclo-di-vita-dei-processi-di-servizio-con-nodejs)

#### Relations
  * derivedFrom: [Arresto unico, ordinato e limitato nel tempo](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#arresto-unico-ordinato-e-limitato-nel-tempo)
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [http-surface.ts](../../apps/server/src/composition/http-surface.ts)
  * satisfiedBy: [main.ts](../../apps/server/src/main.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [lifecycle.ts](../../apps/server/src/runtime/lifecycle.ts)
  * satisfiedBy: [server-process.ts](../../apps/server/src/runtime/server-process.ts)
  * satisfiedBy: [compose.example.yaml](../../compose.example.yaml)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Assenza dei log HTTP automatici

Il runtime HTTP del server non deve emettere automaticamente eventi diagnostici di ricezione della richiesta o invio della risposta: il logger interno di Fastify deve restare disattivato e gli eventi diagnostici HTTP devono passare soltanto dal logger minimo del backend.

#### Details
Origine: baseline Reqvire «No automatic HTTP request logs», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Assenza di account e autenticazione applicativa nell'MVP

Durante l'MVP, il server Ambrogio non deve implementare account utente né autenticazione applicativa per i propri ingressi pubblici.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../../../ambrogio-model/system-model/Capabilities/Product.md#assistenza-personale-domestica)
---

### Assenza di consegna differita degli eventi di dominio

Nella prima versione, Ambrogio non deve conservare eventi di dominio per consegne successive né pubblicarli tramite code o outbox.

#### Details
Origine: baseline Reqvire «No deferred delivery of domain events», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Assenza di log definitivi nei componenti intermedi

Quando un componente intermedio del server si limita a propagare un guasto inatteso, non deve registrarlo nuovamente come errore diagnostico definitivo.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Diagnosi definitiva unica dei guasti inattesi](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#diagnosi-definitiva-unica-dei-guasti-inattesi)
  * satisfiedBy: [get-conversation.use-case.ts](../../packages/conversations/src/application/get-conversation.use-case.ts)
  * satisfiedBy: [list-conversations.use-case.ts](../../packages/conversations/src/application/list-conversations.use-case.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Assenza di logger in Domain e nei casi d'uso

Il codice Domain e i casi d'uso Application dei moduli business del server non devono dipendere da un logger, nemmeno tramite porte o import di soli tipi.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Domain e casi d'uso senza logger](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#domain-e-casi-duso-senza-logger)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Assenza di un catalogo globale dei rifiuti dei casi d'uso

Il server non deve definire un catalogo globale condiviso dei rifiuti previsti dei casi d'uso Application.

#### Details
Origine: baseline Reqvire «No global catalog of use case rejections», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Audit delle dipendenze nella CI del backend

Quando la CI del backend viene eseguita, il job `Backend checks` di `.github/workflows/ci.yml` deve eseguire l'audit delle dipendenze del backend secondo «Audit delle dipendenze con pnpm», subito dopo l'installazione congelata, e deve fallire se l'audit fallisce.

#### Details
`pnpm-workspace.yaml` non dichiara `auditConfig`: il backend non ha avvisi accettati. Quando un avviso riguarda una dipendenza transitiva con una versione corretta compatibile con gli intervalli dichiarati, il lockfile si aggiorna con `pnpm update -r <pacchetto>`.

#### Metadata
  * type: requirement

#### Contract References
  * [Audit delle dipendenze con pnpm](../../../ambrogio-model/system-model/Contracts/ModelDrivenDevelopment.md#audit-delle-dipendenze-con-pnpm)

#### Relations
  * derivedFrom: [Audit delle vulnerabilità delle dipendenze](../../../ambrogio-model/system-model/Requirements/ModelDrivenDevelopment.md#audit-delle-vulnerabilità-delle-dipendenze)
  * satisfiedBy: [ci.yml](../../.github/workflows/ci.yml)
  * satisfiedBy: [pnpm-workspace.yaml](../../pnpm-workspace.yaml)
---

### Blocco locale dei commit con segreti

Il repository backend deve realizzare il controllo dei segreti prima del commit con l'hook versionato `.githooks/pre-commit`, eseguito quando il clone ha attivato gli hook con `git config core.hooksPath .githooks`.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di scansione dei segreti con gitleaks](../../../ambrogio-model/system-model/Contracts/ModelDrivenDevelopment.md#profilo-di-scansione-dei-segreti-con-gitleaks)

#### Relations
  * derivedFrom: [Controllo dei segreti prima del commit](../../../ambrogio-model/system-model/Requirements/ModelDrivenDevelopment.md#controllo-dei-segreti-prima-del-commit)
  * satisfiedBy: [pre-commit](../../.githooks/pre-commit)
  * specify: [Sviluppo governato dal modello](../../../ambrogio-model/system-model/Capabilities/Engineering.md#sviluppo-governato-dal-modello)
---

### Campi specifici dei rifiuti previsti

Le varianti di rifiuto previsto di Domain, Application e delle porte del server devono contenere, oltre a `kind`, soltanto eventuali campi specifici tipizzati, stabili nel loro significato e necessari al chiamante, senza imporre campi generici comuni obbligatori a tutte le varianti.

#### Details
Origine: baseline Reqvire «Rejection-specific fields only», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Caricamento iniziale della configurazione del backend

Quando un processo del backend avvia un ingresso, deve leggere una sola volta, all'avvio e prima di attivarli, la configurazione dei componenti necessari a quell'ingresso dalle variabili d'ambiente del processo, tramite il modulo di configurazione di ciascun componente, e non deve rileggerla durante il lavoro.

#### Details
Origine: baseline Reqvire «One-time configuration load at startup», adottata; «Ordered startup before accepting work», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo dell'ambiente di esecuzione e del file d'ambiente locale](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#profilo-dellambiente-di-esecuzione-e-del-file-dambiente-locale)

#### Relations
  * derivedFrom: [Modulo di configurazione per componente dalle variabili d'ambiente](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#modulo-di-configurazione-per-componente-dalle-variabili-dambiente)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [http-config.ts](../../apps/server/src/runtime/http-config.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * satisfiedBy: [environment-variables.ts](../../packages/conversations/src/adapters/out/environment-variables.ts)
  * satisfiedBy: [voice-config.ts](../../packages/conversations/src/adapters/out/voice-config.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Chiusura delle risorse dopo l'interruzione dei turni

Quando il server conclude un arresto ordinato, deve chiudere le risorse dei turni dopo averne richiesto l'interruzione e aver conservato lo stato dei turni interrotti.

#### Details
Origine: baseline Reqvire «Interrupted state persisted before closing resources», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Politica di interruzione nell'arresto ordinato](../Contracts/ServerFoundation.md#politica-di-interruzione-nellarresto-ordinato)

#### Relations
  * satisfiedBy: [main.ts](../../apps/server/src/main.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Comando di verifica completo del backend

Il backend deve offrire `pnpm verify` secondo «Comando di verifica completo con pnpm», con i comandi dei controlli successivi all'installazione nell'ordine del job `Backend checks` della CI.

#### Details
I comandi del punto 5 del contratto sono, in quest'ordine, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration` e `pnpm test:e2e`; la build precede il controllo TypeScript e i test perché i package del workspace esportano la propria cartella `dist/`, che l'applicazione server e i suoi test importano. La suite di test prova l'hook pre-commit e richiede gitleaks nel `PATH`.

#### Metadata
  * type: requirement

#### Contract References
  * [Comando di verifica completo con pnpm](../../../ambrogio-model/system-model/Contracts/ModelDrivenDevelopment.md#comando-di-verifica-completo-con-pnpm)

#### Relations
  * derivedFrom: [Comando di verifica completo](../../../ambrogio-model/system-model/Requirements/ModelDrivenDevelopment.md#comando-di-verifica-completo)
  * satisfiedBy: [package.json](../../package.json)
---

### Compilazione TypeScript strict del server

La compilazione TypeScript del server deve avere l'opzione effettiva `strict` abilitata.

#### Details
Origine: baseline Reqvire «Strict TypeScript compilation», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Configurazione esplicita dell'ascolto HTTP

Quando il processo avvia l'ingresso HTTP, deve ascoltare all'indirizzo host e alla porta dichiarati esplicitamente nella configurazione del componente HTTP e rifiutare l'avvio quando uno dei due valori manca o non è valido; soltanto nell'ambiente `development` i valori assenti devono assumere i valori predefiniti di sviluppo dichiarati dal componente.

#### Details
Origine: baseline Reqvire «Explicit HTTP listener configuration», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo dell'ambiente di esecuzione e del file d'ambiente locale](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#profilo-dellambiente-di-esecuzione-e-del-file-dambiente-locale)

#### Relations
  * satisfiedBy: [http-config.ts](../../apps/server/src/runtime/http-config.ts)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Conservazione dell'errore originale durante la serializzazione

Quando il logger del server serializza il campo `err` di un log diagnostico definitivo, la serializzazione non deve modificare l'oggetto `Error` originale né gli oggetti della sua catena `cause` mantenuti in memoria.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Diagnosi definitiva unica dei guasti inattesi](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#diagnosi-definitiva-unica-dei-guasti-inattesi)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Contesto operativo con Error e cause

Quando un `catch` del server aggiunge un contesto operativo concreto a un guasto inatteso, deve costruire un nuovo `Error` con un messaggio che descriva l'operazione fallita nel linguaggio del componente e con l'opzione `cause` pari per identità al valore originale, senza modificarlo.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Guasti inattesi propagati come eccezioni](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#guasti-inattesi-propagati-come-eccezioni)
  * satisfiedBy: [mcp-tool-client.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Controlli CI delle modifiche funzionali del server

Quando la CI del backend viene eseguita, il job `Backend checks` di `.github/workflows/ci.yml` deve eseguire il checkout del repository in `workspace/ambrogio-backend`, scaricare affiancati gli altri repository del modello con `ambrogio-model/scripts/checkout-workspace`, eseguire `ambrogio-model/scripts/model-checks` sulla cartella `workspace` e poi, nella cartella del backend, l'installazione delle dipendenze, l'audit delle dipendenze, la build, il controllo TypeScript e la suite backend con Vitest nella selezione veloce, con la prova dell'hook dei segreti e lo scanner installato e verificato, nella selezione di integrazione, con le prove degli adapter di persistenza su SQLite reale quando tali adapter esistono, e nella selezione dei processi compilati, e deve fallire se uno di questi controlli fallisce.

#### Details
Origine: baseline Reqvire «Persistence adapter tests against a real database», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di scansione dei segreti del backend](../Contracts/ServerFoundation.md#profilo-di-scansione-dei-segreti-del-backend)
  * [Checkout affiancato dello spazio di lavoro](../../../ambrogio-model/system-model/Contracts/ModelDrivenDevelopment.md#checkout-affiancato-dello-spazio-di-lavoro)
  * [Controlli del modello dello spazio di lavoro](../../../ambrogio-model/system-model/Contracts/ModelDrivenDevelopment.md#controlli-del-modello-dello-spazio-di-lavoro)

#### Relations
  * derivedFrom: [Controlli CI dei repository di Ambrogio](../../../ambrogio-model/system-model/Requirements/ModelDrivenDevelopment.md#controlli-ci-dei-repository-di-ambrogio)
  * satisfiedBy: [ci.yml](../../.github/workflows/ci.yml)
  * specify: [Sviluppo governato dal modello](../../../ambrogio-model/system-model/Capabilities/Engineering.md#sviluppo-governato-dal-modello)
---

### Controlli del modello prima del commit del backend

Quando si crea un commit in un clone del backend con gli hook versionati attivi, l'hook `.githooks/pre-commit` del backend deve eseguire i controlli del modello di `ambrogio-model` affiancato dopo la scansione dei segreti, secondo «Controlli del modello nell'hook pre-commit».

#### Metadata
  * type: requirement

#### Contract References
  * [Controlli del modello nell'hook pre-commit](../../../ambrogio-model/system-model/Contracts/ModelDrivenDevelopment.md#controlli-del-modello-nellhook-pre-commit)

#### Relations
  * derivedFrom: [Controlli del modello prima del commit](../../../ambrogio-model/system-model/Requirements/ModelDrivenDevelopment.md#controlli-del-modello-prima-del-commit)
  * satisfiedBy: [pre-commit](../../.githooks/pre-commit)
---

### Controlli obbligatori prima del merge del backend

Il ruleset del branch principale del repository backend deve richiedere come controlli superati il job `Backend checks` della CI e il job `Scan history for secrets` della scansione dei segreti.

#### Metadata
  * type: requirement

#### Contract References
  * [Ruleset del branch principale](../../../ambrogio-model/system-model/Contracts/ModelDrivenDevelopment.md#ruleset-del-branch-principale)

#### Relations
  * derivedFrom: [Controlli obbligatori prima del merge](../../../ambrogio-model/system-model/Requirements/ModelDrivenDevelopment.md#controlli-obbligatori-prima-del-merge)
  * specify: [Sviluppo governato dal modello](../../../ambrogio-model/system-model/Capabilities/Engineering.md#sviluppo-governato-dal-modello)
---

### Controllo dell'accesso nell'installazione

Quando l'MVP è installato senza autenticazione applicativa, il deployment deve limitare la raggiungibilità degli ingressi del server ai client ammessi dall'installatore tramite controlli di rete e, se presente, reverse proxy.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../../../ambrogio-model/system-model/Capabilities/Product.md#assistenza-personale-domestica)
---

### Costruzione del server separata dall'ascolto

La costruzione del server conversazionale deve preparare configurazione, agenti, archivio, componenti vocali e server HTTP e restituire il server, l'indirizzo di ascolto validato e la funzione di chiusura senza mettersi in ascolto, e l'entrypoint del processo deve aprire l'ascolto e decidere l'esito del processo; l'ingresso di prova pubblico deve seguire la stessa separazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Ciclo di vita dei processi di servizio con Node.js](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#ciclo-di-vita-dei-processi-di-servizio-con-nodejs)

#### Relations
  * derivedFrom: [Costruzione separata dall'attivazione](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#costruzione-separata-dallattivazione)
  * satisfiedBy: [main.ts](../../apps/server/src/main.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [server-process.ts](../../apps/server/src/runtime/server-process.ts)
  * satisfiedBy: [test-server.ts](../../apps/server/src/runtime/test-server.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Credenziali API dalle variabili d'ambiente

Quando un componente del backend usa credenziali per un'API esterna, deve riceverle dalle variabili d'ambiente del processo tramite il proprio modulo di configurazione, e nessun file di configurazione del backend deve contenere una credenziale.

#### Details
Le credenziali degli agenti sono indicate nei file degli agenti con il nome della variabile d'ambiente che le contiene.

Origine: baseline Reqvire «Configuration module per component reading environment variables», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Formato JSON dei file degli agenti](../Contracts/FamilyConversation.md#formato-json-dei-file-degli-agenti)

#### Relations
  * derivedFrom: [Modulo di configurazione per componente dalle variabili d'ambiente](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#modulo-di-configurazione-per-componente-dalle-variabili-dambiente)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Database di prova isolati del backend

Le prove del backend che usano un database SQLite devono usare soltanto database che creano, in memoria o in una cartella temporanea propria, costruiti con le migrazioni di produzione, devono cancellare soltanto le cartelle che hanno creato e non devono leggere la configurazione dell'installazione né ripiegare su un archivio di sviluppo o di produzione.

#### Details
Origine: baseline Reqvire «Isolated and guarded test databases», adattata: con SQLite incorporato ogni prova crea il proprio database invece di un database per worker su un server, quindi non servono il controllo del bersaglio, la pulizia dei dati fra i casi né un servizio di database da cui la suite dipenda.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [sqlite-turn-repository.adapter.integration.spec.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.integration.spec.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Definizione locale del tipo Result

Ogni modulo business del server che usa `Result<T, E>` deve definire il tipo nel proprio package, senza importarlo da un altro package.

#### Details
Origine: baseline Reqvire «Result type defined per module», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Diagnostica dei guasti nei componenti tecnici

Quando un guasto inatteso del server richiede diagnostica, la diagnostica deve essere gestita dai componenti tecnici che trattano il guasto.

#### Details
Origine: baseline Reqvire «Diagnostics of unexpected failures in technical components», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Diagnostica del mancato avvio del server

Se la preparazione del processo server o l'apertura dell'ascolto HTTP falliscono, il processo deve emettere un unico log diagnostico definitivo `server_startup_failed` che identifichi la causa del mancato avvio senza riprodurre valori segreti, comunicare il mancato avvio su stderr e terminare con un codice di uscita non riuscito, secondo il contratto «Evento diagnostico del mancato avvio del server».

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Diagnostica del mancato avvio](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#diagnostica-del-mancato-avvio)
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [http-surface.ts](../../apps/server/src/composition/http-surface.ts)
  * satisfiedBy: [main.ts](../../apps/server/src/main.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [server-process.ts](../../apps/server/src/runtime/server-process.ts)
  * satisfiedBy: [startup-failure.ts](../../apps/server/src/runtime/startup-failure.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Dichiarazioni del caso d'uso nello stesso file

Quando un caso d'uso Application del server espone rifiuti previsti, la sua firma callable, la factory e l'unione dei rifiuti osservabili devono essere dichiarate nello stesso file `<use-case>.use-case.ts`.

#### Details
Origine: baseline Reqvire «Use case declarations in a single file», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Convenzione dei nomi di casi d'uso, porte e adapter](../../../ambrogio-model/system-model/Contracts/CodeArchitecture.md#convenzione-dei-nomi-di-casi-duso-porte-e-adapter)

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Directory delle voci sostituibile nell'immagine

Quando l'installazione monta in sola lettura una propria directory di voci al posto di quella inclusa nell'immagine Docker del backend, il container deve usare le voci della directory montata al posto di quelle incluse, senza ricostruire l'immagine.

#### Metadata
  * type: requirement

#### Contract References
  * [Catalogo bilingue dei modelli vocali nell'immagine backend](../Contracts/ServerFoundation.md#catalogo-bilingue-dei-modelli-vocali-nellimmagine-backend)

#### Relations
  * satisfiedBy: [Dockerfile](../../Dockerfile)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Discriminante kind dei rifiuti previsti

Ogni variante di rifiuto previsto di Domain, Application o di una porta del server deve avere un campo `kind` con un valore letterale distinto da quello delle altre varianti della stessa unione.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Distinzione dei rifiuti senza classi o instanceof

Le varianti di rifiuto previsto di Domain, Application e delle porte del server non devono essere classi né essere distinte tramite `instanceof`.

#### Details
Origine: baseline Reqvire «Rejection variants without classes or instanceof», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Distribuzione del server come immagine Docker

Quando il progetto distribuisce il server, deve fornire un'immagine Docker eseguibile del server, il cui filesystem non contiene i valori effettivi della configurazione né i dati persistenti, costruita da un contesto di build che esclude storia Git, dipendenze installate, risultati di build, modello, test, file di database e file d'ambiente.

#### Details
I modelli vocali inclusi sono risorse in sola lettura sostituibili con un mount, non configurazione.

Origine: baseline Reqvire «Server distributed as a container image», adottata; «Configuration and data outside the container image», adottata; «Minimal container build context», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Catalogo bilingue dei modelli vocali nell'immagine backend](../Contracts/ServerFoundation.md#catalogo-bilingue-dei-modelli-vocali-nellimmagine-backend)

#### Relations
  * satisfiedBy: [.dockerignore](../../.dockerignore)
  * satisfiedBy: [Dockerfile](../../Dockerfile)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Distribuzione mirata della configurazione validata

Quando il processo ha validato la configurazione dei componenti attivi, la composition root deve fornire a ciascun componente soltanto i valori di configurazione che gli servono, già convertiti nei tipi previsti, senza far leggere direttamente file o variabili d'ambiente a Domain e ai casi d'uso Application.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di bootstrap della configurazione del backend](../Contracts/ServerFoundation.md#profilo-di-bootstrap-della-configurazione-del-backend)

#### Relations
  * derivedFrom: [Validazione della configurazione prima delle risorse](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#validazione-della-configurazione-prima-delle-risorse)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Eccezioni costruite come Error

Quando il codice TypeScript del server costruisce un'eccezione per un guasto tecnico non tradotto o un bug, deve costruire un oggetto `Error`.

#### Details
Origine: baseline Reqvire «Exceptions built as Error objects», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Guasti inattesi propagati come eccezioni](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#guasti-inattesi-propagati-come-eccezioni)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Esclusione dalla cache delle risposte conversazionali HTTP

Quando l'API HTTP risponde con dati di una conversazione, inclusi storico, elenco e flussi di aggiornamento, deve includere l'header `Cache-Control: no-store`.

#### Details
Origine: baseline Reqvire «No caching of sensitive HTTP responses», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Esclusione dei dettagli tecnici dal messaggio pubblico

Quando un confine del server comunica alla famiglia un messaggio per un guasto, il messaggio pubblico non deve contenere cause, stack, messaggi tecnici del provider o il valore originale dell'eccezione.

#### Details
Origine: baseline Reqvire «No technical details in public failure messages», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Esclusione dei file di configurazione effettivi dagli artefatti

Quando il backend usa file di configurazione effettivi, come il file `.env` di sviluppo o i file degli agenti di un'installazione, tali file devono restare esterni al repository Git e all'immagine container.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Configurazioni effettive escluse dagli artefatti](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#configurazioni-effettive-escluse-dagli-artefatti)
  * satisfiedBy: [.dockerignore](../../.dockerignore)
  * satisfiedBy: [.gitignore](../../.gitignore)
  * satisfiedBy: [Dockerfile](../../Dockerfile)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Esclusione della raccolta automatica di dati nei log

Quando il runtime HTTP del server emette eventi diagnostici, il logger e le loro integrazioni non devono acquisire automaticamente testi delle conversazioni, corpi o header HTTP, input o output dei casi d'uso e credenziali.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Log tecnici JSON con Pino](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#log-tecnici-json-con-pino)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Esecuzione del server senza Docker Compose

Quando un installatore avvia l'immagine Docker del server, deve poterlo fare senza usare Docker Compose; un eventuale file Compose del progetto ha solo il ruolo di esempio di avvio.

#### Details
Origine: baseline Reqvire «Container start without Compose», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [Dockerfile](../../Dockerfile)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Esempi di configurazione privi di credenziali

Quando il repository fornisce esempi di configurazione, come `.env.example`, `compose.example.yaml` e i file degli agenti d'esempio, tali esempi non devono contenere credenziali effettive.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Configurazioni effettive escluse dagli artefatti](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#configurazioni-effettive-escluse-dagli-artefatti)
  * satisfiedBy: [.env.example](../../.env.example)
  * satisfiedBy: [compose.example.yaml](../../compose.example.yaml)
  * satisfiedBy: [generic.json](../../examples/agents/generic.json)
  * satisfiedBy: [home-assistant.json](../../examples/agents/home-assistant.json)
  * satisfiedBy: [orchestrator.json](../../examples/agents/orchestrator.json)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Esito del ciclo di vita del server conservato nei guasti

Quando l'avvio o l'arresto del server falliscono, il server deve conservare il guasto dell'avvio come primo guasto, raccogliere i guasti di pulizia e di chiusura senza perderli né presentarli come cause l'uno dell'altro, ed emetterli nell'unico log diagnostico definitivo dell'avvio o dell'arresto, terminando con codice di uscita 1 anche quando soltanto la chiusura di una risorsa è fallita.

#### Metadata
  * type: requirement

#### Contract References
  * [Finestra di arresto del server](../Contracts/ServerFoundation.md#finestra-di-arresto-del-server)
  * [Ciclo di vita dei processi di servizio con Node.js](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#ciclo-di-vita-dei-processi-di-servizio-con-nodejs)

#### Relations
  * derivedFrom: [Esito del ciclo di vita conservato nei guasti](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#esito-del-ciclo-di-vita-conservato-nei-guasti)
  * satisfiedBy: [agents.ts](../../apps/server/src/composition/agents.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [lifecycle.ts](../../apps/server/src/runtime/lifecycle.ts)
  * satisfiedBy: [server-process.ts](../../apps/server/src/runtime/server-process.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### File JSON di soli dati per gli agenti

Il backend deve leggere la configurazione di ogni agente da un file JSON di soli dati nella directory degli agenti, validarla con lo schema degli agenti prima di attivare l'agente, e rifiutare un file che contiene una credenziale invece del nome della variabile d'ambiente che la fornisce.

#### Details
L'insieme degli agenti resta aperto: chi installa aggiunge o toglie un agente aggiungendo o togliendo il suo file, senza scrivere codice.

Origine: baseline Reqvire «Configuration module per component reading environment variables», adattata: la configurazione degli agenti è un file JSON di soli dati montato nella directory degli agenti e letto dal modulo di configurazione degli agenti, invece di sole variabili d'ambiente; le credenziali restano variabili d'ambiente, riferite nel file per nome.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo dell'ambiente di esecuzione e del file d'ambiente locale](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#profilo-dellambiente-di-esecuzione-e-del-file-dambiente-locale)

#### Relations
  * derivedFrom: [Modulo di configurazione per componente dalle variabili d'ambiente](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#modulo-di-configurazione-per-componente-dalle-variabili-dambiente)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### File d'ambiente locale del backend

Il backend deve caricare il file `.env` della radice soltanto con lo script di sviluppo `dev`, che avvia il server compilato con `node --env-file=.env`, deve fornire `.env.example` secondo il profilo comune, e il suo codice non deve caricare file d'ambiente.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo dell'ambiente di esecuzione e del file d'ambiente locale](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#profilo-dellambiente-di-esecuzione-e-del-file-dambiente-locale)

#### Relations
  * derivedFrom: [Caricamento esplicito del file d'ambiente locale](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#caricamento-esplicito-del-file-dambiente-locale)
  * satisfiedBy: [.env.example](../../.env.example)
  * satisfiedBy: [.gitignore](../../.gitignore)
  * satisfiedBy: [package.json](../../package.json)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Firma Result dei casi d'uso con rifiuti previsti

Quando un caso d'uso Application del server prevede rifiuti, la sua firma TypeScript deve restituire `Result<T, E>` oppure `Promise<Result<T, E>>`, con `E` pari all'unione chiusa delle varianti dichiarate nel contratto del caso d'uso.

#### Details
Origine: baseline Reqvire «Result signature of use cases with expected rejections», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Firma Result delle porte con rifiuti previsti

Quando una porta Application del server prevede rifiuti, la sua firma TypeScript deve restituire `Result<T, E>` oppure `Promise<Result<T, E>>`, con `E` pari all'unione chiusa delle varianti dichiarate nel contratto della porta.

#### Details
Origine: baseline Reqvire «Result signature of ports with expected rejections», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Formato e flussi dei log tecnici

Quando il runtime del server HTTP emette un evento diagnostico tecnico, deve scrivere un evento JSON strutturato per riga nel flusso predefinito definito per il relativo ingresso.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Log tecnici JSON con Pino](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#log-tecnici-json-con-pino)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Gestione esaustiva dei rifiuti negli adapter inbound

Quando un adapter inbound del server rappresenta gli esiti di un caso d'uso, deve gestire tutte le varianti dell'unione dei rifiuti osservabili dichiarata dal caso d'uso.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Gestione esplicita dei rifiuti previsti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#gestione-esplicita-dei-rifiuti-previsti)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Gestione esplicita dei rifiuti delle porte

Quando un caso d'uso Application del server riceve da una porta un rifiuto previsto, deve gestire esplicitamente ogni variante dichiarata dal contratto della porta nel proprio flusso.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Gestione esplicita dei rifiuti previsti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#gestione-esplicita-dei-rifiuti-previsti)
  * satisfiedBy: [begin-turn.use-case.ts](../../packages/conversations/src/application/begin-turn.use-case.ts)
  * satisfiedBy: [complete-turn.use-case.ts](../../packages/conversations/src/application/complete-turn.use-case.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### HSTS legato all'HTTPS pubblico

Quando il deployment dichiara che l'origine pubblica dell'API HTTP usa HTTPS, il server deve emettere `Strict-Transport-Security` secondo una politica esplicita; quando l'origine pubblica non usa HTTPS, non deve emettere tale header.

#### Details
Origine: baseline Reqvire «HSTS bound to declared public HTTPS», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [http-config.ts](../../apps/server/src/runtime/http-config.ts)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Header di sicurezza sulle risposte HTTP

Quando il server HTTP emette una risposta, incluse risposte di errore e rotte non trovate, deve applicare il profilo di header di sicurezza fornito da `@fastify/helmet` registrato globalmente, con sole eccezioni esplicite motivate dal contratto della rotta o del deployment.

#### Details
Origine: baseline Reqvire «Security headers on every HTTP response», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Identificativo di correlazione delle richieste HTTP

Quando il server riceve una richiesta HTTP, il confine HTTP deve generare per quella richiesta un `correlationId` UUID v4 distinto e includerlo negli eventi diagnostici relativi alla richiesta.

#### Details
Origine: baseline Reqvire «Explicit diagnostic context», adottata; «Per-request correlation identifier», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Identificativo di richiesta nelle risposte HTTP

Quando il server emette una risposta HTTP gestita, inclusa una risposta di errore, deve riportare nell'header `X-Request-Id` il medesimo `correlationId` generato per la richiesta.

#### Details
Origine: baseline Reqvire «Request identifier in HTTP responses», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Implementazione Fastify dell'API HTTP

L'API HTTP del server deve essere implementata con Fastify.

#### Details
Origine: baseline Reqvire «Fastify as HTTP framework», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Ingresso di prova pubblico del server conversazionale

Il backend deve offrire un ingresso di prova pubblico e documentato che avvia il server conversazionale completo, con il protocollo `ambrogio.v1` e le API HTTP pubbliche, su un indirizzo locale e con un archivio temporaneo, sostituendo il modello linguistico, la trascrizione e la sintesi vocale con implementazioni deterministiche fornite dalla prova, e che restituisce l'indirizzo del server e un'operazione di chiusura; l'ingresso deve bastare alle prove di integrazione dei client senza che importino altri moduli del backend.

#### Details
Le prove di integrazione dei client conversazionali usano soltanto questo ingresso, dal repository backend affiancato nella cartella di lavoro, compilato nella loro CI dopo il checkout affiancato e senza una revisione fissata. Modulo, funzione e forma dei parametri sono registrati in «Ingresso di prova del server conversazionale».

Origine: baseline Reqvire «Public test entry point for client integration tests», adottata.

#### Concept References
  * [Backend](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#backend)
  * [Client conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#client-conversazionale)

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [test-server.ts](../../apps/server/src/runtime/test-server.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Inoltro dei log affidato al deployment

Quando è richiesta la raccolta centralizzata dei log tecnici del server HTTP, l'inoltro verso il sistema di raccolta deve essere configurato nel deployment, senza integrare nel codice applicativo un backend di log specifico.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Log affidati al deployment](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#log-affidati-al-deployment)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Installazione delle dipendenze del backend con pnpm e Corepack

Il backend deve dichiarare in `package.json` `"packageManager": "pnpm@12.11.2"` e il job `Backend checks` della CI e la fase di build del `Dockerfile` devono attivare quella versione con Corepack e installare le dipendenze del workspace con `pnpm install --frozen-lockfile`, secondo «Profilo di installazione con pnpm e Corepack», con le versioni esatte, gli script di build ammessi e l'attesa per le nuove versioni di «Profilo di installazione delle dipendenze del backend».

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di installazione con pnpm e Corepack](../../../ambrogio-model/system-model/Contracts/ModelDrivenDevelopment.md#profilo-di-installazione-con-pnpm-e-corepack)

#### Relations
  * derivedFrom: [Installazione delle dipendenze con pnpm attivato da Corepack](../../../ambrogio-model/system-model/Requirements/ModelDrivenDevelopment.md#installazione-delle-dipendenze-con-pnpm-attivato-da-corepack)
  * satisfiedBy: [ci.yml](../../.github/workflows/ci.yml)
  * satisfiedBy: [Dockerfile](../../Dockerfile)
  * satisfiedBy: [package.json](../../package.json)
  * satisfiedBy: [pnpm-workspace.yaml](../../pnpm-workspace.yaml)
---

### Interruzione dei turni durante l'arresto

Quando il server riceve una richiesta di arresto ordinato, deve interrompere i turni attivi senza attendere che completino la risposta.

#### Details
Origine: baseline Reqvire «Interruption of active operations on shutdown», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [main.ts](../../apps/server/src/main.ts)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Irrobustimento dei workflow GitHub Actions

I workflow GitHub Actions del backend devono essere soltanto quelli dei controlli, della scansione dei segreti e della pubblicazione dell'immagine, con la durata propria di ciascun job, e il token del registro deve raggiungere soltanto il passo di accesso al registro del job che pubblica.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo comune dei workflow GitHub Actions](../../../ambrogio-model/system-model/Contracts/ModelDrivenDevelopment.md#profilo-comune-dei-workflow-github-actions)

#### Relations
  * derivedFrom: [Workflow GitHub Actions con privilegi e durata limitati](../../../ambrogio-model/system-model/Requirements/ModelDrivenDevelopment.md#workflow-github-actions-con-privilegi-e-durata-limitati)
  * satisfiedBy: [ci.yml](../../.github/workflows/ci.yml)
  * satisfiedBy: [publish-image.yml](../../.github/workflows/publish-image.yml)
  * satisfiedBy: [secret-scan.yml](../../.github/workflows/secret-scan.yml)
  * specify: [Sviluppo governato dal modello](../../../ambrogio-model/system-model/Capabilities/Engineering.md#sviluppo-governato-dal-modello)
---

### Isolamento degli adapter inbound dai rifiuti interni

Quando un adapter inbound del server rappresenta gli esiti di un caso d'uso, non deve importare né riconoscere i tipi di rifiuto interni delle porte o del Domain, inclusi gli import di soli tipi.

#### Details
Origine: baseline Reqvire «Inbound adapters isolated from internal rejections», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Gestione esplicita dei rifiuti previsti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#gestione-esplicita-dei-rifiuti-previsti)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Limite dei corpi delle richieste HTTP

Quando una rotta HTTP riceve un corpo, il server deve applicare un limite esplicito e positivo alla sua dimensione prima di invocare il caso d'uso; se il corpo supera il limite, deve rispondere con HTTP 413 e un errore JSON pubblico sicuro senza avviare l'operazione richiesta.

#### Details
Origine: baseline Reqvire «HTTP request body size limit», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Log error del fallback pubblico

Quando un guasto tecnico inatteso, un bug o un valore lanciato sconosciuto raggiunge il fallback pubblico HTTP del server e il canale diagnostico è disponibile, il confine che decide l'esito esterno deve emettere un log diagnostico definitivo di livello `error` per quel guasto.

#### Details
Origine: baseline Reqvire «Error log at the public fallback», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Logger minimo del backend

I componenti tecnici del backend che registrano eventi diagnostici devono ricevere il logger minimo creato una sola volta da `main.ts` con Pino al livello minimo `warn`, o dall'ingresso di prova pubblico per il proprio processo, e il confine HTTP deve passare alle rotte e alle sessioni conversazionali un logger derivato con il `correlationId` della richiesta.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo del logger con Pino](../../../ambrogio-model/system-model/Contracts/CodeArchitecture.md#profilo-del-logger-con-pino)

#### Relations
  * derivedFrom: [Interfaccia minima del logger con un solo logger di base](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#interfaccia-minima-del-logger-con-un-solo-logger-di-base)
  * satisfiedBy: [session-route.adapter.ts](../../apps/server/src/adapters/in/session-route.adapter.ts)
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [main.ts](../../apps/server/src/main.ts)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * satisfiedBy: [logger.ts](../../apps/server/src/runtime/logger.ts)
  * satisfiedBy: [test-server.ts](../../apps/server/src/runtime/test-server.ts)
  * satisfiedBy: [conversation-routes.ts](../../packages/conversations/src/adapters/in/http/conversation-routes.ts)
  * satisfiedBy: [logger.ts](../../packages/conversations/src/adapters/in/logger.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Mapping esaustivo dei rifiuti previsti

Quando un mapping del server deve gestire tutte le varianti di un'unione di rifiuti previsti, il codice TypeScript deve usare uno `switch` su `kind` con un ramo per ogni variante e un `default` che passi il valore completo della variante a `assertNever`.

#### Details
Origine: baseline Reqvire «Exhaustive rejection mapping with assertNever», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Gestione esplicita dei rifiuti previsti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#gestione-esplicita-dei-rifiuti-previsti)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Modelli vocali italiani e inglesi inclusi

Quando il progetto distribuisce l'immagine Docker del backend, deve includere modelli Vosk per italiano e inglese, almeno una voce Piper per ciascuna lingua e un modello Kokoro multilingue con voci utilizzabili in entrambe le lingue, verificando provenienza e integrità degli archivi durante la build.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [Dockerfile](../../Dockerfile)
  * satisfiedBy: [fetch-speech-models.mjs](../../scripts/fetch-speech-models.mjs)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Modulo di configurazione per componente del backend

Ogni componente configurabile del backend, cioè HTTP, Conversazioni, Voce e Agenti, deve avere un proprio modulo di configurazione TypeScript nella build, che legge soltanto le variabili d'ambiente del componente e le valida con lo schema del componente, senza contenere valori effettivi; chi installa deve configurare il backend con variabili d'ambiente e con i file di dati degli agenti, senza fornire codice.

#### Details
Origine: baseline Reqvire «Configuration module per component reading environment variables», adottata, con l'adattamento dei file degli agenti registrato in «File JSON di soli dati per gli agenti».

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Modulo di configurazione per componente dalle variabili d'ambiente](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#modulo-di-configurazione-per-componente-dalle-variabili-dambiente)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * satisfiedBy: [http-config.ts](../../apps/server/src/runtime/http-config.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * satisfiedBy: [voice-config.ts](../../packages/conversations/src/adapters/out/voice-config.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Nessun log automatico per esiti previsti

Quando il server gestisce un rifiuto previsto di Domain o Application, un errore di protocollo previsto o un guasto tecnico tradotto in un esito previsto, non deve emettere automaticamente un log dedicato di livello `warn` o `error` per il solo verificarsi di tale esito.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti senza log di errore automatici](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-senza-log-di-errore-automatici)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Nome stabile degli eventi diagnostici

Quando il logger del server HTTP emette un evento diagnostico, la riga JSON deve contenere un campo `event` con un nome stabile dichiarato nel punto di emissione, indipendente dai dati della singola esecuzione.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Log tecnici JSON con Pino](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#log-tecnici-json-con-pino)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Nomi dei file secondo il ruolo architetturale nel backend

I file del codice di produzione dell'applicazione server e dei package business del backend devono seguire «Convenzione dei nomi di casi d'uso, porte e adapter».

#### Details
Esempi nel backend: il caso d'uso che scambia un turno si chiama `exchange-turn.use-case.ts`; la porta di lettura dello storico si chiama `conversation-history-read.port.ts` e la sua implementazione SQLite `sqlite-conversation-history-read.adapter.ts`. Le regole sulla dichiarazione di firme, factory ed esiti restano applicabili nel loro ambito.

#### Metadata
  * type: requirement

#### Contract References
  * [Convenzione dei nomi di casi d'uso, porte e adapter](../../../ambrogio-model/system-model/Contracts/CodeArchitecture.md#convenzione-dei-nomi-di-casi-duso-porte-e-adapter)

#### Relations
  * derivedFrom: [Nomi dei file secondo il ruolo architetturale](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#nomi-dei-file-secondo-il-ruolo-architetturale)
  * satisfiedBy: [session-route.adapter.ts](../../apps/server/src/adapters/in/session-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [ai-sdk-reply.adapter.ts](../../packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts)
  * satisfiedBy: [conversation-history-read.port.ts](../../packages/conversations/src/application/conversation-history-read.port.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Normalizzazione diagnostica nel confine definitivo

Quando il confine tecnico HTTP del server gestisce definitivamente un guasto inatteso, deve normalizzare una sola volta il valore catturato per la diagnostica, conservando l'identità di un `Error` già presente oppure creando un `Error` per un valore diverso, secondo il contratto di normalizzazione diagnostica. I componenti intermedi non devono normalizzare nuovamente il guasto.

#### Details
Origine: baseline Reqvire «Diagnostic normalization at the definitive boundary», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Diagnosi definitiva unica dei guasti inattesi](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#diagnosi-definitiva-unica-dei-guasti-inattesi)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Oggetto Error nel campo err del log definitivo

Quando il confine HTTP del server chiama il logger per un log diagnostico definitivo, il campo strutturato `err` deve contenere l'oggetto `Error` che rappresenta il guasto, conservando in memoria la catena `cause` presente.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Diagnosi definitiva unica dei guasti inattesi](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#diagnosi-definitiva-unica-dei-guasti-inattesi)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Origini CORS esplicite dell'API HTTP

Quando l'API HTTP riceve una richiesta con un'origine cross-origin, deve autorizzare CORS solo se tale origine è esplicitamente configurata per il componente HTTP; in assenza di origini configurate non deve autorizzare alcuna origine.

#### Details
Origine: baseline Reqvire «Explicitly configured CORS origins», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [http-config.ts](../../apps/server/src/runtime/http-config.ts)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Percorso fatale del server

Quando un errore sfugge a ogni confine controllato del processo server, compreso un rifiuto di promessa non gestito, il processo deve scrivere su stderr soltanto la riga fissa `Ambrogio backend stopped after a fatal error.` e terminare con codice di uscita 1, senza serializzare il valore sollevato né emettere log ordinari.

#### Metadata
  * type: requirement

#### Contract References
  * [Ciclo di vita dei processi di servizio con Node.js](../../../ambrogio-model/system-model/Contracts/HomelabInstallation.md#ciclo-di-vita-dei-processi-di-servizio-con-nodejs)

#### Relations
  * derivedFrom: [Percorso fatale separato](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#percorso-fatale-separato)
  * satisfiedBy: [main.ts](../../apps/server/src/main.ts)
  * satisfiedBy: [fatal-path.ts](../../apps/server/src/runtime/fatal-path.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Perimetro iniziale dei segnali di osservabilità del backend

Nella prima versione, il runtime HTTP del backend deve usare come segnali di osservabilità, oltre ai log tecnici strutturati, soltanto gli identificativi di correlazione delle richieste HTTP.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Perimetro iniziale dei segnali di osservabilità](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#perimetro-iniziale-dei-segnali-di-osservabilità)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Preparazione del server TypeScript ESM

Quando viene preparato il server per l'esecuzione, il progetto deve produrre a partire da sorgenti TypeScript un artefatto JavaScript ESM avviabile con Node.js 24 o successivo.

#### Details
Origine: baseline Reqvire «ESM build for Node.js», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Proiezione dei rifiuti bloccanti delle porte

Quando un rifiuto previsto ricevuto da una porta impedisce di completare un caso d'uso Application del server, il caso d'uso deve tradurlo mediante un mapping esplicito in una variante dichiarata dal proprio contratto.

#### Details
Origine: baseline Reqvire «Projection of blocking port rejections», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Gestione esplicita dei rifiuti previsti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#gestione-esplicita-dei-rifiuti-previsti)
  * satisfiedBy: [begin-turn.use-case.ts](../../packages/conversations/src/application/begin-turn.use-case.ts)
  * satisfiedBy: [complete-turn.use-case.ts](../../packages/conversations/src/application/complete-turn.use-case.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Propagazione dei guasti inattesi

Quando un guasto tecnico inatteso o un bug si verifica nel server, il componente che lo rileva deve propagarlo come eccezione fino al confine che lo gestisce.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Guasti inattesi propagati come eccezioni](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#guasti-inattesi-propagati-come-eccezioni)
  * satisfiedBy: [get-conversation.use-case.ts](../../packages/conversations/src/application/get-conversation.use-case.ts)
  * satisfiedBy: [list-conversations.use-case.ts](../../packages/conversations/src/application/list-conversations.use-case.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Propagazione senza wrapper superflui

Quando un guasto inatteso attraversa un layer del server senza che sia aggiunto un contesto operativo concreto, il layer deve propagare il valore originale senza costruire un nuovo wrapper.

#### Details
Origine: baseline Reqvire «Propagation without superfluous wrappers», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Guasti inattesi propagati come eccezioni](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#guasti-inattesi-propagati-come-eccezioni)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Proprietà e unicità del log diagnostico definitivo

Quando un componente del server decide definitivamente l'esito esterno di un guasto inatteso, deve possedere l'eventuale log diagnostico definitivo e non emetterne più di uno per quel guasto.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Diagnosi definitiva unica dei guasti inattesi](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#diagnosi-definitiva-unica-dei-guasti-inattesi)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Pubblicazione dell'immagine Docker del server

Quando viene creato un tag di release `v*` del backend, il progetto deve pubblicare l'immagine Docker eseguibile del server in un registro accessibile all'installazione homelab.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo dell'immagine Docker del server](../Contracts/ServerFoundation.md#profilo-dellimmagine-docker-del-server)
  * [Profilo di scansione dei segreti del backend](../Contracts/ServerFoundation.md#profilo-di-scansione-dei-segreti-del-backend)

#### Relations
  * derivedFrom: [Pubblicazione delle immagini di release](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#pubblicazione-delle-immagini-di-release)
  * satisfiedBy: [publish-image.yml](../../.github/workflows/publish-image.yml)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
  * verifiedBy: [Dimostrazione della pubblicazione dell'immagine Docker del server](../Verifications/ServerFoundation.md#dimostrazione-della-pubblicazione-dellimmagine-docker-del-server)
---

### Rappresentazione di err nel log JSON

Quando il logger del server emette la riga JSON di un log diagnostico definitivo, la riga deve contenere una rappresentazione del campo `err` conforme al profilo controllato di serializzazione, con `ProjectError` come errore del progetto e `Unexpected backend failure` come descrizione costante di ogni altro valore.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo controllato di serializzazione di err](../../../ambrogio-model/system-model/Contracts/CodeArchitecture.md#profilo-controllato-di-serializzazione-di-err)

#### Relations
  * derivedFrom: [Serializzazione controllata di err](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#serializzazione-controllata-di-err)
  * satisfiedBy: [lifecycle.ts](../../apps/server/src/runtime/lifecycle.ts)
  * satisfiedBy: [logger.ts](../../apps/server/src/runtime/logger.ts)
  * satisfiedBy: [project-error.ts](../../packages/conversations/src/domain/project-error.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Rifiuti osservabili dichiarati per caso d'uso

Quando un caso d'uso Application del server prevede rifiuti, il suo contratto Application deve dichiarare un insieme chiuso che contenga soltanto i rifiuti osservabili dal chiamante.

#### Details
Origine: baseline Reqvire «Closed set of observable rejections per use case», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Rifiuti previsti come valori di esito

Quando un'operazione Domain, un caso d'uso Application o una porta Application del server prevede un rifiuto dichiarato nel proprio contratto, deve restituirlo come valore distinguibile dal successo.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * satisfiedBy: [sqlite-turn-repository.adapter.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.ts)
  * satisfiedBy: [begin-turn.use-case.ts](../../packages/conversations/src/application/begin-turn.use-case.ts)
  * satisfiedBy: [complete-turn.use-case.ts](../../packages/conversations/src/application/complete-turn.use-case.ts)
  * satisfiedBy: [exchange-turn.use-case.ts](../../packages/conversations/src/application/exchange-turn.use-case.ts)
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Scansione dei segreti nella CI del backend

Prima della pubblicazione di un'immagine di release del backend, la pipeline di pubblicazione deve eseguire la scansione dei segreti sull'intera storia del repository e deve impedire la pubblicazione se la scansione rileva un segreto o non si completa.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di scansione dei segreti con gitleaks](../../../ambrogio-model/system-model/Contracts/ModelDrivenDevelopment.md#profilo-di-scansione-dei-segreti-con-gitleaks)

#### Relations
  * derivedFrom: [Scansione dei segreti nella CI](../../../ambrogio-model/system-model/Requirements/ModelDrivenDevelopment.md#scansione-dei-segreti-nella-ci)
  * satisfiedBy: [publish-image.yml](../../.github/workflows/publish-image.yml)
  * satisfiedBy: [secret-scan.yml](../../.github/workflows/secret-scan.yml)
  * specify: [Sviluppo governato dal modello](../../../ambrogio-model/system-model/Capabilities/Engineering.md#sviluppo-governato-dal-modello)
---

### Selezione esplicita dei campi diagnostici

Quando il runtime HTTP del server emette un evento diagnostico applicativo, la riga del log deve contenere soltanto i campi diagnostici scelti esplicitamente per quell'evento o per la configurazione del logger, senza acquisire automaticamente gli oggetti di ingresso, uscita o contesto.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Log tecnici JSON con Pino](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#log-tecnici-json-con-pino)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Separazione del messaggio pubblico dalla diagnosi tecnica

Quando un confine del server produce per lo stesso guasto un messaggio per la famiglia e una diagnosi tecnica, deve costruire le due rappresentazioni separatamente.

#### Details
Origine: baseline Reqvire «Public message separated from technical diagnosis», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Server compilato provato come processo

La selezione `e2e` del backend deve avviare il punto d'ingresso compilato del server come processo figlio e verificare che risolva i propri moduli, si avvii in produzione su un archivio SQLite nuovo, risponda all'elenco delle conversazioni di `/api/v1`, termini con codice 0 a `SIGTERM` e, senza ambiente di esecuzione, termini con codice 1, un solo evento `server_startup_failed` e la riga fissa su stderr.

#### Details
Le matrici dei casi di configurazione, delle rotte e del ciclo di vita restano nelle prove dei singoli confini.

#### Metadata
  * type: requirement

#### Contract References
  * [Suite di test del backend](../Contracts/ServerFoundation.md#suite-di-test-del-backend)

#### Relations
  * derivedFrom: [Artefatti compilati provati come processi](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#artefatti-compilati-provati-come-processi)
  * satisfiedBy: [main.e2e.spec.ts](../../apps/server/src/main.e2e.spec.ts)
  * satisfiedBy: [vitest.config.ts](../../vitest.config.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Struttura del tipo Result

Il tipo `Result<T, E>` definito da un modulo business del server deve rappresentare successo e rifiuto mediante un'unione discriminata immutabile conforme alla specifica della forma di Result.

#### Details
Origine: baseline Reqvire «Result type as immutable discriminated union», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Tipi distinti per i rifiuti di porte e casi d'uso

Quando un caso d'uso Application del server espone un rifiuto originato da una porta, la variante esposta deve avere un tipo nominato distinto dal tipo del rifiuto della porta; il contratto del caso d'uso non deve riutilizzare il tipo interno della porta.

#### Details
Origine: baseline Reqvire «Distinct types for port and use case rejections», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Tipi nominati immutabili per i rifiuti previsti

Ogni variante di rifiuto previsto di Domain, Application o di una porta del server deve essere un tipo TypeScript nominato indipendente rappresentato da un oggetto `Readonly`.

#### Details
Origine: baseline Reqvire «Named immutable rejection variant types», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esiti previsti come valori tipizzati](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#esiti-previsti-come-valori-tipizzati)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Uso di Pino per il logging tecnico

Quando il server HTTP emette un evento diagnostico tecnico, deve usare Pino come logger del proprio runtime.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Log tecnici JSON con Pino](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#log-tecnici-json-con-pino)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Validazione preventiva della configurazione attiva

Quando un processo del server prepara un ingresso, deve verificare presenza, formato e valori richiesti della configurazione dei componenti effettivamente attivi, letta dai rispettivi moduli di configurazione, prima di creare o attivare le risorse che la usano; una configurazione non valida deve impedire l'attivazione dell'ingresso e produrre un errore sicuro al confine di avvio.

#### Details
Origine: baseline Reqvire «Ordered startup before accepting work», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di bootstrap della configurazione del backend](../Contracts/ServerFoundation.md#profilo-di-bootstrap-della-configurazione-del-backend)

#### Relations
  * derivedFrom: [Validazione della configurazione prima delle risorse](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#validazione-della-configurazione-prima-delle-risorse)
  * satisfiedBy: [conversation-server.ts](../../apps/server/src/runtime/conversation-server.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Valori predefiniti del backend applicati dal proprietario

Ogni valore predefinito della configurazione del backend deve essere dichiarato e applicato soltanto dal modulo di configurazione del componente che lo possiede, e l'ingresso di prova, i file d'esempio, `.env.example` e `compose.example.yaml` non devono ripeterlo.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di bootstrap della configurazione del backend](../Contracts/ServerFoundation.md#profilo-di-bootstrap-della-configurazione-del-backend)

#### Relations
  * derivedFrom: [Valori predefiniti applicati dal proprietario](../../../ambrogio-model/system-model/Requirements/HomelabInstallation.md#valori-predefiniti-applicati-dal-proprietario)
  * satisfiedBy: [agent-config.ts](../../apps/server/src/runtime/agent-config.ts)
  * satisfiedBy: [http-config.ts](../../apps/server/src/runtime/http-config.ts)
  * satisfiedBy: [test-server.ts](../../apps/server/src/runtime/test-server.ts)
  * satisfiedBy: [compose.example.yaml](../../compose.example.yaml)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * specify: [Installazione nell'homelab](../../../ambrogio-model/system-model/Capabilities/Engineering.md#installazione-nellhomelab)
---

### Varianti Application negli esiti degli adapter inbound

Quando un adapter inbound del server rappresenta un rifiuto di un caso d'uso, deve usare soltanto le varianti esportate dall'API Application di quel caso d'uso.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Gestione esplicita dei rifiuti previsti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#gestione-esplicita-dei-rifiuti-previsti)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Vitest come runner del backend

Quando la suite automatica del backend esegue le verifiche dei package business, dell'applicazione server e del repository, deve usare Vitest come unico runner con i test accanto al codice e le selezioni del contratto «Suite di test del backend».

#### Metadata
  * type: requirement

#### Contract References
  * [Suite di test con Vitest](../../../ambrogio-model/system-model/Contracts/CodeArchitecture.md#suite-di-test-con-vitest)

#### Relations
  * derivedFrom: [Suite di test con Vitest accanto al codice](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#suite-di-test-con-vitest-accanto-al-codice)
  * satisfiedBy: [package.json](../../package.json)
  * satisfiedBy: [vitest.config.ts](../../vitest.config.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---
