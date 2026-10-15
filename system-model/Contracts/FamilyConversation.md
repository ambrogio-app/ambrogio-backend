# Elements

### Archivio SQLite con Kysely

Le conversazioni e i loro scambi testuali sono conservati in un database SQLite dell'installazione. Le operazioni applicative di lettura e scrittura dell'archivio usano Kysely. La scelta riguarda l'archivio delle conversazioni; non prescrive lo stack degli altri componenti del monorepo.

#### Metadata
  * type: specification

#### Relations
  * define: [Disponibilità dello storico dopo riavvio](../Requirements/FamilyConversation.md#disponibilità-dello-storico-dopo-riavvio)
---

### Avvio con migrazioni dell'archivio conversazioni

Prima di attivare gli ingressi conversazionali, il server confronta lo schema SQLite dell'archivio con le migrazioni versionate richieste dalla versione avviata e applica in ordine quelle pendenti tramite Kysely. Se una migrazione non riesce, il server non accetta turni e rende osservabile il guasto al confine tecnico. Le conversazioni e gli scambi già conservati restano dati da preservare durante l'evoluzione dello schema.

#### Metadata
  * type: specification

#### Relations
  * define: [Migrazione automatica dell'archivio delle conversazioni](../Requirements/FamilyConversation.md#migrazione-automatica-dellarchivio-delle-conversazioni)
---

### Ciclo di vita della risorsa SQLite conversazionale

La composition root del server costruisce e possiede una risorsa SQLite/Kysely condivisa dagli adapter interessati. Gli adapter ricevono l'accesso necessario per le proprie operazioni e non ne controllano la chiusura; Domain e Application non ricevono handle tecnici SQLite o Kysely. Prima di abilitare il lavoro che dipende dall'archivio, il proprietario ne verifica l'apertura e completa le migrazioni richieste. Se la preparazione fallisce, chiude la risorsa già creata. Al termine del processo, la chiude dopo il completamento o l'interruzione delle operazioni che la usano. Non si prescrive un pool PostgreSQL né un numero di connessioni fisiche SQLite.

#### Metadata
  * type: specification

#### Relations
  * define: [Proprietà della risorsa SQLite conversazionale](../Requirements/FamilyConversation.md#proprietà-della-risorsa-sqlite-conversazionale)
---

### Configurazione facoltativa dell'interazione vocale

Un'installazione può non abilitare l'ingresso vocale. In tal caso la configurazione richiesta soltanto dai componenti vocali può essere assente e la composition root non costruisce né avvia tali componenti. La chat testuale HTTP resta utilizzabile con le proprie dipendenze. Quando la voce è abilitata, i suoi componenti sono configurati e avviati secondo i requisiti dell'interazione vocale.

#### Metadata
  * type: specification

#### Relations
  * define: [Ingressi testuali indipendenti dalla voce](../Requirements/FamilyConversation.md#ingressi-testuali-indipendenti-dalla-voce)
---

### Confine di conversione dell'archivio conversazioni

I tipi delle righe SQLite/Kysely restano nell'adapter di persistenza. L'adapter traduce i valori ricevuti dal contratto di scrittura in dati persistenti e ricostruisce dai dati letti i valori Domain richiesti per i comandi oppure le proiezioni Application richieste per storico ed elenco. Le conversioni preservano identità, ordine dei turni, stato ed esito, testo originale e distinzione tra valore assente e presente. L'adapter tratta dati persistenti incompatibili con il contratto corrente come un guasto osservabile, senza correggerli implicitamente. Le conversioni sono esplicite al confine logico pertinente; non è imposto un file mapper per ogni tipo né un mapper bidirezionale universale.

#### Metadata
  * type: specification

#### Relations
  * define: [Conversione esplicita dei dati conversazionali persistenti](../Requirements/FamilyConversation.md#conversione-esplicita-dei-dati-conversazionali-persistenti)
---

### Confini atomici dell'archivio conversazioni

Application richiede all'archivio la persistenza delle transizioni complete del turno tramite un contratto dedicato; questo può esporre il salvataggio della conversazione come aggregato o operazioni di transizione esplicite. L'adapter SQLite/Kysely controlla la transazione breve. L'ammissione registra insieme il turno accettato e l'occupazione dell'installazione. La conclusione o l'interruzione registrano insieme l'esito persistente del turno e la liberazione dell'occupazione, salvo l'arresto che impedisce nuovi ingressi. Un errore in una delle scritture della transizione annulla l'intera transazione; il chiamante osserva il successo solo dopo il commit. Le chiamate ad agenti e connettori e l'invio progressivo della risposta avvengono fuori da transazioni SQLite; `done` viene emesso solo dopo il commit dell'esito riuscito. Non è richiesto un coordinatore generico di transazioni esposto ai casi d'uso.

#### Metadata
  * type: specification

#### Relations
  * define: [Scritture atomiche dello stato dei turni](../Requirements/FamilyConversation.md#scritture-atomiche-dello-stato-dei-turni)
---

### Dati dei casi d'uso indipendenti dagli ingressi

Il caso d'uso del turno conversazionale riceve un input Application costruito dall'adapter di ingresso a partire dai dati già decodificati. I suoi dati di successo, compresi gli eventuali incrementi della risposta progressiva, hanno significato proprio del modulo e non sono oggetti HTTP, eventi SSE, righe di terminale o dati audio. Ogni adapter di ingresso converte tali valori nella rappresentazione richiesta dal proprio protocollo; il caso d'uso non restituisce direttamente oggetti Domain o rappresentazioni del trasporto. Il caso d'uso consegna prima la notifica di ammissione e poi ciascun incremento nell'ordine di produzione, attendendo che la consegna di una notifica sia terminata prima di iniziare la successiva. Tale attesa riguarda la consegna all'adapter, non la lettura da parte della persona. Se la consegna fallisce dopo l'ammissione, anche per un guasto tecnico diverso dalla disconnessione, il caso d'uso continua il turno e conserva l'esito prodotto senza trasformare il solo guasto di consegna in un errore conversazionale. L'adapter che esegue la consegna distingue la disconnessione dal guasto tecnico e registra quest'ultimo nel canale diagnostico prima che il caso d'uso ignori il fallimento della notifica; non delega al caso d'uso la classificazione o il log. La normale disconnessione del client non richiede di per sé un log di errore. Gli altri casi d'uso del modulo seguono lo stesso confine quando ricevono input o producono dati di successo.

#### Metadata
  * type: input-output

#### Relations
  * define: [Dati Application dei casi d'uso conversazionali](../Requirements/FamilyConversation.md#dati-application-dei-casi-duso-conversazionali)
---

### Dati della richiesta del turno della chat testuale

La richiesta HTTP `POST /api/conversations/turns` della chat testuale usa `Content-Type: application/json` e un corpo JSON di al massimo 64 KiB (65 536 byte) con `text`, stringa che contiene il nuovo turno testuale, e `conversationId`, stringa presente quando si prosegue una conversazione conservata e assente quando se ne avvia una nuova. Il valore di `text`, eliminati gli spazi bianchi iniziali e finali per la sola verifica di validità, deve contenere almeno un carattere. Il corpo non contiene gli scambi precedenti: lo storico è recuperato dal backend dall'archivio delle conversazioni.

#### Metadata
  * type: input-output

#### Relations
  * define: [Invio HTTP del turno della chat testuale](../Requirements/FamilyConversation.md#invio-http-del-turno-della-chat-testuale)
---

### Esclusione dell'audio persistente

L'audio acquisito dalla famiglia e quello generato per la risposta possono essere trattati durante l'interazione, ma non fanno parte dello stato persistente della conversazione. Nessuna registrazione audio del turno o della risposta viene conservata.

#### Metadata
  * type: constraint

#### Relations
  * define: [Conservazione solo testuale della conversazione](../Requirements/FamilyConversation.md#conservazione-solo-testuale-della-conversazione)
---

### Esito della trascrizione vocale

Una trascrizione è utilizzabile quando il testo restituito, eliminati gli spazi iniziali e finali, contiene almeno un carattere. Un errore del servizio di trascrizione o un testo vuoto dopo tale normalizzazione costituisce trascrizione non riuscita. Il tentativo non genera uno scambio nello storico.

#### Metadata
  * type: behavior

#### Relations
  * define: [Trascrizione vocale non riuscita](../Requirements/FamilyConversation.md#trascrizione-vocale-non-riuscita)
---

### Guasto dello storico dopo ammissione

Se la lettura dello storico fallisce oppure non restituisce il turno appena ammesso come ancora in elaborazione, il caso d'uso non avvia la produzione della risposta e tenta una sola conclusione con esito `errore` e messaggio pubblico sicuro. Il successo di tale conclusione conserva l'errore e libera l'occupazione nella stessa transazione. Se la conclusione non viene conservata, il guasto raggiunge il confine tecnico del server; il server non abilita ulteriori ingressi conversazionali fino al riavvio. Un eventuale turno rimasto `in elaborazione` segue il recupero già previsto al riavvio. Non si ripete automaticamente il turno né la conclusione.

#### Metadata
  * type: behavior

#### Relations
  * define: [Gestione del turno ammesso senza storico utilizzabile](../Requirements/FamilyConversation.md#gestione-del-turno-ammesso-senza-storico-utilizzabile)
---

### Identità di conversazioni e turni

Ogni nuova conversazione e ogni nuovo turno ricevono un UUID versione 4. Il caso d'uso Application ottiene il valore da una porta di generazione fornita dalla composition root e lo consegna al Domain prima di costruire il nuovo stato; l'implementazione tecnica del generatore resta fuori da Domain e Application. L'adapter SQLite conserva gli identificativi senza sostituirli e impone l'unicità persistente. Il `conversationId` comunicato alla chat e riusato nelle richieste rappresenta lo stesso UUID v4 della conversazione conservata. L'ordinamento delle conversazioni non deriva dagli UUID ma dall'ultima attività definita nel relativo contratto. Non è prescritta una classe specifica per rappresentare gli identificativi nel Domain.

#### Metadata
  * type: specification

#### Relations
  * define: [Identificativi UUID v4 di conversazioni e turni](../Requirements/FamilyConversation.md#identificativi-uuid-v4-di-conversazioni-e-turni)
---

### Invarianti dello stato del turno

Un turno nuovo accettato entra nello stato `in elaborazione` con identità e testo originario. Da `in elaborazione` può passare una sola volta a un esito concluso con risposta, a un esito concluso con errore oppure a `interrotto`. Gli stati conclusi e `interrotto` sono terminali; un risultato tardivo non li sostituisce. Una transizione rifiutata non cambia lo stato Domain. La ricostruzione dai dati persistenti convalida lo stato corrente senza rieseguire le transizioni storiche. L'invariante globale di un solo turno attivo nell'installazione resta garantita dall'ammissione atomica dell'archivio, poiché non appartiene a una singola conversazione. Il contratto non prescrive classi, una dimensione fissa dell'aggregato o un particolare metodo di persistenza.

#### Metadata
  * type: state

#### Relations
  * define: [Integrità dello stato del turno nel Domain](../Requirements/FamilyConversation.md#integrità-dello-stato-del-turno-nel-domain)
---

### Istanti SQLite in millisecondi Unix

Le colonne temporali della conversazione conservano interi di millisecondi dall'epoca Unix (`1970-01-01T00:00:00Z`). L'adapter di persistenza scrive `date.getTime()` da un `Date` valido e, alla lettura, accetta soltanto un intero che ricostruisce un `Date` valido con lo stesso valore `getTime()`. Un valore assente, non intero, fuori dall'intervallo rappresentabile da `Date` o di tipo incompatibile è un dato persistente invalido e produce un guasto osservabile, senza sostituirlo con l'ora corrente né arrotondarlo. Le conversioni sono locali all'adapter e conservano gli istanti storici.

#### Metadata
  * type: specification

#### Relations
  * define: [Persistenza degli istanti conversazionali in millisecondi Unix](../Requirements/FamilyConversation.md#persistenza-degli-istanti-conversazionali-in-millisecondi-unix)
---

### Istanti della conversazione e orologio applicativo

La composition root fornisce ai soli casi d'uso che ne hanno bisogno una capacità Application di lettura dell'istante corrente. All'accettazione di un turno, il caso d'uso usa un istante esplicito per il turno e per l'ultima attività della sua conversazione. Domain riceve tale valore come dato e non legge autonomamente l'orologio. La ricostruzione dall'archivio conserva gli istanti storici, senza sostituirli con l'ora del caricamento. L'ordinamento delle conversazioni usa l'ultima attività persistente e non il valore dell'UUID. Gli istanti nello schema SQLite seguono il contratto dedicato ai millisecondi Unix.

#### Metadata
  * type: specification

#### Relations
  * define: [Fornitura esplicita dell'ora corrente alla conversazione](../Requirements/FamilyConversation.md#fornitura-esplicita-dellora-corrente-alla-conversazione)
---

### Lingua nel JSON conversazionale

Il file JSON locale del componente «Conversazioni», già usato per i limiti della paginazione, ammette il campo opzionale `language`, una stringa con `en` per l'inglese o `it` per l'italiano. Se il campo è assente o contiene una lingua non supportata, la lingua effettiva è `en`. Un valore non stringa è una struttura incompatibile e impedisce l'attivazione dell'ingresso interessato. La variabile d'ambiente indica solo il percorso del file e non sostituisce `language`.

#### Metadata
  * type: specification

#### Relations
  * define: [Localizzazione dell'errore conversazionale inatteso](../Requirements/FamilyConversation.md#localizzazione-dellerrore-conversazionale-inatteso)
---

### Messaggio standard del guasto conversazionale

Per un guasto inatteso di un turno già ammesso, il server sceglie il messaggio pubblico secondo `language` nel medesimo file JSON locale del componente «Conversazioni» che configura la paginazione. Le lingue inizialmente supportate sono `en` e `it`; se la lingua non è indicata oppure non è supportata, usa `en`. La formulazione inglese è «I can't complete the response.»; quella italiana è «Non riesco a completare la risposta.». La composition root passa al caso d'uso la formulazione scelta dai valori di configurazione, senza far leggere il file al caso d'uso. Il caso d'uso usa il medesimo testo per l'esito persistente e per la comunicazione al client.

#### Metadata
  * type: input-output

#### Relations
  * define: [Localizzazione dell'errore conversazionale inatteso](../Requirements/FamilyConversation.md#localizzazione-dellerrore-conversazionale-inatteso)
---

### Occupazione dell'installazione e ammissione dei turni

L'ammissione di un turno è coordinata in modo atomico tra gli ingressi HTTP e voce del server. L'installazione è occupata dall'accettazione di un turno fino alla conservazione del suo esito o dello stato `interrotto`; durante l'arresto non torna disponibile per nuovi turni. Tra richieste simultanee, al massimo una ottiene l'ammissione: le altre ricevono un rifiuto previsto e non vengono conservate né accodate. A ogni avvio, dopo le migrazioni e prima di abilitare gli ingressi, tutti i turni ancora `in elaborazione` sono contrassegnati come `interrotti` e l'occupazione residua viene liberata nella stessa transazione SQLite. Solo il server apre l’archivio per elaborare conversazioni; una conclusione tardiva non può sostituire lo stato `interrotto`.

#### Metadata
  * type: specification

#### Relations
  * define: [Rifiuto dei turni concorrenti nell'installazione](../Requirements/FamilyConversation.md#rifiuto-dei-turni-concorrenti-nellinstallazione)
---

### Pagine dell'elenco conversazioni

L'elenco delle conversazioni conservate è restituito in pagine di dimensione limitata. Ogni pagina segue l'ordine decrescente dell'ultima attività della conversazione; a parità di ultima attività usa un criterio stabile e univoco. L'ultima attività corrisponde all'accettazione del turno più recente della conversazione, indipendentemente dall'ingresso testuale o vocale. Ogni richiesta di pagina consulta lo stato corrente dell'archivio, senza mantenere una fotografia fissa tra richieste. Il contratto di continuazione consente di richiedere la pagina successiva senza perdere o duplicare conversazioni quando l'archivio non cambia durante la consultazione; se cambia, un aggiornamento dell'elenco riparte dalla prima pagina. La dimensione della pagina e il massimo ammesso provengono dalla configurazione conversazionale validata. La rappresentazione pubblica del riferimento alla pagina successiva è definita nel contratto HTTP dell'elenco.

#### Metadata
  * type: input-output

#### Relations
  * define: [Elenco paginato delle conversazioni](../Requirements/FamilyConversation.md#elenco-paginato-delle-conversazioni)
---

### Percorso dell'archivio nel JSON Conversazioni

Per l'ingresso HTTP di consultazione, il file JSON del componente «Conversazioni» richiede `archivePath`, stringa non vuota che indica il file SQLite da aprire. Il percorso è letto insieme agli altri campi del componente una sola volta, prima dell'apertura dell'archivio. Il valore non viene sostituito da variabili d'ambiente. Gli ingressi che non richiedono un archivio conservano i propri obblighi di configurazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Selezione dell'archivio conversazionale all'avvio](../Requirements/FamilyConversation.md#selezione-dellarchivio-conversazionale-allavvio)
---

### Profilo dell'ingresso HTTP consultivo

L'ingresso eseguibile di questa tranche registra `GET /api/conversations` e `GET /api/conversations/:conversationId` sugli adapter esistenti. Non registra la rotta di invio dei turni perché non è ancora scelto un produttore concreto delle risposte. Prima di ascoltare, valida i JSON HTTP e Conversazioni, apre l'archivio e recupera i turni pendenti secondo il contratto esistente. All'arresto chiude il listener e l'archivio. Il futuro ingresso che accetterà i turni richiederà il proprio assemblaggio e la verifica dell'interruzione dei turni attivi.

#### Metadata
  * type: specification

#### Relations
  * define: [Avvio consultivo dell'API conversazioni](../Requirements/FamilyConversation.md#avvio-consultivo-dellapi-conversazioni)
---

### Profilo di trasporto SSE della chat

Il client invia il turno della chat testuale con una richiesta HTTP POST. Il backend restituisce il flusso sulla risposta della stessa richiesta, con `Content-Type: text/event-stream` ed eventi nel formato Server-Sent Events codificati in UTF-8. Quando il turno crea una nuova conversazione, il primo evento applicativo del flusso è `event: conversation` e comunica `conversationId`, corrispondente all'identificativo della conversazione conservata, prima di qualsiasi incremento della risposta testuale. Il valore del campo SSE `data` di questo evento è la serializzazione JSON di un oggetto con il campo stringa `conversationId`, per esempio `{"conversationId":"..."}`. Ogni evento che trasporta testo di risposta è `event: delta` e usa nel proprio campo SSE `data` la serializzazione JSON di un oggetto con il campo stringa `text`, contenente soltanto il nuovo frammento; la concatenazione ordinata dei frammenti ricostruisce la risposta testuale. Quando la risposta è prodotta in più incrementi, il backend trasmette gli incrementi disponibili prima del completamento della generazione, senza attendere di disporre dell'intera risposta. Dopo l'ultimo incremento di una risposta completata correttamente, il backend invia un evento con `event: done` e `data: {}`, terminato da una riga vuota secondo il formato SSE, e poi chiude il flusso. `done` segnala il completamento riuscito; la sola chiusura del flusso senza `done` non lo segnala. Se un errore impedisce il completamento dopo l'avvio del flusso, il backend invia `event: error` con `data` contenente la serializzazione JSON di un oggetto con il campo stringa `error` e un messaggio pubblico sicuro, per esempio `{"error":"..."}`; termina l'evento con una riga vuota e chiude il flusso senza `done`. Il messaggio pubblico rispetta l'esclusione dei dettagli tecnici dai messaggi di guasto.

#### Metadata
  * type: input-output

#### Relations
  * define: [Risposta progressiva SSE nella chat testuale](../Requirements/FamilyConversation.md#risposta-progressiva-sse-nella-chat-testuale)
---

### Proprietà dei controlli del turno conversazionale

L'adapter HTTP possiede la verifica della forma dell'input e della decodifica del proprio protocollo: ferma i dati non validi prima del caso d'uso, senza decidere invarianti o precondizioni di business. Application riceve dati già interpretati e coordina le precondizioni che richiedono contesto, per esempio il recupero della conversazione richiesta, tramite porte; un rifiuto previsto ferma il turno prima degli effetti successivi. Domain garantisce gli stati e le transizioni del singolo turno anche se un ingresso ha eseguito controlli preliminari. L'archivio SQLite garantisce atomicamente l'ammissione di al massimo un turno nell'installazione; una lettura o un controllo preliminare non sostituisce tale garanzia. I controlli pubblici aggiuntivi sono ammessi solo se servono al rispettivo confine e non ridefiniscono la regola autorevole di un altro livello.

#### Metadata
  * type: specification

#### Relations
  * define: [Validazione del formato negli ingressi conversazionali](../Requirements/FamilyConversation.md#validazione-del-formato-negli-ingressi-conversazionali)
---

### Responsabilità di Domain Application e adapter

Nel modulo business «Conversazioni», Domain contiene le regole e i tipi del dominio della conversazione; Application contiene i casi d'uso e le porte necessarie per collaborare con componenti esterni; gli adapter realizzano gli ingressi del modulo e le integrazioni tecniche richieste dalle porte. Questa suddivisione riguarda le responsabilità del codice, indipendentemente dai percorsi delle cartelle.

#### Metadata
  * type: specification

#### Relations
  * define: [Separazione delle responsabilità nel modulo Conversazioni](../Requirements/FamilyConversation.md#separazione-delle-responsabilità-nel-modulo-conversazioni)
---

### Risposta HTTP dell'elenco conversazioni

`GET /api/conversations` legge la prima pagina. Il parametro di query opzionale `cursor` richiede la pagina successiva; il parametro opzionale `limit` indica un intero decimale da 1 a `maxListPageSize` incluso. Se `limit` manca, si usa `listPageSize` dal JSON conversazionale. La risposta `200` ha `Content-Type: application/json`, `Cache-Control: no-store` e corpo `{ "items": [{ "id": "...", "lastActivityAt": "..." }], "nextCursor": null }`. `items` segue l'ordine dell'archivio, `lastActivityAt` è una stringa ISO 8601 UTC e `nextCursor` è una stringa quando esiste un'altra pagina, altrimenti `null`.

Il cursore pubblico è opaco per il client: il backend codifica in Base64URL senza padding la rappresentazione JSON UTF-8 della coppia `{ "id": "...", "lastActivityAt": "..." }` dell'ultimo elemento restituito. La data del cursore è una stringa ISO 8601 UTC. Il client riusa il valore senza interpretarlo. A archivio invariato, seguire `nextCursor` restituisce ogni conversazione una volta senza omissioni; dopo un aggiornamento dell'elenco il client riparte senza `cursor`.

Un `cursor` malformato, un `limit` invalido o un parametro di query non previsto produce `400` JSON con il solo campo stringa `error`: «Invalid pagination request.» in inglese o «Richiesta di paginazione non valida.» in italiano. Un guasto tecnico della lettura produce `500` nello stesso formato, con «I can't complete the response.» in inglese o «Non riesco a completare la risposta.» in italiano. Entrambe le risposte usano `Cache-Control: no-store` e non espongono dettagli tecnici; i guasti tecnici sono registrati nella diagnostica del server.

#### Metadata
  * type: input-output

#### Relations
  * define: [Lettura HTTP dell'elenco conversazioni](../Requirements/FamilyConversation.md#lettura-http-dellelenco-conversazioni)
---

### Risposta HTTP dello storico conversazionale

`GET /api/conversations/:conversationId` restituisce uno snapshot della conversazione identificata dal parametro di percorso, senza aprire un flusso SSE, recuperare frammenti di risposta o aggiornare automaticamente la pagina. La risposta riuscita ha stato HTTP `200`, `Content-Type: application/json` e `Cache-Control: no-store`. Il corpo JSON contiene `id`, `createdAt`, `lastActivityAt` e `turns`; `turns` è un array completo, ordinato secondo l'ordine persistente dei turni. Ogni turno contiene `id`, `text`, `acceptedAt` e `status`. I valori temporali sono stringhe ISO 8601 in UTC. `status` vale `pending`, `answered`, `failed` o `interrupted`: `pending` non contiene esito né `finishedAt`; `answered` contiene `answer` e `finishedAt`; `failed` contiene `error` e `finishedAt`; `interrupted` contiene `finishedAt` senza `answer` né `error`. Il testo del turno e degli esiti è quello conservato, senza frammenti parziali non conclusi.

Se la conversazione non esiste, la risposta ha stato `404`; se la lettura fallisce per un guasto tecnico, ha stato `500`. Entrambe sono JSON con il solo campo stringa `error`, un messaggio pubblico sicuro e `Cache-Control: no-store`. Per `404` il messaggio è «Conversation not found.» in inglese o «Conversazione non trovata.» in italiano. Per `500` è «I can't complete the response.» in inglese o «Non riesco a completare la risposta.» in italiano, secondo la lingua configurata. I dettagli tecnici restano nella diagnostica del server.

#### Metadata
  * type: input-output

#### Relations
  * define: [Lettura HTTP dello storico conversazionale](../Requirements/FamilyConversation.md#lettura-http-dello-storico-conversazionale)
---

### Risposta di errore HTTP prima del flusso testuale

Se un errore viene determinato prima dell'invio degli header SSE, il backend risponde alla richiesta POST con uno stato HTTP di errore `4xx` o `5xx` e `Content-Type: application/json`. Il corpo è un oggetto JSON con il campo stringa `error` contenente un messaggio pubblico sicuro, per esempio `{"error":"..."}`. Il messaggio non espone dettagli tecnici del guasto. Questa risposta non usa `text/event-stream` e non contiene eventi SSE. Se `text` è vuoto o contiene soltanto spazi bianchi, il corpo JSON è malformato, contiene campi non previsti o usa tipi diversi da quelli contrattuali, oppure `Content-Type` non è `application/json`, il codice di stato è `400` e il messaggio è «Invalid message.» in inglese oppure «Messaggio non valido.» in italiano; il testo vuoto ha precedenza anche quando è presente un `conversationId` inesistente. Se `text` è valido ma il `conversationId` non identifica una conversazione conservata, il codice di stato è `404` e il messaggio è «Conversation not found.» oppure «Conversazione non trovata.». Se il turno valido è rifiutato perché l'installazione è occupata, il codice di stato è `409` e il messaggio è «Another turn is in progress.» oppure «Un altro turno è in corso.»; il turno non viene conservato né accodato. Se l'archivio rifiuta temporaneamente l'ammissione perché occupato, il codice di stato è `503` e il messaggio è «Service temporarily unavailable.» oppure «Servizio temporaneamente non disponibile.»; il turno non viene conservato né accodato. Se il corpo supera 64 KiB, il codice di stato è `413` e il messaggio è «Request too large.» oppure «Richiesta troppo grande.». Per i messaggi alternativi di questo paragrafo, il primo testo è inglese e il secondo italiano, secondo la lingua configurata. Se un guasto tecnico inatteso avviene prima dell'ammissione del turno e prima degli header SSE, il codice di stato è `500` e `error` contiene il messaggio standard già definito per la lingua configurata: «I can't complete the response.» in inglese oppure «Non riesco a completare la risposta.» in italiano. La scelta del codice di stato specifico per gli altri casi di errore resta da definire.

Quando il server ha disabilitato gli ingressi conversazionali perché non è riuscito a conservare l'esito di un turno già ammesso, ogni nuovo POST del turno testuale riceve fino al riavvio HTTP `503` con la stessa risposta JSON e lo stesso messaggio tradotto di indisponibilità temporanea; nessun nuovo turno viene ammesso, conservato o accodato.

#### Metadata
  * type: input-output

#### Relations
  * define: [Segnalazione dell'errore HTTP prima del flusso testuale](../Requirements/FamilyConversation.md#segnalazione-dellerrore-http-prima-del-flusso-testuale)
---

### Semantica locale delle porte verso servizi esterni

Ogni porta outbound di Application descrive una capacità coerente richiesta da uno o più casi d'uso del modulo «Conversazioni». Nomi delle operazioni, input, output e rifiuti descrivono il significato per il modulo, senza riprodurre automaticamente metodi, payload o tipi di SDK, protocollo o API del fornitore. L'adapter realizza la porta e converte richieste, risposte e rifiuti fra le due rappresentazioni. La granularità delle porte segue le capacità effettivamente richieste, senza imporre un numero di operazioni per porta. La porta di produzione della risposta espone `produce(history: ConversationHistory): AsyncIterable<string>`: `ConversationHistory` è la proiezione Application dello storico conservato, e ogni valore iterato è un nuovo frammento di testo della risposta. Il caso d'uso legge i frammenti uno alla volta nell'ordine di produzione; la porta non espone eventi SSE né tipi del fornitore.

#### Metadata
  * type: specification

#### Relations
  * define: [Contratti delle porte nei termini di Conversazioni](../Requirements/FamilyConversation.md#contratti-delle-porte-nei-termini-di-conversazioni)
---

### Significato degli esiti di scrittura SQLite

Per ogni mutazione dell'archivio, la porta di scrittura definisce la postcondizione e gli eventuali rifiuti previsti. L'adapter traduce un risultato SQLite in un rifiuto della porta solo quando l'operazione e le informazioni osservabili nella stessa transazione identificano quella condizione: per esempio, un'ammissione negata dall'occupazione già presente è un rifiuto di turno concorrente. Una scrittura che modifica zero righe non significa universalmente né successo né risorsa assente: l'adapter confronta il risultato con la postcondizione e con lo stato accertabile; una conclusione tardiva di un turno già interrotto non può riportarlo a successo. Un vincolo SQLite è tradotto solo se è noto e semanticamente equivalente al rifiuto specifico dell'operazione, senza esporre dettagli del database alla porta. Errori sconosciuti, esiti ambigui ed errori di commit restano guasti tecnici con la causa originale disponibile alla diagnostica. Nessuna scrittura parziale viene confermata o presentata come successo; la classificazione non avvia un nuovo tentativo automatico.

#### Metadata
  * type: specification

#### Relations
  * define: [Classificazione degli esiti delle scritture conversazionali](../Requirements/FamilyConversation.md#classificazione-degli-esiti-delle-scritture-conversazionali)
---

### Stati del turno testuale alla riapertura

Un turno testuale accettato e ancora in elaborazione è distinguibile dagli scambi conclusi quando si consulta la conversazione. Finché l'esito non è conservato, la consultazione lo identifica come `in elaborazione` e lo associa al testo del turno; il client invita la persona ad aggiornare manualmente la pagina più tardi. Alla successiva consultazione, se l'esito è stato conservato, il client presenta lo scambio concluso con risposta oppure errore e non presenta più per lo stesso turno lo stato `in elaborazione`. La riapertura non crea una seconda connessione SSE, non recupera i frammenti parziali e non aggiorna automaticamente lo stato della pagina. Dopo un'interruzione del processo, il turno senza esito segue lo stato `interrotto` definito nel contratto degli stati persistenti del turno testuale.

#### Metadata
  * type: state

#### Relations
  * define: [Stato del turno in elaborazione alla riapertura](../Requirements/FamilyConversation.md#stato-del-turno-in-elaborazione-alla-riapertura)
---

### Stati dell'interazione vocale

L'interazione vocale ha gli stati `chiusa` e `attiva`. Nello stato `attiva` è associata a una sola conversazione. Un avvio esplicito ammesso quando nessun turno è in corso nell'installazione crea una nuova conversazione e la rende attiva anche se un'altra interazione era ancora attiva. Una replica arrivata prima della scadenza dell'intervallo di inattività appartiene alla conversazione attiva. L'intervallo decorre dalla fine della risposta vocale e ricomincia dopo ogni risposta vocale. Alla scadenza, l'interazione passa a `chiusa`; un successivo turno vocale richiede un nuovo avvio e una nuova conversazione. Il valore iniziale dell'intervallo è 15 secondi ed è configurabile con un valore positivo.

#### Metadata
  * type: state

#### Relations
  * define: [Chiusura per inattività vocale](../Requirements/FamilyConversation.md#chiusura-per-inattività-vocale)
---

### Stati persistenti dei turni conversazionali

Un turno della chat testuale o della voce trascritta è conservato come accettato con il suo testo e lo stato `in elaborazione` prima che Ambrogio ne avvii l'elaborazione. Quando l'esito è conservato, il turno diventa uno scambio concluso con risposta oppure errore. A ogni avvio del server, tutti i turni ancora nello stato `in elaborazione` senza esito conservato diventano `interrotti`: restano consultabili con il testo originario, non sono rappresentati come risposte o errori conclusi e non vengono rielaborati automaticamente. La sola disconnessione del client non cambia lo stato persistente in `interrotto`.

#### Metadata
  * type: state

#### Relations
  * define: [Riconoscimento del turno interrotto dopo riavvio](../Requirements/FamilyConversation.md#riconoscimento-del-turno-interrotto-dopo-riavvio)
---

### Struttura testuale dello scambio

Lo storico di una conversazione è una sequenza ordinata di scambi. Ogni scambio contiene il testo del turno della famiglia, il tipo di esito comunicato da Ambrogio (risposta oppure errore) e il testo di tale esito. Uno scambio appartiene a una sola conversazione. Per un turno vocale, il testo del turno è la trascrizione.

#### Metadata
  * type: input-output

#### Relations
  * define: [Conservazione dello scambio testuale](../Requirements/FamilyConversation.md#conservazione-dello-scambio-testuale)
---

### Valori Date della conversazione

Gli istanti del turno e dell'ultima attività della conversazione sono valori `Date` standard nel codice Application e Domain. Un `Date` è valido soltanto se `getTime()` restituisce un numero finito; creazione e ricostruzione di oggetti Domain rifiutano valori invalidi. Gli oggetti Domain copiano ogni `Date` ricevuto prima di conservarlo e restituiscono nuove copie quando lo espongono, così le mutazioni del chiamante non alterano lo stato interno. Il confronto tra istanti usa il loro valore temporale. I formati dei payload esterni seguono i rispettivi contratti di confine; la rappresentazione SQLite è specificata nel contratto di persistenza degli istanti.

#### Metadata
  * type: specification

#### Relations
  * define: [Istanti validi e protetti della conversazione](../Requirements/FamilyConversation.md#istanti-validi-e-protetti-della-conversazione)
---

### Valori JSON della paginazione conversazionale

Il file JSON locale del componente «Conversazioni» ammette i campi opzionali `listPageSize` e `maxListPageSize`. Se assenti, valgono rispettivamente 20 e 100. Ciascun valore presente è un intero positivo; `listPageSize` non supera `maxListPageSize` dopo l'applicazione dei valori predefiniti. Un file necessario assente, illeggibile, non JSON, con struttura incompatibile o con valori invalidi impedisce l'attivazione dell'ingresso interessato. La composition root carica il file una volta, consegna i due valori validati al caso d'uso di elenco e all'adapter di lettura dell'archivio e non li sostituisce con variabili d'ambiente. Il massimo limita la dimensione accettata per una pagina; il contratto HTTP dell'elenco definisce come un client può richiedere una dimensione diversa da quella predefinita.

Il percorso del file è indicato dalla variabile d'ambiente `AMBROGIO_CONVERSATIONS_CONFIG_PATH`, che non contiene valori di paginazione. Se la variabile manca o non indica un percorso utilizzabile, la preparazione del componente fallisce prima di attivare gli ingressi.

#### Metadata
  * type: specification

#### Relations
  * define: [Configurazione della paginazione conversazionale](../Requirements/FamilyConversation.md#configurazione-della-paginazione-conversazionale)
---
