# Elements

### Verifica del ciclo di vita del server

Raggruppa le prove dell'interruzione dei turni attivi all'arresto ordinato e della chiusura delle risorse.

#### Metadata
  * type: verification-objective
---

### Prova dell'interruzione dei turni all'arresto

Avviare un turno con elaborazione controllata che resterebbe in corso, richiedere l'arresto del server e tentare un nuovo turno. Osservare la richiesta di interruzione, lo stato persistente del turno, l'ordine di chiusura delle risorse e i messaggi ricevuti dalla sessione del client.

#### Details
La prova passa se il server rifiuta i nuovi turni con `unavailable`, richiede subito l'interruzione di quello attivo senza attendere il completamento della risposta, conserva il turno senza esito come «Interrotto» prima di chiudere l'archivio, invia `turn.interrupted` alla sessione ancora aperta e poi chiude sessioni e risorse. Nessun turno interrotto riceve un esito riuscito o viene riavviato automaticamente. Fallisce se l'arresto attende la risposta controllata, accetta altri turni, perde il turno interrotto o chiude l'archivio prima di registrarlo.

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
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
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
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
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
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
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
La prova passa se per l'`Error` del progetto il campo strutturato `err` conserva in memoria la catena `cause`, i riferimenti e le proprietà degli oggetti originali restano invariati, e la vista JSON include lo stack diagnostico; se ogni vista contiene soltanto campi ammessi; e se errori esterni e valori sconosciuti producono una descrizione costante sicura senza riportare messaggio, stack o proprietà aggiuntive di origine. Fallisce se la serializzazione modifica l'`Error` originale o un oggetto della sua catena `cause`, se l'argomento in memoria perde la catena delle cause, se la riga omette `err` o lo stack previsto, se compaiono campi non ammessi o se la descrizione esterna dipende dal valore originale.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
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
La prova passa se, per ciascun caso e ciascun ingresso presente, il confine emette esattamente un log diagnostico definitivo di livello `error` relativo al guasto. Fallisce se il log manca, ha un livello diverso, è emesso da un componente intermedio o compare più volte.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
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
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
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
La prova passa se nessuno dei marcatori viene acquisito automaticamente dagli eventi e se la configurazione non abilita la registrazione automatica delle sorgenti elencate. Fallisce se un'integrazione o un serializer copia automaticamente una di tali sorgenti nei log.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
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
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
  * satisfiedBy: [http-history-route.test.ts](../../packages/conversations/test/adapters/in/http-history-route.test.ts)
  * satisfiedBy: [http-list-route.test.ts](../../packages/conversations/test/adapters/in/http-list-route.test.ts)
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
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
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
La prova passa se la normalizzazione avviene una sola volta nel confine definitivo: per l'`Error`, `err` è la stessa istanza catturata; per ogni altro valore, `err` è un nuovo `Error` con messaggio diagnostico fisso uguale nei casi provati e `cause` identica al valore catturato. Il valore originale resta invariato e non viene convertito in stringa. Fallisce se un componente intermedio normalizza il guasto, se sono creati wrapper ulteriori, se cambia l'identità dell'`Error` originale o della `cause`, o se il messaggio dipende dal valore catturato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
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
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
  * satisfiedBy: [http-history-route.test.ts](../../packages/conversations/test/adapters/in/http-history-route.test.ts)
  * satisfiedBy: [http-list-route.test.ts](../../packages/conversations/test/adapters/in/http-list-route.test.ts)
  * verify: [Esclusione dei dettagli tecnici dal messaggio pubblico](../Requirements/ServerFoundation.md#esclusione-dei-dettagli-tecnici-dal-messaggio-pubblico)
  * verify: [Separazione del messaggio pubblico dalla diagnosi tecnica](../Requirements/ServerFoundation.md#separazione-del-messaggio-pubblico-dalla-diagnosi-tecnica)
---

### Prova delle definizioni locali di Result

Con l'API del compilatore TypeScript, esaminare tutti i file TypeScript sotto `src/` di ogni package in `packages/`: le dichiarazioni chiamate `Result`, i riferimenti di tipo a `Result` e gli import e le riesportazioni che portano il nome `Result`.

#### Details
La prova passa se ogni package che riferisce `Result` lo dichiara nel proprio `src/` come alias di tipo con i parametri `T` ed `E` il cui testo, a meno degli spazi, è `Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>`, se non esistono altre dichiarazioni chiamate `Result` e se ogni import o riesportazione del nome `Result` usa un percorso relativo verso un file dello stesso package che lo dichiara. Fallisce se il tipo è importato da un altro package o tramite un nome di package, se un ramo è mutabile, se discriminanti o campi differiscono dalla specifica o se un package riferisce `Result` senza dichiararlo.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della distinzione degli esiti applicativi](#verifica-della-distinzione-degli-esiti-applicativi)
  * satisfiedBy: [result-type.test.ts](../../test/repository/result-type.test.ts)
  * verify: [Definizione locale del tipo Result](../Requirements/ServerFoundation.md#definizione-locale-del-tipo-result)
  * verify: [Struttura del tipo Result](../Requirements/ServerFoundation.md#struttura-del-tipo-result)
---

### Verifica della protezione dai segreti

Raggruppa i controlli che impediscono l'ingresso di credenziali nella storia Git del backend, in CI e nei commit locali.

#### Metadata
  * type: verification-objective
---

### Prova dell'hook pre-commit dei segreti

In un repository Git temporaneo che contiene l'hook `.githooks/pre-commit` del repository, con `core.hooksPath` impostato a `.githooks`, mettere in staging un file con un token fittizio nel formato dei token di accesso personali GitHub, costruito durante la prova, e tentare il commit; ripetere con un file privo di segreti; ripetere con un `PATH` che contiene soltanto `git`.

#### Details
La prova passa se il commit con il token è impedito e l'output non mostra il valore, se il commit senza segreti riesce e se, senza `gitleaks` nel `PATH`, il commit è impedito con un messaggio che nomina gitleaks e indica dove ottenerlo. Fallisce se viene creato un commit con il token, se il valore compare nell'output, se il commit senza segreti è impedito, se l'assenza dello scanner lascia passare il commit oppure se `gitleaks` non è disponibile nel `PATH` della prova. La CI installa lo scanner secondo «Profilo di scansione dei segreti con gitleaks» prima della suite Vitest.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della protezione dai segreti](#verifica-della-protezione-dai-segreti)
  * satisfiedBy: [pre-commit-hook.test.ts](../../test/repository/pre-commit-hook.test.ts)
  * verify: [Blocco locale dei commit con segreti](../Requirements/ServerFoundation.md#blocco-locale-dei-commit-con-segreti)
---

### Prova della configurazione della scansione dei segreti in CI

Leggere come testo `.github/workflows/secret-scan.yml` e `.github/workflows/publish-image.yml` e confrontarli con «Profilo di scansione dei segreti con gitleaks».

#### Details
La prova passa se la scansione parte a ogni push su qualunque branch (`'**'`), a ogni pull request, su richiesta manuale e con `workflow_call`; se il checkout dichiara `fetch-depth: 0` e `persist-credentials: false`; se il workflow fissa la versione 8.30.1 e l'impronta SHA-256 del contratto, scarica `gitleaks_8.30.1_linux_x64.tar.gz` dalla release ufficiale e lo verifica con `sha256sum --check --strict` prima di estrarlo; se il job `Scan history for secrets` esegue `gitleaks git --redact --no-banner --exit-code 1 .`; e se il job `publish` dichiara `needs` sul job che richiama `secret-scan.yml`. Fallisce se un evento manca, se la storia è troncata, se versione o impronta differiscono dal contratto, se l'archivio è estratto senza verifica, se il comando differisce o se la pubblicazione non dipende dalla scansione. Che una scansione fallita impedisca l'integrazione è verificato da «Ispezione della protezione del merge».

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della protezione dai segreti](#verifica-della-protezione-dai-segreti)
  * satisfiedBy: [workflows.test.ts](../../test/repository/workflows.test.ts)
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

Esaminare tutti i moduli TypeScript di configurazione d'esempio presenti nel repository e i campi in cui potrebbero comparire credenziali.

#### Details
Il controllo passa se gli esempi non contengono credenziali effettive; eventuali campi dedicati usano soltanto valori dimostrativi non utilizzabili. Fallisce se un esempio contiene una credenziale effettiva.

Non automatizzabile: stabilire che un valore non è una credenziale effettiva richiede giudizio umano; gitleaks riconosce soltanto i formati previsti dalle sue regole.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Esempi di configurazione privi di credenziali](../Requirements/ServerFoundation.md#esempi-di-configurazione-privi-di-credenziali)
---

### Controllo dei file di configurazione dei componenti

Per ogni componente configurabile presente nel server, individuare il file da cui viene caricata la configurazione locale; esaminare il formato e confrontare i percorsi usati dai diversi componenti.

#### Details
Il controllo passa se ogni componente legge un proprio modulo TypeScript e nessun file è condiviso come configurazione locale di componenti distinti. Fallisce se un componente usa un formato diverso da TypeScript o condivide il proprio file di configurazione con un altro componente.

Non automatizzabile: individuare i componenti configurabili e il modulo letto da ciascuno richiede di leggere la composition root.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [File TypeScript separato per componente configurabile](../Requirements/ServerFoundation.md#file-typescript-separato-per-componente-configurabile)
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
  * verify: [Perimetro iniziale dei segnali di osservabilità](../Requirements/ServerFoundation.md#perimetro-iniziale-dei-segnali-di-osservabilità)
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

Per ciascun file di configurazione locale effettivo presente, esaminare i file tracciati da Git, le regole di esclusione e il contenuto dell'immagine container costruita per il server.

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

### Ispezione dei nomi secondo le responsabilità

#### Details
Partire dall'elenco completo dei file di produzione, dalle porte Application e dai punti di ingresso; non limitare la ricerca ai nomi che contengono già `.adapter` o `.use-case`. Per ciascun componente interessato registrare percorso, responsabilità, eventuale porta implementata o caso d'uso invocato, classificazione e nome atteso.

L'ispezione passa se tutti i casi d'uso hanno il suffisso `.use-case.ts`, tutti gli adapter di ingresso e di uscita hanno il suffisso `.adapter.ts` e i file di supporto non sono classificati come adapter soltanto per la cartella che li contiene. Considerare anche le implementazioni strutturali di porte a oggetto o callable; non affidarsi al solo `implements`. I ruoli ambigui devono essere risolti con motivazione documentata. L'ispezione fallisce se manca un suffisso richiesto o se un suffisso descrive un ruolo non realizzato.

Per ogni rinomina controllare import, export pubblici, riferimenti nei test e collegamenti Reqvire. La compilazione e i test pertinenti devono continuare a passare. L'elenco dei file classificati, i difetti e l'esito si riportano nel messaggio del commit o nella pull request che svolge l'ispezione; la presenza di una relazione `satisfiedBy` e il successo di `validate` o `lint` non sostituiscono questa ispezione.

Non automatizzabile: la classificazione dei file per responsabilità richiede giudizio umano, come prescrive la convenzione dei nomi.

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

Non automatizzabile: richiede di stabilire quali rotte accettano un corpo; le rotte attuali non ne accettano, quindi non esiste un corpo da inviare in una prova automatica.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Limite dei corpi delle richieste HTTP](../Requirements/ServerFoundation.md#limite-dei-corpi-delle-richieste-http)
---

### Ispezione della protezione del merge

Leggere con `gh api repos/<proprietario>/<repository>/rulesets` e con il dettaglio del ruleset `main` le regole attive sul branch principale.

#### Details
L'ispezione passa se il ruleset corrisponde al contratto: applicazione attiva sul branch predefinito, nessun attore escluso, integrazione solo tramite pull request, controlli richiesti con i nomi del contratto, riscrittura forzata e cancellazione vietate; e se un push diretto sul branch principale viene rifiutato. Fallisce se il ruleset manca, è disattivato, ha attori esclusi o differisce dal contratto. I controlli richiesti `Backend checks` e `Scan history for secrets` sono i job verificati da «Prova della configurazione della CI del server» e da «Prova della configurazione della scansione dei segreti in CI»: l'ispezione stabilisce che un loro fallimento impedisce l'integrazione. Non automatizzabile: il ruleset è un'impostazione del repository GitHub e non un file del repository, e leggerlo richiede credenziali con accesso amministrativo che la CI non possiede.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * verify: [Controlli CI delle modifiche funzionali del server](../Requirements/ServerFoundation.md#controlli-ci-delle-modifiche-funzionali-del-server)
  * verify: [Controlli obbligatori prima del merge](../Requirements/ServerFoundation.md#controlli-obbligatori-prima-del-merge)
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
  * satisfiedBy: [http-history-route.test.ts](../../packages/conversations/test/adapters/in/http-history-route.test.ts)
  * satisfiedBy: [http-list-route.test.ts](../../packages/conversations/test/adapters/in/http-list-route.test.ts)
  * verify: [Esclusione dalla cache delle risposte conversazionali HTTP](../Requirements/ServerFoundation.md#esclusione-dalla-cache-delle-risposte-conversazionali-http)
---

### Prova del bootstrap delle configurazioni TypeScript

Avviare l'ingresso HTTP con moduli TypeScript di prova distinti per i componenti attivi; fornire valori tramite variabili d'ambiente e omettere il modulo vocale quando la voce è disabilitata. Osservare i valori ricevuti dai componenti e il momento in cui vengono create e attivate le risorse. Ripetere con un modulo richiesto mancante, non importabile o con un valore non valido, includendo un segreto marcatore.

#### Details
La prova passa se ciascun processo importa una volta all'avvio solo i moduli necessari, usa i valori validati anche quando provengono dall'ambiente e consegna a ogni componente solo i dati pertinenti già convertiti. L'assenza del modulo vocale non blocca gli ingressi quando la voce è disabilitata. Un modulo necessario mancante o invalido impedisce l'attivazione prima dell'uso delle risorse dipendenti e produce un errore sicuro senza riprodurre il segreto. Domain e casi d'uso non leggono direttamente file o ambiente. Fallisce se un modulo non necessario diventa obbligatorio, la configurazione viene riletta durante il lavoro, una risorsa dipendente si attiva prima della validazione o un segreto appare nell'errore.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [agent-config.test.ts](../../apps/server/test/runtime/agent-config.test.ts)
  * satisfiedBy: [config-bootstrap.test.ts](../../apps/server/test/runtime/config-bootstrap.test.ts)
  * satisfiedBy: [config-examples.test.ts](../../apps/server/test/runtime/config-examples.test.ts)
  * satisfiedBy: [conversation-config.test.ts](../../packages/conversations/test/adapters/out/conversation-config.test.ts)
  * verify: [Caricamento iniziale delle configurazioni TypeScript](../Requirements/ServerFoundation.md#caricamento-iniziale-delle-configurazioni-typescript)
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
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
  * verify: [Header di sicurezza sulle risposte HTTP](../Requirements/ServerFoundation.md#header-di-sicurezza-sulle-risposte-http)
---

### Prova del runner Vitest del backend

Esaminare gli script dei package e dell'app server che eseguono la suite automatica del backend; avviarli con il runner configurato e acquisire il report delle verifiche disponibili.

#### Details
La prova passa se gli script eseguono i test backend tramite Vitest e il runner produce un report dei test avviati. Fallisce se la suite backend usa un runner diverso o non può essere avviata tramite Vitest.

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
La prova passa se il progetto produce un'immagine eseguibile, il server si avvia e risponde usando l'immagine senza Docker Compose e nessuna fase indispensabile richiede Compose. Fallisce se l'immagine manca, non è eseguibile oppure l'avvio dipende da Compose.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * verify: [Distribuzione del server come immagine Docker](../Requirements/ServerFoundation.md#distribuzione-del-server-come-immagine-docker)
  * verify: [Esecuzione del server senza Docker Compose](../Requirements/ServerFoundation.md#esecuzione-del-server-senza-docker-compose)
---

### Prova dell'irrobustimento dei workflow

Leggere come testo `.github/workflows/ci.yml`, `.github/workflows/secret-scan.yml` e `.github/workflows/publish-image.yml` e confrontare permessi, riferimenti delle action, runner, `timeout-minutes`, opzioni di checkout, uso del `GITHUB_TOKEN`, installazione dello scanner dei segreti e richiami `workflow_call` con «Profilo di irrobustimento dei workflow GitHub Actions».

#### Details
La prova passa se ogni workflow dichiara `permissions` con il solo `contents: read`; se soltanto il job `publish` dichiara permessi propri, `contents: read` e `packages: write`; se ogni `uses` di un passo indica un'action esterna con un'impronta di 40 caratteri esadecimali seguita dal commento della versione e `actions/checkout` e `actions/setup-node` usano le impronte del contratto; se ogni job con passi usa `ubuntu-24.04` e dichiara `timeout-minutes` 20 per `checks`, 10 per `gitleaks` e 60 per `publish`; se ogni passo `actions/checkout` imposta `persist-credentials: false`; se `secrets.GITHUB_TOKEN` compare soltanto nell'`env` del passo di login al registro; se i job `checks` e `gitleaks` installano gitleaks con la stessa versione e la stessa impronta verificata; e se `ci.yml` e `secret-scan.yml` dichiarano `workflow_call` e `publish-image.yml` li richiama come job `checks` e `secret-scan`, da cui il job `publish` dipende con `needs`. Fallisce se un job riceve permessi non previsti, se un'action è indicata con un tag o un branch, se un job non ha il limite di durata del contratto, se un checkout conserva le credenziali o se la pubblicazione duplica i controlli invece di richiamarli.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [workflows.test.ts](../../test/repository/workflows.test.ts)
  * verify: [Irrobustimento dei workflow GitHub Actions](../Requirements/ServerFoundation.md#irrobustimento-dei-workflow-github-actions)
---

### Prova dell'origine delle credenziali API

Per ogni componente del server che usa un'API esterna, predisporre un modulo TypeScript locale di prova con credenziali fittizie distinguibili, avviare il componente con un client API controllato e osservare le credenziali fornite al client. Esaminare il percorso di caricamento della configurazione.

#### Details
La prova passa se le credenziali fornite al client corrispondono a quelle del modulo TypeScript dedicato al componente e il codice le ottiene da quel file. Fallisce se il componente usa credenziali incorporate nel codice o ricavate da un'altra sorgente al posto del proprio modulo TypeScript.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [api-credentials.test.ts](../../apps/server/test/composition/api-credentials.test.ts)
  * verify: [Credenziali API nel modulo TypeScript del componente](../Requirements/ServerFoundation.md#credenziali-api-nel-modulo-typescript-del-componente)
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
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
  * verify: [HSTS legato all'HTTPS pubblico](../Requirements/ServerFoundation.md#hsts-legato-allhttps-pubblico)
---

### Prova della configurazione della CI del server

Leggere come testo `.github/workflows/ci.yml` e i file di prova dei package sotto `packages/`.

#### Details
La prova passa se il workflow parte a ogni push su `main`, a ogni pull request, su richiesta manuale e con `workflow_call`; se il job `Backend checks` esegue `pnpm install --frozen-lockfile`, `validate` di Reqvire 1.3.2, `lint --json` di Reqvire 1.3.2 con il controllo `jq -e` che le liste `auto_fixable` e `needs_manual_review` siano vuote, `node scripts/check-model.mjs`, `pnpm typecheck`, `pnpm build` e `pnpm test`, con l'installazione dipendenze per prima e con `pnpm build` e l'installazione verificata di gitleaks prima di `pnpm test`; se nessun passo o job dichiara `continue-on-error`; e se ogni file di prova che importa un adapter di persistenza di `src/adapters/out/sqlite/` importa anche `better-sqlite3`, così da esercitare un database SQLite reale. Fallisce se manca un evento o una fase, se l'ordine richiesto non è rispettato, se un fallimento è tollerato o se una prova di un adapter SQLite non usa il driver reale. Che un controllo fallito impedisca l'integrazione è verificato da «Ispezione della protezione del merge».

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [workflows.test.ts](../../test/repository/workflows.test.ts)
  * verify: [Controlli CI delle modifiche funzionali del server](../Requirements/ServerFoundation.md#controlli-ci-delle-modifiche-funzionali-del-server)
---

### Prova della configurazione esplicita del listener HTTP

Fornire al processo modulo TypeScript HTTP con `host` e `port` validi, poi omettere separatamente ciascun campo e provare valori di tipo o intervallo invalidi; provare anche variabile di percorso mancante, file assente e modulo TypeScript non importabile. Verificare l'indirizzo e la porta effettivamente ascoltati nel caso valido e l'assenza di listener nei casi invalidi.

#### Details
La prova passa se il processo ascolta solo all'indirizzo e alla porta espliciti validati, senza valori predefiniti, e non apre né attiva l'ingresso per configurazioni mancanti o invalide. Fallisce se usa valori non validati per host o porta o un valore implicito per host o porta.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
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
  * satisfiedBy: [http-server.test.ts](../../apps/server/test/runtime/http-server.test.ts)
  * verify: [Origini CORS esplicite dell'API HTTP](../Requirements/ServerFoundation.md#origini-cors-esplicite-dellapi-http)
---

### Prova delle voci incluse e sostituibili

Con `scripts/verify-docker-image.mjs`, costruire l'immagine backend oppure usare quella indicata da `AMBROGIO_DOCKER_IMAGE`, ispezionare le directory delle voci Piper incluse `vits-piper-it_IT-riccardo-x_low`, `vits-piper-it_IT-paola-medium` e `vits-piper-en_US-kristin-medium` e sintetizzare una breve frase con ciascuna usando il codice di sintesi dell'immagine. Verificare che l'immagine non contenga `python3` né `/opt/piper`. Avviare un container con una directory di prova montata in sola lettura su `/opt/ambrogio/voices` e osservare che il mount sostituisce il contenuto incluso; selezionare inoltre una voce italiana montata in un percorso distinto tramite un profilo vocale.

#### Details
La prova passa se ogni directory contiene un solo modello `.onnx`, `tokens.txt`, `espeak-ng-data/` e `MODEL_CARD`, `/opt/ambrogio/voices/README.md` è presente, la sintesi produce audio non vuoto alla frequenza del modello per ogni voce, l'immagine non contiene `python3` né `/opt/piper`, il mount su `/opt/ambrogio/voices` presenta i file esterni al posto delle voci incluse senza una nuova build e la voce montata in un percorso distinto viene selezionata e caricata. Fallisce se manca una voce, la sintesi fallisce o il mount non sostituisce la directory. La prova non sostituisce l'ascolto umano della qualità delle voci.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello stack del server](#verifica-dello-stack-del-server)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * verify: [Directory delle voci sostituibile nell'immagine](../Requirements/ServerFoundation.md#directory-delle-voci-sostituibile-nellimmagine)
---
