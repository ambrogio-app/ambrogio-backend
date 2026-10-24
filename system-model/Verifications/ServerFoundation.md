# Elements

### Verifica degli strumenti del repository backend

Raggruppa le prove dell'hook pre-commit, dell'installazione, dell'audit delle dipendenze, del comando di verifica completo e del workflow di pubblicazione del backend.

#### Metadata
  * type: verification-objective
---

### Prova dei controlli del modello nell'hook pre-commit del backend

In una cartella temporanea con un repository Git che contiene l'hook `.githooks/pre-commit` del backend, con `core.hooksPath` impostato a `.githooks`, e accanto una cartella `ambrogio-model/scripts/` con uno script `model-checks` sostitutivo che registra ogni esecuzione e termina con successo oppure con un errore, tentare il commit di un file privo di segreti con lo script che riesce, con lo script che fallisce e senza la cartella `ambrogio-model`; tentare poi il commit di un token fittizio con lo script che riesce.

#### Details
La prova passa se il commit privo di segreti riesce ed esegue lo script; se con lo script che fallisce il commit è impedito e l'output riporta il messaggio dello script; se senza `ambrogio-model` affiancato il commit è impedito con il messaggio del contratto «Controlli del modello nell'hook pre-commit»; e se il commit con il token è impedito senza eseguire lo script. Fallisce se un commit è creato nonostante un controllo fallito o l'assenza di `ambrogio-model`, se lo script non è eseguito dopo una scansione riuscita o se è eseguito dopo un segreto. Lo script sostitutivo evita di eseguire Reqvire nella suite; `scripts/model-checks` è provato in `ambrogio-model`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica degli strumenti del repository backend](#verifica-degli-strumenti-del-repository-backend)
  * satisfiedBy: [pre-commit-hook.spec.ts](../../test/repository/pre-commit-hook.spec.ts)
  * verify: [Controlli del modello prima del commit del backend](../Requirements/ServerFoundation.md#controlli-del-modello-prima-del-commit-del-backend)
---

### Prova del comando di verifica completo del backend

Leggere lo script `verify` di `package.json` e i passi del job `Backend checks` di `.github/workflows/ci.yml`.

#### Details
La prova passa se i comandi `pnpm` del job successivi all'installazione, escluso l'audit, sono `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration` e `pnpm test:e2e` e se `verify` è la sequenza unita da `&&` di `../ambrogio-model/scripts/model-checks`, `pnpm install --frozen-lockfile`, `pnpm audit --audit-level high` e di quei comandi nello stesso ordine. Fallisce se un controllo della CI manca da `verify`, se l'ordine differisce o se i comandi non sono uniti da `&&`. Che `&&` interrompa la sequenza al primo comando fallito è un comportamento della shell.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica degli strumenti del repository backend](#verifica-degli-strumenti-del-repository-backend)
  * satisfiedBy: [workflows.spec.ts](../../test/repository/workflows.spec.ts)
  * verify: [Comando di verifica completo del backend](../Requirements/ServerFoundation.md#comando-di-verifica-completo-del-backend)
---

### Prova dell'audit delle dipendenze nella CI del backend

Leggere come testo i workflow del backend e `pnpm-workspace.yaml`.

#### Details
La prova passa se l'unico comando di audit dei workflow è `pnpm audit --audit-level high`, nel job `Backend checks` subito dopo `pnpm install --frozen-lockfile` e prima degli altri passi pnpm, e se `auditConfig` di `pnpm-workspace.yaml` dichiara al più `ignoreGhsas` con soli identificativi GHSA singoli, oggi nessuno come nel contratto. Fallisce se l'audit manca, usa un'altra soglia o opzioni che ignorano avvisi, è in un'altra posizione, o se un'eccezione non è un singolo avviso o non è registrata nel contratto. Che `pnpm audit` fallisca su un avviso alto non ignorato è un comportamento di pnpm, osservato nella CI: l'audit interroga il registro in rete e la suite di test non dipende dalla rete.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica degli strumenti del repository backend](#verifica-degli-strumenti-del-repository-backend)
  * satisfiedBy: [workflows.spec.ts](../../test/repository/workflows.spec.ts)
  * verify: [Audit delle dipendenze nella CI del backend](../Requirements/ServerFoundation.md#audit-delle-dipendenze-nella-ci-del-backend)
---

### Prova dell'installazione del backend con pnpm e Corepack

Leggere come testo i `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, i workflow e il `Dockerfile` del backend.

#### Details
La prova passa se `packageManager` dichiara una versione esatta di pnpm; se nessun workflow né il `Dockerfile` installano pnpm con `npm install --global` o lo eseguono con `npx`; se il job `Backend checks` dichiara `COREPACK_ENABLE_DOWNLOAD_PROMPT` uguale a `0` ed esegue `corepack enable` prima di ogni comando `pnpm`; se la fase di build del `Dockerfile` parte da `node:24`, dichiara `ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0` ed esegue `corepack enable` prima di `pnpm install --frozen-lockfile`, primo comando pnpm della fase; se ogni dipendenza diretta dei tre `package.json` ha la versione esatta risolta nel lockfile, salvo il package interno dichiarato con `workspace:*`; se `allowBuilds` ammette soltanto `koffi` e `vosk-koffi`; e se `pnpm-workspace.yaml` non dichiara `minimumReleaseAge` né eccezioni all'attesa. Fallisce se una di queste condizioni manca.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica degli strumenti del repository backend](#verifica-degli-strumenti-del-repository-backend)
  * satisfiedBy: [dependencies.spec.ts](../../test/repository/dependencies.spec.ts)
  * satisfiedBy: [workflows.spec.ts](../../test/repository/workflows.spec.ts)
  * verify: [Installazione delle dipendenze del backend con pnpm e Corepack](../Requirements/ServerFoundation.md#installazione-delle-dipendenze-del-backend-con-pnpm-e-corepack)
---

### Verifica del ciclo di vita del server

Raggruppa le prove dell'interruzione dei turni attivi all'arresto ordinato e della chiusura delle risorse.

#### Metadata
  * type: verification-objective
---

### Prova del percorso fatale del server

In un processo Node.js figlio che installa il percorso fatale del server, provocare separatamente un'eccezione non catturata e un rifiuto di promessa non gestito, entrambi con un messaggio marcatore e una proprietà marcatore; catturare `stdout`, `stderr` e codice di uscita. Leggere `main.ts` del server.

#### Details
La prova passa se in entrambi i casi `stderr` contiene soltanto `Ambrogio backend stopped after a fatal error.`, `stdout` è vuoto, il codice di uscita è 1 e nessun marcatore compare negli output; e se `main.ts` installa il percorso fatale prima di caricare con import dinamici il codice dell'applicazione. Fallisce se il processo continua, termina con successo, serializza il valore sollevato o scrive su `stdout`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del ciclo di vita del server](#verifica-del-ciclo-di-vita-del-server)
  * satisfiedBy: [fatal-path.spec.ts](../../apps/server/src/runtime/fatal-path.spec.ts)
  * verify: [Percorso fatale del server](../Requirements/ServerFoundation.md#percorso-fatale-del-server)
---

### Prova dell'arresto ordinato e limitato del server

Con risorse controllate che registrano l'ordine delle chiusure, eseguire il runner del processo server: inviare due volte `SIGTERM`, poi ripetere facendo fallire la chiusura di una risorsa intermedia e infine con una chiusura che non termina mai e un timer controllato. Costruire il server reale con archivio, componenti vocali controllati e agenti controllati e chiuderlo, registrando l'ordine delle chiusure. Leggere l'esempio Compose del repository.

#### Details
La prova passa se due segnali producono un solo arresto; se le chiusure avvengono una sola volta in ordine inverso di acquisizione, dopo lo stop dei nuovi turni e l'interruzione di quelli in corso, e quelle successive a una chiusura fallita sono comunque tentate; se un guasto di chiusura produce una sola riga `server_shutdown_failed` con il guasto incapsulato che nomina la risorsa e codice 1, e due guasti un `LifecycleError` che li elenca nell'ordine osservato; se alla scadenza dei 10000 ms il runner emette una sola riga `server_shutdown_timeout` con `timeoutMs: 10000` e i guasti già osservati, e restituisce il codice 1 con l'uscita forzata senza attendere la chiusura pendente; se l'arresto riuscito restituisce 0 senza righe di log; e se l'esempio Compose dichiara un `stop_grace_period` di almeno 15 secondi. Fallisce se una risorsa è chiusa due volte o fuori ordine, se un guasto di chiusura va perso o diventa causa di un altro, se un secondo segnale riavvia il tempo massimo o se l'esempio non dichiara il periodo di arresto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del ciclo di vita del server](#verifica-del-ciclo-di-vita-del-server)
  * satisfiedBy: [conversation-server.resource-lifecycle.spec.ts](../../apps/server/src/runtime/conversation-server.resource-lifecycle.spec.ts)
  * satisfiedBy: [lifecycle.spec.ts](../../apps/server/src/runtime/lifecycle.spec.ts)
  * satisfiedBy: [server-process.spec.ts](../../apps/server/src/runtime/server-process.spec.ts)
  * satisfiedBy: [environment-files.spec.ts](../../test/repository/environment-files.spec.ts)
  * verify: [Arresto unico e ordinato del server](../Requirements/ServerFoundation.md#arresto-unico-e-ordinato-del-server)
  * verify: [Esito del ciclo di vita del server conservato nei guasti](../Requirements/ServerFoundation.md#esito-del-ciclo-di-vita-del-server-conservato-nei-guasti)
---

### Prova dell'interruzione dei turni all'arresto

Avviare un turno con elaborazione controllata che resterebbe in corso, richiedere l'arresto del server e tentare un nuovo turno. Osservare la richiesta di interruzione, lo stato persistente del turno, l'ordine di chiusura delle risorse e i messaggi ricevuti dalla sessione del client.

#### Details
La prova passa se il server rifiuta i nuovi turni con `unavailable`, richiede subito l'interruzione di quello attivo senza attendere il completamento della risposta, conserva il turno senza esito come «Interrotto» prima di chiudere l'archivio, invia `turn.interrupted` alla sessione ancora aperta e poi chiude sessioni e risorse. Nessun turno interrotto riceve un esito riuscito o viene riavviato automaticamente. Fallisce se l'arresto attende la risposta controllata, accetta altri turni, perde il turno interrotto o chiude l'archivio prima di registrarlo.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del ciclo di vita del server](#verifica-del-ciclo-di-vita-del-server)
  * satisfiedBy: [conversation-server.session-lifecycle.spec.ts](../../apps/server/src/runtime/conversation-server.session-lifecycle.spec.ts)
  * satisfiedBy: [conversation-server.spec.ts](../../apps/server/src/runtime/conversation-server.spec.ts)
  * verify: [Arresto controllato dei nuovi turni](../Requirements/ServerFoundation.md#arresto-controllato-dei-nuovi-turni)
  * verify: [Chiusura delle risorse dopo l'interruzione dei turni](../Requirements/ServerFoundation.md#chiusura-delle-risorse-dopo-linterruzione-dei-turni)
  * verify: [Interruzione dei turni durante l'arresto](../Requirements/ServerFoundation.md#interruzione-dei-turni-durante-larresto)
---

### Prova della costruzione del server senza ascolto

Costruire il server conversazionale da una configurazione valida con agenti controllati, verificare che la porta configurata resti libera, poi farlo attivare dal runner del processo e richiedere l'elenco delle conversazioni; avviare l'ingresso di prova pubblico e chiuderlo.

#### Details
La prova passa se dopo la costruzione nessun listener è aperto sulla porta configurata e la funzione di chiusura rilascia le risorse senza aver mai ascoltato; se l'ascolto si apre soltanto con l'attivazione decisa dal runner, che risponde all'elenco con HTTP 200; e se l'ingresso di prova si costruisce, si attiva su una porta libera e si chiude. Fallisce se la costruzione apre l'ascolto o se l'attivazione avviene fuori dall'entrypoint e dal runner.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del ciclo di vita del server](#verifica-del-ciclo-di-vita-del-server)
  * satisfiedBy: [conversation-server.resource-lifecycle.spec.ts](../../apps/server/src/runtime/conversation-server.resource-lifecycle.spec.ts)
  * satisfiedBy: [server-process.spec.ts](../../apps/server/src/runtime/server-process.spec.ts)
  * satisfiedBy: [test-server.spec.ts](../../apps/server/src/runtime/test-server.spec.ts)
  * verify: [Costruzione del server separata dall'ascolto](../Requirements/ServerFoundation.md#costruzione-del-server-separata-dallascolto)
---

### Prova della diagnostica del mancato avvio

Provocare il fallimento dell'avvio del processo server in ciascuna fase: variabile HTTP o conversazionale mancante o invalida, configurazione vocale invalida, directory degli agenti senza agenti specializzati, opzioni del modello non valide in un agente, server MCP di un agente irraggiungibile, archivio non apribile e porta di ascolto occupata; ripetere un caso in cui fallisce anche la chiusura di una risorsa già acquisita. Inserire un segreto marcatore nei valori invalidi e nelle credenziali MCP e un messaggio marcatore nel guasto esterno. Catturare `stdout`, `stderr` e codice di uscita.

#### Details
La prova passa se ogni caso produce su `stdout` una sola riga JSON con livello `error`, `event` `server_startup_failed` ed `err` conforme al profilo del contratto, con il messaggio fisso della fase o il messaggio di validazione già previsto e, per gli agenti, l'identificativo dell'agente; se `stderr` contiene `Unable to start HTTP server.`, il codice di uscita è `1` e il server non è in ascolto; se, quando fallisce anche una chiusura, `err` è un `LifecycleError` con il guasto dell'avvio al primo posto e il guasto di chiusura dopo. Fallisce se manca l'evento o ne compaiono più di uno, se il segreto o il messaggio marcatore del guasto esterno compaiono in un output, se la causa non distingue la fase o l'agente, o se il processo termina con successo.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del ciclo di vita del server](#verifica-del-ciclo-di-vita-del-server)
  * satisfiedBy: [agents.spec.ts](../../apps/server/src/composition/agents.spec.ts)
  * satisfiedBy: [server-process.spec.ts](../../apps/server/src/runtime/server-process.spec.ts)
  * satisfiedBy: [startup-failure.spec.ts](../../apps/server/src/runtime/startup-failure.spec.ts)
  * verify: [Diagnostica del mancato avvio del server](../Requirements/ServerFoundation.md#diagnostica-del-mancato-avvio-del-server)
---

### Verifica della distinzione degli esiti applicativi

Raggruppa le prove che distinguono i rifiuti previsti dai guasti inattesi nelle operazioni Domain, nei casi d'uso Application e nelle porte del server.

#### Metadata
  * type: verification-objective
---

### Analisi degli esiti rappresentati dagli adapter inbound

Per ogni adapter inbound del server che rappresenta gli esiti di un caso d'uso, confrontare le varianti gestite con l'unione pubblica dichiarata dall'API Application del caso d'uso ed esaminare import, `import type`, controlli di tipo e rami di gestione.

#### Details
L'analisi passa se l'adapter usa solo le varianti pubbliche del caso d'uso, gestisce ogni variante della loro unione e non importa né riconosce tipi di rifiuto interni delle porte o del Domain. Fallisce se manca una variante, compare un tipo interno anche in un import di soli tipi oppure la rappresentazione dell'esito dipende da un rifiuto interno.

Non automatizzabile: confrontare le varianti pubbliche con i rami di rappresentazione richiede di leggere adapter e API Application; il compilatore controlla soltanto i mapping che usano già `assertNever`.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Gestione esaustiva dei rifiuti negli adapter inbound](../Requirements/ServerFoundation.md#gestione-esaustiva-dei-rifiuti-negli-adapter-inbound)
  * verify: [Isolamento degli adapter inbound dai rifiuti interni](../Requirements/ServerFoundation.md#isolamento-degli-adapter-inbound-dai-rifiuti-interni)
  * verify: [Varianti Application negli esiti degli adapter inbound](../Requirements/ServerFoundation.md#varianti-application-negli-esiti-degli-adapter-inbound)
---

### Analisi dei campi dei rifiuti previsti

Esaminare le dichiarazioni e gli usi delle varianti di rifiuto previsto di Domain, Application e delle porte del server, confrontando ogni campo oltre `kind` con il significato del rifiuto e con le informazioni richieste dai chiamanti.

#### Details
L'analisi passa se ogni campo aggiuntivo è tipizzato, specifico della variante, stabile nel significato e usato dal chiamante, e se nessun tipo o schema comune impone a tutte le varianti campi generici come `message`, `cause`, `metadata`, `statusCode` o codici di uscita. Fallisce se un campo aggiuntivo non soddisfa questi criteri o se uno schema comune rende obbligatorio uno di tali campi generici.

Non automatizzabile: giudicare se un campo è stabile nel significato e necessario al chiamante richiede giudizio umano.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Campi specifici dei rifiuti previsti](../Requirements/ServerFoundation.md#campi-specifici-dei-rifiuti-previsti)
---

### Analisi dei mapping esaustivi dei rifiuti

Per ogni mapping che deve coprire tutte le varianti di un'unione di rifiuti previsti, confrontare i valori `kind` dichiarati nell'unione con i rami dello `switch` e il codice del ramo `default`.

#### Details
L'analisi passa se lo `switch` usa `kind`, contiene un ramo per ogni variante e il `default` chiama `assertNever` passando il valore completo della variante. Fallisce se manca un ramo, se la discriminazione usa un altro meccanismo o se `assertNever` riceve soltanto `kind` o un valore diverso dalla variante completa.

Non automatizzabile: individuare i mapping che devono coprire tutte le varianti richiede di leggere il codice; il compilatore controlla `assertNever` solo dove è già usato.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Mapping esaustivo dei rifiuti previsti](../Requirements/ServerFoundation.md#mapping-esaustivo-dei-rifiuti-previsti)
---

### Analisi della responsabilità della diagnostica

Esaminare il codice Domain e i casi d'uso Application dei moduli business del server, inclusi costruttori, porte, `import type` e chiamate di logging; seguire i percorsi dei guasti inattesi fino ai componenti che li gestiscono.

#### Details
L'analisi passa se Domain e casi d'uso non dipendono da un logger e la diagnostica dei guasti inattesi è gestita dai componenti tecnici che trattano tali guasti. Fallisce se un logger entra nelle dipendenze o nel codice dei due layer, oppure se la responsabilità diagnostica è spostata da un componente tecnico a Domain o a un caso d'uso.

Non automatizzabile: seguire i percorsi dei guasti fino al componente che li gestisce richiede di leggere il codice.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Assenza di logger in Domain e nei casi d'uso](../Requirements/ServerFoundation.md#assenza-di-logger-in-domain-e-nei-casi-duso)
  * verify: [Diagnostica dei guasti nei componenti tecnici](../Requirements/ServerFoundation.md#diagnostica-dei-guasti-nei-componenti-tecnici)
---

### Analisi della separazione dei tipi di rifiuto

Per ogni caso d'uso Application che espone un rifiuto originato da una porta, esaminare le dichiarazioni TypeScript dei rifiuti della porta e del caso d'uso, la firma pubblica e il codice del mapping.

#### Details
L'analisi passa se il rifiuto esposto dal caso d'uso ha un tipo nominato distinto da quello della porta, la firma e il contratto del caso d'uso usano soltanto il tipo proprio e il mapping è esplicito. Fallisce se il tipo della porta è riutilizzato, riesportato o inserito direttamente nell'unione dei rifiuti del caso d'uso.

Non automatizzabile: riconoscere quale rifiuto del caso d'uso deriva da una porta richiede di leggere il mapping.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Tipi distinti per i rifiuti di porte e casi d'uso](../Requirements/ServerFoundation.md#tipi-distinti-per-i-rifiuti-di-porte-e-casi-duso)
---

### Analisi delle firme Result di casi d'uso e porte

Esaminare le firme TypeScript di ogni caso d'uso e porta Application del server che dichiara rifiuti previsti e confrontare il tipo `E` con le varianti del rispettivo contratto; includere funzioni sincrone e asincrone.

#### Details
L'analisi passa se ogni firma restituisce `Result<T, E>` oppure `Promise<Result<T, E>>` e se `E` è l'unione chiusa delle sole varianti dichiarate nel contratto di quell'operazione. Fallisce se la firma usa un altro tipo di esito, se `E` è aperto o se contiene varianti mancanti o estranee al contratto del caso d'uso o della porta.

Non automatizzabile: confrontare `E` con le varianti dichiarate nel contratto di ogni operazione richiede di leggere contratto e firma.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Firma Result dei casi d'uso con rifiuti previsti](../Requirements/ServerFoundation.md#firma-result-dei-casi-duso-con-rifiuti-previsti)
  * verify: [Firma Result delle porte con rifiuti previsti](../Requirements/ServerFoundation.md#firma-result-delle-porte-con-rifiuti-previsti)
---

### Analisi delle varianti di rifiuto previste

Esaminare le dichiarazioni TypeScript e i punti in cui il server distingue le varianti di rifiuto previsto di Domain, Application e delle porte; confrontare i valori `kind` all'interno di ciascuna unione.

#### Details
L'analisi passa se ogni variante è un tipo nominato indipendente rappresentato da un oggetto `Readonly`, possiede un `kind` letterale univoco nella propria unione e non è una classe né viene distinta tramite `instanceof`. Fallisce se manca una di queste proprietà o se due varianti della stessa unione condividono il medesimo `kind`.

Non automatizzabile: individuare le unioni che rappresentano rifiuti previsti richiede di leggerne il significato.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Discriminante kind dei rifiuti previsti](../Requirements/ServerFoundation.md#discriminante-kind-dei-rifiuti-previsti)
  * verify: [Distinzione dei rifiuti senza classi o instanceof](../Requirements/ServerFoundation.md#distinzione-dei-rifiuti-senza-classi-o-instanceof)
  * verify: [Tipi nominati immutabili per i rifiuti previsti](../Requirements/ServerFoundation.md#tipi-nominati-immutabili-per-i-rifiuti-previsti)
---

### Controllo dei rifiuti dichiarati dai casi d'uso

Esaminare il contratto Application e l'interfaccia di ciascun caso d'uso del server che prevede rifiuti, confrontando le varianti dichiarate con quelle osservabili dai suoi chiamanti; cercare eventuali cataloghi globali condivisi tra casi d'uso.

#### Details
Il controllo passa se ogni caso d'uso dichiara nel proprio contratto un insieme chiuso dei soli rifiuti osservabili dal chiamante e se non esiste un catalogo globale condiviso dei rifiuti dei casi d'uso. Fallisce se l'insieme è aperto, omette un rifiuto osservabile, include rifiuti interni non osservabili o dipende da un catalogo globale condiviso.

Non automatizzabile: stabilire quali rifiuti sono osservabili dal chiamante e se un tipo funge da catalogo globale richiede di leggere contratti e codice.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Assenza di un catalogo globale dei rifiuti dei casi d'uso](../Requirements/ServerFoundation.md#assenza-di-un-catalogo-globale-dei-rifiuti-dei-casi-duso)
  * verify: [Rifiuti osservabili dichiarati per caso d'uso](../Requirements/ServerFoundation.md#rifiuti-osservabili-dichiarati-per-caso-duso)
---

### Controllo del logger tecnico Pino

Esaminare la configurazione del runtime HTTP e seguire le chiamate che emettono eventi diagnostici tecnici.

#### Details
Il controllo passa se il server usa Pino per emettere tali eventi. Fallisce se un componente del server usa un logger alternativo per gli eventi tecnici.

Non automatizzabile: riconoscere gli eventi diagnostici tecnici fra le scritture del processo richiede di leggere il codice; il progetto non ha un controllo automatico degli import di logger alternativi.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Uso di Pino per il logging tecnico](../Requirements/ServerFoundation.md#uso-di-pino-per-il-logging-tecnico)
---

### Controllo della raccolta esterna dei log

Esaminare l'ingresso HTTP, la configurazione di Pino e le configurazioni di deployment presenti per identificare dove vengono definiti l'inoltro e il backend di raccolta dei log.

#### Details
Il controllo passa se il codice applicativo emette eventi verso i flussi standard senza integrare direttamente un backend specifico e se ogni inoltro centralizzato presente è configurato nel deployment. Fallisce se il codice applicativo contiene un'integrazione diretta con un backend di log per questo inoltro.

Non automatizzabile: le configurazioni di deployment che inoltrano i log appartengono alle installazioni e non sono nel repository.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Inoltro dei log affidato al deployment](../Requirements/ServerFoundation.md#inoltro-dei-log-affidato-al-deployment)
---

### Controllo delle dichiarazioni del caso d'uso

Per ogni caso d'uso Application del server che espone rifiuti previsti, individuare il file `<use-case>.use-case.ts` e le dichiarazioni TypeScript della firma callable, della factory e dell'unione dei rifiuti osservabili.

#### Details
Il controllo passa se tutte e tre le dichiarazioni appartengono allo stesso file `<use-case>.use-case.ts` del caso d'uso. Fallisce se una dichiarazione manca, si trova in un file diverso o il nome del file non segue lo schema previsto.

Non automatizzabile: riconoscere quali dichiarazioni sono la firma callable, la factory e l'unione dei rifiuti osservabili richiede di leggere il codice.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Dichiarazioni del caso d'uso nello stesso file](../Requirements/ServerFoundation.md#dichiarazioni-del-caso-duso-nello-stesso-file)
---

### Controllo delle eccezioni costruite dal server

Esaminare i punti in cui il codice TypeScript del server costruisce e lancia eccezioni per guasti tecnici non tradotti o bug.

#### Details
Il controllo passa se ogni eccezione costruita dal progetto in questi casi è un oggetto `Error`. Fallisce se il server costruisce e lancia una stringa, un oggetto non `Error` o un altro valore come nuova eccezione per tali guasti.

Non automatizzabile: distinguere i guasti tecnici non tradotti e i bug dagli altri lanci richiede di leggere il codice.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Eccezioni costruite come Error](../Requirements/ServerFoundation.md#eccezioni-costruite-come-error)
---

### Prova dei campi diagnostici espliciti

Per eventi diagnostici HTTP presenti, predisporre oggetti di ingresso, uscita e contesto con campi marcatori non selezionati; produrre gli eventi e confrontare le chiavi e i valori delle righe JSON con i campi dichiarati nel punto di emissione e nella configurazione del logger.

#### Details
La prova passa se tutti i campi della riga appartengono alla selezione esplicita e nessun marcatore non selezionato compare nel log. Fallisce se il logger serializza automaticamente un oggetto intero o aggiunge un campo di origine non dichiarato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * satisfiedBy: [conversation-session.adapter.spec.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.spec.ts)
  * verify: [Selezione esplicita dei campi diagnostici](../Requirements/ServerFoundation.md#selezione-esplicita-dei-campi-diagnostici)
---

### Prova dei flussi dei log tecnici

Avviare il server HTTP con i flussi standard intercettati, indurre un evento diagnostico tecnico e acquisire `stdout` e `stderr` separatamente.

#### Details
La prova passa se ogni evento Pino occupa una sola riga JSON strutturata, il processo HTTP la emette per impostazione predefinita su `stdout`. Fallisce se un evento è spezzato su più righe, non è JSON valido o compare sul flusso predefinito errato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * verify: [Formato e flussi dei log tecnici](../Requirements/ServerFoundation.md#formato-e-flussi-dei-log-tecnici)
---

### Prova dei nomi degli eventi diagnostici

Per ogni punto di emissione diagnostica HTTP presente, individuare il nome `event` dichiarato nel codice ed emettere lo stesso evento con dati di esecuzione differenti; acquisire le righe JSON.

#### Details
La prova passa se ogni riga contiene `event`, il suo valore corrisponde al nome dichiarato nel punto di emissione e resta uguale nelle esecuzioni dello stesso evento nonostante varino i dati. Fallisce se il campo manca, è ricavato da dati della singola esecuzione o cambia per lo stesso evento.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * satisfiedBy: [conversation-session.adapter.spec.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.spec.ts)
  * verify: [Nome stabile degli eventi diagnostici](../Requirements/ServerFoundation.md#nome-stabile-degli-eventi-diagnostici)
---

### Prova dei rifiuti previsti come valori

Per ogni operazione Domain, caso d'uso Application e porta Application del server che dichiara rifiuti previsti, esercitare almeno un esito riuscito e ogni variante di rifiuto dichiarata dal relativo contratto.

#### Details
La prova passa se ogni rifiuto è restituito come valore distinguibile dal successo e non è lanciato come eccezione. Fallisce se un rifiuto dichiarato è lanciato o se il chiamante non può distinguerlo dal successo.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [sqlite-conversation-history-read.adapter.integration.spec.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-history-read.adapter.integration.spec.ts)
  * satisfiedBy: [sqlite-turn-repository.adapter.integration.spec.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-turn-repository.adapter.integration.spec.ts)
  * satisfiedBy: [begin-turn.use-case.spec.ts](../../packages/conversations/src/application/begin-turn.use-case.spec.ts)
  * satisfiedBy: [complete-turn.use-case.spec.ts](../../packages/conversations/src/application/complete-turn.use-case.spec.ts)
  * satisfiedBy: [exchange-turn.use-case.spec.ts](../../packages/conversations/src/application/exchange-turn.use-case.spec.ts)
  * satisfiedBy: [turn.spec.ts](../../packages/conversations/src/domain/turn.spec.ts)
  * verify: [Rifiuti previsti come valori di esito](../Requirements/ServerFoundation.md#rifiuti-previsti-come-valori-di-esito)
---

### Prova del campo err nel log definitivo

Nei fallback HTTP presenti, indurre separatamente un `Error` costruito dal progetto con catena `cause`, errori esterni con marcatori distinti in messaggio, stack e proprietà aggiuntive, valori lanciati sconosciuti e un `LifecycleError` che raccoglie un errore del progetto e un errore esterno; intercettare l'argomento del logger e le righe JSON emesse. Prima della serializzazione acquisire riferimenti e proprietà proprie dell'`Error` originale e degli oggetti della sua catena `cause`, poi confrontarli dopo l'emissione. Confrontare le chiavi serializzate con i campi ammessi esplicitamente dal serializzatore.

#### Details
La prova passa se per l'`Error` del progetto il campo strutturato `err` conserva in memoria la catena `cause`, i riferimenti e le proprietà degli oggetti originali restano invariati, e la vista JSON include lo stack diagnostico; se ogni vista contiene soltanto campi ammessi; e se errori esterni e valori sconosciuti producono una descrizione costante sicura senza riportare messaggio, stack o proprietà aggiuntive di origine, e il `LifecycleError` elenca in `faults`, nell'ordine, la vista completa dell'errore del progetto e quella costante dell'errore esterno. Fallisce se la serializzazione modifica l'`Error` originale o un oggetto della sua catena `cause`, se l'argomento in memoria perde la catena delle cause, se la riga omette `err` o lo stack previsto, se compaiono campi non ammessi o se la descrizione esterna dipende dal valore originale.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * satisfiedBy: [logger.spec.ts](../../apps/server/src/runtime/logger.spec.ts)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.spec.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.spec.ts)
  * satisfiedBy: [conversation-session.adapter.spec.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.spec.ts)
  * verify: [Conservazione dell'errore originale durante la serializzazione](../Requirements/ServerFoundation.md#conservazione-dellerrore-originale-durante-la-serializzazione)
  * verify: [Oggetto Error nel campo err del log definitivo](../Requirements/ServerFoundation.md#oggetto-error-nel-campo-err-del-log-definitivo)
  * verify: [Rappresentazione di err nel log JSON](../Requirements/ServerFoundation.md#rappresentazione-di-err-nel-log-json)
---

### Prova del log error nei fallback pubblici

Per ogni fallback pubblico HTTP presente nel server, rendere disponibile un logger di prova e indurre separatamente un guasto tecnico inatteso, un bug e un valore lanciato sconosciuto; osservare gli eventi prodotti dal confine che decide l'esito esterno.

#### Details
La prova passa se, per ciascun caso e ciascun ingresso presente, il confine emette esattamente un log diagnostico definitivo di livello `error` relativo al guasto. Fallisce se il log manca, ha un livello diverso, è emesso da un componente intermedio o compare più volte.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * verify: [Log error del fallback pubblico](../Requirements/ServerFoundation.md#log-error-del-fallback-pubblico)
---

### Prova del logger minimo del backend

Creare il logger di base del backend su un flusso di prova, derivarne due logger con campi diversi ed emettere eventi con campi sensibili annidati, nomi di variabili delle credenziali e un `err`; costruire il server HTTP e la sessione conversazionale con un logger di prova che registra le chiamate e provocare un guasto inatteso in una rotta e in una sessione. Leggere gli import dei componenti che ricevono il logger.

#### Details
La prova passa se le righe dei logger derivati contengono ciascuna soltanto i propri campi fissi e il logger di base resta invariato; se i valori dei campi sensibili e delle variabili delle credenziali sono sostituiti da `[redacted]` a ogni profondità senza modificare gli oggetti originali; se il livello minimo è `warn`; se gli eventi della rotta e della sessione arrivano al logger iniettato tramite un logger derivato con il `correlationId` della richiesta; e se nessun componente fuori da `apps/server/src/runtime/logger.ts` importa Pino. Fallisce se un evento passa dal logger di Fastify o da un'istanza Pino diversa, se un valore sensibile compare in una riga o se un logger derivato altera il logger di base.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * satisfiedBy: [logger.spec.ts](../../apps/server/src/runtime/logger.spec.ts)
  * satisfiedBy: [conversation-session.adapter.spec.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.spec.ts)
  * satisfiedBy: [import-boundaries.spec.ts](../../test/repository/import-boundaries.spec.ts)
  * verify: [Logger minimo del backend](../Requirements/ServerFoundation.md#logger-minimo-del-backend)
---

### Prova dell'assenza di log HTTP automatici

Avviare il runtime HTTP con logging tecnico attivo e inviare una richiesta con esito ordinario e una che raggiunge il fallback per un guasto inatteso; raccogliere tutti gli eventi emessi da Fastify e dal runtime.

#### Details
La prova passa se la ricezione della richiesta e l'invio della risposta non generano eventi automatici di Fastify, mentre restano disponibili gli eventi applicativi esplicitamente previsti, incluso il log diagnostico definitivo del guasto. Fallisce se compaiono eventi automatici di inizio o fine richiesta.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * verify: [Assenza dei log HTTP automatici](../Requirements/ServerFoundation.md#assenza-dei-log-http-automatici)
---

### Prova dell'assenza di log automatici per esiti previsti

Con un logger di prova, esercitare un rifiuto previsto di Domain, uno di Application, un errore di protocollo previsto e un guasto tecnico tradotto in un esito previsto; raccogliere gli eventi `warn` e `error` prodotti per ciascun caso.

#### Details
La prova passa se nessuno dei quattro esiti causa automaticamente un log dedicato `warn` o `error` per il solo fatto di essersi verificato. Fallisce se uno di questi esiti genera tale log senza un obbligo diagnostico distinto e dichiarato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [conversation-session.adapter.spec.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.spec.ts)
  * verify: [Nessun log automatico per esiti previsti](../Requirements/ServerFoundation.md#nessun-log-automatico-per-esiti-previsti)
---

### Prova dell'assenza di raccolta automatica nei log

Nell'ingresso HTTP presente, inserire marcatori distinti in testi delle conversazioni, corpi e header HTTP, input e output dei casi d'uso e credenziali di prova; generare eventi diagnostici ordinari e di guasto e acquisire le righe JSON. Esaminare anche la configurazione del logger e le integrazioni degli ingressi per individuare serializzazioni automatiche delle sorgenti indicate.

#### Details
La prova passa se nessuno dei marcatori viene acquisito automaticamente dagli eventi e se la configurazione non abilita la registrazione automatica delle sorgenti elencate. Fallisce se un'integrazione o un serializer copia automaticamente una di tali sorgenti nei log.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * verify: [Esclusione della raccolta automatica di dati nei log](../Requirements/ServerFoundation.md#esclusione-della-raccolta-automatica-di-dati-nei-log)
---

### Prova dell'unicità del log diagnostico definitivo

Indurre lo stesso guasto inatteso in un percorso che attraversa componenti intermedi e termina nel componente che decide l'esito esterno; acquisire con un logger di prova gli eventi diagnostici emessi da ogni componente.

#### Details
La prova passa se per il guasto esiste al massimo un log diagnostico definitivo, emesso soltanto dal componente che decide l'esito esterno, e nessun componente intermedio lo registra di nuovo come errore definitivo. Fallisce se il log definitivo compare in un componente intermedio o viene emesso più volte per lo stesso guasto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.spec.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.spec.ts)
  * satisfiedBy: [conversation-session.adapter.spec.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.spec.ts)
  * verify: [Assenza di log definitivi nei componenti intermedi](../Requirements/ServerFoundation.md#assenza-di-log-definitivi-nei-componenti-intermedi)
  * verify: [Proprietà e unicità del log diagnostico definitivo](../Requirements/ServerFoundation.md#proprietà-e-unicità-del-log-diagnostico-definitivo)
---

### Prova della correlazione HTTP

Per ogni ingresso HTTP presente, effettuare almeno due richieste distinte e provocare sia un esito ordinario sia una risposta di errore gestita; raccogliere gli eventi diagnostici relativi a ciascuna richiesta e l'header `X-Request-Id` delle risposte.

#### Details
La prova passa se ogni richiesta riceve un `correlationId` UUID v4 distinto, tutti i suoi eventi diagnostici riportano lo stesso ID e ogni risposta gestita riporta in `X-Request-Id` proprio quell'ID, anche in errore. Fallisce se un ID manca, non è UUID v4, è riutilizzato tra richieste o differisce tra log e risposta.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * verify: [Identificativo di correlazione delle richieste HTTP](../Requirements/ServerFoundation.md#identificativo-di-correlazione-delle-richieste-http)
  * verify: [Identificativo di richiesta nelle risposte HTTP](../Requirements/ServerFoundation.md#identificativo-di-richiesta-nelle-risposte-http)
---

### Prova della gestione dei rifiuti delle porte nei casi d'uso

Per ogni caso d'uso Application che riceve rifiuti previsti da una porta, sostituire la porta con un fake che restituisca a turno ogni variante dichiarata dal suo contratto; osservare il comportamento del caso d'uso rispetto al proprio contratto.

#### Details
La prova passa se il caso d'uso gestisce esplicitamente ogni variante e, quando il rifiuto impedisce di completarlo, restituisce la variante prevista dal proprio contratto tramite il mapping dichiarato. Fallisce se una variante resta senza gestione, viene propagata come tipo della porta oppure produce un esito non dichiarato dal contratto del caso d'uso.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [begin-turn.use-case.spec.ts](../../packages/conversations/src/application/begin-turn.use-case.spec.ts)
  * satisfiedBy: [complete-turn.use-case.spec.ts](../../packages/conversations/src/application/complete-turn.use-case.spec.ts)
  * satisfiedBy: [exchange-turn.use-case.spec.ts](../../packages/conversations/src/application/exchange-turn.use-case.spec.ts)
  * verify: [Gestione esplicita dei rifiuti delle porte](../Requirements/ServerFoundation.md#gestione-esplicita-dei-rifiuti-delle-porte)
  * verify: [Proiezione dei rifiuti bloccanti delle porte](../Requirements/ServerFoundation.md#proiezione-dei-rifiuti-bloccanti-delle-porte)
---

### Prova della normalizzazione diagnostica al confine

Nei fallback HTTP presenti, iniettare separatamente un'istanza `Error` con `cause` e più valori lanciati che non sono `Error`, distinguibili tra loro. Intercettare il valore strutturato `err` passato al logger definitivo e osservare il percorso dai componenti intermedi al confine che decide l'esito esterno.

#### Details
La prova passa se la normalizzazione avviene una sola volta nel confine definitivo: per l'`Error`, `err` è la stessa istanza catturata; per ogni altro valore, `err` è un nuovo `Error` con messaggio diagnostico fisso uguale nei casi provati e `cause` identica al valore catturato. Il valore originale resta invariato e non viene convertito in stringa. Fallisce se un componente intermedio normalizza il guasto, se sono creati wrapper ulteriori, se cambia l'identità dell'`Error` originale o della `cause`, o se il messaggio dipende dal valore catturato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.spec.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.spec.ts)
  * satisfiedBy: [conversation-session.adapter.spec.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.spec.ts)
  * verify: [Normalizzazione diagnostica nel confine definitivo](../Requirements/ServerFoundation.md#normalizzazione-diagnostica-nel-confine-definitivo)
---

### Prova della propagazione dei guasti inattesi

Indurre un guasto tecnico inatteso e un bug in percorsi rappresentativi del server e seguire ciascun guasto fino al confine che ne decide la gestione.

#### Details
La prova passa se entrambi i guasti si propagano come eccezioni fino al confine che li gestisce, senza essere restituiti come successo o rifiuto previsto. Fallisce se un componente intermedio li assorbe o li rappresenta come esiti applicativi previsti.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.spec.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.spec.ts)
  * verify: [Propagazione dei guasti inattesi](../Requirements/ServerFoundation.md#propagazione-dei-guasti-inattesi)
---

### Prova della propagazione e del contesto dei guasti

Indurre un guasto inatteso che attraversa un layer senza nuovo contesto e un guasto catturato da un componente che aggiunge un contesto operativo concreto; osservare i valori propagati e ispezionare i `catch` equivalenti del server.

#### Details
La prova passa se nel primo caso arriva al confine lo stesso valore originale, senza wrapper, e nel secondo arriva un nuovo `Error` con un messaggio che identifica l'operazione fallita, `cause` identica al valore originale e originale non modificato. Fallisce se un layer crea un wrapper senza contesto, se il nuovo `Error` perde la causa o se modifica il valore catturato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [mcp-tool-client.spec.ts](../../packages/conversations/src/adapters/out/mcp-tool-client.spec.ts)
  * satisfiedBy: [complete-turn.use-case.spec.ts](../../packages/conversations/src/application/complete-turn.use-case.spec.ts)
  * verify: [Contesto operativo con Error e cause](../Requirements/ServerFoundation.md#contesto-operativo-con-error-e-cause)
  * verify: [Propagazione senza wrapper superflui](../Requirements/ServerFoundation.md#propagazione-senza-wrapper-superflui)
---

### Prova della separazione tra messaggio pubblico e diagnosi

Per ogni confine del server che comunica un guasto alla famiglia, indurre un'eccezione con marcatori distinti nel messaggio tecnico, nello stack, nella causa e nel valore originale; raccogliere il messaggio pubblico e, quando prodotta, la diagnosi tecnica dello stesso guasto.

#### Details
La prova passa se il messaggio pubblico non contiene nessuno dei marcatori tecnici né il valore originale e, quando esiste una diagnosi tecnica, le due rappresentazioni sono costruite separatamente. Fallisce se un dettaglio tecnico compare nel messaggio per la famiglia o se il messaggio pubblico è ricavato direttamente dalla rappresentazione diagnostica.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.spec.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.spec.ts)
  * satisfiedBy: [conversation-session.adapter.spec.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.spec.ts)
  * verify: [Esclusione dei dettagli tecnici dal messaggio pubblico](../Requirements/ServerFoundation.md#esclusione-dei-dettagli-tecnici-dal-messaggio-pubblico)
  * verify: [Separazione del messaggio pubblico dalla diagnosi tecnica](../Requirements/ServerFoundation.md#separazione-del-messaggio-pubblico-dalla-diagnosi-tecnica)
---

### Prova delle definizioni locali di Result

Leggendo come testo tutti i file TypeScript sotto `src/` di ogni package in `packages/`, tolti i commenti e i letterali stringa, individuare le dichiarazioni chiamate `Result`, i riferimenti a `Result` e gli import, le riesportazioni, gli import di namespace e gli import dinamici che portano il nome `Result`.

#### Details
La prova passa se ogni package che riferisce `Result` lo dichiara nel proprio `src/` come alias di tipo con i parametri `T` ed `E` il cui testo, a meno degli spazi, è `Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>`, se non esistono altre dichiarazioni chiamate `Result` e se ogni import o riesportazione del nome `Result` usa un percorso relativo verso un file dello stesso package che lo dichiara. Fallisce se il tipo è importato da un altro package o tramite un nome di package, se un ramo è mutabile, se discriminanti o campi differiscono dalla specifica o se un package riferisce `Result` senza dichiararlo. Fallisce anche se la lettura non riconosce, in un testo d'esempio, le dichiarazioni valide e non valide e ogni forma di import del nome.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [result-type.spec.ts](../../test/repository/result-type.spec.ts)
  * verify: [Definizione locale del tipo Result](../Requirements/ServerFoundation.md#definizione-locale-del-tipo-result)
  * verify: [Struttura del tipo Result](../Requirements/ServerFoundation.md#struttura-del-tipo-result)
---

### Verifica della protezione dai segreti

Raggruppa i controlli che impediscono l'ingresso di credenziali nella storia Git del backend, in CI e nei commit locali.

#### Metadata
  * type: verification-objective
---

### Prova dell'hook pre-commit dei segreti del backend

In un repository Git temporaneo che contiene l'hook `.githooks/pre-commit` del repository, con `core.hooksPath` impostato a `.githooks`, mettere in staging un file con un token fittizio nel formato dei token di accesso personali GitHub, costruito durante la prova, e tentare il commit; ripetere con un file privo di segreti; ripetere con un `PATH` che contiene soltanto `git`.

#### Details
La prova passa se il commit con il token è impedito e l'output non mostra il valore, se il commit senza segreti riesce e se, senza `gitleaks` nel `PATH`, il commit è impedito con un messaggio che nomina gitleaks e indica dove ottenerlo. Fallisce se viene creato un commit con il token, se il valore compare nell'output, se il commit senza segreti è impedito, se l'assenza dello scanner lascia passare il commit oppure se `gitleaks` non è disponibile nel `PATH` della prova. La CI installa lo scanner secondo «Profilo di scansione dei segreti del backend» prima della suite Vitest.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della protezione dai segreti](#verifica-della-protezione-dai-segreti)
  * satisfiedBy: [pre-commit-hook.spec.ts](../../test/repository/pre-commit-hook.spec.ts)
  * verify: [Blocco locale dei commit con segreti](../Requirements/ServerFoundation.md#blocco-locale-dei-commit-con-segreti)
---

### Prova della configurazione della scansione dei segreti in CI del backend

Leggere come testo `.github/workflows/secret-scan.yml` e `.github/workflows/publish-image.yml` e confrontarli con «Profilo di scansione dei segreti con gitleaks» e «Profilo di scansione dei segreti del backend».

#### Details
La prova passa se la scansione parte a ogni push su qualunque branch (`'**'`), a ogni pull request, su richiesta manuale e con `workflow_call`; se il checkout dichiara `fetch-depth: 0` e `persist-credentials: false`; se il workflow fissa la versione 8.30.1 e l'impronta SHA-256 del contratto, scarica `gitleaks_8.30.1_linux_x64.tar.gz` dalla release ufficiale e lo verifica con `sha256sum --check --strict` prima di estrarlo; se il job `Scan history for secrets` esegue `gitleaks git --redact --no-banner --exit-code 1 .`; e se il job `publish` dichiara `needs` sul job che richiama `secret-scan.yml`. Fallisce se un evento manca, se la storia è troncata, se versione o impronta differiscono dal contratto, se l'archivio è estratto senza verifica, se il comando differisce o se la pubblicazione non dipende dalla scansione. Che una scansione fallita impedisca l'integrazione è verificato da «Ispezione della protezione del merge del backend».

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della protezione dai segreti](#verifica-della-protezione-dai-segreti)
  * satisfiedBy: [workflows.spec.ts](../../test/repository/workflows.spec.ts)
  * verify: [Scansione dei segreti nella CI del backend](../Requirements/ServerFoundation.md#scansione-dei-segreti-nella-ci-del-backend)
---

### Verifica della pubblicazione dell'immagine Docker del server

Verificare che una release del backend renda disponibile nel registro l'immagine utilizzabile nell'homelab e collegata al tag Git che l'ha prodotta.

#### Metadata
  * type: verification-objective
---

### Dimostrazione della pubblicazione dell'immagine Docker del server

Su una release del backend, osservare l'esecuzione del workflow GitHub Actions e recuperare da GHCR il tag immagine corrispondente al tag Git.

#### Details
La verifica passa se il tag Git `vMAJOR.MINOR.PATCH` corrisponde alla versione del package server, il workflow verifica l'immagine prima del push e pubblica `ghcr.io/ambrogio-app/ambrogio-backend:<tag Git>` per `linux/amd64`. Con credenziali di lettura, il digest pubblicato deve essere scaricabile e avviare il server con configurazione e archivio SQLite esterni, senza Compose. Un tag diverso non deve pubblicare l'immagine. La prova finale richiede una release effettivamente pubblicata.

Non automatizzabile: richiede la creazione di un tag di release, l'esecuzione su GitHub Actions e il download dal registro GHCR.

#### Metadata
  * type: demonstration-verification

#### Relations
  * derivedFrom: [Verifica della pubblicazione dell'immagine Docker del server](#verifica-della-pubblicazione-dellimmagine-docker-del-server)
  * verify: [Pubblicazione dell'immagine Docker del server](../Requirements/ServerFoundation.md#pubblicazione-dellimmagine-docker-del-server)
---

### Prova del workflow di pubblicazione dell'immagine del server

Leggere come testo `.github/workflows/publish-image.yml`.

#### Details
La prova passa se il workflow parte soltanto sui tag `v*`, se il job `publish` convalida il tag e ricava `IMAGE` uguale a `ghcr.io/ambrogio-app/ambrogio-backend:<tag Git>`, verifica l'immagine con `scripts/verify-docker-image.mjs` prima del push e, nel passo del push, dopo `docker push "$IMAGE"`, scrive `Published $IMAGE` in `$GITHUB_STEP_SUMMARY`, e se il workflow non nomina un tag `latest`. Fallisce se una di queste condizioni manca. La pubblicazione effettiva resta provata da «Dimostrazione della pubblicazione dell'immagine Docker del server».

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della pubblicazione dell'immagine Docker del server](#verifica-della-pubblicazione-dellimmagine-docker-del-server)
  * satisfiedBy: [workflows.spec.ts](../../test/repository/workflows.spec.ts)
  * verify: [Pubblicazione dell'immagine Docker del server](../Requirements/ServerFoundation.md#pubblicazione-dellimmagine-docker-del-server)
---

### Verifica delle integrazioni senza eventi differiti

Raggruppa i controlli sulla scelta di non usare eventi di dominio persistenti per consegne successive nella prima versione.

#### Metadata
  * type: verification-objective
---

### Controllo dell'assenza di outbox e pubblicazione differita

Esaminare le operazioni dei moduli business, lo schema persistente e le integrazioni tra componenti della prima versione.

#### Details
Il controllo passa se nessun modulo conserva eventi di dominio per una consegna successiva e se non esistono outbox, code o processi di pubblicazione differita di tali eventi. Fallisce se un evento di dominio viene registrato in attesa di essere consegnato o ritentato. La verifica non riguarda i normali scambi testuali conservati nello storico delle conversazioni.

Non automatizzabile: riconoscere un evento di dominio conservato per una consegna successiva richiede di leggere operazioni e schema.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica delle integrazioni senza eventi differiti](#verifica-delle-integrazioni-senza-eventi-differiti)
  * verify: [Assenza di consegna differita degli eventi di dominio](../Requirements/ServerFoundation.md#assenza-di-consegna-differita-degli-eventi-di-dominio)
---

### Verifica dello stack del server

Raggruppa i controlli sulla preparazione del server in TypeScript ESM e sulla sua esecuzione con Node.js 24 o successivo.

#### Metadata
  * type: verification-objective
---

### Controllo degli esempi di configurazione

Esaminare `.env.example`, `compose.example.yaml` e i file degli agenti d'esempio di `examples/agents/`, e i campi in cui potrebbero comparire credenziali.

#### Details
Il controllo passa se gli esempi non contengono credenziali effettive: le variabili delle credenziali sono vuote in `.env.example`, richieste senza valore in `compose.example.yaml` e nominate soltanto per nome nei file degli agenti. Fallisce se un esempio contiene una credenziale effettiva.

Non automatizzabile: stabilire che un valore non è una credenziale effettiva richiede giudizio umano; gitleaks riconosce soltanto i formati previsti dalle sue regole.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Esempi di configurazione privi di credenziali](../Requirements/ServerFoundation.md#esempi-di-configurazione-privi-di-credenziali)
---

### Controllo dei file di configurazione dei componenti

Per ogni componente configurabile del backend individuare il modulo di configurazione da cui è letta la sua configurazione; esaminare da dove provengono i valori, come sono validati e confrontare le variabili lette dai diversi moduli.

#### Details
Il controllo passa se ogni componente ha un proprio modulo di configurazione TypeScript nella build, il modulo legge soltanto variabili d'ambiente del componente, le valida con lo schema del componente e non contiene valori effettivi, e soltanto il modulo degli agenti legge i file di dati della directory degli agenti. Fallisce se un componente legge la configurazione da un'altra sorgente, condivide il modulo con un altro componente o se un modulo contiene un valore effettivo, come un indirizzo o una credenziale.

Non automatizzabile: individuare i componenti configurabili e distinguere un valore effettivo da un valore predefinito ammesso richiede di leggere il codice di avvio e di giudicare i confini dei componenti.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Modulo di configurazione per componente del backend](../Requirements/ServerFoundation.md#modulo-di-configurazione-per-componente-del-backend)
---

### Controllo del perimetro iniziale di osservabilità

Esaminare runtime HTTP, dipendenze, configurazioni, endpoint e documentazione operativa della prima versione. Confrontare i segnali presenti con i contratti dei log strutturati e degli identificativi di correlazione; cercare raccoglitori o API distinti per metriche, tracing distribuito e audit.

#### Details
Il controllo passa se i runtime forniscono i log e i `correlationId` già previsti, senza attivare nella prima versione metriche, tracing o audit separati, e se nessun `correlationId` o log ordinario è presentato come traccia distribuita o registro di audit. Fallisce se viene introdotto un segnale separato senza una decisione e una verifica proprie, se i log sono descritti come audit garantito o se manca il profilo diagnostico previsto. I controlli funzionali dei log e della correlazione restano nelle rispettive verifiche.

Non automatizzabile: richiede di esaminare la documentazione operativa e di giudicare se un segnale è presentato come traccia distribuita o audit.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Perimetro iniziale dei segnali di osservabilità del backend](../Requirements/ServerFoundation.md#perimetro-iniziale-dei-segnali-di-osservabilità-del-backend)
---

### Controllo dell'assenza di autenticazione applicativa

Esaminare l'ingresso HTTP presente, le dipendenze runtime e i modelli persistenti del server per individuare gestione di account, credenziali utente, login e controlli di autenticazione applicativa.

#### Details
Il controllo passa se l'MVP non implementa account utente né autenticazione applicativa nei propri ingressi. Fallisce se sono presenti meccanismi applicativi di account o autenticazione.

Non automatizzabile: riconoscere meccanismi di account o autenticazione richiede di leggere ingressi, dipendenze e modelli persistenti.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Assenza di account e autenticazione applicativa nell'MVP](../Requirements/ServerFoundation.md#assenza-di-account-e-autenticazione-applicativa-nellmvp)
---

### Controllo dell'esclusione delle configurazioni effettive

Per ciascun file di configurazione effettivo usato da un'installazione o nello sviluppo, come `.env` e i file degli agenti, esaminare i file tracciati da Git, le regole di esclusione e il contenuto dell'immagine container costruita per il server.

#### Details
Il controllo passa se nessun file effettivo è tracciato in Git o incluso nell'immagine e il deployment lo fornisce dall'esterno. Fallisce se un file effettivo è presente nei file versionati o nell'immagine.

Non automatizzabile: i file effettivi appartengono alle installazioni e non sono nel repository; `scripts/verify-docker-image.mjs` controlla soltanto l'assenza dei percorsi noti nell'immagine.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Esclusione dei file di configurazione effettivi dagli artefatti](../Requirements/ServerFoundation.md#esclusione-dei-file-di-configurazione-effettivi-dagli-artefatti)
---

### Controllo dell'implementazione HTTP con Fastify

Esaminare l'avvio del server e la registrazione degli endpoint dell'API HTTP.

#### Details
Il controllo passa se il server crea un'istanza Fastify, vi registra gli endpoint dell'API HTTP e la usa per gestire le richieste. Fallisce se gli endpoint sono serviti da un altro framework o da un gestore HTTP applicativo che aggira Fastify.

Non automatizzabile: riconoscere un gestore HTTP che aggira Fastify richiede di leggere l'avvio del server.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Implementazione Fastify dell'API HTTP](../Requirements/ServerFoundation.md#implementazione-fastify-dellapi-http)
---

### Ispezione dei nomi secondo le responsabilità nel backend

#### Details
Partire dall'elenco completo dei file di produzione, dalle porte Application e dai punti di ingresso; non limitare la ricerca ai nomi che contengono già `.adapter`, `.port` o `.use-case`. Per ciascun componente interessato registrare percorso, responsabilità, eventuale porta dichiarata o implementata o caso d'uso invocato, classificazione e nome atteso.

L'ispezione passa se tutti i casi d'uso hanno il suffisso `.use-case.ts`, tutti i file che dichiarano una porta Application hanno il suffisso `.port.ts`, tutti gli adapter di ingresso e di uscita hanno il suffisso `.adapter.ts` e i file di supporto non sono classificati come adapter soltanto per la cartella che li contiene. Considerare anche le implementazioni strutturali di porte a oggetto o callable; non affidarsi al solo `implements`. I ruoli ambigui devono essere risolti con motivazione documentata. L'ispezione fallisce se manca un suffisso richiesto o se un suffisso descrive un ruolo non realizzato.

Per ogni rinomina controllare import, export pubblici, riferimenti nei test e collegamenti Reqvire. La compilazione e i test pertinenti devono continuare a passare. L'elenco dei file classificati, i difetti e l'esito si riportano nel messaggio del commit o nella pull request che svolge l'ispezione; la presenza di una relazione `satisfiedBy` e il successo di `validate` o `lint` non sostituiscono questa ispezione.

Non automatizzabile: la classificazione dei file per responsabilità richiede giudizio umano, come prescrive la convenzione dei nomi.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Nomi dei file secondo il ruolo architetturale nel backend](../Requirements/ServerFoundation.md#nomi-dei-file-secondo-il-ruolo-architetturale-nel-backend)
---

### Ispezione dei proprietari dei valori predefiniti del backend

Esaminare ogni valore facoltativo della configurazione del backend, degli adapter inbound, dei casi d'uso e delle creazioni del Domain, e il punto in cui viene applicato il suo valore predefinito.

#### Details
L'ispezione passa se ogni valore predefinito è deciso per il proprio concetto e applicato esplicitamente, una sola volta, dal suo proprietario soltanto quando l'assenza è ammessa: i valori di configurazione dal modulo di configurazione del componente, quelli di protocollo dall'adapter inbound, quelli di intenzione da Application e quelli di creazione dal Domain. Fallisce se un valore predefinito è soltanto documentato, ripetuto in un altro punto o applicato dal layer sbagliato.

Non automatizzabile: stabilire quale layer possiede un valore predefinito dipende dal significato di ciascun campo, che richiede la lettura del codice.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Valori predefiniti del backend applicati dal proprietario](../Requirements/ServerFoundation.md#valori-predefiniti-del-backend-applicati-dal-proprietario)
---

### Ispezione del limite dei corpi HTTP

Esaminare le rotte HTTP registrate dal server e la configurazione del limite dei corpi del componente HTTP. Per ogni rotta che accetta un corpo, quando esisterà, inviare corpi sotto e sopra il limite dichiarato, includendo un invio in più parti oltre il limite.

#### Details
L'ispezione passa se nessuna rotta HTTP accetta un corpo senza un limite positivo esplicito e se le rotte attuali di elenco e storico non accettano corpo. Per una futura rotta con corpo, i corpi oltre il limite ricevono `413` con JSON `error` sicuro e non avviano l'operazione. I limiti dei turni appartengono al protocollo conversazionale e sono verificati separatamente. Fallisce se una rotta accetta un corpo senza limite o se il limite dipende solo da `Content-Length`.

Non automatizzabile: richiede di stabilire quali rotte accettano un corpo; le rotte attuali non ne accettano, quindi non esiste un corpo da inviare in una prova automatica.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Limite dei corpi delle richieste HTTP](../Requirements/ServerFoundation.md#limite-dei-corpi-delle-richieste-http)
---

### Ispezione della protezione del merge del backend

Leggere con `gh api repos/<proprietario>/<repository>/rulesets` e con il dettaglio del ruleset `main` le regole attive sul branch principale.

#### Details
L'ispezione passa se il ruleset corrisponde a «Ruleset del branch principale» e a «Ruleset del branch principale del backend»: applicazione attiva sul branch predefinito, nessun attore escluso, integrazione solo tramite pull request, controlli richiesti con i nomi del contratto del backend, riscrittura forzata e cancellazione vietate; e se un push diretto sul branch principale viene rifiutato. Fallisce se il ruleset manca, è disattivato, ha attori esclusi o differisce dal contratto. I controlli richiesti `Backend checks` e `Scan history for secrets` sono i job verificati da «Prova della configurazione della CI del server» e da «Prova della configurazione della scansione dei segreti in CI del backend»: l'ispezione stabilisce che un loro fallimento impedisce l'integrazione. Non automatizzabile: il ruleset è un'impostazione del repository GitHub e non un file del repository, e leggerlo richiede credenziali con accesso amministrativo che la CI non possiede.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Controlli CI delle modifiche funzionali del server](../Requirements/ServerFoundation.md#controlli-ci-delle-modifiche-funzionali-del-server)
  * verify: [Controlli obbligatori prima del merge del backend](../Requirements/ServerFoundation.md#controlli-obbligatori-prima-del-merge-del-backend)
  * verify: [Scansione dei segreti nella CI del backend](../Requirements/ServerFoundation.md#scansione-dei-segreti-nella-ci-del-backend)
---

### Prova degli header di cache conversazionali

Richiedere elenco e storico, anche in casi di errore; osservare gli header delle risposte.

#### Details
La prova passa se tutte le risposte HTTP che trasportano dati conversazionali includono `Cache-Control: no-store`, anche quando segnalano un errore. Fallisce se una risposta pertinente ne è priva. I messaggi del canale conversazionale WebSocket non rientrano in questa prova.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [get-conversation.route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.route.adapter.spec.ts)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.spec.ts)
  * satisfiedBy: [list-conversations.route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.route.adapter.spec.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.spec.ts)
  * verify: [Esclusione dalla cache delle risposte conversazionali HTTP](../Requirements/ServerFoundation.md#esclusione-dalla-cache-delle-risposte-conversazionali-http)
---

### Prova dei file JSON degli agenti

Preparare una directory degli agenti con file `<id>.json` validi e con file di altro tipo; in tentativi separati usare un file che non è JSON valido, un campo sconosciuto a ciascun livello, una credenziale letterale in `llm.apiKey`, `mcp.auth.token` o `mcp.auth.clientSecret`, un nome di variabile non valido e una variabile nominata assente o vuota, con un segreto marcatore nei valori.

#### Details
La prova passa se i file validi sono accettati con le credenziali lette dalle variabili nominate, i file di altro tipo sono ignorati, ogni caso invalido impedisce l'attivazione con `Invalid agent configuration: <id>`, una variabile assente o vuota produce `Missing environment variable <NOME> for agent <id>` e nessun errore contiene il segreto marcatore. Fallisce se un file con una credenziale letterale o con un campo sconosciuto è accettato o se un errore riporta un valore.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [agent-config.spec.ts](../../apps/server/src/runtime/agent-config.spec.ts)
  * verify: [File JSON di soli dati per gli agenti](../Requirements/ServerFoundation.md#file-json-di-soli-dati-per-gli-agenti)
---

### Prova dei file d'ambiente e dei valori predefiniti del backend

Confrontare `.env.example` con le variabili dichiarate dai moduli di configurazione e con le variabili nominate dai file degli agenti d'esempio; confrontare le variabili impostate da `compose.example.yaml` con i valori predefiniti dichiarati dai moduli; esaminare gli script del `package.json` della radice e i sorgenti del backend; avviare Node.js con `--env-file` su un file temporaneo e una variabile dello stesso nome nell'ambiente del processo.

#### Details
La prova passa se `.env.example` elenca esattamente quelle variabili, tutte vuote salvo `AMBROGIO_ENV=development`; se `compose.example.yaml` imposta `AMBROGIO_ENV: production`, ogni variabile con un valore predefinito di sviluppo e nessuna variabile con un valore predefinito valido in produzione, senza valori predefiniti di interpolazione; se soltanto lo script `dev` usa `--env-file=.env` e nessun sorgente carica file d'ambiente; e se la variabile del processo prevale su quella del file. Fallisce su qualunque scostamento.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [environment-files.spec.ts](../../test/repository/environment-files.spec.ts)
  * verify: [File d'ambiente locale del backend](../Requirements/ServerFoundation.md#file-dambiente-locale-del-backend)
  * verify: [Valori predefiniti del backend applicati dal proprietario](../Requirements/ServerFoundation.md#valori-predefiniti-del-backend-applicati-dal-proprietario)
---

### Prova del bootstrap della configurazione del backend

Avviare l'ingresso HTTP con un oggetto d'ambiente di prova che fornisce variabili distinte per i componenti attivi e omette quelle della voce. Osservare i valori ricevuti dai componenti e il momento in cui vengono create e attivate le risorse. Ripetere con una variabile richiesta mancante, malformata o con un valore invalido che contiene un segreto marcatore, e con `AMBROGIO_AGENTS_DIR` diretta a una directory di prova.

#### Details
La prova passa se il processo legge una volta all'avvio soltanto la configurazione necessaria, consegna a ogni componente solo i dati pertinenti già convertiti e usa la directory degli agenti indicata. L'assenza delle variabili della voce non blocca gli ingressi. Una variabile richiesta mancante o invalida impedisce l'attivazione prima dell'uso delle risorse dipendenti e produce un errore sicuro che nomina la variabile senza riprodurre il segreto. Domain e casi d'uso non leggono direttamente file o ambiente. Fallisce se una variabile non necessaria diventa obbligatoria, la configurazione viene riletta durante il lavoro, una risorsa dipendente si attiva prima della validazione o un segreto appare nell'errore.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [agent-config.spec.ts](../../apps/server/src/runtime/agent-config.spec.ts)
  * satisfiedBy: [conversation-server.config-bootstrap.spec.ts](../../apps/server/src/runtime/conversation-server.config-bootstrap.spec.ts)
  * satisfiedBy: [config-examples.spec.ts](../../apps/server/test/examples/config-examples.spec.ts)
  * satisfiedBy: [conversation-config.spec.ts](../../packages/conversations/src/adapters/out/conversation-config.spec.ts)
  * verify: [Caricamento iniziale della configurazione del backend](../Requirements/ServerFoundation.md#caricamento-iniziale-della-configurazione-del-backend)
  * verify: [Distribuzione mirata della configurazione validata](../Requirements/ServerFoundation.md#distribuzione-mirata-della-configurazione-validata)
  * verify: [Validazione preventiva della configurazione attiva](../Requirements/ServerFoundation.md#validazione-preventiva-della-configurazione-attiva)
---

### Prova del catalogo vocale bilingue dell'immagine

Costruire l'immagine e ispezionare gli archivi fissati, le impronte verificate e i file runtime di Vosk italiano e inglese, delle voci Piper italiane e inglesi e del modello Kokoro multilingue. Eseguire una breve trascrizione e una sintesi per ogni lingua e motore disponibile nell'immagine.

#### Details
La prova passa se tutte le risorse sono leggibili dentro il container senza mount, le impronte corrispondono a quelle fissate e Vosk, Piper e Kokoro producono risultati non vuoti in entrambe le lingue. Fallisce se una risorsa manca o richiede un mount, se un'impronta non corrisponde o se un motore produce un risultato vuoto in una lingua.

La build dell'immagine verifica le impronte degli archivi con `scripts/fetch-speech-models.mjs`; `scripts/verify-docker-image.mjs` esegue gli altri controlli nel job di pubblicazione, perché richiedono la build Docker con il download dei modelli.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [fetch-speech-models.mjs](../../scripts/fetch-speech-models.mjs)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * verify: [Modelli vocali italiani e inglesi inclusi](../Requirements/ServerFoundation.md#modelli-vocali-italiani-e-inglesi-inclusi)
---

### Prova del controllo di accesso dell'installazione

Per ogni installazione dell'MVP da verificare, ispezionare la configurazione di rete e dell'eventuale reverse proxy; tentare l'accesso agli ingressi del server da un client ammesso e da un client non ammesso dall'installatore.

#### Details
La prova passa se il client ammesso può raggiungere l'ingresso previsto e il client non ammesso non può raggiungere l'applicazione attraverso la rete o il proxy. Fallisce se un client non ammesso può usare l'ingresso. La prova richiede l'installazione concreta: la validazione del repository non certifica le configurazioni degli installatori.

Non automatizzabile: si svolge su un'installazione reale, con la rete e l'eventuale reverse proxy scelti dall'installatore, che il repository non contiene.

#### Metadata
  * type: demonstration-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Controllo dell'accesso nell'installazione](../Requirements/ServerFoundation.md#controllo-dellaccesso-nellinstallazione)
---

### Prova del profilo globale degli header HTTP

Avviare l'API con il plugin registrato sulla radice e richiedere una risposta conversazionale riuscita, un errore gestito e una rotta inesistente. Ispezionare configurazione del plugin e header delle risposte.

#### Details
La prova passa se `@fastify/helmet` è registrato globalmente e le tre risposte portano gli header applicabili del profilo adottato, salvo differenze motivate e dichiarate. Fallisce se il plugin è limitato a un sottoinsieme di rotte, se un errore o un `404` non riceve il profilo, oppure se una deroga non è motivata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * verify: [Header di sicurezza sulle risposte HTTP](../Requirements/ServerFoundation.md#header-di-sicurezza-sulle-risposte-http)
---

### Prova del runner Vitest del backend

Esaminare `vitest.config.ts` e gli script `test`, `test:integration` e `test:e2e` del `package.json` della radice; avviarli e acquisire il report dei test eseguiti da ciascuno.

#### Details
La prova passa se gli script eseguono con Vitest rispettivamente i progetti `fast`, `integration` ed `e2e` di «Suite di test del backend», ciascuno produce un report dei test avviati, nessun file di test compare in più di un report e la somma dei file eseguiti è pari al numero dei file `*.spec.ts` del repository. Fallisce se la suite usa un runner diverso, se uno script non può essere avviato tramite Vitest, se un file gira in entrambe le selezioni o se un file di test non appartiene a nessuna.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [package.json](../../package.json)
  * satisfiedBy: [vitest.config.ts](../../vitest.config.ts)
  * verify: [Vitest come runner del backend](../Requirements/ServerFoundation.md#vitest-come-runner-del-backend)
---

### Prova dell'ambiente di esecuzione del backend

Leggere la configurazione con `AMBROGIO_ENV` assente, vuota, con un valore diverso da `development`, `test` e `production`, e con ciascuno dei tre valori; in ciascun ambiente omettere a turno le variabili che hanno un valore predefinito di sviluppo e quelle che hanno un valore predefinito per tutti gli ambienti, e fornire una variabile vuota.

#### Details
La prova passa se un ambiente assente, vuoto o invalido impedisce l'avvio con un errore che nomina `AMBROGIO_ENV` senza il valore; se i valori predefiniti di sviluppo valgono soltanto in `development` e in `test` e `production` la loro assenza impedisce l'avvio; se i valori predefiniti per tutti gli ambienti valgono ovunque; e se una variabile vuota è trattata come assente. Fallisce se un ambiente implicito viene assunto, se un valore predefinito di sviluppo vale in un altro ambiente o se un errore riporta un valore.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [http-config.spec.ts](../../apps/server/src/runtime/http-config.spec.ts)
  * satisfiedBy: [conversation-config.spec.ts](../../packages/conversations/src/adapters/out/conversation-config.spec.ts)
  * satisfiedBy: [environment-variables.spec.ts](../../packages/conversations/src/adapters/out/environment-variables.spec.ts)
  * verify: [Ambiente di esecuzione dichiarato del backend](../Requirements/ServerFoundation.md#ambiente-di-esecuzione-dichiarato-del-backend)
---

### Prova dell'immagine Docker indipendente da Compose

Costruire l'immagine Docker del server a partire dagli artefatti del progetto e avviarla con il solo runtime Docker, fornendo dall'esterno i file di configurazione di prova; verificare l'avvio e una richiesta a un ingresso HTTP presente. Esaminare l'eventuale file Compose per accertare che sia un esempio di avvio e non un prerequisito della build o dell'esecuzione.

#### Details
La prova passa se il progetto produce un'immagine eseguibile, il server si avvia e risponde usando l'immagine senza Docker Compose e nessuna fase indispensabile richiede Compose. Fallisce se l'immagine manca, non è eseguibile oppure l'avvio dipende da Compose.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * verify: [Distribuzione del server come immagine Docker](../Requirements/ServerFoundation.md#distribuzione-del-server-come-immagine-docker)
  * verify: [Esecuzione del server senza Docker Compose](../Requirements/ServerFoundation.md#esecuzione-del-server-senza-docker-compose)
---

### Prova dell'ingresso di prova del server conversazionale

Importare soltanto l'ingresso di prova dal backend compilato e avviare il server con un produttore di risposte, un trascrittore e un sintetizzatore deterministici, un archivio temporaneo e una porta libera; aprire una sessione `ambrogio.v1`, inviare un turno testuale e un turno audio con la risposta chiesta in audio, leggere elenco e storico con le API HTTP pubbliche, anche da un'origine consentita e da una non consentita, e chiudere il server due volte; ripetere l'avvio senza trascrittore e sintetizzatore e inviare un turno audio.

#### Details
La prova passa se l'ingresso restituisce un indirizzo locale raggiungibile e un'operazione di chiusura; se i turni sono ammessi, ricevono le risposte del produttore deterministico e si concludono con `turn.completed`; se la risposta in audio al turno audio, prodotta dal sintetizzatore deterministico, contiene il testo ottenuto dal trascrittore deterministico; se elenco e storico riportano gli scambi conservati e soltanto l'origine consentita riceve l'intestazione CORS; se dopo la chiusura il server non accetta connessioni e l'archivio temporaneo è rilasciato; e se, senza trascrittore e sintetizzatore, il turno audio è rifiutato con `audio_unavailable`. Fallisce se l'avvio legge configurazioni dell'installazione, variabili d'ambiente o modelli vocali, contatta servizi esterni, richiede l'import di altri moduli del backend o se un esito differisce dai contratti del protocollo.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [test-server.spec.ts](../../apps/server/src/runtime/test-server.spec.ts)
  * verify: [Ingresso di prova pubblico del server conversazionale](../Requirements/ServerFoundation.md#ingresso-di-prova-pubblico-del-server-conversazionale)
---

### Prova dell'irrobustimento dei workflow

Leggere come testo `.github/workflows/ci.yml`, `.github/workflows/secret-scan.yml` e `.github/workflows/publish-image.yml` e confrontare permessi, riferimenti delle action, runner, `timeout-minutes`, opzioni di checkout, uso del `GITHUB_TOKEN`, installazione dello scanner dei segreti e richiami `workflow_call` con «Profilo comune dei workflow GitHub Actions» e «Profilo di irrobustimento dei workflow GitHub Actions».

#### Details
La prova passa se ogni workflow dichiara `permissions` con il solo `contents: read`; se soltanto il job `publish` dichiara permessi propri, `contents: read` e `packages: write`; se ogni `uses` di un passo indica un'action esterna con un'impronta di 40 caratteri esadecimali seguita dal commento della versione e `actions/checkout` e `actions/setup-node` usano le impronte del contratto; se ogni job con passi usa `ubuntu-24.04` e dichiara `timeout-minutes` 20 per `checks`, 10 per `gitleaks` e 60 per `publish`; se ogni passo `actions/checkout` imposta `persist-credentials: false`; se `secrets.GITHUB_TOKEN` compare soltanto nell'`env` del passo di login al registro; se i job `checks` e `gitleaks` installano gitleaks con la stessa versione e la stessa impronta verificata; e se `ci.yml` e `secret-scan.yml` dichiarano `workflow_call` e `publish-image.yml` li richiama come job `checks` e `secret-scan`, da cui il job `publish` dipende con `needs`. Fallisce se un job riceve permessi non previsti, se un'action è indicata con un tag o un branch, se un job non ha il limite di durata del contratto, se un checkout conserva le credenziali o se la pubblicazione duplica i controlli invece di richiamarli.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [workflows.spec.ts](../../test/repository/workflows.spec.ts)
  * verify: [Irrobustimento dei workflow GitHub Actions](../Requirements/ServerFoundation.md#irrobustimento-dei-workflow-github-actions)
---

### Prova dell'origine delle credenziali API

Per ogni componente del backend che usa un'API esterna, preparare file degli agenti di prova che nominano variabili d'ambiente distinte per chiave API, token Bearer e segreto OAuth, fornire nell'oggetto d'ambiente valori fittizi distinguibili, avviare il componente con un client API controllato e osservare le credenziali fornite al client. Ripetere con una variabile nominata assente o vuota e con un file che contiene la credenziale al posto del nome della variabile.

#### Details
La prova passa se le credenziali fornite al client sono i valori delle variabili nominate dal file dell'agente, una variabile assente o vuota impedisce l'avvio con un messaggio che nomina la variabile e l'agente senza alcun valore, e un file con una credenziale letterale è rifiutato. Fallisce se il componente usa credenziali incorporate nel codice o nel file o ricavate da un'altra sorgente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [agents.api-credentials.spec.ts](../../apps/server/src/composition/agents.api-credentials.spec.ts)
  * satisfiedBy: [agent-config.spec.ts](../../apps/server/src/runtime/agent-config.spec.ts)
  * verify: [Credenziali API dalle variabili d'ambiente](../Requirements/ServerFoundation.md#credenziali-api-dalle-variabili-dambiente)
---

### Prova della build e dell'avvio del server

Eseguire la build del server a partire dai sorgenti TypeScript, verificare che invochi `tsc` e avviare l'artefatto prodotto in un ambiente Node.js 24; ripetere su ogni altra versione di Node.js dichiarata supportata dal progetto.

#### Details
La prova passa se la build usa `tsc`, produce JavaScript ESM e l'artefatto si avvia senza errori di compatibilità del modulo o del runtime su ciascuna versione provata. Ispezionare la dichiarazione delle versioni supportate: deve includere Node.js 24 e non ammettere versioni inferiori. Fallisce se la build usa un altro compilatore, l'output non è ESM, l'avvio non riesce o la dichiarazione contraddice il requisito.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [package.json](../../apps/server/package.json)
  * satisfiedBy: [verify-server-startup.mjs](../../scripts/verify-server-startup.mjs)
  * verify: [Preparazione del server TypeScript ESM](../Requirements/ServerFoundation.md#preparazione-del-server-typescript-esm)
---

### Prova della compilazione TypeScript strict

Esaminare la configurazione TypeScript effettiva dei progetti che compongono il server e compilare il codice TypeScript con `tsc`.

#### Details
La prova passa se l'opzione effettiva `strict` è abilitata per ogni progetto TypeScript del server e la compilazione riesce. Fallisce se `strict` è disabilitata in un progetto del server o se la compilazione fallisce.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [tsconfig.build.json](../../apps/server/tsconfig.build.json)
  * satisfiedBy: [tsconfig.build.json](../../packages/conversations/tsconfig.build.json)
  * satisfiedBy: [tsconfig.json](../../tsconfig.json)
  * verify: [Compilazione TypeScript strict del server](../Requirements/ServerFoundation.md#compilazione-typescript-strict-del-server)
---

### Prova della condizione HSTS

Avviare l'API con origine pubblica HTTP e con origine pubblica dichiarata HTTPS, mantenendo in entrambi i casi una connessione interna HTTP e variando `X-Forwarded-Proto`. Osservare le risposte riuscite e di errore.

#### Details
La prova passa se HSTS è assente quando la configurazione pubblica è HTTP o non dichiarata ed è presente con durata positiva quando è HTTPS, indipendentemente dal protocollo interno o dal valore di `X-Forwarded-Proto`. Fallisce se un header della richiesta attiva HSTS da solo o se la politica è assente in un deployment HTTPS dichiarato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * verify: [HSTS legato all'HTTPS pubblico](../Requirements/ServerFoundation.md#hsts-legato-allhttps-pubblico)
---

### Prova della configurazione della CI del server

Leggere come testo `.github/workflows/ci.yml` e i file di prova dei package sotto `packages/`.

#### Details
La prova passa se il workflow parte a ogni push su `main`, a ogni pull request, su richiesta manuale e con `workflow_call`; se il job `Backend checks` dichiara `BRANCH` pari a `${{ github.head_ref || github.ref_name }}`, esegue il checkout del repository in `workspace/ambrogio-backend` con `fetch-depth: 0`, clona `ambrogio-model` in `workspace/ambrogio-model` sul branch `BRANCH` se esiste sul remoto e altrimenti su `main`, esegue poi `workspace/ambrogio-model/scripts/checkout-workspace workspace "$BRANCH"` e `workspace/ambrogio-model/scripts/model-checks --workspace workspace`, e infine, nella cartella `workspace/ambrogio-backend`, `pnpm install --frozen-lockfile`, `pnpm audit --audit-level high` subito dopo, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration` e `pnpm test:e2e`, con `corepack enable` prima dell'installazione e l'installazione e l'audit delle dipendenze prima degli altri passi pnpm, con `pnpm build` prima di `pnpm typecheck` e di `pnpm test:e2e` e l'installazione verificata di gitleaks prima di `pnpm test`; se il workflow non nomina un pacchetto o una versione di Reqvire né uno script di integrità locale; se nessun passo o job dichiara `continue-on-error`; e se ogni file di prova dei package che importa un adapter di persistenza di `src/adapters/out/sqlite/` importa anche `better-sqlite3`, così da esercitare un database SQLite reale, e si chiama `*.integration.spec.ts`, e ogni file `*.integration.spec.ts` importa `better-sqlite3`. Fallisce se manca un evento o una fase, se l'ordine richiesto non è rispettato, se un fallimento è tollerato, se una prova di un adapter SQLite non usa il driver reale o non appartiene alla selezione di integrazione. Che un controllo fallito impedisca l'integrazione è verificato da «Ispezione della protezione del merge del backend».

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [workflows.spec.ts](../../test/repository/workflows.spec.ts)
  * verify: [Controlli CI delle modifiche funzionali del server](../Requirements/ServerFoundation.md#controlli-ci-delle-modifiche-funzionali-del-server)
---

### Prova della configurazione esplicita del listener HTTP

Fornire al processo `AMBROGIO_HTTP_HOST` e `AMBROGIO_HTTP_PORT` validi, poi omettere separatamente ciascuna variabile negli ambienti `development`, `test` e `production` e provare valori di tipo o intervallo invalidi. Verificare l'indirizzo e la porta effettivamente ascoltati nel caso valido e l'assenza di listener nei casi invalidi.

#### Details
La prova passa se il processo ascolta solo all'indirizzo e alla porta validati, in `development` i valori assenti assumono `127.0.0.1` e `3000`, in `test` e `production` l'assenza di ciascun valore impedisce l'avvio, e i valori invalidi non aprono né attivano l'ingresso. Fallisce se usa un valore non validato o un valore implicito fuori da `development`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [conversation-server.spec.ts](../../apps/server/src/runtime/conversation-server.spec.ts)
  * satisfiedBy: [http-config.spec.ts](../../apps/server/src/runtime/http-config.spec.ts)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * verify: [Configurazione esplicita dell'ascolto HTTP](../Requirements/ServerFoundation.md#configurazione-esplicita-dellascolto-http)
---

### Prova delle origini CORS dell'API HTTP

Avviare l'API con elenco di origini assente, poi con un'origine esplicitamente ammessa. Inviare richieste ordinarie e preflight da origine ammessa e non ammessa.

#### Details
La prova passa se, senza elenco, nessuna risposta autorizza CORS; con l'elenco, solo l'origine ammessa riceve gli header di autorizzazione pertinenti e nessuna risposta usa wildcard o riflette l'origine non ammessa. Fallisce se una delle richieste non ammesse ottiene autorizzazione CORS.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * verify: [Origini CORS esplicite dell'API HTTP](../Requirements/ServerFoundation.md#origini-cors-esplicite-dellapi-http)
---

### Prova delle voci incluse e sostituibili

Con `scripts/verify-docker-image.mjs`, costruire l'immagine backend oppure usare quella indicata da `AMBROGIO_DOCKER_IMAGE`, ispezionare le directory delle voci Piper incluse `vits-piper-it_IT-riccardo-x_low`, `vits-piper-it_IT-paola-medium` e `vits-piper-en_US-kristin-medium` e sintetizzare una breve frase con ciascuna usando il codice di sintesi dell'immagine. Verificare che l'immagine non contenga `python3` né `/opt/piper`. Avviare un container con una directory di prova montata in sola lettura su `/opt/ambrogio/voices` e osservare che il mount sostituisce il contenuto incluso; selezionare inoltre una voce italiana montata in un percorso distinto tramite le variabili del profilo vocale.

#### Details
La prova passa se ogni directory contiene un solo modello `.onnx`, `tokens.txt`, `espeak-ng-data/` e `MODEL_CARD`, `/opt/ambrogio/voices/README.md` è presente, la sintesi produce audio non vuoto alla frequenza del modello per ogni voce, l'immagine non contiene `python3` né `/opt/piper`, il mount su `/opt/ambrogio/voices` presenta i file esterni al posto delle voci incluse senza una nuova build e la voce montata in un percorso distinto viene selezionata e caricata. Fallisce se manca una voce, la sintesi fallisce o il mount non sostituisce la directory. La prova non sostituisce l'ascolto umano della qualità delle voci.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * verify: [Directory delle voci sostituibile nell'immagine](../Requirements/ServerFoundation.md#directory-delle-voci-sostituibile-nellimmagine)
---

### Prova del contesto di build dell'immagine del server

Leggere `.dockerignore` del backend.

#### Details
La prova passa se `.dockerignore` contiene tutte le esclusioni di «Profilo dell'immagine Docker del server» e nessuna voce `!` che reinclude file. Fallisce se manca un'esclusione o se una voce reinclude file.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [container-build-context.spec.ts](../../test/repository/container-build-context.spec.ts)
  * verify: [Distribuzione del server come immagine Docker](../Requirements/ServerFoundation.md#distribuzione-del-server-come-immagine-docker)
---

### Prova del server compilato come processo

Dopo `pnpm build`, eseguire `pnpm test:e2e`: avviare `apps/server/dist/main.js` con Node.js in un processo figlio con impostazioni di produzione, una porta libera di loopback, un archivio in una cartella temporanea e un agente che risponde, richiedere `GET /api/v1/conversations`, inviare `SIGTERM`; avviarlo poi senza variabili `AMBROGIO_*`.

#### Details
La prova passa se il punto d'ingresso compilato esiste; se il server risponde `200` con un elenco vuoto, crea il file dell'archivio, termina con codice 0 senza scrivere su stderr e non riporta la credenziale segnaposto; e se senza ambiente di esecuzione termina con codice 1, una sola riga JSON `server_startup_failed` con il messaggio `Missing environment variable AMBROGIO_ENV` e la sola riga `Unable to start HTTP server.` su stderr. Fallisce se il compilato manca o non si risolve, se una risposta, un codice di uscita o un output differiscono.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [main.e2e.spec.ts](../../apps/server/src/main.e2e.spec.ts)
  * verify: [Server compilato provato come processo](../Requirements/ServerFoundation.md#server-compilato-provato-come-processo)
---

### Prova dell'isolamento dei database di prova

Leggere come testo i file `*.integration.spec.ts` degli adapter SQLite.

#### Details
La prova passa se ogni file importa le migrazioni di produzione o l'archivio che le applica, apre almeno un database con `better-sqlite3`, non legge `process.env` né variabili `AMBROGIO_*`, e se, quando apre un file invece di un database in memoria, crea la propria cartella con `mkdtempSync` nella cartella temporanea del sistema e la cancella con `rmSync`. Fallisce se un file manca di una di queste proprietà.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [test-databases.spec.ts](../../test/repository/test-databases.spec.ts)
  * verify: [Database di prova isolati del backend](../Requirements/ServerFoundation.md#database-di-prova-isolati-del-backend)
---
