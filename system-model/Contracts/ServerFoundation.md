# Elements

### Arresto immediato con richiesta remota non attesa

Alla richiesta di arresto ordinato, il server impedisce subito nuove ammissioni e conserva come `interrotto` ogni turno ancora senza esito, prima di chiudere l'archivio. Non attende il completamento della produzione remota e non invia un annullamento esplicito al provider tramite la porta della risposta. Dopo la persistenza comunica `turn.interrupted` ai turni interrotti delle sessioni ancora aperte quando la consegna è possibile, chiude le sessioni conversazionali e le connessioni HTTP locali attive e termina il processo; una risposta remota successiva non viene acquisita né conservata. La chiusura della connessione locale non garantisce l'arresto dell'elaborazione presso il provider. Un turno già concluso prima dell'interruzione conserva il proprio esito.

#### Metadata
  * type: behavior

#### Relations
  * define: [Interruzione dei turni durante l'arresto](../Requirements/ServerFoundation.md#interruzione-dei-turni-durante-larresto)
---

### Catalogo bilingue dei modelli vocali nell'immagine backend

Decisione concordata il 21 ottobre 2026: l'immagine runtime include `vosk-model-small-it-0.22` e `vosk-model-small-en-us-0.15`, le voci Piper italiane Riccardo x_low e Paola medium già distribuite, la voce inglese `vits-piper-en_US-kristin-medium` e il modello multilingue `kokoro-multi-lang-v1_0`, con voci italiane e inglesi. La build scarica archivi con versioni fissate, ne verifica SHA-256 e conserva provenienza e licenze. Gli esempi selezionano Piper per le macchine modeste; Kokoro è disponibile senza download aggiuntivo e viene caricato solo se indicato dal profilo attivo. I modelli esterni rimangono configurabili. L'inclusione nell'immagine sostituisce la precedente decisione di richiedere sempre mount esterni per Vosk e Kokoro.

#### Metadata
  * type: specification

#### Relations
  * define: [Modelli vocali italiani e inglesi inclusi](../Requirements/ServerFoundation.md#modelli-vocali-italiani-e-inglesi-inclusi)
---

### Catalogo delle voci italiane nell'immagine backend

L'immagine backend contiene in `/opt/ambrogio/voices` le directory `vits-piper-it_IT-riccardo-x_low` e `vits-piper-it_IT-paola-medium`, ciascuna con il modello `.onnx`, il JSON originale della voce, `tokens.txt`, `espeak-ng-data/` e la scheda del modello, oltre a una nota di provenienza e licenza. Le directory provengono dagli archivi della release `tts-models` di k2-fsa/sherpa-onnx, scaricati durante la build e verificati con SHA-256 fissati: `7541f75778afa164e44e34baaef63befad7698595df26a95ca944b63ef1a16b4` per Paola medium e `8ad0791558ae2b3e96054fc5756ae3ae2f6457fb1765bc01f43bbab85e0a7021` per Riccardo x_low; un'impronta diversa interrompe la build. Le voci sono rilasciate con licenza MIT da rhasspy/piper-voices e convertite per sherpa-onnx da k2-fsa. La configurazione vocale può scegliere una voce per lingua tramite percorsi espliciti; l'installazione di riferimento seleziona Paola medium per l'italiano. Un mount in sola lettura su `/opt/ambrogio/voices` sostituisce il catalogo incluso e permette di usare voci proprie con la stessa struttura di directory. Il catalogo bilingue comprende ora anche i modelli Vosk e Kokoro inclusi secondo la specifica «Catalogo bilingue dei modelli vocali nell'immagine backend»; i mount restano disponibili per modelli esterni. Non è prevista la scelta della voce durante una conversazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Voci italiane incluse nell'immagine](../Requirements/ServerFoundation.md#voci-italiane-incluse-nellimmagine)
---

### Contratto di normalizzazione diagnostica

Il confine tecnico usa il valore catturato come `err` senza crearne un altro quando è già un `Error`: l'identità dell'istanza resta invariata. Se il valore catturato non è un `Error`, crea un nuovo `Error` con un messaggio diagnostico fisso, indipendente dal valore, e con `cause` pari per identità al valore catturato. La normalizzazione non converte il valore catturato in stringa e non lo modifica.

#### Metadata
  * type: input-output

#### Relations
  * define: [Normalizzazione diagnostica nel confine definitivo](../Requirements/ServerFoundation.md#normalizzazione-diagnostica-nel-confine-definitivo)
---

### Convenzione dei nomi di casi d'uso e adapter

Decisione di progetto concordata: usare suffissi di ruolo per i casi d'uso e gli adapter, mantenendo nel nome la funzione concreta del componente. Questa convenzione appartiene a questo repository; non richiede un modello multirepository.

Un file che realizza un caso d'uso Application si chiama `<azione>.use-case.ts`, con un nome che descrive l'operazione offerta, per esempio `exchange-turn.use-case.ts`. Il criterio vale anche per casi d'uso che non espongono rifiuti previsti.

Un file che realizza un adapter si chiama `<funzione-o-integrazione>.adapter.ts`. Sono adapter di ingresso i componenti che traducono eventi o richieste esterne in invocazioni di Application; sono adapter di uscita i componenti che realizzano una porta Application tramite una tecnologia concreta. La realizzazione può essere una classe, una funzione o un oggetto fornito dalla composition root: non dipende dalla presenza della parola TypeScript `implements`. Per esempio, un'implementazione SQLite di una porta di lettura si chiama `sqlite-conversation-history-read.adapter.ts`.

La collocazione in `adapters/` non rende automaticamente adapter ogni file contenuto. Mapper, schemi, cataloghi, validatori, driver di libreria e funzioni tecniche di supporto mantengono nomi descrittivi senza aggiungere `.adapter`, salvo che realizzino essi stessi un ingresso o una porta Application. Un coordinatore con stato non riceve o evita `.use-case` per il solo fatto di essere una classe: occorre identificarne la responsabilità e stabilire se offre un caso d'uso oppure supporta altri casi d'uso. In caso di ruolo ambiguo, documentare l'esito della classificazione nell'ispezione prima di rinominare.

La regola riguarda i nomi dei file di produzione. Non impone il suffisso `Adapter` o `UseCase` a ogni simbolo TypeScript, non introduce un suffisso obbligatorio per le porte e non modifica le regole sui confini dei layer. Le regole preesistenti sulla dichiarazione di firme, factory ed esiti restano applicabili nel loro ambito.

Motivazione: Martin Fowler sostiene una politica coerente dei nomi dei ruoli e l'uso dei nomi dei pattern quando chiariscono la responsabilità, senza proporre una convenzione universale: https://martinfowler.com/articles/refactoring-external-service.html . Robert C. Martin evidenzia la riconoscibilità dei casi d'uso nella struttura: https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html . Gli esempi di Alistair Cockburn non impongono il termine Adapter nei nomi: https://alistair.cockburn.us/hexagonal-architecture . Il suffisso obbligatorio qui adottato è una scelta locale, non una prescrizione attribuita a questi autori.

#### Metadata
  * type: specification

#### Relations
  * define: [Nomi dei file secondo il ruolo architetturale](../Requirements/ServerFoundation.md#nomi-dei-file-secondo-il-ruolo-architetturale)
---

### Distribuzione dei modelli vocali

Quando la voce è abilitata, Vosk e la sintesi vocale sherpa-onnx sono eseguiti nel processo backend del medesimo container Docker. Le librerie necessarie a Vosk e a sherpa-onnx, i modelli Vosk italiani e inglesi, le voci Piper italiane e inglesi e il modello Kokoro multilingue appartengono all'immagine runtime; l'immagine non contiene un ambiente Python né il binario Piper. Una directory di voci montata in sola lettura al posto di quella inclusa nell'immagine può sostituire il catalogo predefinito senza ricostruire l'immagine. Il componente vocale riceve i percorsi dalla configurazione validata e ne verifica la disponibilità prima di attivare l'ingresso vocale; un modello necessario assente, illeggibile o non caricabile impedisce l'avvio. Quando la voce è disabilitata, i percorsi dei modelli non sono richiesti.

#### Metadata
  * type: specification

#### Relations
  * define: [Distribuzione del server come immagine Docker](../Requirements/ServerFoundation.md#distribuzione-del-server-come-immagine-docker)
---

### Evento diagnostico del mancato avvio del server

Decisione concordata con la persona il 18 ottobre 2026, perché la sola riga `Unable to start HTTP server.` non permetteva a chi installa Ambrogio di capire quale configurazione o risorsa impedisse l'avvio. L'entrypoint del processo server è il confine definitivo dei guasti avvenuti prima dell'ascolto: quando la preparazione fallisce emette una sola riga JSON Pino su `stdout` con livello `error`, `event: "server_startup_failed"`, il messaggio fisso `Server startup failed` e il campo `err`, poi scrive su `stderr` la riga invariata `Unable to start HTTP server.` e termina con codice di uscita `1`. Il server non si mette in ascolto e non emette altri log definitivi per lo stesso guasto.

Il campo `err` segue il profilo controllato di serializzazione già adottato dal runtime HTTP: un `ProjectError` espone tipo, messaggio e stack; ogni altro valore riceve la descrizione costante `Unexpected startup failure` con stack oscurato, senza copiarne messaggio o proprietà. La catena `cause` non è serializzata. Per rendere identificabile la causa, le fasi di avvio che possono ricevere guasti esterni li incapsulano in un `ProjectError` con un messaggio fisso che nomina la fase e conserva l'originale come `cause`: `Conversation archive could not be prepared` per apertura, migrazione e recupero dell'archivio, `Voice components could not be loaded` per il caricamento di trascrizione e sintesi, `HTTP listener could not start` per l'ascolto, `Agent MCP connection failed: <id>` per connessione e scoperta degli strumenti MCP di un agente e `Invalid agent options: <id>` per opzioni del modello non valide. Un `ProjectError` già prodotto da una fase, come quelli di validazione dei modulo TypeScript, resta invariato. I messaggi possono contenere l'identificativo di un agente o il nome di un file di agente, ma mai valori letti dai file, URL, credenziali, token o chiavi.

#### Metadata
  * type: input-output

#### Relations
  * define: [Diagnostica del mancato avvio del server](../Requirements/ServerFoundation.md#diagnostica-del-mancato-avvio-del-server)
---

### Forma del tipo Result

La definizione TypeScript locale a un modulo business è `type Result<T, E> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>`; il ramo `ok: true` contiene `value`, il ramo `ok: false` contiene `error`. Entrambi i rami sono immutabili tramite `Readonly`.

#### Metadata
  * type: specification

#### Relations
  * define: [Struttura del tipo Result](../Requirements/ServerFoundation.md#struttura-del-tipo-result)
---

### Politica CORS del componente HTTP

L'elenco delle origini autorizzate è un'impostazione esplicita del configurazione locale del componente HTTP; se è assente o vuoto, la politica non aggiunge header CORS di autorizzazione. Per una richiesta con `Origin`, la risposta ordinaria e l'eventuale risposta alla preflight autorizzano soltanto una corrispondenza esatta con un'origine dell'elenco. Non si usa `*` e non si riflette un'origine non autorizzata. CORS non sostituisce le restrizioni di rete e reverse proxy previste per l'accesso all'installazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Origini CORS esplicite dell'API HTTP](../Requirements/ServerFoundation.md#origini-cors-esplicite-dellapi-http)
---

### Politica HSTS dell'origine pubblica

Il configurazione locale validato del componente HTTP dichiara se l'origine pubblica è esposta esclusivamente tramite HTTPS, anche quando la terminazione TLS avviene nel reverse proxy. Il componente non deduce questa condizione da `X-Forwarded-Proto` o dal protocollo della singola connessione interna. Se la condizione è falsa o non dichiarata, disabilita l'HSTS predefinito di Helmet. Se è vera, abilita HSTS con una durata positiva dichiarata; `includeSubDomains` e `preload` non sono attivati implicitamente, perché riguardano anche altri servizi del dominio. La configurazione del deployment coordina l'eventuale emissione dello stesso header da parte del reverse proxy.

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

Alla richiesta di arresto il server smette di accettare nuovi turni, richiede subito l'interruzione di quelli attivi e non attende che le loro risposte terminino. Per ogni turno accettato rimasto senza esito, conserva lo stato `interrotto` prima di chiudere l'archivio e le altre risorse necessarie a tale registrazione; un completamento tardivo non può sostituire tale stato con una risposta riuscita. Un esito già conservato prima dell'arresto resta concluso. Se il processo termina prima che lo stato `interrotto` sia conservato, il recupero al riavvio riconosce il turno senza esito come interrotto. Nessun turno viene accodato o ripetuto automaticamente.

#### Metadata
  * type: specification

#### Relations
  * define: [Interruzione dei turni durante l'arresto](../Requirements/ServerFoundation.md#interruzione-dei-turni-durante-larresto)
---

### Profilo TypeScript dell'ascolto HTTP

Il percorso del modulo TypeScript del componente HTTP è indicato da `AMBROGIO_HTTP_CONFIG_PATH`. Il modulo esporta per default un oggetto con `host`, stringa non vuota, e `port`, numero intero da 1 a 65535. Non esistono valori predefiniti per questi due campi. Il listener usa esattamente i valori validati. Modulo mancante, non importabile o valori non validi impediscono l'avvio.

Il file ammette `allowedOrigins`, elenco di origini HTTP(S) esplicite, predefinito vuoto; `publicHttps`, booleano predefinito `false`; e `hstsMaxAgeSeconds`, intero positivo obbligatorio quando `publicHttps` è `true`. Il componente applica la politica CORS già definita tramite il plugin ufficiale `@fastify/cors` e configura `@fastify/helmet` secondo la politica HSTS già definita. Una voce CORS non può essere `*`; la corrispondenza dell'origine è esatta.

#### Metadata
  * type: specification

#### Relations
  * define: [Configurazione esplicita dell'ascolto HTTP](../Requirements/ServerFoundation.md#configurazione-esplicita-dellascolto-http)
---

### Profilo controllato di serializzazione di err

La rappresentazione JSON di `err` usa una vista composta soltanto da campi ammessi esplicitamente dal serializzatore. Gli errori costruiti dal progetto usano un tipo `Error` dedicato e riconoscibile dal serializzatore; la loro vista include lo stack diagnostico. Gli errori ricevuti da driver, SDK o provider conservano il tipo originale e, come ogni valore lanciato sconosciuto, ricevono una descrizione costante sicura, indipendente dal valore ricevuto, senza copiarne messaggio, stack o proprietà aggiuntive. La normalizzazione diagnostica al confine conserva l'identità di ogni `Error` ricevuto e rappresenta un valore non `Error` con un nuovo `Error` privo del tipo dedicato; non applica il tipo del progetto a un guasto esterno o sconosciuto.

#### Metadata
  * type: input-output

#### Relations
  * define: [Rappresentazione di err nel log JSON](../Requirements/ServerFoundation.md#rappresentazione-di-err-nel-log-json)
---

### Profilo del limite dei corpi HTTP

Il componente HTTP configura un limite di dimensione positivo per i corpi ricevuti dalle rotte che ne accettano uno; un'eventuale eccezione per rotta dichiara un proprio limite esplicito. Il controllo riguarda la dimensione effettivamente ricevuta, anche quando il corpo arriva in più parti. Il rifiuto `413` usa la forma JSON pubblica degli errori HTTP e non passa il corpo al caso d'uso. Le rotte HTTP attuali di elenco e storico non accettano un corpo; i valori di future rotte con corpo saranno fissati nei rispettivi contratti. I limiti dei turni sono definiti dal protocollo conversazionale e non da questo profilo.

#### Metadata
  * type: specification

#### Relations
  * define: [Limite dei corpi delle richieste HTTP](../Requirements/ServerFoundation.md#limite-dei-corpi-delle-richieste-http)
---

### Profilo dell'immagine Docker del server

L'immagine del backend usa Debian con Node.js 24 ed è costruita in due fasi: una fase prepara dipendenze e artefatti compilati del workspace, l'altra contiene il runtime necessario per avviare il server. La configurazione TypeScript effettiva dei componenti e l'archivio SQLite sono forniti dal deployment tramite percorsi esterni all'immagine; il filesystem dell'immagine non contiene i loro valori effettivi. La build e l'avvio dell'immagine non richiedono Docker Compose.

#### Metadata
  * type: specification

#### Relations
  * define: [Distribuzione del server come immagine Docker](../Requirements/ServerFoundation.md#distribuzione-del-server-come-immagine-docker)
---

### Profilo di bootstrap delle configurazioni TypeScript

Decisione concordata il 23 ottobre 2026: i moduli TypeScript sostituiscono i file JSON di configurazione. Il deployment può fornire tutti i valori mediante variabili d'ambiente in Docker Compose; i moduli TypeScript leggono `process.env`, convertono esplicitamente i tipi ed esportano per default l'oggetto di configurazione. Node.js 24 carica i moduli `.ts` con il supporto nativo ai tipi rimovibili. La composition root determina i componenti dell'ingresso da avviare e importa una sola volta i rispettivi moduli prima di costruirne le risorse. Ogni componente dichiara campi obbligatori e valori predefiniti; il caricamento valida struttura e valori e blocca l'attivazione se un modulo necessario manca, non è importabile o restituisce valori invalidi. I moduli dei componenti inattivi, compreso quello vocale quando la voce è disabilitata, non sono richiesti. La composition root consegna a ogni componente solo i valori validati; Domain e casi d'uso Application non leggono file, variabili d'ambiente o segreti dal processo. Messaggi di errore, log ed esempi non riproducono segreti.

Il percorso del modulo TypeScript di un componente attivo è indicato dalla variabile d'ambiente dedicata già prevista. I valori espressi dai moduli possono provenire dall'ambiente del processo; dopo il caricamento restano soggetti alla validazione esistente.

#### Metadata
  * type: specification

#### Relations
  * define: [Caricamento iniziale delle configurazioni TypeScript](../Requirements/ServerFoundation.md#caricamento-iniziale-delle-configurazioni-typescript)
---

### Profilo di pubblicazione dell'immagine Docker del server

Decisione concordata il 16 ottobre 2026: il backend pubblica l'immagine su GitHub Container Registry (`ghcr.io`) tramite GitHub Actions quando viene creato un tag Git di release nel formato `vMAJOR.MINOR.PATCH`. La prima release è `v0.1.0`. La versione senza `v` corrisponde a `apps/server/package.json`. Il pacchetto OCI usa il nome `ghcr.io/ambrogio-app/ambrogio-backend` e riceve un tag immagine uguale al tag Git di release; non viene pubblicato un tag mobile `latest`. L'immagine supporta `linux/amd64`. Il workflow costruisce l'immagine dal Dockerfile del repository, la verifica prima del push e usa il `GITHUB_TOKEN` con permesso `packages: write` per pubblicarla. La pubblicazione richiede che la CI del backend e la scansione dei segreti siano superate sullo stesso commit. Un commit ordinario su `main` non è un evento di pubblicazione. L'immagine conserva le configurazioni TypeScript effettive, l'archivio SQLite e i modelli vocali fuori dal filesystem distribuito. La visibilità del pacchetto nel registro è decisa dalla persona e non è modificata dal workflow.

#### Details
Decisione concordata con la persona il 18 ottobre 2026: le release `v0.1.0`, `v0.1.1` e `v0.2.0`, pubblicate fra il 16 e il 18 ottobre 2026, sono state ritirate perché le prime due precedevano il protocollo `ambrogio.v1` e non funzionavano con i client attuali. I tag Git e il pacchetto nel registro sono stati cancellati e la numerazione riparte da `v0.1.0`, ripubblicata sul primo commit successivo con `apps/server/package.json` alla versione 0.1.0, in linea con il client terminale e il satellite. Chi conserva in cache i tag o le immagini ritirati deve aggiornarli forzatamente; le evidenze storiche che citano quelle versioni descrivono lo stato del momento.

Decisione concordata con la persona il 18 ottobre 2026, che sostituisce lo spazio dei nomi personale deciso il 16 ottobre: i repository di Ambrogio appartengono all'organizzazione GitHub `ambrogio-app` e l'immagine è pubblicata come `ghcr.io/ambrogio-app/ambrogio-backend`. Il pacchetto nello spazio dei nomi personale è cancellato dopo la prima pubblicazione nell'organizzazione.

Decisione concordata con la persona il 18 ottobre 2026: i numeri delle release ritirate, a parte `v0.1.0` già ripubblicato, non sono riusati. La release successiva a `v0.1.0` è `v0.1.2`, che salta `v0.1.1` per non confonderla con l'immagine ritirata ancora presente in cache o citata nelle evidenze; `v0.2.0` resta anch'esso escluso.

#### Metadata
  * type: specification

#### Relations
  * define: [Pubblicazione dell'immagine Docker del server](../Requirements/ServerFoundation.md#pubblicazione-dellimmagine-docker-del-server)
---

### Profilo di scansione dei segreti con gitleaks

Decisione concordata con la persona il 18 ottobre 2026: il repository backend usa gitleaks per impedire che chiavi API, token o altre credenziali entrino nella storia Git, con due controlli complementari, uno in CI e uno locale. La stessa scelta è adottata dagli altri repository di Ambrogio; questa registrazione riguarda soltanto il backend.

Nella CI il workflow `.github/workflows/secret-scan.yml` è eseguito a ogni push su qualunque branch, a ogni pull request, su richiesta manuale e come workflow riutilizzabile. Esegue il checkout dell'intera storia (`fetch-depth: 0`) senza conservare le credenziali del checkout, scarica dalla release ufficiale l'archivio `gitleaks_8.30.1_linux_x64.tar.gz` di gitleaks v8.30.1 e ne verifica l'impronta SHA-256 `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`; un'impronta diversa interrompe il workflow con esito negativo. Lo scanner esegue `gitleaks git --redact --no-banner --exit-code 1 .` sull'intera storia; un ritrovamento produce esito negativo e i valori trovati sono oscurati nell'output. Il workflow di pubblicazione dell'immagine richiama questo workflow e il job di pubblicazione dipende dal suo esito, così che nessuna immagine venga pubblicata se la scansione fallisce.

In locale l'hook versionato `.githooks/pre-commit`, script POSIX eseguibile, controlla le modifiche in staging con `gitleaks git --pre-commit --staged --redact --no-banner .` e impedisce il commit in caso di ritrovamento. Se `gitleaks` non è disponibile nel `PATH`, l'hook stampa un messaggio che indica come installarlo e impedisce il commit invece di proseguire senza controllo. L'hook si attiva una volta per clone con `git config core.hooksPath .githooks`. I commit creati dallo strumento `reqvire.git.commit` del server MCP Reqvire 1.3.2 non eseguono gli hook Git, come osservato il 18 ottobre 2026: per i soli file del modello committati in questo modo la protezione è data dalla scansione in CI. La configurazione predefinita delle regole di gitleaks è adottata senza eccezioni; un'eccezione per un falso positivo richiede una nuova decisione registrata qui.

Alternative considerate: l'action `gitleaks/gitleaks-action` richiede una chiave di licenza per i repository di organizzazioni e aggiunge una dipendenza di terze parti al percorso di pubblicazione, mentre il binario fissato con impronta verificata non dipende da licenze; un controllo solo in CI lascerebbe entrare il segreto nella storia locale e lo bloccherebbe soltanto al push; un controllo solo locale dipenderebbe dall'attivazione dell'hook in ogni clone e non proteggerebbe integrazione e pubblicazione. L'aggiornamento della versione di gitleaks richiede di aggiornare insieme versione e impronta.

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

### Profilo iniziale di osservabilità

Il segnale diagnostico della prima versione è costituito dai log JSON strutturati del runtime HTTP, con i `correlationId` per collegare gli eventi di una richiesta. Un `correlationId` non è una traccia distribuita e i log non costituiscono un registro di audit garantito. Non sono attivati raccoglitori o API applicative separati per metriche, tracing o audit. Eventuali estensioni richiedono un bisogno concreto, un contratto proprio per dati e protezioni, una collocazione nei confini tecnici e verifiche dedicate; non ereditano automaticamente le garanzie dei log. La diagnostica tecnica non acquisisce automaticamente contenuti delle conversazioni o credenziali secondo i requisiti già definiti.

#### Metadata
  * type: specification

#### Relations
  * define: [Perimetro iniziale dei segnali di osservabilità](../Requirements/ServerFoundation.md#perimetro-iniziale-dei-segnali-di-osservabilità)
---

### Stack TypeScript ESM e Node.js del server

Il codice sorgente del server è scritto in TypeScript. La build del server usa `tsc` e produce JavaScript ESM. L'artefatto è eseguito con Node.js 24 o successivo.

#### Metadata
  * type: specification

#### Relations
  * define: [Preparazione del server TypeScript ESM](../Requirements/ServerFoundation.md#preparazione-del-server-typescript-esm)
---

### Vincolo sui campi dei rifiuti previsti

Una variante può contenere solo `kind` oppure aggiungere campi propri, tipizzati, che appartengono al significato stabile del rifiuto e servono al chiamante. Non esiste uno schema comune che richieda in ogni variante campi generici quali `message`, `cause`, `metadata`, `statusCode` o codici di uscita. La presenza di uno di questi nomi in una variante specifica non è vietata quando soddisfa il criterio dei campi propri.

#### Metadata
  * type: constraint

#### Relations
  * define: [Campi specifici dei rifiuti previsti](../Requirements/ServerFoundation.md#campi-specifici-dei-rifiuti-previsti)
---
