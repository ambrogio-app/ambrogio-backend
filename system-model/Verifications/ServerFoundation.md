# Elements

### Verifica del ciclo di vita del server

Raggruppa le prove dell'interruzione dei turni attivi all'arresto ordinato e della chiusura delle risorse.

#### Metadata
  * type: verification-objective
---

### Prova dell'interruzione dei turni all'arresto

Avviare un turno con elaborazione controllata che resterebbe in corso, richiedere l'arresto del server e tentare un nuovo turno. Osservare la richiesta di interruzione, lo stato persistente del turno, l'ordine di chiusura delle risorse e i messaggi ricevuti dalla sessione del client.

#### Details
La prova passa se il server rifiuta i nuovi turni con `unavailable`, richiede subito l'interruzione di quello attivo senza attendere il completamento della risposta, conserva il turno senza esito come «Interrotto» prima di chiudere l'archivio, invia `turn.interrupted` alla sessione ancora aperta e poi chiude sessioni e risorse. Nessun turno interrotto riceve un esito riuscito o viene riavviato automaticamente. Fallisce se l'arresto attende la risposta controllata, accetta altri turni, perde il turno interrotto o chiude l'archivio prima di registrarlo. Verifica aggiornata per il protocollo `ambrogio.v1`, da eseguire.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del ciclo di vita del server](#verifica-del-ciclo-di-vita-del-server)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [session-lifecycle.test.ts](../../apps/server/test/runtime/session-lifecycle.test.ts)
  * verify: [Arresto controllato dei nuovi turni](../Requirements/ServerFoundation.md#arresto-controllato-dei-nuovi-turni)
  * verify: [Chiusura delle risorse dopo l'interruzione dei turni](../Requirements/ServerFoundation.md#chiusura-delle-risorse-dopo-linterruzione-dei-turni)
  * verify: [Interruzione dei turni durante l'arresto](../Requirements/ServerFoundation.md#interruzione-dei-turni-durante-larresto)
---

### Prova della diagnostica del mancato avvio

Provocare il fallimento dell'avvio del processo server in ciascuna fase: file HTTP o conversazionale mancante o invalido, file vocale invalido, directory degli agenti senza agenti specializzati, opzioni del modello non valide in un agente, server MCP di un agente irraggiungibile, archivio non apribile e porta di ascolto occupata. Inserire un segreto marcatore nei file e nelle credenziali MCP e un messaggio marcatore nel guasto esterno. Catturare `stdout`, `stderr` e codice di uscita.

#### Details
La prova passa se ogni caso produce su `stdout` una sola riga JSON con livello `error`, `event` `server_startup_failed` ed `err` conforme al profilo del contratto, con il messaggio fisso della fase o il messaggio di validazione già previsto e, per gli agenti, l'identificativo dell'agente; se `stderr` contiene `Unable to start HTTP server.`, il codice di uscita è `1` e il server non è in ascolto. Fallisce se manca l'evento o ne compaiono più di uno, se il segreto o il messaggio marcatore del guasto esterno compaiono in un output, se la causa non distingue la fase o l'agente, o se il processo termina con successo.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del ciclo di vita del server](#verifica-del-ciclo-di-vita-del-server)
  * satisfiedBy: [agents.test.ts](../../apps/server/test/composition/agents.test.ts)
  * satisfiedBy: [startup-failure.test.ts](../../apps/server/test/runtime/startup-failure.test.ts)
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

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Tipi distinti per i rifiuti di porte e casi d'uso](../Requirements/ServerFoundation.md#tipi-distinti-per-i-rifiuti-di-porte-e-casi-duso)
---

### Analisi delle definizioni locali di Result

Per ogni modulo business del server che usa `Result<T, E>`, esaminare la dichiarazione TypeScript del tipo e gli import dei file che lo usano; confrontare la dichiarazione con la specifica «Forma del tipo Result».

#### Details
L'analisi passa se ogni modulo definisce `Result<T, E>` nel proprio package, senza importarlo da altri package, e se il tipo coincide con `Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>`. Fallisce se il tipo è condiviso tra package, se un ramo è mutabile o se discriminanti e campi differiscono dalla specifica.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Definizione locale del tipo Result](../Requirements/ServerFoundation.md#definizione-locale-del-tipo-result)
  * verify: [Struttura del tipo Result](../Requirements/ServerFoundation.md#struttura-del-tipo-result)
---

### Analisi delle firme Result di casi d'uso e porte

Esaminare le firme TypeScript di ogni caso d'uso e porta Application del server che dichiara rifiuti previsti e confrontare il tipo `E` con le varianti del rispettivo contratto; includere funzioni sincrone e asincrone.

#### Details
L'analisi passa se ogni firma restituisce `Result<T, E>` oppure `Promise<Result<T, E>>` e se `E` è l'unione chiusa delle sole varianti dichiarate nel contratto di quell'operazione. Fallisce se la firma usa un altro tipo di esito, se `E` è aperto o se contiene varianti mancanti o estranee al contratto del caso d'uso o della porta.

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
Il controllo passa se entrambi gli ingressi usano Pino per emettere tali eventi. Fallisce se un ingresso usa un logger alternativo per gli eventi tecnici. La verifica per un ingresso non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Uso di Pino per il logging tecnico](../Requirements/ServerFoundation.md#uso-di-pino-per-il-logging-tecnico)
---

### Controllo della raccolta esterna dei log

Esaminare l'ingresso HTTP, la configurazione di Pino e le configurazioni di deployment presenti per identificare dove vengono definiti l'inoltro e il backend di raccolta dei log.

#### Details
Il controllo passa se il codice applicativo emette eventi verso i flussi standard senza integrare direttamente un backend specifico e se ogni inoltro centralizzato presente è configurato nel deployment. Fallisce se il codice applicativo contiene un'integrazione diretta con un backend di log per questo inoltro. Il controllo della configurazione di raccolta resta da eseguire quando un deployment che la richiede viene introdotto.

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

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * verify: [Eccezioni costruite come Error](../Requirements/ServerFoundation.md#eccezioni-costruite-come-error)
---

### Prova dei campi diagnostici espliciti

Per eventi diagnostici HTTP presenti, predisporre oggetti di ingresso, uscita e contesto con campi marcatori non selezionati; produrre gli eventi e confrontare le chiavi e i valori delle righe JSON con i campi dichiarati nel punto di emissione e nella configurazione del logger.

#### Details
La prova passa se tutti i campi della riga appartengono alla selezione esplicita e nessun marcatore non selezionato compare nel log. Fallisce se il logger serializza automaticamente un oggetto intero o aggiunge un campo di origine non dichiarato. La prova per un ingresso o evento non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
  * verify: [Selezione esplicita dei campi diagnostici](../Requirements/ServerFoundation.md#selezione-esplicita-dei-campi-diagnostici)
---

### Prova dei flussi dei log tecnici

Avviare il server HTTP con i flussi standard intercettati, indurre un evento diagnostico tecnico e acquisire `stdout` e `stderr` separatamente.

#### Details
La prova passa se ogni evento Pino occupa una sola riga JSON strutturata, il processo HTTP la emette per impostazione predefinita su `stdout`. Fallisce se un evento è spezzato su più righe, non è JSON valido o compare sul flusso predefinito errato. La prova per un ingresso non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * verify: [Formato e flussi dei log tecnici](../Requirements/ServerFoundation.md#formato-e-flussi-dei-log-tecnici)
---

### Prova dei nomi degli eventi diagnostici

Per ogni punto di emissione diagnostica HTTP presente, individuare il nome `event` dichiarato nel codice ed emettere lo stesso evento con dati di esecuzione differenti; acquisire le righe JSON.

#### Details
La prova passa se ogni riga contiene `event`, il suo valore corrisponde al nome dichiarato nel punto di emissione e resta uguale nelle esecuzioni dello stesso evento nonostante varino i dati. Fallisce se il campo manca, è ricavato da dati della singola esecuzione o cambia per lo stesso evento. La prova per un punto di emissione non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
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
  * satisfiedBy: [sqlite-conversation-write.test.ts](../../packages/conversations/test/adapters/out/sqlite-conversation-write.test.ts)
  * satisfiedBy: [sqlite-history.test.ts](../../packages/conversations/test/adapters/out/sqlite-history.test.ts)
  * satisfiedBy: [exchange-turn.test.ts](../../packages/conversations/test/application/exchange-turn.test.ts)
  * satisfiedBy: [turn-use-cases.test.ts](../../packages/conversations/test/application/turn-use-cases.test.ts)
  * satisfiedBy: [turn.test.ts](../../packages/conversations/test/domain/turn.test.ts)
  * verify: [Rifiuti previsti come valori di esito](../Requirements/ServerFoundation.md#rifiuti-previsti-come-valori-di-esito)
---

### Prova del campo err nel log definitivo

Nei fallback HTTP presenti, indurre separatamente un `Error` costruito dal progetto con catena `cause`, errori esterni con marcatori distinti in messaggio, stack e proprietà aggiuntive, e valori lanciati sconosciuti; intercettare l'argomento del logger e le righe JSON emesse. Prima della serializzazione acquisire riferimenti e proprietà proprie dell'`Error` originale e degli oggetti della sua catena `cause`, poi confrontarli dopo l'emissione. Confrontare le chiavi serializzate con i campi ammessi esplicitamente dal serializzatore.

#### Details
La prova passa se per l'`Error` del progetto il campo strutturato `err` conserva in memoria la catena `cause`, i riferimenti e le proprietà degli oggetti originali restano invariati, e la vista JSON include lo stack diagnostico; se ogni vista contiene soltanto campi ammessi; e se errori esterni e valori sconosciuti producono una descrizione costante sicura senza riportare messaggio, stack o proprietà aggiuntive di origine. Fallisce se la serializzazione modifica l'`Error` originale o un oggetto della sua catena `cause`, se l'argomento in memoria perde la catena delle cause, se la riga omette `err` o lo stack previsto, se compaiono campi non ammessi o se la descrizione esterna dipende dal valore originale. La prova per un ingresso non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
  * satisfiedBy: [http-history-route.test.ts](../../packages/conversations/test/adapters/in/http-history-route.test.ts)
  * satisfiedBy: [http-list-route.test.ts](../../packages/conversations/test/adapters/in/http-list-route.test.ts)
  * verify: [Conservazione dell'errore originale durante la serializzazione](../Requirements/ServerFoundation.md#conservazione-dellerrore-originale-durante-la-serializzazione)
  * verify: [Oggetto Error nel campo err del log definitivo](../Requirements/ServerFoundation.md#oggetto-error-nel-campo-err-del-log-definitivo)
  * verify: [Rappresentazione di err nel log JSON](../Requirements/ServerFoundation.md#rappresentazione-di-err-nel-log-json)
---

### Prova del log error nei fallback pubblici

Per ogni fallback pubblico HTTP presente nel server, rendere disponibile un logger di prova e indurre separatamente un guasto tecnico inatteso, un bug e un valore lanciato sconosciuto; osservare gli eventi prodotti dal confine che decide l'esito esterno.

#### Details
La prova passa se, per ciascun caso e ciascun ingresso presente, il confine emette esattamente un log diagnostico definitivo di livello `error` relativo al guasto. Fallisce se il log manca, ha un livello diverso, è emesso da un componente intermedio o compare più volte. La prova per un ingresso non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * verify: [Log error del fallback pubblico](../Requirements/ServerFoundation.md#log-error-del-fallback-pubblico)
---

### Prova dell'assenza di log HTTP automatici

Avviare il runtime HTTP con logging tecnico attivo e inviare una richiesta con esito ordinario e una che raggiunge il fallback per un guasto inatteso; raccogliere tutti gli eventi emessi da Fastify e dal runtime.

#### Details
La prova passa se la ricezione della richiesta e l'invio della risposta non generano eventi automatici di Fastify, mentre restano disponibili gli eventi applicativi esplicitamente previsti, incluso il log diagnostico definitivo del guasto. Fallisce se compaiono eventi automatici di inizio o fine richiesta.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
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
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
  * verify: [Nessun log automatico per esiti previsti](../Requirements/ServerFoundation.md#nessun-log-automatico-per-esiti-previsti)
---

### Prova dell'assenza di raccolta automatica nei log

Nell'ingresso HTTP presente, inserire marcatori distinti in testi delle conversazioni, corpi e header HTTP, input e output dei casi d'uso e credenziali di prova; generare eventi diagnostici ordinari e di guasto e acquisire le righe JSON. Esaminare anche la configurazione del logger e le integrazioni degli ingressi per individuare serializzazioni automatiche delle sorgenti indicate.

#### Details
La prova passa se nessuno dei marcatori viene acquisito automaticamente dagli eventi e se la configurazione non abilita la registrazione automatica delle sorgenti elencate. Fallisce se un'integrazione o un serializer copia automaticamente una di tali sorgenti nei log. La prova per un ingresso o una sorgente non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
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
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
  * satisfiedBy: [http-history-route.test.ts](../../packages/conversations/test/adapters/in/http-history-route.test.ts)
  * satisfiedBy: [http-list-route.test.ts](../../packages/conversations/test/adapters/in/http-list-route.test.ts)
  * verify: [Assenza di log definitivi nei componenti intermedi](../Requirements/ServerFoundation.md#assenza-di-log-definitivi-nei-componenti-intermedi)
  * verify: [Proprietà e unicità del log diagnostico definitivo](../Requirements/ServerFoundation.md#proprietà-e-unicità-del-log-diagnostico-definitivo)
---

### Prova della correlazione HTTP

Per ogni ingresso HTTP presente, effettuare almeno due richieste distinte e provocare sia un esito ordinario sia una risposta di errore gestita; raccogliere gli eventi diagnostici relativi a ciascuna richiesta e l'header `X-Request-Id` delle risposte.

#### Details
La prova passa se ogni richiesta riceve un `correlationId` UUID v4 distinto, tutti i suoi eventi diagnostici riportano lo stesso ID e ogni risposta gestita riporta in `X-Request-Id` proprio quell'ID, anche in errore. Fallisce se un ID manca, non è UUID v4, è riutilizzato tra richieste o differisce tra log e risposta. La prova per un ingresso non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
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
  * satisfiedBy: [exchange-turn.test.ts](../../packages/conversations/test/application/exchange-turn.test.ts)
  * satisfiedBy: [turn-use-cases.test.ts](../../packages/conversations/test/application/turn-use-cases.test.ts)
  * verify: [Gestione esplicita dei rifiuti delle porte](../Requirements/ServerFoundation.md#gestione-esplicita-dei-rifiuti-delle-porte)
  * verify: [Proiezione dei rifiuti bloccanti delle porte](../Requirements/ServerFoundation.md#proiezione-dei-rifiuti-bloccanti-delle-porte)
---

### Prova della normalizzazione diagnostica al confine

Nei fallback HTTP presenti, iniettare separatamente un'istanza `Error` con `cause` e più valori lanciati che non sono `Error`, distinguibili tra loro. Intercettare il valore strutturato `err` passato al logger definitivo e osservare il percorso dai componenti intermedi al confine che decide l'esito esterno.

#### Details
La prova passa se la normalizzazione avviene una sola volta nel confine definitivo: per l'`Error`, `err` è la stessa istanza catturata; per ogni altro valore, `err` è un nuovo `Error` con messaggio diagnostico fisso uguale nei casi provati e `cause` identica al valore catturato. Il valore originale resta invariato e non viene convertito in stringa. Fallisce se un componente intermedio normalizza il guasto, se sono creati wrapper ulteriori, se cambia l'identità dell'`Error` originale o della `cause`, o se il messaggio dipende dal valore catturato. La prova per un ingresso non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
  * satisfiedBy: [http-history-route.test.ts](../../packages/conversations/test/adapters/in/http-history-route.test.ts)
  * satisfiedBy: [http-list-route.test.ts](../../packages/conversations/test/adapters/in/http-list-route.test.ts)
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
  * satisfiedBy: [http-history-route.test.ts](../../packages/conversations/test/adapters/in/http-history-route.test.ts)
  * satisfiedBy: [http-list-route.test.ts](../../packages/conversations/test/adapters/in/http-list-route.test.ts)
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
  * satisfiedBy: [mcp-tool-client.test.ts](../../packages/conversations/test/adapters/out/mcp-tool-client.test.ts)
  * satisfiedBy: [turn-use-cases.test.ts](../../packages/conversations/test/application/turn-use-cases.test.ts)
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
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
  * satisfiedBy: [http-history-route.test.ts](../../packages/conversations/test/adapters/in/http-history-route.test.ts)
  * satisfiedBy: [http-list-route.test.ts](../../packages/conversations/test/adapters/in/http-list-route.test.ts)
  * verify: [Esclusione dei dettagli tecnici dal messaggio pubblico](../Requirements/ServerFoundation.md#esclusione-dei-dettagli-tecnici-dal-messaggio-pubblico)
  * verify: [Separazione del messaggio pubblico dalla diagnosi tecnica](../Requirements/ServerFoundation.md#separazione-del-messaggio-pubblico-dalla-diagnosi-tecnica)
---

### Verifica della protezione dai segreti

Raggruppa i controlli che impediscono l'ingresso di credenziali nella storia Git del backend, in CI e nei commit locali.

#### Metadata
  * type: verification-objective
---

### Controllo della scansione dei segreti in CI

Esaminare `.github/workflows/secret-scan.yml` e `.github/workflows/publish-image.yml`: eventi che avviano la scansione, profondità del checkout, versione e impronta SHA-256 dell'archivio gitleaks, comando eseguito e dipendenza del job di pubblicazione dall'esito della scansione. Esaminare l'esito di un'esecuzione del workflow su GitHub quando disponibile.

#### Details
Il controllo passa se la scansione parte a ogni push su qualunque branch e a ogni pull request, esegue il checkout dell'intera storia senza conservare le credenziali, scarica gitleaks v8.30.1 e interrompe il workflow se l'impronta non coincide con quella del contratto, esegue `gitleaks git` su tutta la storia con valori oscurati e uscita non riuscita in caso di ritrovamento, e se il job di pubblicazione dell'immagine non può partire senza l'esito positivo della scansione. Fallisce se un evento previsto non avvia la scansione, se la storia è troncata, se il binario non è verificato o se un'immagine può essere pubblicata dopo una scansione fallita o non eseguita.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della protezione dai segreti](#verifica-della-protezione-dai-segreti)
  * verify: [Scansione dei segreti nella CI del backend](../Requirements/ServerFoundation.md#scansione-dei-segreti-nella-ci-del-backend)
---

### Dimostrazione dell'hook pre-commit dei segreti

In un clone con `core.hooksPath` impostato a `.githooks`, mettere in staging un file che contiene un segreto fittizio riconosciuto dalle regole predefinite di gitleaks e tentare il commit; ripetere con modifiche prive di segreti; ripetere con `gitleaks` assente dal `PATH`.

#### Details
La dimostrazione passa se il commit con il segreto fittizio è impedito e l'output non mostra il valore, il commit senza segreti riesce e, senza `gitleaks` nel `PATH`, il commit è impedito con un messaggio che indica come installare lo scanner. Fallisce se un commit con il segreto viene creato, se il valore compare in chiaro o se l'assenza dello scanner lascia passare il commit.

#### Metadata
  * type: demonstration-verification

#### Relations
  * derivedFrom: [Verifica della protezione dai segreti](#verifica-della-protezione-dai-segreti)
  * verify: [Blocco locale dei commit con segreti](../Requirements/ServerFoundation.md#blocco-locale-dei-commit-con-segreti)
---

### Verifica della pubblicazione dell'immagine Docker del server

Verificare che una release del backend renda disponibile nel registro l'immagine utilizzabile nell'homelab e collegata al tag Git che l'ha prodotta.

#### Metadata
  * type: verification-objective
---

### Dimostrazione della pubblicazione dell'immagine Docker del server

Su una release del backend, osservare l'esecuzione del workflow GitHub Actions e recuperare da GHCR il tag immagine corrispondente al tag Git.

#### Details
La verifica passa se il tag Git `vMAJOR.MINOR.PATCH` corrisponde alla versione del package server, il workflow verifica l'immagine prima del push e pubblica `ghcr.io/adrianofoschi/ambrogio-backend:<tag Git>` come pacchetto privato per `linux/amd64`. Con credenziali di lettura, il digest pubblicato deve essere scaricabile e avviare il server con configurazione e archivio SQLite esterni, senza Compose. Un tag diverso non deve pubblicare l'immagine. La prova finale richiede una release effettivamente pubblicata.

#### Metadata
  * type: demonstration-verification

#### Relations
  * derivedFrom: [Verifica della pubblicazione dell'immagine Docker del server](#verifica-della-pubblicazione-dellimmagine-docker-del-server)
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

Esaminare tutti gli esempi JSON di configurazione presenti nel repository e i campi in cui potrebbero comparire credenziali.

#### Details
Il controllo passa se gli esempi non contengono credenziali effettive; eventuali campi dedicati usano soltanto valori dimostrativi non utilizzabili. Fallisce se un esempio contiene una credenziale effettiva. Il controllo degli esempi resta da eseguire quando vengono aggiunti.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Esempi di configurazione privi di credenziali](../Requirements/ServerFoundation.md#esempi-di-configurazione-privi-di-credenziali)
---

### Controllo dei file di configurazione dei componenti

Per ogni componente configurabile presente nel server, individuare il file da cui viene caricata la configurazione locale; esaminare il formato e confrontare i percorsi usati dai diversi componenti.

#### Details
Il controllo passa se ogni componente legge un proprio file JSON e nessun file è condiviso come configurazione locale di componenti distinti. Fallisce se un componente usa un formato diverso da JSON o condivide il proprio file di configurazione con un altro componente. Il controllo per un componente non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [File JSON separato per componente configurabile](../Requirements/ServerFoundation.md#file-json-separato-per-componente-configurabile)
---

### Controllo del percorso CI del server

Esaminare la configurazione CI e le invocazioni effettive per le modifiche funzionali del server. Verificare che esegua Reqvire validate e lint, la compilazione TypeScript e la suite backend Vitest, incluse prove degli adapter di persistenza contro un database SQLite reale preparato per i test quando gli adapter esistono. Accertare che ogni comando richiesto abbia un esito vincolante per l'integrazione.

#### Details
Il controllo passa se tutte le fasi richieste vengono eseguite e un loro fallimento impedisce l'integrazione; le prove SQLite devono usare il database reale e non un sostituto in memoria della porta. Fallisce se manca una fase, le prove dell'adapter non raggiungono SQLite reale oppure un controllo fallito non blocca l'integrazione. Il controllo resta da eseguire quando esistono codice applicativo e configurazione CI.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Controlli CI delle modifiche funzionali del server](../Requirements/ServerFoundation.md#controlli-ci-delle-modifiche-funzionali-del-server)
---

### Controllo del perimetro iniziale di osservabilità

Esaminare runtime HTTP, dipendenze, configurazioni, endpoint e documentazione operativa della prima versione. Confrontare i segnali presenti con i contratti dei log strutturati e degli identificativi di correlazione; cercare raccoglitori o API distinti per metriche, tracing distribuito e audit.

#### Details
Il controllo passa se i runtime forniscono i log e i `correlationId` già previsti, senza attivare nella prima versione metriche, tracing o audit separati, e se nessun `correlationId` o log ordinario è presentato come traccia distribuita o registro di audit. Fallisce se viene introdotto un segnale separato senza una decisione e una verifica proprie, se i log sono descritti come audit garantito o se manca il profilo diagnostico previsto. I controlli funzionali dei log e della correlazione restano nelle rispettive verifiche. Il controllo è da svolgere quando il runtime esiste.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Perimetro iniziale dei segnali di osservabilità](../Requirements/ServerFoundation.md#perimetro-iniziale-dei-segnali-di-osservabilità)
---

### Controllo dell'assenza di autenticazione applicativa

Esaminare l'ingresso HTTP presente, le dipendenze runtime e i modelli persistenti del server per individuare gestione di account, credenziali utente, login e controlli di autenticazione applicativa.

#### Details
Il controllo passa se l'MVP non implementa account utente né autenticazione applicativa nei propri ingressi. Fallisce se sono presenti meccanismi applicativi di account o autenticazione. Il controllo per un ingresso non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Assenza di account e autenticazione applicativa nell'MVP](../Requirements/ServerFoundation.md#assenza-di-account-e-autenticazione-applicativa-nellmvp)
---

### Controllo dell'esclusione delle configurazioni effettive

Per ciascun file di configurazione locale effettivo presente, esaminare i file tracciati da Git, le regole di esclusione e il contenuto dell'immagine container costruita per il server.

#### Details
Il controllo passa se nessun file effettivo è tracciato in Git o incluso nell'immagine e il deployment lo fornisce dall'esterno. Fallisce se un file effettivo è presente nei file versionati o nell'immagine. Il controllo dell'immagine resta da eseguire quando la distribuzione container viene introdotta.

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

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Implementazione Fastify dell'API HTTP](../Requirements/ServerFoundation.md#implementazione-fastify-dellapi-http)
---

### Ispezione dei nomi secondo le responsabilità

#### Details
Partire dall'elenco completo dei file di produzione, dalle porte Application e dai punti di ingresso; non limitare la ricerca ai nomi che contengono già `.adapter` o `.use-case`. Per ciascun componente interessato registrare percorso, responsabilità, eventuale porta implementata o caso d'uso invocato, classificazione e nome atteso.

L'ispezione passa se tutti i casi d'uso hanno il suffisso `.use-case.ts`, tutti gli adapter di ingresso e di uscita hanno il suffisso `.adapter.ts` e i file di supporto non sono classificati come adapter soltanto per la cartella che li contiene. Considerare anche le implementazioni strutturali di porte a oggetto o callable; non affidarsi al solo `implements`. I ruoli ambigui devono essere risolti con motivazione documentata. L'ispezione fallisce se manca un suffisso richiesto o se un suffisso descrive un ruolo non realizzato.

Per ogni rinomina controllare import, export pubblici, riferimenti nei test e collegamenti Reqvire. La compilazione e i test pertinenti devono continuare a passare. Registrare revisione Git esaminata, elenco dei file classificati, difetti ed esito; la presenza di una relazione `satisfiedBy` e il successo di `validate` o `lint` non sostituiscono questa ispezione.

#### Esito dell'ispezione del 17 ottobre 2026
Esito: PASS sulla revisione `08424266a5b2d23cc06d4805022a91f264742dec`, che introduce l'orchestratore selettore, l'agente che ha risposto, gli agenti senza MCP e il tempo massimo della produzione della risposta. Inventario di 47 file TypeScript di produzione: rispetto alla revisione `8d8b0a7911040d21819c73cb604ce17c1d903264`, già ispezionata nella sua interezza, `git diff --name-status` riporta un solo file aggiunto, `system-deadlines.adapter.ts`, nessun file rinominato o rimosso e 17 file modificati; i 17 file modificati e quello aggiunto sono stati riesaminati per responsabilità e porte, gli altri 29 sono identici alla revisione già ispezionata. Nessuna non conformità di naming nel perimetro esaminato. Sostituisce l'esito precedente dello stesso giorno sulla revisione `8d8b0a7911040d21819c73cb604ce17c1d903264`, quello sulla revisione `fe2d78fe6e5058ee40c59ddc082c46de099159fc` e quello del 16 ottobre 2026 sulla revisione base `512317c9e93b4e6ab7a1e32dd9c210436b7b5c06`.

Identificazione riproducibile dei sorgenti esaminati: SHA-256 `aae90d67994319586b6b3d19d70ac4e5b63585e01927e6d2b09b0f579cb1c829`, calcolato concatenando, in ordine lessicografico, percorso relativo UTF-8, byte NUL, contenuto del file, byte NUL, per tutti i file dell'inventario. Il risultato riguarda questo stato del worktree, non attesta modifiche successive.

Classificazioni dei file introdotti: `conversation-session.adapter.ts` traduce i messaggi del protocollo in invocazioni del caso d'uso `exchange-turn` ed è un adapter di ingresso; `session-route.adapter.ts` accetta l'upgrade WebSocket con il controllo di sottoprotocollo e origine e consegna il socket all'adapter di sessione, nel server che possiede il plugin Fastify WebSocket. `vosk-transcriber.ts` e `sherpa-synthesizer.ts` realizzano le interfacce `Transcriber` e `Synthesizer` dichiarate da `speech-components.ts` per l'adapter di sessione: non sono porte Application, quindi sono driver tecnici senza suffisso; `local-speech-components.ts` li costruisce dalla configurazione validata. `sentences.ts` contiene la regola di separazione delle frasi e la pulizia della marcatura usate dal driver di sintesi. `system-deadlines.adapter.ts` realizza la porta Application `Deadlines`, dichiarata in `turn-capabilities.ts`, con il timer della piattaforma ed è quindi un adapter di uscita con il suffisso richiesto. `ai-sdk-reply.adapter.ts` realizza `ProduceConversationReply` per l'orchestratore selettore, per gli agenti con MCP e per quelli senza MCP; resta un unico adapter di uscita. `protocol-decoder.ts` è un validatore dello schema del protocollo. Rimossi `piper-synthesizer.ts`, `start-voice-conversation.use-case.ts`, `turn-route.adapter.ts`, gli adapter Micdrop, `vosk-streaming-stt.ts`, `voice-route.adapter.ts` e `composition/voice.ts`.

#### Inventario completo
Il percorso in tabella è anche il nome atteso. Classificazione basata su responsabilità, porte e chiamate esaminate; la cartella non determina il ruolo.

| File di produzione e nome atteso | Responsabilità e classificazione | Controllo |
| --- | --- | --- |
| `apps/server/src/adapters/in/session-route.adapter.ts` | Adapter inbound: upgrade WebSocket `/api/session` con controllo di sottoprotocollo e origine → sessione conversazionale. | Suffisso richiesto presente |
| `apps/server/src/composition/agents.ts` | Composition root: costruisce e collega risorse, casi d'uso e adapter. | Nome descrittivo, nessun suffisso richiesto |
| `apps/server/src/composition/conversations.ts` | Composition root: costruisce e collega risorse, casi d'uso e adapter. | Nome descrittivo, nessun suffisso richiesto |
| `apps/server/src/main.ts` | Bootstrap del processo e arresto delle risorse. | Nome descrittivo, nessun suffisso richiesto |
| `apps/server/src/runtime/agent-config.ts` | Supporto bootstrap: caricamento e validazione configurazione. | Nome descrittivo, nessun suffisso richiesto |
| `apps/server/src/runtime/consultation-server.ts` | Runtime: avvio, gestione listener e arresto risorse. | Nome descrittivo, nessun suffisso richiesto |
| `apps/server/src/runtime/conversation-config-path.ts` | Supporto bootstrap: caricamento e validazione configurazione. | Nome descrittivo, nessun suffisso richiesto |
| `apps/server/src/runtime/conversation-server.ts` | Runtime: avvio, gestione listener e arresto risorse. | Nome descrittivo, nessun suffisso richiesto |
| `apps/server/src/runtime/http-config.ts` | Supporto bootstrap: caricamento e validazione configurazione. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/in/http/history-route.adapter.ts` | Adapter inbound: GET storico → get-conversation. | Suffisso richiesto presente |
| `packages/conversations/src/adapters/in/http/http-validation.ts` | Supporto HTTP: validazione e mapping degli errori. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/in/http/list-route.adapter.ts` | Adapter inbound: GET elenco → list-conversations. | Suffisso richiesto presente |
| `packages/conversations/src/adapters/in/session/conversation-session.adapter.ts` | Adapter inbound: messaggi `ambrogio.v1` → exchange-turn; trasmissioni, rifiuti ed esiti. | Suffisso richiesto presente |
| `packages/conversations/src/adapters/in/session/local-speech-components.ts` | Supporto: costruzione di Vosk e sherpa-onnx dalla configurazione vocale. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/in/session/protocol-decoder.ts` | Supporto: validazione Ajv dei messaggi del protocollo. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/in/session/sentences.ts` | Supporto: separazione del testo in frasi e pulizia della marcatura per la sintesi. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/in/session/sherpa-synthesizer.ts` | Driver di sintesi sherpa-onnx usato dall'adapter di sessione; non implementa una porta Application. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/in/session/speech-components.ts` | Tipi dei componenti vocali dell'adapter di sessione; non sono porte Application. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/in/session/vosk-transcriber.ts` | Driver di trascrizione Vosk usato dall'adapter di sessione; non implementa una porta Application. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/out/ai-sdk-reply.adapter.ts` | Adapter outbound: implementa ProduceConversationReply con AI SDK (orchestratore selettore, agenti con e senza MCP). | Suffisso richiesto presente |
| `packages/conversations/src/adapters/out/conversation-config.ts` | Supporto bootstrap: caricamento e validazione configurazione. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/out/mcp-tool-client.ts` | Client tecnico MCP usato dall'adapter AI; non implementa una porta Application. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/out/sqlite/conversation-archive.ts` | Supporto: apertura e ciclo di vita archivio SQLite. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/out/sqlite/migrations.ts` | Supporto: migrazioni del database. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/out/sqlite/recover-pending-turns.ts` | Supporto di startup SQLite: recupero dei turni pendenti. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/out/sqlite/schema.ts` | Supporto: schema e tipi delle tabelle. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/out/sqlite/sqlite-conversation-history-read.adapter.ts` | Adapter outbound: implementa ConversationHistoryRead. | Suffisso richiesto presente |
| `packages/conversations/src/adapters/out/sqlite/sqlite-conversation-list-read.adapter.ts` | Adapter outbound: implementa ConversationListRead. | Suffisso richiesto presente |
| `packages/conversations/src/adapters/out/sqlite/sqlite-conversation-write.adapter.ts` | Adapter outbound: implementa ConversationWrite. | Suffisso richiesto presente |
| `packages/conversations/src/adapters/out/sqlite/sqlite-transaction.ts` | Supporto: transazioni SQLite. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/out/sqlite/sqlite-turn-mapper.ts` | Supporto: mapping righe SQLite ed entità. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/adapters/out/system-current-time.adapter.ts` | Adapter outbound: implementa CurrentTime. | Suffisso richiesto presente |
| `packages/conversations/src/adapters/out/system-deadlines.adapter.ts` | Adapter outbound: implementa Deadlines con il timer della piattaforma. | Suffisso richiesto presente |
| `packages/conversations/src/adapters/out/uuid-identifiers.adapter.ts` | Adapter outbound: implementa NewIdentifier. | Suffisso richiesto presente |
| `packages/conversations/src/adapters/out/voice-config.ts` | Supporto bootstrap: caricamento e validazione configurazione. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/application/begin-turn.use-case.ts` | Caso d'uso: ammissione turno; porte archivio, identificatori e orologio. | Suffisso richiesto presente |
| `packages/conversations/src/application/complete-turn.use-case.ts` | Caso d'uso: completamento turno; porte archivio e orologio. | Suffisso richiesto presente |
| `packages/conversations/src/application/conversation-history-read.ts` | Porta Application e DTO dello storico. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/application/conversation-list-read.ts` | Porta Application e DTO della paginazione. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/application/conversation-write.ts` | Porta Application e valori di ammissione/completamento. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/application/exchange-turn.use-case.ts` | Caso d'uso: scambio turno; coordina ammissione, risposta e completamento. | Suffisso richiesto presente |
| `packages/conversations/src/application/get-conversation.use-case.ts` | Caso d'uso: lettura storico; ConversationHistoryRead. | Suffisso richiesto presente |
| `packages/conversations/src/application/list-conversations.use-case.ts` | Caso d'uso: elenco paginato; ConversationListRead. | Suffisso richiesto presente |
| `packages/conversations/src/application/produce-conversation-reply.ts` | Porta Application per la produzione della risposta. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/application/turn-capabilities.ts` | Porte Application CurrentTime, NewIdentifier e Deadlines. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/domain/turn.ts` | Domain: entità e invarianti del turno. | Nome descrittivo, nessun suffisso richiesto |
| `packages/conversations/src/project-error.ts` | Tipo comune dei guasti e delle cause. | Nome descrittivo, nessun suffisso richiesto |

#### Evidenze eseguite
Sulla revisione `08424266a5b2d23cc06d4805022a91f264742dec`: build e `tsc --noEmit`: PASS. `vitest run` con apertura delle porte locali consentita: 30 file di test, 286 test PASS e 1 saltato (la prova con voce reale, attiva solo con `AMBROGIO_TEST_VOICE_MODEL_DIR`). `node scripts/verify-server-startup.mjs` e la prova Docker `scripts/verify-docker-image.mjs` sull'immagine `ambrogio-server:router-test` (`sha256:63581a4bc70fd2f7269a10ecb4ea1940fa688bd9fc1ad6f98424625754df9991`), con un agente senza MCP: PASS. Non sono state eseguite prove con Vosk reale, con Mistral reale né su hardware.

Riesaminati import relativi, export dei subpath del package, compreso il nuovo `./adapters/out/system-deadlines`, riferimenti dei test e collegamenti del modello. Questa ispezione attesta la convenzione dei nomi e la regressione software pertinente; non sostituisce le dimostrazioni su hardware o la validazione generale del prodotto.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Nomi dei file secondo il ruolo architetturale](../Requirements/ServerFoundation.md#nomi-dei-file-secondo-il-ruolo-architetturale)
---

### Ispezione del limite dei corpi HTTP

Esaminare le rotte HTTP registrate dal server e la configurazione del limite dei corpi del componente HTTP. Per ogni rotta che accetta un corpo, quando esisterà, inviare corpi sotto e sopra il limite dichiarato, includendo un invio in più parti oltre il limite.

#### Details
L'ispezione passa se nessuna rotta HTTP accetta un corpo senza un limite positivo esplicito e se le rotte attuali di elenco e storico non accettano corpo. Per una futura rotta con corpo, i corpi oltre il limite ricevono `413` con JSON `error` sicuro e non avviano l'operazione. I limiti dei turni appartengono al protocollo conversazionale e sono verificati separatamente. Fallisce se una rotta accetta un corpo senza limite o se il limite dipende solo da `Content-Length`.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Limite dei corpi delle richieste HTTP](../Requirements/ServerFoundation.md#limite-dei-corpi-delle-richieste-http)
---

### Prova degli header di cache conversazionali

Richiedere elenco e storico, anche in casi di errore; osservare gli header delle risposte.

#### Details
La prova passa se tutte le risposte HTTP che trasportano dati conversazionali includono `Cache-Control: no-store`, anche quando segnalano un errore. Fallisce se una risposta pertinente ne è priva. I messaggi del canale conversazionale WebSocket non rientrano in questa prova.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [http-history-route.test.ts](../../packages/conversations/test/adapters/in/http-history-route.test.ts)
  * satisfiedBy: [http-list-route.test.ts](../../packages/conversations/test/adapters/in/http-list-route.test.ts)
  * verify: [Esclusione dalla cache delle risposte conversazionali HTTP](../Requirements/ServerFoundation.md#esclusione-dalla-cache-delle-risposte-conversazionali-http)
---

### Prova del bootstrap delle configurazioni JSON

Avviare l'ingresso HTTP con file JSON di prova distinti per i componenti attivi; predisporre variabili d'ambiente con valori discordanti e un file vocale mancante quando la voce è disabilitata. Osservare letture dei file, valori ricevuti dai componenti e momento in cui vengono create e attivate le risorse. Ripetere con un JSON richiesto mancante, malformato o con un valore non valido, includendo un segreto marcatore.

#### Details
La prova passa se ciascun processo legge una volta all'avvio i soli file necessari, usa i valori validati dei JSON senza sovrascriverli con quelli d'ambiente e consegna a ogni componente solo i dati pertinenti già convertiti. L'assenza del file vocale non blocca gli ingressi quando la voce è disabilitata. Un file necessario mancante o invalido impedisce l'attivazione prima dell'uso delle risorse dipendenti e produce un errore sicuro senza riprodurre il segreto. Domain e casi d'uso non leggono direttamente file o ambiente. Fallisce se un valore d'ambiente prevale, un file non necessario diventa obbligatorio, la configurazione viene riletta durante il lavoro, una risorsa dipendente si attiva prima della validazione o un segreto appare nell'errore. La prova resta da eseguire quando i componenti esistono.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [agent-config.test.ts](../../apps/server/test/runtime/agent-config.test.ts)
  * satisfiedBy: [config-bootstrap.test.ts](../../apps/server/test/runtime/config-bootstrap.test.ts)
  * satisfiedBy: [conversation-config.test.ts](../../packages/conversations/test/adapters/out/conversation-config.test.ts)
  * verify: [Caricamento iniziale dei JSON di configurazione](../Requirements/ServerFoundation.md#caricamento-iniziale-dei-json-di-configurazione)
  * verify: [Distribuzione mirata della configurazione validata](../Requirements/ServerFoundation.md#distribuzione-mirata-della-configurazione-validata)
  * verify: [Validazione preventiva della configurazione attiva](../Requirements/ServerFoundation.md#validazione-preventiva-della-configurazione-attiva)
---

### Prova del controllo di accesso dell'installazione

Per ogni installazione dell'MVP da verificare, ispezionare la configurazione di rete e dell'eventuale reverse proxy; tentare l'accesso agli ingressi del server da un client ammesso e da un client non ammesso dall'installatore.

#### Details
La prova passa se il client ammesso può raggiungere l'ingresso previsto e il client non ammesso non può raggiungere l'applicazione attraverso la rete o il proxy. Fallisce se un client non ammesso può usare l'ingresso. La prova richiede l'installazione concreta: la validazione del repository non certifica le configurazioni degli installatori. Il 18 ottobre 2026 la verifica è stata riclassificata da test a dimostrazione, perché si svolge su un'installazione reale e non può avere un test automatico nel repository; non è ancora stata eseguita.

#### Metadata
  * type: demonstration-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Controllo dell'accesso nell'installazione](../Requirements/ServerFoundation.md#controllo-dellaccesso-nellinstallazione)
---

### Prova del profilo globale degli header HTTP

Avviare l'API con il plugin registrato sulla radice e richiedere una risposta conversazionale riuscita, un errore gestito e una rotta inesistente. Ispezionare configurazione del plugin e header delle risposte.

#### Details
La prova passa se `@fastify/helmet` è registrato globalmente e le tre risposte portano gli header applicabili del profilo adottato, salvo differenze motivate e dichiarate. Fallisce se il plugin è limitato a un sottoinsieme di rotte, se un errore o un `404` non riceve il profilo, oppure se una deroga non è motivata. Da eseguire quando l'API HTTP è implementata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * verify: [Header di sicurezza sulle risposte HTTP](../Requirements/ServerFoundation.md#header-di-sicurezza-sulle-risposte-http)
---

### Prova del runner Vitest del backend

Esaminare gli script dei package e dell'app server che eseguono la suite automatica del backend; avviarli con il runner configurato e acquisire il report delle verifiche disponibili.

#### Details
La prova passa se gli script eseguono i test backend tramite Vitest e il runner produce un report dei test avviati. Fallisce se la suite backend usa un runner diverso o non può essere avviata tramite Vitest. La prova resta da eseguire quando esistono test implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [package.json](../../package.json)
  * verify: [Vitest come runner del backend](../Requirements/ServerFoundation.md#vitest-come-runner-del-backend)
---

### Prova dell'immagine Docker indipendente da Compose

Costruire l'immagine Docker del server a partire dagli artefatti del progetto e avviarla con il solo runtime Docker, fornendo dall'esterno i file di configurazione di prova; verificare l'avvio e una richiesta a un ingresso HTTP presente. Esaminare l'eventuale file Compose per accertare che sia un esempio di avvio e non un prerequisito della build o dell'esecuzione.

#### Details
La prova passa se il progetto produce un'immagine eseguibile, il server si avvia e risponde usando l'immagine senza Docker Compose e nessuna fase indispensabile richiede Compose. Fallisce se l'immagine manca, non è eseguibile oppure l'avvio dipende da Compose. La prova resta da eseguire quando gli artefatti di distribuzione e l'ingresso HTTP sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * verify: [Distribuzione del server come immagine Docker](../Requirements/ServerFoundation.md#distribuzione-del-server-come-immagine-docker)
  * verify: [Esecuzione del server senza Docker Compose](../Requirements/ServerFoundation.md#esecuzione-del-server-senza-docker-compose)
---

### Prova dell'origine delle credenziali API

Per ogni componente del server che usa un'API esterna, predisporre un file JSON locale di prova con credenziali fittizie distinguibili, avviare il componente con un client API controllato e osservare le credenziali fornite al client. Esaminare il percorso di caricamento della configurazione.

#### Details
La prova passa se le credenziali fornite al client corrispondono a quelle del file JSON dedicato al componente e il codice le ottiene da quel file. Fallisce se il componente usa credenziali incorporate nel codice o ricavate da un'altra sorgente al posto del proprio JSON. La prova per un componente non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [api-credentials.test.ts](../../apps/server/test/composition/api-credentials.test.ts)
  * verify: [Credenziali API nel JSON del componente](../Requirements/ServerFoundation.md#credenziali-api-nel-json-del-componente)
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
La prova passa se HSTS è assente quando la configurazione pubblica è HTTP o non dichiarata ed è presente con durata positiva quando è HTTPS, indipendentemente dal protocollo interno o dal valore di `X-Forwarded-Proto`. Fallisce se un header della richiesta attiva HSTS da solo o se la politica è assente in un deployment HTTPS dichiarato. Da eseguire quando l'API HTTP è implementata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * verify: [HSTS legato all'HTTPS pubblico](../Requirements/ServerFoundation.md#hsts-legato-allhttps-pubblico)
---

### Prova della configurazione esplicita del listener HTTP

Fornire al processo file JSON HTTP con `host` e `port` validi, poi omettere separatamente ciascun campo e provare valori di tipo o intervallo invalidi; provare anche variabile di percorso mancante, file assente e JSON malformato. Verificare l'indirizzo e la porta effettivamente ascoltati nel caso valido e l'assenza di listener nei casi invalidi.

#### Details
La prova passa se il processo ascolta solo all'indirizzo e alla porta espliciti validati, senza valori predefiniti, e non apre né attiva l'ingresso per configurazioni mancanti o invalide. Fallisce se usa valori d'ambiente per sostituire campi JSON o un valore implicito per host o porta.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * verify: [Configurazione esplicita dell'ascolto HTTP](../Requirements/ServerFoundation.md#configurazione-esplicita-dellascolto-http)
---

### Prova delle origini CORS dell'API HTTP

Avviare l'API con elenco di origini assente, poi con un'origine esplicitamente ammessa. Inviare richieste ordinarie e preflight da origine ammessa e non ammessa.

#### Details
La prova passa se, senza elenco, nessuna risposta autorizza CORS; con l'elenco, solo l'origine ammessa riceve gli header di autorizzazione pertinenti e nessuna risposta usa wildcard o riflette l'origine non ammessa. Fallisce se una delle richieste non ammesse ottiene autorizzazione CORS. Da eseguire quando l'API HTTP è implementata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [consultation-server.test.ts](../../apps/server/test/runtime/consultation-server.test.ts)
  * verify: [Origini CORS esplicite dell'API HTTP](../Requirements/ServerFoundation.md#origini-cors-esplicite-dellapi-http)
---

### Prova delle voci incluse e sostituibili

Costruire l'immagine backend, ispezionare le directory delle voci Riccardo x_low e Paola medium e sintetizzare una breve frase italiana con ciascuna usando sherpa-onnx nel Node dell'immagine. Verificare che l'immagine non contenga l'ambiente Python né il binario Piper. Avviare inoltre un container con una directory di prova montata in sola lettura su `/opt/ambrogio/voices` e osservare che il mount sostituisce il contenuto incluso.

#### Details
La prova passa se entrambe le directory contengono modello, `tokens.txt`, `espeak-ng-data/` e note di provenienza, sherpa-onnx produce audio non vuoto alla frequenza del modello per entrambe le voci, l'immagine non contiene `/opt/piper` e il mount presenta i file esterni al posto delle voci incluse senza una nuova build. Fallisce se manca una voce, la sintesi fallisce o il mount non sostituisce la directory. La prova non sostituisce l'ascolto umano della qualità delle voci.

Il 17 ottobre 2026, con la precedente sintesi Piper, l'immagine `ambrogio-server:paola-20261017` è stata distribuita sul server dell'installazione di riferimento con Paola medium selezionata e la persona ha confermato il funzionamento della prova vocale con il satellite. Le esecuzioni della prova con sherpa-onnx sono registrate di seguito.

Eseguita il 17 ottobre 2026 sulla revisione `8d8b0a7911040d21819c73cb604ce17c1d903264` con `docker build --tag ambrogio-server:sherpa-test .` e `AMBROGIO_DOCKER_IMAGE=ambrogio-server:sherpa-test node scripts/verify-docker-image.mjs`: impronte SHA-256 degli archivi verificate durante la build, immagine `sha256:f1d39028d6b565d6f52d10540e8bcfdcd400e1e616489ce38f5bc232c1d20927` senza `/opt/piper` né `python3`, sintesi con il codice dell'immagine di 38028 byte a 16000 Hz per Riccardo x_low e 57344 byte a 22050 Hz per Paola medium, mount sostitutivo e HTTP `200`. Non è stata eseguita una prova vocale con Vosk reale e satellite su questa immagine, che non è stata distribuita.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * verify: [Voci italiane incluse nell'immagine](../Requirements/ServerFoundation.md#voci-italiane-incluse-nellimmagine)
---

