# Elements

### Archivio SQLite con Kysely

Le conversazioni e i loro scambi testuali sono conservati in un database SQLite dell'installazione. Le operazioni applicative di lettura e scrittura dell'archivio usano Kysely. La scelta riguarda l'archivio delle conversazioni; non prescrive lo stack degli altri componenti del monorepo.

#### Metadata
  * type: specification

#### Relations
  * define: [Disponibilità dello storico dopo riavvio](../Requirements/FamilyConversation.md#disponibilità-dello-storico-dopo-riavvio)
---

### Attivazione degli agenti MCP dai file presenti

Ogni file `<id>.json` valido trovato in `/etc/ambrogio/agents` definisce un agente specializzato disponibile all'orchestratore dopo l'avvio. L'insieme degli agenti disponibili deriva dai file presenti nella directory: aggiungere un file rende disponibile l'agente corrispondente al successivo avvio; rimuoverlo lo rende indisponibile al successivo avvio. Non è previsto un elenco separato né un campo di abilitazione. La validazione dei file avviene prima dell'attivazione secondo il contratto comune di bootstrap.

#### Metadata
  * type: specification

#### Relations
  * define: [Disponibilità degli agenti MCP dai file JSON](../Requirements/FamilyConversation.md#disponibilità-degli-agenti-mcp-dai-file-json)
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

### Conferma della fine della risposta parlata

Il client vocale osserva la riproduzione della risposta tramite lo stato Micdrop `isAssistantSpeaking`. Quando tale stato passa da vero a falso dopo una risposta vocale, invia al server un evento di fine riproduzione riferito all'interazione attiva. Il backend usa la ricezione di questo evento come inizio dell'intervallo configurato di inattività; la sola fine della generazione TTS o dell'invio dei blocchi audio non avvia l'intervallo. Il VAD delimita il parlato della famiglia in ingresso e non determina la fine della riproduzione della risposta. L'ingresso ignora eventi duplicati o riferiti a un'interazione non attiva. Alla chiusura della connessione vocale l'interazione associata viene chiusa.

#### Metadata
  * type: specification

#### Relations
  * define: [Chiusura per inattività vocale](../Requirements/FamilyConversation.md#chiusura-per-inattività-vocale)
---

### Configurazione facoltativa dell'interazione vocale

Un'installazione può non abilitare l'ingresso vocale. L'assenza della variabile di percorso `AMBROGIO_VOICE_CONFIG_PATH` lo disabilita: la composition root non legge file vocali e non costruisce né avvia Micdrop, Vosk o Piper. La chat testuale HTTP resta utilizzabile con le proprie dipendenze. Quando il percorso è presente, il file JSON vocale richiede `voskModelPath` (directory del modello), `piperModelPath` (file ONNX della voce) e `piperBinaryPath` (eseguibile Piper); ammette `inactivityMs` intero positivo, predefinito a 15000. I percorsi dei modelli devono essere leggibili all'avvio, il binario deve essere eseguibile e il file JSON della voce Piper adiacente al modello ONNX deve essere leggibile. Un valore mancante o invalido impedisce l'attivazione della voce prima dell'ascolto del server. I file di configurazione e i modelli restano esterni all'immagine del backend.

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

Application richiede all'archivio la persistenza delle transizioni complete del turno tramite un contratto dedicato; questo può esporre il salvataggio della conversazione come aggregato o operazioni di transizione esplicite. L'adapter SQLite/Kysely controlla la transazione breve. L'ammissione registra insieme il turno accettato e l'occupazione della conversazione interessata. La conclusione o l'interruzione registrano insieme l'esito persistente del turno e la liberazione dell'occupazione, salvo l'arresto che impedisce nuovi ingressi. Un errore in una delle scritture della transizione annulla l'intera transazione; il chiamante osserva il successo solo dopo il commit. Le chiamate ad agenti e connettori e l'invio progressivo della risposta avvengono fuori da transazioni SQLite; la conferma di successo del profilo UI Message Stream viene emessa solo dopo il commit dell'esito riuscito. Non è richiesto un coordinatore generico di transazioni esposto ai casi d'uso.

#### Metadata
  * type: specification

#### Relations
  * define: [Scritture atomiche dello stato dei turni](../Requirements/FamilyConversation.md#scritture-atomiche-dello-stato-dei-turni)
---

### Conteggio delle chiamate agli strumenti MCP per turno

Ogni file JSON di agente specializzato contiene al primo livello `maxToolCalls`, un intero positivo. Il valore è obbligatorio e vale solo per quell'agente. Per ogni turno delegato, Ambrogio conta ogni chiamata a uno strumento MCP effettivamente richiesta dal modello dell'agente, anche quando più chiamate sono richieste nella stessa risposta del modello. Prima di inoltrare una chiamata che eccederebbe `maxToolCalls`, interrompe la produzione del turno con un guasto; il caso d'uso comunica e conserva il messaggio pubblico standard senza dettagli tecnici. Il contatore riparte da zero al turno successivo. Il limite non impedisce al modello di formulare una risposta finale dopo l'ultima chiamata consentita.

#### Metadata
  * type: specification

#### Relations
  * define: [Limite delle chiamate agli strumenti per agente](../Requirements/FamilyConversation.md#limite-delle-chiamate-agli-strumenti-per-agente)
---

### Credenziale Bearer per l'endpoint MCP

Nel JSON di ogni agente specializzato, `mcp.auth` è facoltativo. Quando seleziona Bearer statico, è un oggetto con `type: "bearer"` e `token` stringa non vuota. Il client invia `Authorization: Bearer <token>` nelle richieste MCP dirette esclusivamente all'endpoint `mcp.url` di quell'agente. Quando `mcp.auth` è assente, il client non invia un header `Authorization` all'endpoint. Un tipo diverso da `bearer` e `oauth_client_credentials`, oppure un token Bearer mancante o vuoto, rende invalida la configurazione prima dell'attivazione dell'agente. Il token non è condiviso con altri agenti, non entra nei messaggi rivolti al modello linguistico e non compare in log o messaggi di errore. Il flusso OAuth con login interattivo non appartiene alla prima integrazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Autenticazione Bearer del client MCP](../Requirements/FamilyConversation.md#autenticazione-bearer-del-client-mcp)
---

### Credenziali OAuth tra servizi per l'endpoint MCP

Quando un agente specializzato usa OAuth tra servizi, il suo JSON contiene `mcp.auth: { "type": "oauth_client_credentials", "clientId": "…", "clientSecret": "…", "issuer": "…" }`; può contenere `scope`, stringa non vuota se presente. `clientId` e `clientSecret` sono stringhe non vuote; `issuer` è l'identificativo URL assoluto HTTP o HTTPS dell'authorization server presso cui le credenziali sono registrate. Il client scopre l'authorization server tramite i metadata pubblicati dal server MCP e usa il flusso OAuth `client_credentials` del SDK MCP ufficiale. Prima di inviare il segreto, deve verificare che l'issuer scoperto corrisponda a quello configurato. Il client usa il token ottenuto soltanto per l'endpoint MCP di quell'agente; gestisce scadenza e rinnovo tramite il SDK durante la vita del processo senza richiedere un login nel browser. Credenziali e token non sono condivisi tra agenti, non entrano nei messaggi rivolti ai modelli e non compaiono in log o errori. La configurazione invalida impedisce l'attivazione dell'agente.

#### Metadata
  * type: specification

#### Relations
  * define: [Autenticazione OAuth tra servizi del client MCP](../Requirements/FamilyConversation.md#autenticazione-oauth-tra-servizi-del-client-mcp)
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
  * define: [Validazione strutturale delle richieste conversazionali HTTP](../Requirements/FamilyConversation.md#validazione-strutturale-delle-richieste-conversazionali-http)
---

### Decisione di delega mediante chiamata di funzione

Per ogni agente specializzato attivo, l'adapter presenta all'orchestratore una funzione di delega identificata dall'agente e descritta mediante il suo campo `description`. L'orchestratore riceve lo storico del turno e può produrre direttamente testo oppure richiedere una chiamata strutturata a una di queste funzioni, con il compito da affidare. Ambrogio accetta una sola delega per turno, esegue soltanto la funzione corrispondente a un agente attivo e usa la risposta dell'agente come esito del turno nella conversazione corrente. Una funzione sconosciuta, argomenti invalidi o più deleghe nello stesso turno causano il guasto pubblico previsto per la produzione della risposta. Le istruzioni e le credenziali dell'agente specializzato restano nel suo adapter.

#### Metadata
  * type: behavior

#### Relations
  * define: [Orchestrazione della risposta conversazionale](../Requirements/FamilyConversation.md#orchestrazione-della-risposta-conversazionale)
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

### Indicazione di attesa della replica vocale

La prima versione del satellite riconosce localmente la wake word. Dopo la risposta parlata permette una replica senza nuova wake word soltanto quando il backend indica che attende una risposta della famiglia. Durante la generazione della risposta l'agente produce insieme al testo un valore booleano strutturato chiamato `expectsReply`, senza una seconda chiamata al modello dedicata alla classificazione. Il satellite non lo deduce dalla punteggiatura.

Il backend consegna la risposta parlata mediante il messaggio Micdrop già esistente `Message` con `role: "assistant"`. Il suo oggetto `metadata` contiene `expectsReply` come booleano obbligatorio. Il valore vale soltanto per quella risposta; la correlazione deriva dalla stessa WebSocket e dal singolo turno vocale attivo per conversazione. Audio e messaggio possono terminare in ordini diversi: il client applica la decisione soltanto dopo aver ricevuto sia il messaggio valido sia la fine effettiva della riproduzione, che conferma con `Played`. Se `expectsReply` è `true`, la replica usa la stessa interazione entro l'intervallo di inattività. Se è `false`, l'interazione termina e il satellite torna alla wake word. Se il messaggio manca o contiene un `expectsReply` assente o non booleano, il satellite non apre una replica; alla fine della riproduzione attende al massimo l'intervallo di inattività configurato per un messaggio valido arrivato tardi, poi chiude l'interazione e torna alla wake word. Un messaggio arrivato dopo la chiusura è ignorato. Il backend non presenta un valore mancante come un `false` valido.

Questa estensione non è implementata dal backend al commit b223daac073fe217cf6609d2173394f7f5bd6d04. La compatibilità richiede codice e prove di integrazione contro una revisione successiva; il solo aggiornamento del modello non la dimostra.

#### Metadata
  * type: specification

#### Relations
  * define: [Segnalazione della replica vocale attesa](../Requirements/FamilyConversation.md#segnalazione-della-replica-vocale-attesa)
---

### Invarianti dello stato del turno

Un turno nuovo accettato entra nello stato `in elaborazione` con identità e testo originario. Da `in elaborazione` può passare una sola volta a un esito concluso con risposta, a un esito concluso con errore oppure a `interrotto`. Gli stati conclusi e `interrotto` sono terminali; un risultato tardivo non li sostituisce. Una transizione rifiutata non cambia lo stato Domain. La ricostruzione dai dati persistenti convalida lo stato corrente senza rieseguire le transizioni storiche. L'invariante di un solo turno attivo per conversazione è protetta dal Domain e garantita dall'ammissione atomica dell'archivio anche tra ingressi concorrenti; conversazioni distinte possono progredire in parallelo. Il contratto non prescrive classi, una dimensione fissa dell'aggregato o un particolare metodo di persistenza.

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

### Istruzioni per gli agenti nei file dell'utente

Ogni agente attivo, compreso l'orchestratore, riceve il proprio testo di istruzioni dal campo `instructions` del file JSON locale dedicato a quell'agente, gestito dall'utente in `/etc/ambrogio/agents`. Il server carica e valida il file prima di costruire l'agente e mantiene separate le istruzioni dei diversi agenti. Le istruzioni sono consegnate al modello dell'agente come istruzioni, insieme al contesto del compito, senza essere incorporate nel codice o negli esempi versionati.

#### Metadata
  * type: specification

#### Relations
  * define: [Istruzioni dell'agente nel JSON dell'utente](../Requirements/FamilyConversation.md#istruzioni-dellagente-nel-json-dellutente)
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

### Occupazione della conversazione e ammissione dei turni

L'ammissione è atomica per identificativo di conversazione ed è condivisa dagli ingressi HTTP e voce. Ogni conversazione è occupata dall'accettazione di un turno fino alla conservazione del suo esito o dello stato `interrotto`. Richieste simultanee sulla stessa conversazione ammettono al massimo un turno; le altre ricevono un rifiuto previsto, senza persistenza né accodamento. Turni di conversazioni diverse possono essere ammessi ed elaborati in parallelo; anche due richieste che creano conversazioni nuove non si escludono reciprocamente. Storico, risposta ed esito di un turno restano associati alla propria conversazione. L'arresto impedisce nuove ammissioni in tutte le conversazioni. Al riavvio, dopo le migrazioni e prima degli ingressi, i turni rimasti `in elaborazione` diventano `interrotti` e le rispettive occupazioni vengono liberate atomicamente. Una conclusione tardiva non sostituisce lo stato `interrotto`. Le transazioni SQLite restano brevi: non includono produzione remota o streaming. La serializzazione delle scritture SQLite non impone la serializzazione dell'intera elaborazione.

Decisione concordata il 16 ottobre 2026, da implementare e verificare: sostituisce il blocco globale dell'installazione. La migrazione ad AI SDK non dimostra da sola questa garanzia. Eventuali limiti globali di capacità richiedono una decisione separata. Il comportamento di indisponibilità globale già previsto per guasti di persistenza resta distinto dal normale conflitto tra turni.

#### Realizzazione SQLite concordata
L’occupazione è memorizzata nella riga della conversazione con il riferimento al turno attivo. Una migrazione incrementale trasferisce lo stato precedente senza perdere conversazioni o turni e rimuove la riga di occupazione globale. Le scritture locali brevi sono serializzate sulla connessione condivisa; questa attesa riguarda le transazioni, non una coda di turni in attesa di risposta. L’ammissione verifica atomicamente l’occupazione della conversazione; completamento e recupero liberano solo le occupazioni pertinenti. Generazione remota e streaming avvengono fuori dalla sezione di scrittura.

#### Metadata
  * type: specification

#### Relations
  * define: [Rifiuto dei turni concorrenti nella stessa conversazione](../Requirements/FamilyConversation.md#rifiuto-dei-turni-concorrenti-nella-stessa-conversazione)
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

### Presentazione degli agenti specializzati all'orchestratore

Ogni file JSON di agente specializzato contiene al primo livello `description`, una stringa non vuota che descrive la capacità dell'agente per la selezione della delega. L'orchestratore riceve l'identificativo e la descrizione degli agenti attivi come definizioni delle funzioni disponibili; non riceve le loro istruzioni o credenziali. Il file `orchestrator.json` non richiede `description`.

#### Metadata
  * type: specification

#### Relations
  * define: [Descrizione degli agenti specializzati per l'orchestrazione](../Requirements/FamilyConversation.md#descrizione-degli-agenti-specializzati-per-lorchestrazione)
---

### Produzione della risposta con Vercel AI SDK

La produzione delle risposte dell'orchestratore e degli agenti specializzati usa un adapter del componente «Conversazioni» basato su Vercel AI SDK, con provider Mistral configurato per ciascun agente. L'adapter implementa la porta applicativa `ProduceConversationReply`: riceve a ogni turno lo storico dall'archivio comune, restituisce frammenti testuali e mantiene i tipi dell'SDK fuori da Domain e Application. Il ponte vocale Micdrop continua a usare il medesimo caso d'uso; l'adapter HTTP della chat presenta i frammenti secondo il proprio profilo SSE.

La configurazione JSON mantiene `llm.provider: "mistral"`, `model`, `apiKey` e le sole `options` facoltative `temperature` e `max_tokens`. L'adapter valida le opzioni prima dell'attivazione e le traduce nei parametri equivalenti dell'AI SDK; omette quelle assenti. L'endpoint Mistral predefinito non richiede un URL nel JSON. Il client MCP comune esistente conserva connessione, autenticazione e ciclo di vita; i suoi tool sono adattati all'AI SDK senza esporre credenziali al modello. Orchestratore e agenti specializzati conservano la delega singola e il limite di chiamate MCP per turno previsti dagli altri contratti.

#### Metadata
  * type: specification

#### Relations
  * define: [Risposta testuale nella conversazione](../Requirements/FamilyConversation.md#risposta-testuale-nella-conversazione)
---

### Profilo del trasporto MCP iniziale

Per la prima implementazione, ogni agente specializzato usa il medesimo client MCP basato su `@modelcontextprotocol/client` versione 2.3.1, con trasporto Streamable HTTP verso l'endpoint indicato in `mcp.url` nel proprio file JSON. `mcp.url` è un URL HTTP o HTTPS assoluto. Il client segue il ciclo di inizializzazione del protocollo e usa la connessione per scoprire e invocare i tool del server configurato. La sezione `mcp` non contiene un campo `transport` e non richiede un comando locale da eseguire: il trasporto iniziale è determinato dal contratto. L'autenticazione segue i contratti del Bearer statico e di OAuth `client_credentials`. La compatibilità con il precedente trasporto HTTP+SSE sarà valutata separatamente prima di introdurla; il trasporto stdio non appartiene alla prima implementazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Trasporto HTTP dei connettori MCP](../Requirements/FamilyConversation.md#trasporto-http-dei-connettori-mcp)
---

### Profilo dell'ingresso HTTP consultivo

L'ingresso eseguibile di questa tranche registra `GET /api/conversations` e `GET /api/conversations/:conversationId` sugli adapter esistenti. Non registra la rotta di invio dei turni perché non è ancora scelto un produttore concreto delle risposte. Prima di ascoltare, valida i JSON HTTP e Conversazioni, apre l'archivio e recupera i turni pendenti secondo il contratto esistente. All'arresto chiude il listener e l'archivio. Il futuro ingresso che accetterà i turni richiederà il proprio assemblaggio e la verifica dell'interruzione dei turni attivi.

#### Metadata
  * type: specification

#### Relations
  * define: [Avvio consultivo dell'API conversazioni](../Requirements/FamilyConversation.md#avvio-consultivo-dellapi-conversazioni)
---

### Profilo dell'ingresso HTTP conversazionale con agenti

L'ingresso eseguibile valida prima dell'ascolto i JSON HTTP, Conversazioni e degli agenti attivi, apre l'archivio e recupera i turni pendenti, prepara gli adapter dei provider e i client MCP degli agenti specializzati, quindi registra `POST /api/conversations/turns` insieme ai due GET già disponibili. La rotta POST usa l'agente orchestratore come produttore concreto della risposta tramite la porta Application `ProduceConversationReply`. La politica CORS autorizza il metodo POST per le origini configurate. L'arresto dell'ingresso segue la politica generale del ciclo di vita del server; la richiesta al provider non viene annullata esplicitamente dall'adapter.

#### Metadata
  * type: specification

#### Relations
  * define: [Avvio dell'ingresso dei turni conversazionali](../Requirements/FamilyConversation.md#avvio-dellingresso-dei-turni-conversazionali)
---

### Profilo della configurazione del modello per agente

Ogni agente attivo ha un file JSON locale separato, gestito dall'utente e individuato in `/etc/ambrogio/agents`. Il file contiene al primo livello `instructions` e `llm`. `instructions` è il testo delle istruzioni dell'agente. `llm` è un oggetto con i campi `provider`, `model` e `apiKey`, che indicano rispettivamente l'adapter del fornitore, l'identificativo del modello e la chiave API; può contenere `options`, un oggetto di opzioni specifiche del provider. L'orchestratore e ciascun agente specializzato usano i valori del proprio file. La composition root valida i campi comuni e consegna le opzioni all'adapter selezionato, che valida i campi specifici prima di attivare l'agente. Il file di un agente specializzato contiene inoltre `mcp`, con `url` e l'eventuale `auth` definiti dai contratti del trasporto MCP e della credenziale Bearer. I file dell'utente non sono materiale versionato del repository.

#### Metadata
  * type: specification

#### Relations
  * define: [Configurazione del modello per agente](../Requirements/FamilyConversation.md#configurazione-del-modello-per-agente)
---

### Profilo di trasporto SSE della chat

Il client invia il turno testuale con `POST /api/conversations/turns`, `Content-Type: application/json` e il corpo già definito dal contratto di invio: `text` e l'eventuale `conversationId`, senza lo storico. L'adapter restituisce i rifiuti precedenti all'ammissione come HTTP JSON secondo il contratto degli errori. Dopo l'ammissione, restituisce sulla stessa richiesta un UI Message Stream v1 di AI SDK, codificato in UTF-8 nel formato SSE, con `Content-Type: text/event-stream`, `x-vercel-ai-ui-message-stream: v1` e `Cache-Control: no-store`. I commenti SSE eventualmente prodotti dall'SDK non sono eventi applicativi.

Il primo evento applicativo contiene una parte `start` con `messageId` stabile per la risposta del turno e `messageMetadata` contenente le stringhe `conversationId` e `turnId`, corrispondenti agli identificativi conservati. Questi metadata sono presenti anche nella continuazione di una conversazione. L'identità precede ogni incremento testuale; `messageId` identifica il messaggio UI della risposta, senza sostituire l'identità del turno nel dominio.

Il testo usa le parti standard `text-start`, `text-delta` e `text-end` con un `id` coerente per ciascun blocco. Il campo `delta` di `text-delta` contiene soltanto il nuovo frammento. La concatenazione ordinata dei frammenti ricostruisce la risposta; gli incrementi disponibili vengono trasmessi durante la generazione. La serializzazione SSE e la chiusura del protocollo sono affidate agli helper AI SDK, senza un encoder SSE locale parallelo.

La conferma di successo del prodotto è una parte `finish` con `finishReason: "stop"` e `messageMetadata.turnStatus: "answered"`, emessa dopo gli incrementi e la chiusura dei blocchi testuali, e soltanto dopo la conferma applicativa del commit dell'esito riuscito. La fine della generazione del modello, `text-end`, la sola chiusura HTTP e il marcatore di trasporto `data: [DONE]` non attestano un esito conservato. L'adapter traduce l'esito applicativo in questa conferma; non inoltra come successo una parte `finish` del provider prima della persistenza.

Se il turno fallisce dopo l'avvio del flusso, l'adapter emette una parte standard `error` con `errorText` uguale al messaggio pubblico sicuro e chiude il flusso senza la conferma di successo. Nel caso di esito di errore conservato, il messaggio coincide con quello nell'archivio. Un guasto della persistenza segue anche la politica di indisponibilità degli ingressi; non viene presentato come esito conservato. La normale chiusura può comunque includere `[DONE]`, che resta un marcatore di trasporto.

Il profilo usa testo, metadata di correlazione ed esiti pubblici. La migrazione non pubblica ragionamento, credenziali o risultati interni dei tool. Non è prevista compatibilità simultanea con i precedenti eventi SSE nominati `conversation`, `delta`, `done` ed `error`. La consultazione dello storico e il comportamento dopo disconnessione continuano a seguire i rispettivi contratti del prodotto.

#### Metadata
  * type: input-output

#### Relations
  * define: [Risposta progressiva SSE nella chat testuale](../Requirements/FamilyConversation.md#risposta-progressiva-sse-nella-chat-testuale)
---

### Proprietà dei controlli del turno conversazionale

L'adapter HTTP possiede la verifica della forma dell'input e della decodifica del proprio protocollo: ferma i dati non validi prima del caso d'uso, senza decidere invarianti o precondizioni di business. Application riceve dati già interpretati e coordina le precondizioni che richiedono contesto, per esempio il recupero della conversazione richiesta, tramite porte; un rifiuto previsto ferma il turno prima degli effetti successivi. Domain garantisce gli stati e le transizioni del singolo turno anche se un ingresso ha eseguito controlli preliminari. L'archivio SQLite garantisce atomicamente l'ammissione di al massimo un turno attivo per conversazione; una lettura o un controllo preliminare non sostituisce tale garanzia. I controlli pubblici aggiuntivi sono ammessi solo se servono al rispettivo confine e non ridefiniscono la regola autorevole di un altro livello.

#### Metadata
  * type: specification

#### Relations
  * define: [Validazione del formato negli ingressi conversazionali](../Requirements/FamilyConversation.md#validazione-del-formato-negli-ingressi-conversazionali)
---

### Protocollo vocale del prodotto

L'ingresso vocale del backend usa Micdrop e WebSocket per trasportare l'audio della famiglia e la risposta parlata in streaming. La WebSocket vocale condivide la porta di ascolto del server HTTP ed è raggiungibile sul percorso `/api/voice`. Ogni nuova connessione WebSocket rappresenta un avvio esplicito di una nuova interazione vocale: il server crea una nuova conversazione, comunica `Ready` seguito da un oggetto JSON con `conversationId` e solo allora il client comincia a trasmettere il turno. Un avvio rifiutato comunica `TurnRejected` con `kind` e chiude la connessione. Le interazioni vocali di client diversi restano indipendenti: l'avvio di una nuova WebSocket non chiude le connessioni già attive. Ogni interazione mantiene la propria conversazione e il proprio timer di inattività. Le repliche immediate usano la stessa connessione e la conversazione attiva. Quando scade l'inattività configurata, il server chiude l'interazione e la sua WebSocket. Il client invia i comandi Micdrop `StartSpeaking` e `StopSpeaking` con campioni audio PCM16 mono a 16 kHz in frame binari mentre la persona parla; il server li consegna progressivamente a Vosk, che trascrive durante il parlato senza attendere la clip completa. Dopo la transizione di `isAssistantSpeaking` da vero a falso, il client invia il comando testuale `Played` sulla stessa connessione; il comando ha effetto una sola volta per ciascuna risposta parlata. Il server segnala il rifiuto previsto di un turno con `TurnRejected` seguito da un oggetto JSON contenente `kind`. Il prodotto definisce il proprio contratto di integrazione del canale vocale: il protocollo e il satellite dello spike non sono vincoli di compatibilità e il satellite potrà richiedere un aggiornamento separato.

Un Agent Micdrop personalizzato, contenuto negli adapter tecnici del package «Conversazioni», traduce la trascrizione in input del caso d'uso conversazionale esistente e consegna progressivamente il testo della risposta a Micdrop per la sintesi vocale. Il caso d'uso e l'archivio comuni ai turni HTTP restano autorità per ammissione atomica, stato ed esito del turno. Domain e Application non importano Micdrop e non ricevono oggetti del suo protocollo. Micdrop non mantiene un secondo archivio persistente della conversazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Dati Application dei casi d'uso conversazionali](../Requirements/FamilyConversation.md#dati-application-dei-casi-duso-conversazionali)
---

### Responsabilità di Domain Application e adapter

Nel modulo business «Conversazioni», Domain contiene le regole e i tipi del dominio della conversazione; Application contiene i casi d'uso e le porte necessarie per collaborare con componenti esterni; gli adapter realizzano gli ingressi del modulo e le integrazioni tecniche richieste dalle porte. Questa suddivisione riguarda le responsabilità del codice, indipendentemente dai percorsi delle cartelle.

#### Metadata
  * type: specification

#### Relations
  * define: [Separazione delle responsabilità nel modulo Conversazioni](../Requirements/FamilyConversation.md#separazione-delle-responsabilità-nel-modulo-conversazioni)
---

### Ricerca dei file degli agenti nella directory del prodotto

Il server cerca i file JSON degli agenti nella directory `/etc/ambrogio/agents`. In Docker l'installatore può montare una directory di configurazione scelta sull'host in `/etc/ambrogio`, così da fornire `agents/` insieme agli altri JSON locali senza incorporarli nell'immagine. La directory contiene configurazioni gestite dall'utente. Il nome `orchestrator.json` identifica l'orchestratore ed è riservato. Ogni altro file `<id>.json` identifica un agente specializzato: `id` inizia con una lettera minuscola e prosegue soltanto con lettere minuscole, cifre o trattini, secondo `^[a-z][a-z0-9-]*$`; `orchestrator` non è un identificativo valido per un agente specializzato. Ogni file JSON con nome valido presente nella directory è preso in carico secondo il contratto di attivazione degli agenti e quello di bootstrap dei componenti.

#### Metadata
  * type: specification

#### Relations
  * define: [Scoperta delle configurazioni degli agenti](../Requirements/FamilyConversation.md#scoperta-delle-configurazioni-degli-agenti)
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

`GET /api/conversations/:conversationId` restituisce uno snapshot della conversazione identificata dal parametro di percorso, senza aprire un flusso SSE, recuperare frammenti di risposta o aggiornare automaticamente la consultazione nel client. La risposta riuscita ha stato HTTP `200`, `Content-Type: application/json` e `Cache-Control: no-store`. Il corpo JSON contiene `id`, `createdAt`, `lastActivityAt` e `turns`; `turns` è un array completo, ordinato secondo l'ordine persistente dei turni. Ogni turno contiene `id`, `text`, `acceptedAt` e `status`. I valori temporali sono stringhe ISO 8601 in UTC. `status` vale `pending`, `answered`, `failed` o `interrupted`: `pending` non contiene esito né `finishedAt`; `answered` contiene `answer` e `finishedAt`; `failed` contiene `error` e `finishedAt`; `interrupted` contiene `finishedAt` senza `answer` né `error`. Il testo del turno e degli esiti è quello conservato, senza frammenti parziali non conclusi.

Se la conversazione non esiste, la risposta ha stato `404`; se la lettura fallisce per un guasto tecnico, ha stato `500`. Entrambe sono JSON con il solo campo stringa `error`, un messaggio pubblico sicuro e `Cache-Control: no-store`. Per `404` il messaggio è «Conversation not found.» in inglese o «Conversazione non trovata.» in italiano. Per `500` è «I can't complete the response.» in inglese o «Non riesco a completare la risposta.» in italiano, secondo la lingua configurata. I dettagli tecnici restano nella diagnostica del server.

#### Metadata
  * type: input-output

#### Relations
  * define: [Lettura HTTP dello storico conversazionale](../Requirements/FamilyConversation.md#lettura-http-dello-storico-conversazionale)
---

### Risposta di errore HTTP prima del flusso testuale

Se un errore viene determinato prima dell'invio degli header SSE, il backend risponde alla richiesta POST con uno stato HTTP di errore `4xx` o `5xx` e `Content-Type: application/json`. Il corpo è un oggetto JSON con il campo stringa `error` contenente un messaggio pubblico sicuro, per esempio `{"error":"..."}`. Il messaggio non espone dettagli tecnici del guasto. Questa risposta non usa `text/event-stream` e non contiene eventi SSE. Se `text` è vuoto o contiene soltanto spazi bianchi, il corpo JSON è malformato, contiene campi non previsti o usa tipi diversi da quelli contrattuali, oppure `Content-Type` non è `application/json`, il codice di stato è `400` e il messaggio è «Invalid message.» in inglese oppure «Messaggio non valido.» in italiano; il testo vuoto ha precedenza anche quando è presente un `conversationId` inesistente. Se `text` è valido ma il `conversationId` non identifica una conversazione conservata, il codice di stato è `404` e il messaggio è «Conversation not found.» oppure «Conversazione non trovata.». Se il turno valido è rifiutato perché la conversazione destinataria è occupata, il codice di stato è `409` e il messaggio è «Another turn is in progress.» oppure «Un altro turno è in corso.»; il turno non viene conservato né accodato. Se l'archivio rifiuta temporaneamente l'ammissione perché occupato, il codice di stato è `503` e il messaggio è «Service temporarily unavailable.» oppure «Servizio temporaneamente non disponibile.»; il turno non viene conservato né accodato. Se il corpo supera 64 KiB, il codice di stato è `413` e il messaggio è «Request too large.» oppure «Richiesta troppo grande.». Per i messaggi alternativi di questo paragrafo, il primo testo è inglese e il secondo italiano, secondo la lingua configurata. Se un guasto tecnico inatteso avviene prima dell'ammissione del turno e prima degli header SSE, il codice di stato è `500` e `error` contiene il messaggio standard già definito per la lingua configurata: «I can't complete the response.» in inglese oppure «Non riesco a completare la risposta.» in italiano. La scelta del codice di stato specifico per gli altri casi di errore resta da definire.

Quando il server ha disabilitato gli ingressi conversazionali perché non è riuscito a conservare l'esito di un turno già ammesso, ogni nuovo POST del turno testuale riceve fino al riavvio HTTP `503` con la stessa risposta JSON e lo stesso messaggio tradotto di indisponibilità temporanea; nessun nuovo turno viene ammesso, conservato o accodato.

#### Metadata
  * type: input-output

#### Relations
  * define: [Segnalazione dell'errore HTTP prima del flusso testuale](../Requirements/FamilyConversation.md#segnalazione-dellerrore-http-prima-del-flusso-testuale)
---

### Schema delle richieste HTTP conversazionali

Le rotte HTTP JSON di elenco, storico e turno dichiarano con TypeBox la forma delle parti di richiesta che usano: corpo, query e parametri di percorso. Fastify valida tali schemi con Ajv prima del gestore. Gli oggetti di richiesta dichiarati sono chiusi: campi non previsti producono un rifiuto, senza essere eliminati. La configurazione Ajv dell'ingresso usa `coerceTypes: false`, `useDefaults: false`, `removeAdditional: false` e `allErrors: false`; la validazione non converte tipi, inserisce valori predefiniti né altera i dati ricevuti.

Lo schema controlla la forma del protocollo. L'adapter converte esplicitamente le rappresentazioni ammesse nei dati Application, come il limite decimale e il cursore dell'elenco. La verifica che il testo del turno non sia composto solo da spazi resta un controllo dell'ingresso che non modifica il testo accettato. Le precondizioni contestuali e gli invarianti restano ai rispettivi proprietari. Un errore di schema o di conversione interrompe la richiesta prima del caso d'uso e viene presentato secondo il contratto HTTP pubblico della rotta. Questa scelta non introduce la pubblicazione OpenAPI.

#### Metadata
  * type: specification

#### Relations
  * define: [Validazione strutturale delle richieste conversazionali HTTP](../Requirements/FamilyConversation.md#validazione-strutturale-delle-richieste-conversazionali-http)
---

### Semantica locale delle porte verso servizi esterni

Ogni porta outbound di Application descrive una capacità coerente richiesta da uno o più casi d'uso del modulo «Conversazioni». Nomi delle operazioni, input, output e rifiuti descrivono il significato per il modulo, senza riprodurre automaticamente metodi, payload o tipi di SDK, protocollo o API del fornitore. L'adapter realizza la porta e converte richieste, risposte e rifiuti fra le due rappresentazioni. La granularità delle porte segue le capacità effettivamente richieste, senza imporre un numero di operazioni per porta.

La capacità di produzione della risposta riceve il contesto applicativo dello storico conservato, consegna i nuovi frammenti testuali nell'ordine di produzione e permette al coordinamento applicativo di distinguere conclusione e guasto della produzione. Le firme possono evolvere per usare i meccanismi SDK attraverso adapter, mantenendo dati ed esiti definiti in Application; non è prescritta una particolare firma TypeScript o il solo `AsyncIterable<string>`. Non attraversano la porta eventi SSE, `UIMessage`, risultati `streamText`, writer e callback dell'SDK o altri tipi del fornitore. Eventuali callback definiti da Application scambiano soltanto dati applicativi. Eventuali nuovi dati applicativi richiedono un bisogno concreto del modulo e non la duplicazione generale del protocollo SDK.

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

### Stati dell'interazione vocale

L'interazione vocale ha gli stati `chiusa` e `attiva`. Nello stato `attiva` è associata a una sola conversazione. Un avvio esplicito ammesso crea una nuova conversazione per l'interazione vocale interessata. Interazioni appartenenti a client diversi restano indipendenti: l'avvio, la risposta o la chiusura di una non sostituisce lo stato delle altre. L'ammissione rispetta il singolo turno attivo per conversazione, senza bloccare conversazioni diverse. Una replica arrivata prima della scadenza dell'intervallo di inattività appartiene alla conversazione attiva. L'intervallo decorre dalla fine della risposta vocale e ricomincia dopo ogni risposta vocale. Alla scadenza, l'interazione passa a `chiusa`; un successivo turno vocale richiede un nuovo avvio e una nuova conversazione. Il valore iniziale dell'intervallo è 15 secondi ed è configurabile con un valore positivo.

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

