# Elements

### Arresto immediato con richiesta remota non attesa

Alla richiesta di arresto ordinato, il server impedisce subito nuove ammissioni e conserva come `interrotto` ogni turno ancora senza esito, prima di chiudere l'archivio. Non attende il completamento della produzione remota e non invia un annullamento esplicito al provider tramite la porta della risposta. Dopo la persistenza comunica `turn.interrupted` ai turni interrotti delle sessioni ancora aperte quando la consegna è possibile, chiude le sessioni conversazionali e le connessioni HTTP locali attive e termina il processo; una risposta remota successiva non viene acquisita né conservata. La chiusura della connessione locale non garantisce l'arresto dell'elaborazione presso il provider. Un turno già concluso prima dell'interruzione conserva il proprio esito.

#### Metadata
  * type: behavior

#### Relations
  * define: [Interruzione dei turni durante l'arresto](../Requirements/ServerFoundation.md#interruzione-dei-turni-durante-larresto)
---

### Catalogo bilingue dei modelli vocali nell'immagine backend

L'immagine runtime include:

- in `/opt/ambrogio/models` i modelli Vosk `vosk-model-small-it-0.22` e `vosk-model-small-en-us-0.15`;
- in `/opt/ambrogio/voices` le voci Piper VITS convertite per sherpa-onnx `vits-piper-it_IT-riccardo-x_low`, `vits-piper-it_IT-paola-medium` e `vits-piper-en_US-kristin-medium`, ciascuna con un solo modello `.onnx`, `tokens.txt`, `espeak-ng-data/` e la scheda `MODEL_CARD`, insieme a una nota di provenienza e licenza (`README.md`);
- in `/opt/ambrogio/kokoro` il modello multilingue `kokoro-multi-lang-v1_0`, con voci italiane e inglesi, `voices.bin` e il file `LICENSE`.

La build scarica gli archivi con versioni fissate dalla release `tts-models` di k2-fsa/sherpa-onnx e dal catalogo dei modelli Vosk, ne verifica l'impronta SHA-256 fissata in `scripts/fetch-speech-models.mjs` prima dell'estrazione e si interrompe se un'impronta differisce o se il contenuto estratto non ha la struttura attesa. Le voci Piper sono rilasciate con licenza MIT da rhasspy/piper-voices, i modelli Vosk e Kokoro con licenza Apache-2.0. Gli esempi selezionano Piper per le macchine modeste; Kokoro è disponibile senza download aggiuntivo e viene caricato solo se indicato dal profilo attivo. I profili vocali indicano i modelli con percorsi espliciti e ammettono anche modelli esterni montati. Non è prevista la scelta della voce durante una conversazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Modelli vocali italiani e inglesi inclusi](../Requirements/ServerFoundation.md#modelli-vocali-italiani-e-inglesi-inclusi)
---

### Contratto di normalizzazione diagnostica

Il confine tecnico usa il valore catturato come `err` senza crearne un altro quando è già un `Error`: l'identità dell'istanza resta invariata. Se il valore catturato non è un `Error`, crea un nuovo `Error` con un messaggio diagnostico fisso, indipendente dal valore, e con `cause` pari per identità al valore catturato. La normalizzazione non converte il valore catturato in stringa e non lo modifica.

#### Metadata
  * type: input-output

#### Relations
  * define: [Normalizzazione diagnostica nel confine definitivo](../Requirements/ServerFoundation.md#normalizzazione-diagnostica-nel-confine-definitivo)
---

### Distribuzione dei modelli vocali

Quando la voce è abilitata, Vosk e la sintesi vocale sherpa-onnx sono eseguiti nel processo backend del medesimo container Docker. Le librerie necessarie a Vosk e a sherpa-onnx appartengono all'immagine runtime, insieme ai modelli del catalogo definito da «Catalogo bilingue dei modelli vocali nell'immagine backend»; l'immagine non contiene un ambiente Python né il binario Piper. Il componente vocale riceve i percorsi dalla configurazione validata e ne verifica la disponibilità prima di attivare l'ingresso vocale; un modello necessario assente, illeggibile o non caricabile impedisce l'avvio. Quando la voce è disabilitata, i percorsi dei modelli non sono richiesti.

#### Metadata
  * type: specification

#### Relations
  * define: [Distribuzione del server come immagine Docker](../Requirements/ServerFoundation.md#distribuzione-del-server-come-immagine-docker)
---

### Evento diagnostico del mancato avvio del server

Il runner del processo server è il confine definitivo dei guasti avvenuti prima che il server sia in ascolto: quando la costruzione del server o l'apertura dell'ascolto falliscono, emette con il logger di base una sola riga JSON su `stdout` con livello `error`, `event: "server_startup_failed"`, il messaggio fisso `Server startup failed` e il campo `err`, poi scrive su `stderr` la riga invariata `Unable to start HTTP server.` e restituisce il codice di uscita `1`. Il server non resta in ascolto e non emette altri log definitivi per lo stesso guasto. Motivazione: la sola riga su `stderr` non permette a chi installa Ambrogio di capire quale configurazione o risorsa impedisca l'avvio.

Il campo `err` segue il profilo controllato di serializzazione: un `ProjectError` espone tipo, messaggio e stack; ogni altro valore riceve la descrizione costante `Unexpected backend failure` con stack oscurato, senza copiarne messaggio o proprietà. La catena `cause` non è serializzata. Per rendere identificabile la causa, le fasi di avvio esposte a guasti esterni li incapsulano in un `ProjectError` con un messaggio fisso che nomina la fase e conserva l'originale come `cause`: `Conversation archive could not be prepared` per apertura, migrazione e recupero dell'archivio, `Voice components could not be loaded` per il caricamento di trascrizione e sintesi, `HTTP listener could not start` per l'ascolto, `Agent MCP connection failed: <id>` per connessione e scoperta degli strumenti MCP di un agente e `Invalid agent options: <id>` per opzioni del modello non valide. Un `ProjectError` già prodotto da una fase, come quelli della validazione della configurazione, resta invariato. Se anche la chiusura delle risorse già acquisite fallisce, `err` è un `LifecycleError` con il messaggio fisso `Server startup failed` e `faults` che elenca il guasto dell'avvio seguito dai guasti di chiusura. I messaggi ammettono il nome di una variabile d'ambiente, l'identificativo di un agente o il nome di un file di agente, ma mai valori letti dalle variabili d'ambiente o dai file, URL, credenziali, token o chiavi.

#### Metadata
  * type: input-output

#### Relations
  * define: [Diagnostica del mancato avvio del server](../Requirements/ServerFoundation.md#diagnostica-del-mancato-avvio-del-server)
---

### Finestra di arresto del server

Il tempo massimo dell'arresto del server è una costante di 10000 ms, non configurabile, che parte dal primo `SIGINT` o `SIGTERM`; i segnali successivi non la riavviano. L'arresto riuscito termina il processo con codice 0 senza righe di log. Se una chiusura fallisce, il server emette una sola riga JSON con livello `error`, `event: "server_shutdown_failed"`, il messaggio fisso `Server shutdown failed` ed `err`, e termina con codice 1. Se l'arresto non termina entro il tempo massimo, il server emette una sola riga JSON con livello `error`, `event: "server_shutdown_timeout"`, il messaggio fisso `Server shutdown timed out`, `timeoutMs: 10000` ed `err` con i guasti già osservati quando ve ne sono, e termina subito con codice 1 senza attendere le chiusure pendenti. Un turno ancora senza esito alla scadenza resta senza esito e il recupero al riavvio lo riconosce come interrotto.

I messaggi fissi dei guasti dell'arresto nominano la fase o la risorsa: `Turns could not be interrupted` per l'arresto dei turni e la chiusura delle sessioni, `HTTP server could not be closed`, `Voice components could not be closed`, `Conversation archive could not be closed` e `Agent MCP connection could not be closed: <id>`; più guasti di chiusura delle connessioni MCP sono raccolti in un `LifecycleError` con il messaggio `Agent MCP connections could not be closed`, più guasti dell'arresto in un `LifecycleError` con il messaggio `Server shutdown failed`.

Il periodo di arresto concesso dal supervisore è di 15 secondi: l'esempio Compose del repository dichiara `stop_grace_period: 15s` e la documentazione indica `--stop-timeout 15` per `docker run`, così che il processo concluda da sé l'arresto prima del `SIGKILL` del runtime dei container.

#### Metadata
  * type: behavior

#### Relations
  * define: [Arresto unico e ordinato del server](../Requirements/ServerFoundation.md#arresto-unico-e-ordinato-del-server)
---

### Forma del tipo Result

La definizione TypeScript locale a un modulo business è `type Result<T, E> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>`; il ramo `ok: true` contiene `value`, il ramo `ok: false` contiene `error`. Entrambi i rami sono immutabili tramite `Readonly`.

#### Metadata
  * type: specification

#### Relations
  * define: [Struttura del tipo Result](../Requirements/ServerFoundation.md#struttura-del-tipo-result)
---

### Ingresso di prova del server conversazionale

L'ingresso di prova è il modulo `apps/server/dist/runtime/test-server.js` del backend compilato, distinto dall'avvio di produzione, che esporta la funzione asincrona `startTestServer(options)`. `options` contiene `directory`, la cartella di un archivio temporaneo posseduta dalla prova; `language`, `it` oppure `en`; `reply`, il produttore di risposte deterministico al posto dell'orchestratore e degli agenti, con la forma della porta di produzione della risposta; facoltativi `speech`, la fabbrica di un trascrittore e di un sintetizzatore deterministici al posto di Vosk e della sintesi vocale, `allowedOrigins`, le origini consentite del componente HTTP, e `sessionPingIntervalMs`. Senza `speech` la voce non è abilitata.

L'ingresso avvia lo stesso server conversazionale dell'avvio di produzione, con il canale `ambrogio.v1`, le API HTTP pubbliche e gli stessi contratti di comportamento del turno, in ascolto su `127.0.0.1` con una porta libera, e restituisce `origin`, l'origine HTTP del server, `sessionUrl`, l'URL della sessione `ambrogio.v1`, e `close()`, che smette di accettare turni, interrompe quelli in corso, chiude le sessioni, il listener e l'archivio, ed è idempotente. Non legge le variabili d'ambiente del processo né i file degli agenti, non carica modelli vocali e non contatta servizi esterni. La configurazione del componente Conversazioni è letta dal suo modulo di configurazione da un ambiente costruito dall'ingresso, con l'ambiente di esecuzione `test`, l'archivio nella cartella indicata e la lingua indicata, così che gli altri valori siano i predefiniti del modulo. Un cambio incompatibile della forma dell'ingresso si fa nella stessa modifica delle prove dei client che lo usano, secondo «Compatibilità fra release per versione d'interfaccia», senza conservare la forma precedente.

#### Metadata
  * type: specification

#### Relations
  * define: [Ingresso di prova pubblico del server conversazionale](../Requirements/ServerFoundation.md#ingresso-di-prova-pubblico-del-server-conversazionale)
---

### Politica CORS del componente HTTP

L'elenco delle origini autorizzate è un'impostazione esplicita del configurazione locale del componente HTTP; se è assente o vuoto, la politica non aggiunge header CORS di autorizzazione. Per una richiesta con `Origin`, la risposta ordinaria e l'eventuale risposta alla preflight autorizzano soltanto una corrispondenza esatta con un'origine dell'elenco. Non si usa `*` e non si riflette un'origine non autorizzata. CORS non sostituisce le restrizioni di rete e reverse proxy previste per l'accesso all'installazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Origini CORS esplicite dell'API HTTP](../Requirements/ServerFoundation.md#origini-cors-esplicite-dellapi-http)
---

### Politica HSTS dell'origine pubblica

La configurazione validata del componente HTTP dichiara con `AMBROGIO_PUBLIC_HTTPS` se l'origine pubblica è esposta esclusivamente tramite HTTPS, anche quando la terminazione TLS avviene nel reverse proxy. Il componente non deduce questa condizione da `X-Forwarded-Proto` o dal protocollo della singola connessione interna. Se la condizione è falsa, disabilita l'HSTS predefinito di Helmet. Se è vera, abilita HSTS con la durata positiva dichiarata da `AMBROGIO_HSTS_MAX_AGE_SECONDS`; `includeSubDomains` e `preload` non sono attivati implicitamente, perché riguardano anche altri servizi del dominio. La configurazione del deployment coordina l'eventuale emissione dello stesso header da parte del reverse proxy.

#### Metadata
  * type: specification

#### Relations
  * define: [HSTS legato all'HTTPS pubblico](../Requirements/ServerFoundation.md#hsts-legato-allhttps-pubblico)
---

### Politica di cache delle risposte conversazionali HTTP

L'header `Cache-Control: no-store` accompagna le risposte HTTP che trasportano dati conversazionali, incluse pagine dell'elenco e storico, anche quando la risposta segnala un errore. Il comportamento non modifica la politica di cache delle risorse statiche prive di dati conversazionali. I messaggi del canale conversazionale WebSocket non sono risposte HTTP memorizzabili in cache e non sono soggetti a questa politica.

#### Metadata
  * type: specification

#### Relations
  * define: [Esclusione dalla cache delle risposte conversazionali HTTP](../Requirements/ServerFoundation.md#esclusione-dalla-cache-delle-risposte-conversazionali-http)
---

### Politica di interruzione nell'arresto ordinato

Alla richiesta di arresto il server smette di accettare nuovi turni, richiede subito l'interruzione di quelli attivi e non attende che le loro risposte terminino. Per ogni turno accettato rimasto senza esito, conserva lo stato `interrotto` prima di chiudere l'archivio e le altre risorse necessarie a tale registrazione; un completamento tardivo non sostituisce tale stato con una risposta riuscita. Un esito già conservato prima dell'arresto resta concluso. Se il processo termina prima che lo stato `interrotto` sia conservato, il recupero al riavvio riconosce il turno senza esito come interrotto. Nessun turno viene accodato o ripetuto automaticamente.

#### Metadata
  * type: specification

#### Relations
  * define: [Interruzione dei turni durante l'arresto](../Requirements/ServerFoundation.md#interruzione-dei-turni-durante-larresto)
---

### Profilo del limite dei corpi HTTP

Il componente HTTP configura un limite di dimensione positivo per i corpi ricevuti dalle rotte che ne accettano uno; un'eventuale eccezione per rotta dichiara un proprio limite esplicito. Il controllo riguarda la dimensione effettivamente ricevuta, anche quando il corpo arriva in più parti. Il rifiuto `413` è il problema `about:blank` con `title` `Content Too Large` del catalogo dei problemi di protocollo e non passa il corpo al caso d'uso. Le rotte HTTP attuali di elenco e storico non accettano un corpo; i valori di future rotte con corpo saranno fissati nei rispettivi contratti. I limiti dei turni sono definiti dal protocollo conversazionale e non da questo profilo.

#### Metadata
  * type: specification

#### Relations
  * define: [Limite dei corpi delle richieste HTTP](../Requirements/ServerFoundation.md#limite-dei-corpi-delle-richieste-http)
---

### Profilo dell'ascolto HTTP

Il modulo di configurazione del componente HTTP legge `AMBROGIO_HTTP_HOST`, stringa non vuota, e `AMBROGIO_HTTP_PORT`, intero decimale da 1 a 65535. In `test` e `production` entrambe sono obbligatorie e non hanno valori predefiniti; in `development`, quando mancano, valgono `127.0.0.1` e `3000`. Il listener usa esattamente i valori validati; un valore mancante o invalido impedisce l'avvio e nessun listener viene aperto.

`AMBROGIO_PUBLIC_HTTPS` vale `true` o `false`; è obbligatoria in `test` e `production` e vale `false` per impostazione predefinita in `development`. `AMBROGIO_HSTS_MAX_AGE_SECONDS` è un intero positivo, obbligatorio quando `AMBROGIO_PUBLIC_HTTPS` vale `true`. `AMBROGIO_ALLOWED_ORIGINS` è un elenco di origini HTTP(S) esatte separate da virgole; quando manca, nessuna origine è autorizzata. Il componente applica la politica CORS già definita tramite il plugin ufficiale `@fastify/cors` e configura `@fastify/helmet` secondo la politica HSTS già definita. Una voce diversa da un'origine esatta, come `*` o un URL con percorso, rende invalida la configurazione; la corrispondenza dell'origine è esatta.

Gli errori seguono il profilo comune: `Missing environment variable <NOME>` per una variabile richiesta assente e `Invalid environment variable <NOME>: <condizione>` per un valore invalido.

#### Metadata
  * type: specification

#### Relations
  * define: [Configurazione esplicita dell'ascolto HTTP](../Requirements/ServerFoundation.md#configurazione-esplicita-dellascolto-http)
---

### Profilo dell'immagine Docker del server

L'immagine del backend usa Debian con Node.js 24 ed è costruita in due fasi: una fase prepara dipendenze e artefatti compilati del workspace, l'altra contiene il runtime necessario per avviare il server. La configurazione effettiva dei componenti è fornita dal deployment come variabili d'ambiente e, per gli agenti, come file montati nella directory degli agenti; l'archivio SQLite risiede in un percorso esterno all'immagine; il filesystem dell'immagine non contiene i loro valori effettivi. La build e l'avvio dell'immagine non richiedono Docker Compose. Il file `.dockerignore` esclude dal contesto di build `.git`, `node_modules` e `**/node_modules`, `dist` e `**/dist`, `system-model`, le cartelle `test` a ogni livello, i file `**/*.spec.ts`, i file di database `*.sqlite`, `*.sqlite-*`, `*.db`, `*.db-*` e i file d'ambiente `*.env` e `*.env.*`, senza voci che reincludono file.

#### Metadata
  * type: specification

#### Relations
  * define: [Distribuzione del server come immagine Docker](../Requirements/ServerFoundation.md#distribuzione-del-server-come-immagine-docker)
---

### Profilo di bootstrap della configurazione del backend

La configurazione del backend è letta dalle variabili d'ambiente del processo da un modulo di configurazione TypeScript per ciascun componente, compilato con il resto del backend:

| Componente | Modulo | Variabili |
|---|---|---|
| Ambiente di esecuzione | `packages/conversations/src/adapters/out/environment-variables.ts` | `AMBROGIO_ENV` |
| HTTP | `apps/server/src/runtime/http-config.ts` | `AMBROGIO_HTTP_HOST`, `AMBROGIO_HTTP_PORT`, `AMBROGIO_PUBLIC_HTTPS`, `AMBROGIO_HSTS_MAX_AGE_SECONDS`, `AMBROGIO_ALLOWED_ORIGINS` |
| Conversazioni | `packages/conversations/src/adapters/out/conversation-config.ts` | `AMBROGIO_ARCHIVE_PATH`, `AMBROGIO_LANGUAGE`, `AMBROGIO_TIME_ZONE`, `AMBROGIO_LIST_PAGE_SIZE`, `AMBROGIO_MAX_LIST_PAGE_SIZE` |
| Agenti | `apps/server/src/runtime/agent-config.ts` | `AMBROGIO_AGENTS_DIR` e le variabili delle credenziali nominate dai file degli agenti |
| Voce | `packages/conversations/src/adapters/out/voice-config.ts` | `AMBROGIO_VOICE_LANGUAGES` e, per ogni lingua elencata, le variabili `AMBROGIO_VOICE_<LINGUA>_…` |

Ogni modulo dichiara le proprie variabili con l'eventuale valore predefinito e l'ambiente in cui vale, legge soltanto l'oggetto d'ambiente ricevuto dalla composition root, converte esplicitamente i tipi e restituisce valori validati. `AMBROGIO_AGENTS_DIR` indica la directory dei file degli agenti e vale per impostazione predefinita `/etc/ambrogio/agents` in ogni ambiente. Il formato dei valori, i valori predefiniti e i messaggi d'errore di ciascuna variabile sono definiti dai contratti del componente.

All'avvio la composition root legge per primo l'ambiente di esecuzione, poi la configurazione dei componenti HTTP, Conversazioni, Agenti e, se abilitata, Voce, una sola volta e prima di costruirne le risorse; la configurazione della voce disabilitata non è richiesta. Una variabile richiesta mancante o un valore invalido bloccano l'attivazione prima che una risorsa dipendente sia costruita. La composition root consegna a ogni componente soltanto i valori validati; Domain e casi d'uso Application non leggono file, variabili d'ambiente o segreti dal processo. Messaggi di errore, log ed esempi non riproducono valori di configurazione né segreti.

#### Metadata
  * type: specification

#### Relations
  * define: [Caricamento iniziale della configurazione del backend](../Requirements/ServerFoundation.md#caricamento-iniziale-della-configurazione-del-backend)
---

### Profilo di installazione delle dipendenze del backend

Il backend applica le regole sulle dipendenze di «Profilo di installazione con pnpm e Corepack» al `package.json` della radice, di `apps/server` e di `packages/conversations`: ogni dipendenza diretta ha la versione esatta risolta in `pnpm-lock.yaml`, salvo `@ambrogio/conversations`, dichiarata da `apps/server` con `workspace:*`. `allowBuilds` in `pnpm-workspace.yaml` ammette soltanto `koffi` e `vosk-koffi`, i cui script di installazione preparano la libreria nativa usata dal riconoscimento vocale Vosk. `pnpm-workspace.yaml` non dichiara `minimumReleaseAge` né `minimumReleaseAgeExclude`: il backend non ha eccezioni all'attesa per le nuove versioni.

#### Metadata
  * type: specification

#### Relations
  * define: [Installazione delle dipendenze del backend con pnpm e Corepack](../Requirements/ServerFoundation.md#installazione-delle-dipendenze-del-backend-con-pnpm-e-corepack)
---

### Profilo di irrobustimento dei workflow GitHub Actions

Il backend applica «Profilo comune dei workflow GitHub Actions» ai workflow `.github/workflows/ci.yml`, `.github/workflows/secret-scan.yml` e `.github/workflows/publish-image.yml`, che sono i soli del repository, con questi valori propri.

Il job che pubblica è `publish` di `publish-image.yml`: riceve `contents: read` e `packages: write` per inviare l'immagine a GHCR con il `GITHUB_TOKEN`. Nessun job esegue operazioni Git autenticate dopo il checkout; il job `publish` si autentica al registro con `docker login` usando il `GITHUB_TOKEN` passato come variabile d'ambiente del solo passo di login, e nessun altro passo riceve il token.

`timeout-minutes` vale 20 per il job `checks` della CI, 10 per il job `gitleaks` della scansione dei segreti e 60 per il job `publish`, che costruisce e verifica l'immagine con il download dei modelli vocali. `publish-image.yml` richiama `ci.yml` e `secret-scan.yml` come job `checks` e `secret-scan`.

#### Metadata
  * type: specification

#### Relations
  * define: [Irrobustimento dei workflow GitHub Actions](../Requirements/ServerFoundation.md#irrobustimento-dei-workflow-github-actions)
---

### Profilo di pubblicazione dell'immagine Docker del server

Il backend pubblica l'immagine su GitHub Container Registry (`ghcr.io`) tramite GitHub Actions quando viene creato un tag Git di release nel formato `vMAJOR.MINOR.PATCH`. La versione senza `v` corrisponde a `apps/server/package.json`. Il pacchetto OCI usa il nome `ghcr.io/ambrogio-app/ambrogio-backend` e riceve un tag immagine uguale al tag Git di release; non viene pubblicato un tag mobile `latest`. L'immagine supporta `linux/amd64`. Il workflow costruisce l'immagine dal Dockerfile del repository, la verifica prima del push e usa il `GITHUB_TOKEN` con permesso `packages: write` per pubblicarla. Dopo il push il job `publish` scrive nel riepilogo del job la riga `Published ghcr.io/ambrogio-app/ambrogio-backend:<tag Git>`. La pubblicazione richiede che la CI del backend e la scansione dei segreti siano superate sullo stesso commit. Un commit ordinario su `main` non è un evento di pubblicazione. Il contenuto dell'immagine pubblicata segue «Profilo dell'immagine Docker del server» e la scansione dei segreti richiesta segue «Profilo di scansione dei segreti del backend». Un numero di versione già pubblicato e poi ritirato non è riusato. La visibilità del pacchetto nel registro è decisa dalla persona e non è modificata dal workflow.

#### Metadata
  * type: specification

#### Relations
  * define: [Pubblicazione dell'immagine Docker del server](../Requirements/ServerFoundation.md#pubblicazione-dellimmagine-docker-del-server)
---

### Profilo di scansione dei segreti del backend

Il backend applica «Profilo di scansione dei segreti con gitleaks» con questi elementi propri.

Nel workflow `.github/workflows/secret-scan.yml` la scansione è il job `gitleaks`, chiamato `Scan history for secrets`; versione e impronta di gitleaks sono dichiarate a livello di workflow nelle variabili `GITLEAKS_VERSION` e `GITLEAKS_SHA256`. Il workflow di pubblicazione `.github/workflows/publish-image.yml` richiama `secret-scan.yml` come job `secret-scan` e il job `publish` dipende dal suo esito, così che nessuna immagine venga pubblicata se la scansione fallisce.

Il job `checks` di `.github/workflows/ci.yml` dichiara le stesse variabili, installa lo stesso archivio di gitleaks con lo stesso passo di download e verifica dell'impronta del job `gitleaks` e aggiunge lo scanner al `PATH` prima della suite Vitest, che esercita l'hook `.githooks/pre-commit` in un repository Git temporaneo.

#### Metadata
  * type: specification

#### Relations
  * define: [Scansione dei segreti nella CI del backend](../Requirements/ServerFoundation.md#scansione-dei-segreti-nella-ci-del-backend)
---

### Profilo di uscita dei log tecnici

Ogni evento diagnostico tecnico emesso da Pino è una singola riga JSON strutturata. Il processo server scrive per impostazione predefinita le righe su `stdout`. La configurazione del deployment determina la destinazione finale dei flussi, senza fissarla nel formato degli eventi.

#### Metadata
  * type: input-output

#### Relations
  * define: [Formato e flussi dei log tecnici](../Requirements/ServerFoundation.md#formato-e-flussi-dei-log-tecnici)
---

### Profilo globale degli header di sicurezza HTTP

Il componente HTTP registra `@fastify/helmet` sulla radice dell'istanza Fastify affinché il profilo raggiunga tutte le rotte gestite, comprese risposte ordinarie, errori e `404`. Mantiene le impostazioni predefinite della versione adottata, salvo HSTS condizionato dal deployment e differenze esplicitamente motivate per singola rotta o superficie. Una futura rotta che serve HTML eseguibile definisce la propria CSP senza indebolire globalmente il profilo delle altre risposte. Gli header specifici per cache conversazionale e CORS restano governati dai rispettivi contratti.

#### Metadata
  * type: specification

#### Relations
  * define: [Header di sicurezza sulle risposte HTTP](../Requirements/ServerFoundation.md#header-di-sicurezza-sulle-risposte-http)
---

### Profilo iniziale di osservabilità del backend

Il segnale diagnostico della prima versione è costituito dai log JSON strutturati del runtime HTTP, con i `correlationId` per collegare gli eventi di una richiesta. Un `correlationId` non è una traccia distribuita e i log non costituiscono un registro di audit garantito. Non sono attivati raccoglitori o API applicative separati per metriche, tracing o audit; un'estensione non eredita automaticamente le garanzie dei log. La diagnostica tecnica non acquisisce automaticamente contenuti delle conversazioni o credenziali secondo i requisiti già definiti.

#### Metadata
  * type: specification

#### Relations
  * define: [Perimetro iniziale dei segnali di osservabilità del backend](../Requirements/ServerFoundation.md#perimetro-iniziale-dei-segnali-di-osservabilità-del-backend)
---

### Regole di architettura del backend

Le regole sono definite in `test/repository/architecture-rules.ts` e controllate da `test/repository/import-boundaries.spec.ts` sull'intero grafo degli import dei sorgenti e dei test di `apps/*` e `packages/*`, compresi gli import di soli tipi, gli import dinamici e le riesportazioni letti dal testo dei sorgenti senza commenti e stringhe; ogni violazione riporta il nome della regola, il file che importa e lo specificatore o il file raggiunto.

| Nome della regola | Che cosa vieta | Requisiti serviti |
|---|---|---|
| `package-isolation` | un file di un package che importa un altro package o un'applicazione del workspace, per nome o con un percorso relativo che esce dal package | «Isolamento degli import dei package business», «Isolamento dei package business dai package tecnici condivisi» |
| `application-public-exports` | un file di un'applicazione che importa un package con un sottopercorso non dichiarato in `exports`, con un alias `#` o con un percorso relativo che esce dall'applicazione | «Import delle API pubbliche dei package business» |
| `no-path-aliases` | una configurazione `tsconfig*.json` della radice o di un'unità del workspace che dichiara `paths` | «Import delle API pubbliche dei package business» |
| `layer-test-imports` | un file di test `*.test.ts` di un'applicazione o di un package; un file `*.spec.ts` di un package che non risiede in `src/domain`, `src/application`, `src/adapters/in` o `src/adapters/out` accanto al file che verifica secondo «Suite di test con Vitest»; un test che raggiunge, anche tramite i moduli di supporto della cartella `test/` del package, codice di produzione fuori da quello ammesso al layer del file che verifica: per un test Domain il Domain; per un test Application Application e Domain; per un test di un adapter inbound il proprio adapter e Application; per un test di un adapter outbound il proprio adapter, Application e Domain. Il proprio adapter è il file verificato, i file della stessa direzione che quel file importa direttamente e, quando l'adapter ha una cartella propria sotto `src/adapters/in` o `src/adapters/out`, i file di produzione di quella cartella | «Import del codice di produzione nei test Domain», «Import del codice di produzione nei test Application», «Import del codice di produzione nei test degli adapter inbound», «Import del codice di produzione nei test degli adapter outbound» |
| `domain-application-own-package` | un file di produzione di `src/domain` di un package, esclusi i file `*.spec.ts`, che importa un modulo diverso da un file di produzione esistente in `src/domain` dello stesso package, oppure un file di produzione di `src/application` che importa un modulo diverso da un file di produzione esistente in `src/domain` o `src/application` dello stesso package | «Indipendenza tecnica di Domain e Application nel backend», «Import del Domain entro il proprio componente», «Import dell'Application entro il proprio modulo» |
| `technical-factory-imports` | un file delle factory tecniche del runtime, oggi `apps/server/src/runtime/http-server.ts`, che importa un package del workspace oppure un file dell'applicazione in `src/composition/` o `src/adapters/` | «Factory tecniche senza conoscenza business» |
| `no-dependency-container` | un file di un'applicazione o di un package che importa un container di dependency injection: `awilix`, `inversify`, `tsyringe`, `typedi`, `injection-js` o `@nestjs/core` | «Composizione scritta a mano» |
| `pino-only-in-logger` | un file di produzione di un'applicazione o di un package, diverso da `apps/server/src/runtime/logger.ts`, che importa `pino` | «Logger minimo del backend» |

Ogni regola ha almeno una fixture negativa in memoria che produce violazioni soltanto con il nome di quella regola. Un'eccezione è una voce dell'elenco `exceptions` del modulo con il nome della regola, il file che importa, l'import ammesso e il motivo, e ammette soltanto quell'import; ogni voce compare anche in questo contratto con il motivo.

Eccezioni: nessuna.

#### Metadata
  * type: specification

#### Relations
  * define: [Regole di architettura centrali del backend](../Requirements/Workspace.md#regole-di-architettura-centrali-del-backend)
---

### Ruleset del branch principale del backend

Il ruleset `main` del repository `ambrogio-backend` segue «Ruleset del branch principale» e richiede i controlli `Backend checks`, il job `checks` di `.github/workflows/ci.yml`, e `Scan history for secrets`, il job `gitleaks` di `.github/workflows/secret-scan.yml`.

#### Metadata
  * type: specification

#### Relations
  * define: [Controlli obbligatori prima del merge del backend](../Requirements/ServerFoundation.md#controlli-obbligatori-prima-del-merge-del-backend)
---

### Sostituzione della directory delle voci nell'immagine backend

Una directory dell'host montata in sola lettura su `/opt/ambrogio/voices` sostituisce interamente le voci Piper incluse nell'immagine, senza ricostruirla: nel container sono visibili soltanto i file della directory montata. Le voci proprie usano la stessa struttura di directory delle voci incluse e sono selezionate dai profili vocali tramite percorsi espliciti. Una voce montata in un percorso distinto da `/opt/ambrogio/voices` lascia disponibili le voci incluse.

#### Metadata
  * type: specification

#### Relations
  * define: [Directory delle voci sostituibile nell'immagine](../Requirements/ServerFoundation.md#directory-delle-voci-sostituibile-nellimmagine)
---

### Stack TypeScript ESM e Node.js del server

Il codice sorgente del server è scritto in TypeScript. La build del server usa `tsc` e produce JavaScript ESM. L'artefatto è eseguito con Node.js 24 o successivo.

#### Metadata
  * type: specification

#### Relations
  * define: [Preparazione del server TypeScript ESM](../Requirements/ServerFoundation.md#preparazione-del-server-typescript-esm)
---

### Suite di test del backend

Il backend applica «Suite di test con Vitest» con questi valori.

Le unità con test sono `packages/conversations` e `apps/server`: i loro test risiedono in `src/` accanto ai file che verificano. Le cartelle `test/` dedicate sono:

- `packages/conversations/test/support/`, con le fixture dell'archivio dei turni e lo scope Fastify con le opzioni Ajv del server usato dalle prove delle rotte HTTP;
- `apps/server/test/support/`, con la fixture dei file di configurazione, la fixture del server di sessione, il client del protocollo `ambrogio.v1` e la vista Ajv dello schema pubblicato usata dalle asserzioni;
- `apps/server/test/protocol/`, con il test dello schema `protocol/ambrogio-v1.schema.json` che il server pubblica;
- `apps/server/test/examples/`, con i test delle configurazioni d'esempio di `examples/`;
- `test/repository/`, con i test dell'intero repository: regole di architettura e loro fixture negative, indipendenza tecnica di Domain e Application, tipo `Result`, dipendenze, contesto di build dell'immagine, database delle prove, workflow e hook pre-commit.

La selezione `integration` contiene i test degli adapter di `packages/conversations/src/adapters/out/sqlite/` che aprono un database SQLite reale con `better-sqlite3`; ogni file `*.integration.spec.ts` importa `better-sqlite3` e ogni test di un adapter SQLite che lo importa è un file `*.integration.spec.ts`. Le prove dell'applicazione server che attraversano l'archivio SQLite verificano composizione e runtime, non un adapter, e restano nella selezione `fast`. La selezione `e2e` contiene `apps/server/src/main.e2e.spec.ts`, che avvia con Node.js in un processo figlio il punto d'ingresso compilato `apps/server/dist/main.js` prodotto da `pnpm build` e fallisce se manca.

Gli script sono `test`, `vitest run --project fast`, `test:integration`, `vitest run --project integration`, e `test:e2e`, `vitest run --project e2e`. Il `package.json` della radice dichiara `"type": "module"`; il `tsconfig.json` della radice, usato da `pnpm typecheck` con `tsc --noEmit`, comprende `packages/**/*.ts`, `apps/**/*.ts`, `test/**/*.ts` e `vitest.config.ts`, escluse le cartelle `dist/` e `node_modules/`. Poiché l'applicazione server e i suoi test importano i package del workspace dalla loro `dist/`, la build precede il controllo TypeScript nella CI e in `pnpm verify`. Il `tsconfig.build.json` di ciascuna unità esclude `src/**/*.spec.ts`, e `.dockerignore` esclude `**/*.spec.ts` e le cartelle `test/`.

#### Metadata
  * type: specification

#### Relations
  * define: [Vitest come runner del backend](../Requirements/ServerFoundation.md#vitest-come-runner-del-backend)
---

### Vincolo sui campi dei rifiuti previsti

Una variante contiene solo `kind` oppure aggiunge campi propri, tipizzati, che appartengono al significato stabile del rifiuto e servono al chiamante. Non esiste uno schema comune che richieda in ogni variante campi generici quali `message`, `cause`, `metadata`, `statusCode` o codici di uscita. La presenza di uno di questi nomi in una variante specifica non è vietata quando soddisfa il criterio dei campi propri.

#### Metadata
  * type: constraint

#### Relations
  * define: [Campi specifici dei rifiuti previsti](../Requirements/ServerFoundation.md#campi-specifici-dei-rifiuti-previsti)
---
