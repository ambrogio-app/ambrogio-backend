# Elements

### Agente che ha risposto nello scambio conservato

Decisione concordata con la persona il 17 ottobre 2026. La capacità Application di produzione della risposta consegna, oltre ai frammenti testuali e all'indicazione `expectsReply`, l'identificativo dell'agente che formula la risposta, come dato Application distinto, al massimo una volta e prima di qualunque frammento testuale. Il caso d'uso del turno lo include nell'esito con risposta passato al completamento; un identificativo ripetuto, vuoto o consegnato dopo un frammento testuale o dopo `expectsReply` viola il contratto della risposta ed è un guasto della produzione. Una risposta senza identificativo resta valida e viene conservata senza agente.

Nel Domain un turno concluso con risposta può portare l'identificativo dell'agente che l'ha formulata, stringa non vuota; i turni `in elaborazione`, conclusi con errore o `interrotti` non hanno agente. L'archivio SQLite lo conserva nella colonna facoltativa `agent` della tabella `turns`, aggiunta dalla migrazione `007_turn_agent`; le righe già presenti restano con valore nullo, cioè agente sconosciuto, e restano leggibili. Un valore non nullo su un turno non concluso con risposta è un dato persistente invalido.

Quando l'orchestratore sceglie l'agente, ogni risposta precedente con agente noto è presentata nel suo contesto preceduta dall'indicazione `[agent: <id>]`; le risposte con agente sconosciuto sono presentate senza indicazione. Gli agenti specializzati ricevono lo storico senza queste indicazioni. L'agente che ha risposto è un dato interno: non compare nei messaggi del protocollo `ambrogio.v1`, nello storico né nell'elenco HTTP, che restano invariati.

#### Metadata
  * type: specification

#### Relations
  * define: [Continuità dell'agente nella conversazione](../Requirements/FamilyConversation.md#continuità-dellagente-nella-conversazione)
---

### Annullamento della produzione della risposta dopo 30 secondi

Decisione concordata con la persona il 17 ottobre 2026, dopo una prova sul server installato in cui uno streaming Mistral si è fermato a metà turno senza mai concludersi e, senza alcun tempo massimo, il turno sarebbe rimasto `in elaborazione` occupando la conversazione. Il caso d'uso del turno concede alla produzione della risposta di un turno ammesso al massimo 30 secondi, costante fissa del caso d'uso non configurabile dall'utente, misurati dall'inizio della produzione dopo la lettura dello storico: il tempo comprende la scelta dell'orchestratore, la risposta dell'agente e le sue chiamate agli strumenti.

Nel rispetto dell'indipendenza tecnica di Domain e Application, che ammette soltanto API standard ECMAScript, il caso d'uso misura il tempo tramite una porta Application di temporizzazione fornita dalla composition root: la porta avvia una scadenza di una durata data, ne espone il compimento come promessa e consente di cancellarla; l'adapter di sistema la realizza con il timer della piattaforma. Il caso d'uso consegna alla capacità di produzione della risposta una richiesta di annullamento definita in Application, una promessa che si risolve quando la produzione deve fermarsi; gli adapter la convertono nei meccanismi del proprio SDK, per esempio un `AbortSignal`.

Alla scadenza il caso d'uso risolve la richiesta di annullamento e smette subito di attendere la produzione, anche se questa non reagisce; non consegna altri frammenti e conclude il turno con l'esito di errore e il messaggio pubblico standard, portando come causa tecnica un guasto di superamento del tempo massimo per la diagnostica `conversation_reply_failed`. I frammenti già consegnati restano consegnati; lo scambio conservato contiene l'errore e non una risposta parziale. Se nel frattempo il turno è stato interrotto, prevale l'esito `interrotto`. Quando la produzione termina prima della scadenza, il caso d'uso cancella la scadenza e la richiesta di annullamento non si risolve. L'adapter AI SDK passa il segnale ottenuto dalla richiesta alle richieste dei modelli, tramite `abortSignal`, e alle invocazioni degli strumenti MCP, tramite l'opzione `signal` della richiesta, così che le richieste ancora in corso vengano annullate.

#### Metadata
  * type: behavior

#### Relations
  * define: [Tempo massimo della produzione della risposta](../Requirements/FamilyConversation.md#tempo-massimo-della-produzione-della-risposta)
---

### Archivio SQLite con Kysely

Le conversazioni e i loro scambi testuali sono conservati in un database SQLite dell'installazione. Le operazioni applicative di lettura e scrittura dell'archivio usano Kysely. La scelta riguarda l'archivio delle conversazioni; non prescrive lo stack degli altri componenti del monorepo.

#### Metadata
  * type: specification

#### Relations
  * define: [Disponibilità dello storico dopo riavvio](../Requirements/FamilyConversation.md#disponibilità-dello-storico-dopo-riavvio)
---

### Attivazione degli agenti dai file presenti

Ogni file `<id>.ts` valido trovato in `/etc/ambrogio/agents` definisce un agente specializzato disponibile all'orchestratore dopo l'avvio. L'insieme degli agenti disponibili deriva dai file presenti nella directory: aggiungere un file rende disponibile l'agente corrispondente al successivo avvio; rimuoverlo lo rende indisponibile al successivo avvio. Non è previsto un elenco separato né un campo di abilitazione. La validazione dei file avviene prima dell'attivazione secondo il contratto comune di bootstrap.

Decisione concordata con la persona il 17 ottobre 2026: poiché l'orchestratore sceglie sempre un agente e non risponde da solo, la directory deve contenere, oltre a `orchestrator.ts`, almeno un file di agente specializzato valido; in caso contrario la preparazione degli agenti fallisce e il server non si mette in ascolto. Un agente specializzato può avere un connettore MCP oppure no, secondo il profilo della configurazione per agente.

#### Metadata
  * type: specification

#### Relations
  * define: [Disponibilità degli agenti dai moduli TypeScript](../Requirements/FamilyConversation.md#disponibilità-degli-agenti-dai-moduli-typescript)
---

### Avvio con migrazioni dell'archivio conversazioni

Prima di attivare gli ingressi conversazionali, il server confronta lo schema SQLite dell'archivio con le migrazioni versionate richieste dalla versione avviata e applica in ordine quelle pendenti tramite Kysely. Se una migrazione non riesce, il server non accetta turni e rende osservabile il guasto al confine tecnico. Le conversazioni e gli scambi già conservati restano dati da preservare durante l'evoluzione dello schema.

#### Metadata
  * type: specification

#### Relations
  * define: [Migrazione automatica dell'archivio delle conversazioni](../Requirements/FamilyConversation.md#migrazione-automatica-dellarchivio-delle-conversazioni)
---

### Campo timeZone del componente Conversazioni

Decisione concordata con la persona il 19 ottobre 2026: il fuso orario della famiglia è un campo del modulo TypeScript del componente «Conversazioni», non la variabile `TZ` del processo, così resta nella configurazione validata all'avvio.

Il modulo TypeScript locale del componente «Conversazioni» ammette il campo facoltativo `timeZone`, una stringa con il nome di un fuso orario IANA accettato dal runtime, per esempio `Europe/Rome`. Quando il campo è assente il fuso effettivo è `UTC`, così le configurazioni esistenti restano valide. Un valore che non è una stringa, una stringa vuota o un nome che il runtime non riconosce come fuso orario rendono invalida la configurazione e impediscono l'avvio con il messaggio `Invalid conversation time zone`.

#### Metadata
  * type: specification

#### Relations
  * define: [Configurazione del fuso orario della conversazione](../Requirements/FamilyConversation.md#configurazione-del-fuso-orario-della-conversazione)
---

### Causa tecnica dell'errore del turno

Decisione concordata il 17 ottobre 2026, dopo la prova del canale con il backend installato, in cui i guasti della produzione della risposta non lasciavano alcuna diagnostica. Quando il caso d'uso del turno conclude un turno ammesso con l'esito di errore perché la lettura dello storico o la produzione della risposta ha lanciato un guasto o ha violato il contratto della risposta, per esempio senza l'indicazione `expectsReply`, l'esito `failed` restituito all'adapter di ingresso porta anche la causa tecnica originale, senza modificarla. Il caso d'uso non registra log e non conserva la causa: l'esito persistente contiene soltanto il messaggio pubblico. L'adapter del canale conversazionale, che decide l'esito comunicato al client, emette un solo evento `conversation_reply_failed` con `err` normalizzato secondo il contratto di normalizzazione diagnostica e con il `correlationId` della sessione; `turn.failed` e la trasmissione dell'errore mantengono il messaggio pubblico. Un esito `failed` senza causa tecnica non produce questo evento.

#### Metadata
  * type: behavior

#### Relations
  * define: [Diagnostica del guasto nella produzione della risposta](../Requirements/FamilyConversation.md#diagnostica-del-guasto-nella-produzione-della-risposta)
---

### Ciclo di vita della risorsa SQLite conversazionale

La composition root del server costruisce e possiede una risorsa SQLite/Kysely condivisa dagli adapter interessati. Gli adapter ricevono l'accesso necessario per le proprie operazioni e non ne controllano la chiusura; Domain e Application non ricevono handle tecnici SQLite o Kysely. Prima di abilitare il lavoro che dipende dall'archivio, il proprietario ne verifica l'apertura e completa le migrazioni richieste. Se la preparazione fallisce, chiude la risorsa già creata. Al termine del processo, la chiude dopo il completamento o l'interruzione delle operazioni che la usano. Non si prescrive un pool PostgreSQL né un numero di connessioni fisiche SQLite.

#### Metadata
  * type: specification

#### Relations
  * define: [Proprietà della risorsa SQLite conversazionale](../Requirements/FamilyConversation.md#proprietà-della-risorsa-sqlite-conversazionale)
---

### Configurazione facoltativa dell'interazione vocale

Un'installazione può non abilitare l'ingresso vocale. L'assenza della variabile di percorso `AMBROGIO_VOICE_CONFIG_PATH` lo disabilita: la composition root non legge file vocali e non costruisce né avvia Vosk o la sintesi vocale. I turni testuali del canale conversazionale restano utilizzabili con le proprie dipendenze, e i turni che trasmettono audio o chiedono la risposta in audio ricevono il rifiuto previsto. Nel formato a profilo singolo, quando il percorso è presente, il modulo TypeScript vocale contiene `voskModelPath` (directory del modello Vosk), `voiceEngine` (motore di sintesi, `piper` oppure `kokoro`), `voiceModelDir` (directory della voce o del modello di sintesi) e, soltanto con `kokoro`, `voiceSpeaker` (identificativo numerico della voce nel modello Kokoro, un intero non negativo) e `voiceLanguage` (codice di lingua espeak-ng per la fonetizzazione, una stringa non vuota). Rendono il file invalido un campo sconosciuto, compresi i precedenti `piperModelPath` e `piperBinaryPath`, l'assenza di `voiceEngine` o un suo valore diverso da `piper` e `kokoro`, la presenza di `voiceSpeaker` o `voiceLanguage` con `piper`, l'assenza di uno dei due con `kokoro`, un `voiceSpeaker` che non è un intero non negativo, compresi i nomi di voce accettati dalla prima versione, e un `voiceLanguage` vuoto o non stringa. L'intervallo di inattività della replica è configurato dal satellite. All'avvio la directory Vosk deve essere leggibile. Con `piper` la directory della voce deve contenere esattamente un file `.onnx`, il file `tokens.txt` e la directory `espeak-ng-data/`; con `kokoro` deve contenere esattamente un file `.onnx`, il file `voices.bin`, il file `tokens.txt` e la directory `espeak-ng-data/`; tutti devono essere leggibili. Un valore mancante o invalido, una risorsa assente o illeggibile, il fallimento del caricamento della voce o un `voiceSpeaker` fuori dalle voci del modello impediscono l'avvio prima dell'ascolto del server. La configurazione resta esterna all'immagine; l'immagine include i modelli Vosk, Piper e Kokoro italiani e inglesi del catalogo bilingue. I percorsi espliciti dei profili possono indicare modelli inclusi o modelli esterni montati. Il profilo per lingua basato su percorsi è definito dalla specifica «Selezione della voce inclusa dalla lingua conversazionale».

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

Application richiede all'archivio la persistenza delle transizioni complete del turno tramite un contratto dedicato; questo può esporre il salvataggio della conversazione come aggregato o operazioni di transizione esplicite. L'adapter SQLite/Kysely controlla la transazione breve. L'ammissione registra insieme il turno accettato e l'occupazione della conversazione interessata. La conclusione o l'interruzione registrano insieme l'esito persistente del turno e la liberazione dell'occupazione, salvo l'arresto che impedisce nuovi ingressi. Un errore in una delle scritture della transizione annulla l'intera transazione; il chiamante osserva il successo solo dopo il commit. Le chiamate ad agenti e connettori, la sintesi vocale e la trasmissione progressiva della risposta avvengono fuori da transazioni SQLite; la conferma `turn.completed` del protocollo conversazionale viene inviata solo dopo il commit dell'esito riuscito. Non è richiesto un coordinatore generico di transazioni esposto ai casi d'uso.

#### Metadata
  * type: specification

#### Relations
  * define: [Scritture atomiche dello stato dei turni](../Requirements/FamilyConversation.md#scritture-atomiche-dello-stato-dei-turni)
---

### Conteggio delle chiamate agli strumenti MCP per turno

Ogni modulo TypeScript di agente specializzato con sezione `mcp` contiene al primo livello `maxToolCalls`, un intero positivo. Il valore è obbligatorio per tali agenti e vale solo per quell'agente; il file di un agente senza `mcp` non contiene `maxToolCalls`, e la sua presenza rende il file invalido. Per ogni turno delegato, Ambrogio conta ogni chiamata a uno strumento MCP effettivamente richiesta dal modello dell'agente, anche quando più chiamate sono richieste nella stessa risposta del modello. Prima di inoltrare una chiamata che eccederebbe `maxToolCalls`, interrompe la produzione del turno con un guasto; il caso d'uso comunica e conserva il messaggio pubblico standard senza dettagli tecnici. Il contatore riparte da zero al turno successivo. Il limite non impedisce al modello di formulare una risposta finale dopo l'ultima chiamata consentita.

#### Metadata
  * type: specification

#### Relations
  * define: [Limite delle chiamate agli strumenti per agente](../Requirements/FamilyConversation.md#limite-delle-chiamate-agli-strumenti-per-agente)
---

### Credenziale Bearer per l'endpoint MCP

Nella configurazione di ogni agente specializzato, `mcp.auth` è facoltativo. Quando seleziona Bearer statico, è un oggetto con `type: "bearer"` e `token` stringa non vuota. Il client invia `Authorization: Bearer <token>` nelle richieste MCP dirette esclusivamente all'endpoint `mcp.url` di quell'agente. Quando `mcp.auth` è assente, il client non invia un header `Authorization` all'endpoint. Un tipo diverso da `bearer` e `oauth_client_credentials`, oppure un token Bearer mancante o vuoto, rende invalida la configurazione prima dell'attivazione dell'agente. Il token non è condiviso con altri agenti, non entra nei messaggi rivolti al modello linguistico e non compare in log o messaggi di errore. Il flusso OAuth con login interattivo non appartiene alla prima integrazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Autenticazione Bearer del client MCP](../Requirements/FamilyConversation.md#autenticazione-bearer-del-client-mcp)
---

### Credenziali OAuth tra servizi per l'endpoint MCP

Quando un agente specializzato usa OAuth tra servizi, la sua configurazione contiene `mcp.auth: { "type": "oauth_client_credentials", "clientId": "…", "clientSecret": "…", "issuer": "…" }`; può contenere `scope`, stringa non vuota se presente. `clientId` e `clientSecret` sono stringhe non vuote; `issuer` è l'identificativo URL assoluto HTTP o HTTPS dell'authorization server presso cui le credenziali sono registrate. Il client scopre l'authorization server tramite i metadata pubblicati dal server MCP e usa il flusso OAuth `client_credentials` del SDK MCP ufficiale. Prima di inviare il segreto, deve verificare che l'issuer scoperto corrisponda a quello configurato. Il client usa il token ottenuto soltanto per l'endpoint MCP di quell'agente; gestisce scadenza e rinnovo tramite il SDK durante la vita del processo senza richiedere un login nel browser. Credenziali e token non sono condivisi tra agenti, non entrano nei messaggi rivolti ai modelli e non compaiono in log o errori. La configurazione invalida impedisce l'attivazione dell'agente.

#### Metadata
  * type: specification

#### Relations
  * define: [Autenticazione OAuth tra servizi del client MCP](../Requirements/FamilyConversation.md#autenticazione-oauth-tra-servizi-del-client-mcp)
---

### Data e ora correnti nelle istruzioni degli agenti

Decisione concordata con la persona il 19 ottobre 2026: nella prova dell'agente meteo il modello, senza conoscere la data di oggi, sbagliava i giorni indicati dalla famiglia, per esempio il fine settimana o «giovedì».

A ogni turno delegato a un agente specializzato, con o senza connettore MCP, l'adapter legge l'istante corrente dalla capacità di orologio fornita dalla composition root e aggiunge alle istruzioni di sistema dell'agente, subito dopo le istruzioni del suo modulo TypeScript e prima delle istruzioni del server MCP e delle indicazioni sul formato della risposta, la riga `Current date and time: <data e ora> (<fuso>).`. `<data e ora>` è l'istante formattato nel fuso effettivo del componente «Conversazioni» con le convenzioni `en-GB` di `Intl.DateTimeFormat`: giorno della settimana e mese per esteso, giorno, anno, ore e minuti in formato 24 ore, per esempio `Monday, 19 October 2026 at 09:41`. `<fuso>` è il nome del fuso effettivo, per esempio `Europe/Rome` o `UTC`. L'orchestratore non riceve la riga, perché sceglie soltanto l'agente. La riga non viene conservata nello storico della conversazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Data e ora correnti per gli agenti specializzati](../Requirements/FamilyConversation.md#data-e-ora-correnti-per-gli-agenti-specializzati)
---

### Dati dei casi d'uso indipendenti dagli ingressi

Il caso d'uso del turno conversazionale riceve un input Application costruito dall'adapter di ingresso a partire dai dati già decodificati. I suoi dati di successo, compresi gli eventuali incrementi della risposta progressiva, hanno significato proprio del modulo e non sono messaggi del protocollo conversazionale, oggetti HTTP, righe di terminale o dati audio. Ogni adapter di ingresso converte tali valori nella rappresentazione richiesta dal proprio protocollo; il caso d'uso non restituisce direttamente oggetti Domain o rappresentazioni del trasporto. Il caso d'uso consegna prima la notifica di ammissione e poi ciascun incremento nell'ordine di produzione, attendendo che la consegna di una notifica sia terminata prima di iniziare la successiva. Tale attesa riguarda la consegna all'adapter, non la lettura da parte della persona. Se la consegna fallisce dopo l'ammissione, anche per un guasto tecnico diverso dalla disconnessione, il caso d'uso continua il turno e conserva l'esito prodotto senza trasformare il solo guasto di consegna in un errore conversazionale. L'adapter che esegue la consegna distingue la disconnessione dal guasto tecnico e registra quest'ultimo nel canale diagnostico prima che il caso d'uso ignori il fallimento della notifica; non delega al caso d'uso la classificazione o il log. La normale disconnessione del client non richiede di per sé un log di errore. Gli altri casi d'uso del modulo seguono lo stesso confine quando ricevono input o producono dati di successo.

#### Metadata
  * type: input-output

#### Relations
  * define: [Dati Application dei casi d'uso conversazionali](../Requirements/FamilyConversation.md#dati-application-dei-casi-duso-conversazionali)
---

### Direttiva di lingua per gli agenti specializzati

Decisione concordata il 21 ottobre 2026: i file degli agenti restano dell'utente e mantengono istruzioni, descrizioni e modello distinti. Il backend consegna a ogni agente specializzato una direttiva esplicita per rispondere nella lingua effettiva, italiana o inglese, scelta nel configurazione Conversazioni. La direttiva si applica agli agenti con e senza MCP; l'orchestratore non la riceve perché produce solo l'identificativo dell'agente. La direttiva orienta il modello, senza garantire deterministicamente la lingua del testo generato.

#### Metadata
  * type: specification

#### Relations
  * define: [Lingua configurata nelle risposte degli agenti](../Requirements/FamilyConversation.md#lingua-configurata-nelle-risposte-degli-agenti)
---

### Elenco degli strumenti MCP ammessi per agente

Decisione concordata con la persona il 19 ottobre 2026: un server MCP può esporre molti più strumenti di quelli che servono all'agente, e le loro definizioni entrano nel contesto del modello a ogni passo. Nella prova dell'agente meteo su Open-Meteo, 17 strumenti occupavano circa 106.000 caratteri di definizioni e portavano il turno vicino al tempo massimo di 30 secondi, mentre i due strumenti necessari ne occupavano circa 11.600.

Nella configurazione di ogni agente specializzato, `mcp.tools` è facoltativo. Quando è presente è un array non vuoto di stringhe non vuote e distinte, ciascuna uguale al nome di uno strumento come dichiarato dal server MCP, non al nome presentato al modello. Un valore che non è un array, un array vuoto, un elemento che non è una stringa non vuota o un nome ripetuto rendono invalida la configurazione prima dell'attivazione dell'agente.

Quando `mcp.tools` è assente, l'agente riceve tutti gli strumenti scoperti, come prima di questa decisione. Quando è presente, dopo la scoperta all'avvio Ambrogio conserva soltanto gli strumenti scoperti il cui nome compare nell'elenco, nell'ordine della lista scoperta; soltanto questi sono offerti al modello, e i loro nomi presentati e l'indice di `mcp_<indice>` restano quelli definiti per la lista scoperta completa. Una chiamata del modello a un nome che non corrisponde a uno strumento offerto non raggiunge il server MCP. Il filtro non cambia i prompt del server letti a ogni turno né il conteggio di `maxToolCalls`.

Se un nome di `mcp.tools` non corrisponde a nessuno strumento scoperto all'avvio, il server non si avvia, come quando il server MCP dell'agente non è raggiungibile; il messaggio diagnostico è `Agent MCP tool unavailable: <id>`, dove `<id>` è l'identificatore dell'agente, e non contiene URL né credenziali.

#### Metadata
  * type: specification

#### Relations
  * define: [Selezione degli strumenti MCP offerti all'agente](../Requirements/FamilyConversation.md#selezione-degli-strumenti-mcp-offerti-allagente)
---

### Esclusione dell'audio persistente

L'audio acquisito dalla famiglia e quello generato per la risposta possono essere trattati durante l'interazione, ma non fanno parte dello stato persistente della conversazione. Nessuna registrazione audio del turno o della risposta viene conservata.

#### Metadata
  * type: constraint

#### Relations
  * define: [Conservazione solo testuale della conversazione](../Requirements/FamilyConversation.md#conservazione-solo-testuale-della-conversazione)
---

### Esempi inglesi delle configurazioni degli agenti

Decisione concordata il 21 ottobre 2026: gli esempi distribuiti di generic.ts e orchestrator.ts e le descrizioni degli agenti specializzati sono scritti in inglese. Il testo di generic.ts non prescrive direttamente italiano o inglese; la direttiva della lingua della risposta è aggiunta dal backend. L'orchestratore resta configurato dall'utente e l'esempio inglese gli chiede soltanto di scegliere un agente, senza fissare la lingua delle risposte.

#### Metadata
  * type: specification

#### Relations
  * define: [Esempi degli agenti in inglese](../Requirements/FamilyConversation.md#esempi-degli-agenti-in-inglese)
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

### Indicazione della replica attesa

Durante la generazione della risposta a ogni turno, il caso d'uso condiviso riceve dall'agente il booleano strutturato `expectsReply` insieme al testo, senza una seconda chiamata al modello dedicata alla classificazione. Il backend lo comunica nel campo `expectsReply` di `turn.completed`. Il valore vale soltanto per quella risposta, non si deduce dalla punteggiatura e non dipende dal tipo di contenuto del turno o della risposta. Un valore mancante o non booleano costituisce un guasto della produzione della risposta e non viene presentato come `false`. I turni rifiutati, falliti o interrotti non comunicano `expectsReply` e il client li tratta come conclusivi. L'uso dell'indicazione, per esempio l'apertura di una replica senza wake word, è responsabilità del client.

#### Metadata
  * type: specification

#### Relations
  * define: [Segnalazione della replica attesa](../Requirements/FamilyConversation.md#segnalazione-della-replica-attesa)
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

Ogni agente attivo, compreso l'orchestratore, riceve il proprio testo di istruzioni dal campo `instructions` del modulo TypeScript locale dedicato a quell'agente, gestito dall'utente in `/etc/ambrogio/agents`. Il server carica e valida il file prima di costruire l'agente e mantiene separate le istruzioni dei diversi agenti. Le istruzioni sono consegnate al modello dell'agente come istruzioni, insieme al contesto del compito, senza essere incorporate nel codice o negli esempi versionati.

#### Metadata
  * type: specification

#### Relations
  * define: [Istruzioni dell'agente nel modulo TypeScript dell'utente](../Requirements/FamilyConversation.md#istruzioni-dellagente-nel-modulo-typescript-dellutente)
---

### Lingua nella configurazione conversazionale

Il modulo TypeScript locale del componente «Conversazioni», già usato per i limiti della paginazione, ammette il campo opzionale `language`, una stringa con `en` per l'inglese o `it` per l'italiano. Se il campo è assente o contiene una lingua non supportata, la lingua effettiva è `en`. Un valore non stringa è una struttura incompatibile e impedisce l'attivazione dell'ingresso interessato. Il modulo può ricavare `language` da una variabile d'ambiente e lo consegna alla stessa validazione. La lingua effettiva guida anche la selezione dei modelli vocali inclusi e la direttiva di lingua consegnata agli agenti specializzati, secondo le rispettive specifiche.

#### Metadata
  * type: specification

#### Relations
  * define: [Localizzazione dell'errore conversazionale inatteso](../Requirements/FamilyConversation.md#localizzazione-dellerrore-conversazionale-inatteso)
---

### Messaggio standard del guasto conversazionale

Per un guasto inatteso di un turno già ammesso, il server sceglie il messaggio pubblico secondo `language` nel medesimo modulo TypeScript locale del componente «Conversazioni» che configura la paginazione. Le lingue inizialmente supportate sono `en` e `it`; se la lingua non è indicata oppure non è supportata, usa `en`. La formulazione inglese è «I can't complete the response.»; quella italiana è «Non riesco a completare la risposta.». La composition root passa al caso d'uso la formulazione scelta dai valori di configurazione, senza far leggere il file al caso d'uso. Il caso d'uso usa il medesimo testo per l'esito persistente e per la comunicazione al client.

#### Metadata
  * type: input-output

#### Relations
  * define: [Localizzazione dell'errore conversazionale inatteso](../Requirements/FamilyConversation.md#localizzazione-dellerrore-conversazionale-inatteso)
---

### Nome degli strumenti presentati al modello

Decisione concordata con la persona il 18 ottobre 2026, che sostituisce la presentazione di ogni strumento con il nome posizionale `mcp_<indice>`: il nome dello strumento aiuta il modello a sceglierlo, per esempio `HassTurnOff` o `GetLiveContext` di Home Assistant.

L'adapter presenta al modello ogni strumento scoperto con il nome dichiarato dal server MCP quando il nome rispetta l'espressione `^[A-Za-z_][A-Za-z0-9_-]{0,63}$` e non ha la forma riservata `mcp_<cifre>`. L'espressione è la regola prudente comune ai provider ammessi: i fornitori compatibili con le API di OpenAI accettano lettere, cifre, trattini bassi e trattini fino a 64 caratteri, e la documentazione di Mistral non dichiara i caratteri ammessi; i nomi MCP possono contenere anche il punto, che quei fornitori rifiutano. Uno strumento con un nome diverso è presentato con il nome `mcp_<indice>`, dove l'indice è la posizione nella lista scoperta a partire da 0; la forma riservata impedisce collisioni con i nomi dichiarati. La descrizione e lo schema degli argomenti restano quelli del server. Una chiamata del modello è inoltrata con il nome originale dello strumento corrispondente e conta per `maxToolCalls` come prima.

Decisione concordata con la persona il 18 ottobre 2026, insieme all'introduzione di più provider, che sostituisce l'espressione `^[A-Za-z0-9_-]{1,64}$`: l'API Gemini richiede che il nome di una funzione inizi con una lettera o un trattino basso, quindi un nome che inizia con una cifra o un trattino riceve il nome posizionale. Fonte: https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/Shared.Types/FunctionDeclaration .

#### Metadata
  * type: specification

#### Relations
  * define: [Nomi degli strumenti MCP offerti al modello](../Requirements/FamilyConversation.md#nomi-degli-strumenti-mcp-offerti-al-modello)
---

### Occupazione della conversazione e ammissione dei turni

L'ammissione è atomica per identificativo di conversazione ed è condivisa da tutti i turni, testuali e vocali, di qualunque client. Ogni conversazione è occupata dall'accettazione di un turno fino alla conservazione del suo esito o dello stato `interrotto`. Richieste simultanee sulla stessa conversazione ammettono al massimo un turno; le altre ricevono un rifiuto previsto, senza persistenza né accodamento. Turni di conversazioni diverse possono essere ammessi ed elaborati in parallelo; anche due richieste che creano conversazioni nuove non si escludono reciprocamente. Storico, risposta ed esito di un turno restano associati alla propria conversazione. L'arresto impedisce nuove ammissioni in tutte le conversazioni. Al riavvio, dopo le migrazioni e prima degli ingressi, i turni rimasti `in elaborazione` diventano `interrotti` e le rispettive occupazioni vengono liberate atomicamente. Una conclusione tardiva non sostituisce lo stato `interrotto`. Le transazioni SQLite restano brevi: non includono produzione remota o streaming. La serializzazione delle scritture SQLite non impone la serializzazione dell'intera elaborazione.

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

### Percorso dell'archivio nella configurazione Conversazioni

Per l'ingresso HTTP di consultazione, il modulo TypeScript del componente «Conversazioni» richiede `archivePath`, stringa non vuota che indica il file SQLite da aprire. Il percorso è letto insieme agli altri campi del componente una sola volta, prima dell'apertura dell'archivio. Il modulo può ricavarlo da una variabile d'ambiente prima della validazione. Gli ingressi che non richiedono un archivio conservano i propri obblighi di configurazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Selezione dell'archivio conversazionale all'avvio](../Requirements/FamilyConversation.md#selezione-dellarchivio-conversazionale-allavvio)
---

### Presentazione degli agenti specializzati all'orchestratore

Ogni modulo TypeScript di agente specializzato contiene al primo livello `description`, una stringa non vuota che descrive la capacità dell'agente per la scelta dell'agente. L'orchestratore riceve l'identificativo e la descrizione degli agenti attivi nell'elenco aggiunto alle sue istruzioni, e gli identificativi come valori ammessi dello schema della sua risposta strutturata; non riceve le loro istruzioni o credenziali. Il file `orchestrator.ts` non richiede `description`.

#### Metadata
  * type: specification

#### Relations
  * define: [Descrizione degli agenti specializzati per l'orchestrazione](../Requirements/FamilyConversation.md#descrizione-degli-agenti-specializzati-per-lorchestrazione)
---

### Produzione della risposta con Vercel AI SDK

La produzione delle risposte dell'orchestratore e degli agenti specializzati usa un adapter del componente «Conversazioni» basato su Vercel AI SDK, con il provider indicato nel modulo TypeScript di ciascun agente. L'adapter implementa la porta applicativa `ProduceConversationReply`: riceve a ogni turno lo storico dall'archivio comune e la richiesta di annullamento, che converte in un `AbortSignal` dell'SDK, restituisce l'identificativo dell'agente scelto, i frammenti testuali della risposta e l'indicazione strutturata `expectsReply`, con un unico percorso di generazione indipendente dal tipo di contenuto del turno, e mantiene i tipi dell'SDK fuori da Domain e Application. L'adapter del canale conversazionale presenta frammenti ed esito secondo il protocollo `ambrogio.v1`.

Decisione concordata con la persona il 18 ottobre 2026, che sostituisce il provider Mistral unico: `llm.provider` sceglie il pacchetto di provider ufficiale di AI SDK con cui l'adapter costruisce il modello dell'agente. I valori ammessi sono `mistral` (`@ai-sdk/mistral`), `openai` (`@ai-sdk/openai`), `anthropic` (`@ai-sdk/anthropic`), `google` (`@ai-sdk/google`, API Gemini di Google AI Studio) e `openai-compatible` (`@ai-sdk/openai-compatible`). Con i primi quattro l'adapter usa l'endpoint predefinito del provider e la configurazione non contiene un URL. Con `openai-compatible` la configurazione contiene `llm.baseURL`, URL HTTP o HTTPS assoluto di un'API compatibile con OpenAI, per esempio un server locale o un aggregatore di modelli; l'adapter dichiara al pacchetto il supporto dell'output strutturato, così che la richiesta contenga lo schema JSON (`response_format` di tipo `json_schema`). Gli altri provider non ammettono `baseURL`. I provider che richiedono credenziali diverse da una chiave API, come Amazon Bedrock, Google Vertex AI o Azure OpenAI, non sono supportati.

La configurazione TypeScript contiene `llm.provider`, `model`, `apiKey`, `baseURL` soltanto con `openai-compatible`, e le sole `options` facoltative `temperature` e `max_tokens`, uguali per tutti i provider. L'adapter valida le opzioni prima dell'attivazione e le traduce nelle impostazioni comuni dell'AI SDK `temperature` e `maxOutputTokens`; omette quelle assenti. Il provider e il modello scelti devono supportare il tool calling e l'output strutturato con schema JSON e, per gli agenti con connettore MCP, entrambi nella stessa richiesta: per esempio i modelli Gemini li combinano soltanto dalla serie 3. Un errore del provider dovuto a una funzionalità non supportata è un guasto della produzione della risposta: il turno termina con il messaggio pubblico standard. Il client MCP comune esistente conserva connessione, autenticazione e ciclo di vita; i suoi tool sono adattati all'AI SDK senza esporre credenziali al modello. L'orchestratore sceglie un solo agente per turno secondo il contratto della scelta dell'agente; gli agenti con connettore MCP rispettano il limite di chiamate per turno previsto dagli altri contratti.

#### Metadata
  * type: specification

#### Relations
  * define: [Risposta testuale nella conversazione](../Requirements/FamilyConversation.md#risposta-testuale-nella-conversazione)
---

### Profilo del connettore Home Assistant

Decisione concordata con la persona il 18 ottobre 2026. Il connettore Home Assistant non richiede codice dedicato: è un agente specializzato configurato con il client MCP comune, il trasporto Streamable HTTP e il Bearer statico già definiti. La sezione `mcp.url` indica l'endpoint `/api/mcp` dell'integrazione ufficiale «Model Context Protocol Server» di Home Assistant, per esempio `http://homeassistant.local:8123/api/mcp`; `mcp.auth` ha `type: "bearer"` e `token` pari a un token di accesso di lunga durata creato nel profilo dell'utente Home Assistant, nella scheda Sicurezza. Home Assistant offre ai client MCP soltanto le entità esposte ad Assist: la scelta dei dispositivi che Ambrogio può consultare o comandare appartiene alla configurazione di Home Assistant. L'autorizzazione OAuth con login interattivo e PKCE offerta da Home Assistant non è usata, perché il client MCP di Ambrogio non supporta flussi con login nel browser. Fonte: https://www.home-assistant.io/integrations/mcp_server/ .

Il repository fornisce `examples/agents/home-assistant.ts`, da montare in `/etc/ambrogio/agents/home-assistant.ts`, che definisce l'agente con identificativo `home-assistant`. Il modulo contiene `description` e `instructions`, seleziona per default Mistral e `mistral-medium-latest`, imposta `maxToolCalls: 5` e legge da variabili d'ambiente la chiave API, l'URL MCP e il token Bearer. In assenza di tali valori la validazione impedisce l'avvio dell'agente.

Decisione concordata con la persona il 18 ottobre 2026, che sostituisce le istruzioni precedenti dopo che l'agente aveva acceso una luce a una domanda sul suo stato e non riusciva a spegnere tutte le luci. Le `instructions` chiedono di rispondere brevemente; lasciano scegliere liberamente fra gli strumenti disponibili, usando quelli che la richiesta richiede; per una domanda sullo stato di un dispositivo o di un sensore chiedono di leggere lo stato corrente senza accendere, spegnere o modificare nulla; chiedono di modificare un dispositivo soltanto quando l'utente chiede una modifica; quando l'utente indica più dispositivi, per esempio tutte le luci o le luci di una stanza, chiedono di agire su tutti, usando l'area o il tipo di dispositivo quando uno strumento lo consente; chiedono di dichiarare un'azione eseguita soltanto dopo la conferma di uno strumento e di dire quando uno strumento fallisce o un dispositivo non è disponibile. L'elenco dei dispositivi e le indicazioni d'uso degli strumenti non sono ripetuti nelle istruzioni: arrivano dal prompt del server MCP di Home Assistant, letto a ogni turno.

Decisione concordata con la persona il 18 ottobre 2026, che sostituisce la richiesta di rispondere in italiano: come gli altri esempi distribuiti e la documentazione utente, le `instructions` dell'esempio sono in inglese e non indicano una lingua di risposta. Chi installa aggiunge alle `instructions` la lingua della propria famiglia.

#### Metadata
  * type: specification

#### Relations
  * define: [Connettore Home Assistant tramite il server MCP di Home Assistant](../Requirements/FamilyConversation.md#connettore-home-assistant-tramite-il-server-mcp-di-home-assistant)
---

### Profilo del trasporto MCP iniziale

Per la prima implementazione, ogni agente specializzato usa il medesimo client MCP basato su `@modelcontextprotocol/client` versione 2.3.1, con trasporto Streamable HTTP verso l'endpoint indicato in `mcp.url` nel proprio modulo TypeScript. `mcp.url` è un URL HTTP o HTTPS assoluto. Il client segue il ciclo di inizializzazione del protocollo e usa la connessione per scoprire e invocare i tool del server configurato. La sezione `mcp` non contiene un campo `transport` e non richiede un comando locale da eseguire: il trasporto iniziale è determinato dal contratto. L'autenticazione segue i contratti del Bearer statico e di OAuth `client_credentials`. La compatibilità con il precedente trasporto HTTP+SSE sarà valutata separatamente prima di introdurla; il trasporto stdio non appartiene alla prima implementazione.

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

### Profilo dell'ingresso conversazionale con agenti

L'ingresso eseguibile valida prima dell'ascolto i moduli TypeScript HTTP, Conversazioni e degli agenti attivi e, se configurato, quello della voce, apre l'archivio e recupera i turni pendenti, prepara gli adapter dei provider e i client MCP degli agenti specializzati che hanno un connettore MCP, quindi registra il canale conversazionale `/api/session` insieme ai due GET già disponibili. Il canale usa l'agente orchestratore come produttore concreto della risposta tramite la porta Application `ProduceConversationReply`: l'orchestratore sceglie l'agente e l'agente scelto formula la risposta. Quando la voce è configurata usa Vosk per trascrivere i turni audio e sherpa-onnx, con la voce caricata prima dell'ascolto, per le risposte richieste in audio. La politica CORS riguarda le rotte GET; l'apertura del canale segue il controllo dell'origine definito per la sessione. L'arresto dell'ingresso segue la politica generale del ciclo di vita del server; le richieste ai provider e ai connettori vengono annullate esplicitamente solo alla scadenza del tempo massimo della produzione della risposta.

#### Metadata
  * type: specification

#### Relations
  * define: [Avvio dell'ingresso dei turni conversazionali](../Requirements/FamilyConversation.md#avvio-dellingresso-dei-turni-conversazionali)
---

### Profilo della configurazione del modello per agente

Ogni agente attivo ha un modulo TypeScript locale separato, gestito dall'utente e individuato in `/etc/ambrogio/agents`. Il file contiene al primo livello `instructions` e `llm`. `instructions` è il testo delle istruzioni dell'agente. `llm` è un oggetto con i campi `provider`, `model` e `apiKey`, che indicano rispettivamente l'adapter del fornitore, l'identificativo del modello e la chiave API; può contenere `options`, un oggetto di opzioni specifiche del provider. L'orchestratore e ciascun agente specializzato usano i valori del proprio file. La composition root valida i campi comuni e consegna le opzioni all'adapter selezionato, che valida i campi specifici prima di attivare l'agente. I file dell'utente non sono materiale versionato del repository.

Decisione concordata con la persona il 17 ottobre 2026, che sostituisce l'obbligo della sezione `mcp` per ogni agente specializzato: nel file di un agente specializzato la sezione `mcp` è facoltativa. Quando è presente contiene `url` e l'eventuale `auth` definiti dai contratti del trasporto MCP e delle credenziali, e il file contiene anche `maxToolCalls`. Quando è assente l'agente ha soltanto `description`, `instructions` e `llm`: risponde con il proprio modello e le proprie istruzioni, senza strumenti, e il file non può contenere `maxToolCalls`. Così agenti con modelli diversi possono essere definiti dalle sole istruzioni.

Decisione concordata con la persona il 18 ottobre 2026: `provider` assume uno dei valori ammessi dal contratto della produzione della risposta e agenti diversi possono usare provider diversi. Quando `provider` è `openai-compatible`, `llm` contiene anche `baseURL`, l'indirizzo dell'endpoint; con gli altri provider `baseURL` non è ammesso. Un valore di `provider` non ammesso, un `baseURL` mancante o non valido con `openai-compatible` o presente con un altro provider rendono invalido il file e impediscono l'avvio.

#### Metadata
  * type: specification

#### Relations
  * define: [Configurazione del modello per agente](../Requirements/FamilyConversation.md#configurazione-del-modello-per-agente)
---

### Prompt del server MCP letti a ogni turno

Decisione concordata con la persona il 18 ottobre 2026, dopo che l'agente Home Assistant dell'installazione di riferimento aveva acceso una luce a una domanda sul suo stato e non riusciva a spegnere tutte le luci: il server MCP di Home Assistant offre un prompt con le indicazioni d'uso degli strumenti, compreso l'uso di `GetLiveContext` per le domande sullo stato, e con l'elenco delle aree e dei dispositivi esposti ad Assist, che il backend non consegnava al modello. Fonti: https://www.home-assistant.io/integrations/mcp_server/ e il sorgente di Home Assistant `homeassistant/components/mcp_server/server.py` e `homeassistant/components/homeassistant/llm.py`.

All'avvio, dopo la scoperta degli strumenti, il backend chiede la lista dei prompt (`prompts/list`) soltanto se il server dichiara la capacità `prompts` nell'inizializzazione; un server che non la dichiara non ha prompt. Conserva, nell'ordine della lista, i nomi dei prompt che non hanno argomenti obbligatori; i prompt con argomenti obbligatori sono ignorati perché il backend non saprebbe valorizzarli. Un errore della lista all'avvio è un guasto della connessione dell'agente, segnalato come `Agent MCP connection failed: <id>`.

A ogni turno delegato a quell'agente, prima di chiamare il modello, il backend legge ciascun prompt conservato con `prompts/get`, senza argomenti, così che dispositivi esposti, rinominati o spostati di area in Home Assistant valgano dal turno successivo senza riavvio. Il testo di un prompt è la concatenazione, separata da una riga vuota, dei contenuti di tipo testo dei suoi messaggi; gli altri tipi di contenuto sono ignorati. Le istruzioni consegnate al modello sono, nell'ordine: le istruzioni del modulo TypeScript dell'agente, una riga vuota, l'intestazione `Instructions and context from the connected MCP server:` seguita dai testi dei prompt separati da una riga vuota, e infine le indicazioni sul formato della risposta. Senza prompt conservati le istruzioni restano quelle del modulo TypeScript con le indicazioni sul formato. Le letture usano il segnale di annullamento del turno e rientrano nel tempo massimo di 30 secondi della produzione della risposta; non contano per `maxToolCalls`. Se una lettura fallisce, il turno termina con il guasto e il messaggio pubblico standard, con causa tecnica `MCP prompt retrieval failed` per la diagnostica `conversation_reply_failed`. Il testo dei prompt non viene registrato nei log.

#### Metadata
  * type: specification

#### Relations
  * define: [Istruzioni del server MCP per l'agente](../Requirements/FamilyConversation.md#istruzioni-del-server-mcp-per-lagente)
---

### Proprietà dei controlli del turno conversazionale

L'adapter del canale conversazionale possiede la verifica della forma dei messaggi e della decodifica del proprio protocollo: ferma i dati non validi prima del caso d'uso, senza decidere invarianti o precondizioni di business. Application riceve dati già interpretati e coordina le precondizioni che richiedono contesto, per esempio il recupero della conversazione richiesta, tramite porte; un rifiuto previsto ferma il turno prima degli effetti successivi. Domain garantisce gli stati e le transizioni del singolo turno anche se un ingresso ha eseguito controlli preliminari. L'archivio SQLite garantisce atomicamente l'ammissione di al massimo un turno attivo per conversazione; una lettura o un controllo preliminare non sostituisce tale garanzia. I controlli pubblici aggiuntivi sono ammessi solo se servono al rispettivo confine e non ridefiniscono la regola autorevole di un altro livello.

#### Metadata
  * type: specification

#### Relations
  * define: [Validazione del formato negli ingressi conversazionali](../Requirements/FamilyConversation.md#validazione-del-formato-negli-ingressi-conversazionali)
---

### Pulizia della marcatura Markdown prima della sintesi

Ogni frase, dopo la separazione e prima della sintesi, è ripulita dalla marcatura Markdown; la pulizia riguarda solo il testo consegnato alla sintesi e non modifica il testo della risposta trasmesso al client né lo scambio conservato. Le regole sono applicate alla singola frase:

- collegamenti `[testo](indirizzo)` e immagini `![testo](indirizzo)` sono sostituiti dal solo testo;
- i delimitatori del codice, cioè apici inversi singoli o ripetuti, sono rimossi e il loro contenuto resta;
- gli asterischi e le tilde doppie sono rimossi ovunque; i trattini bassi sono rimossi solo quando delimitano un'enfasi, cioè quando non stanno fra due lettere o cifre, così i nomi composti con trattino basso restano intatti;
- all'inizio della frase, che include ogni inizio di riga perché l'a capo separa le frasi, sono rimossi i segni di titolo `#`, di citazione `>` e di elenco puntato `-`, `*` e `+` seguiti da spazio; gli elenchi numerati restano;
- in una riga di tabella le barre verticali iniziali e finali sono rimosse e quelle interne sostituite da una virgola seguita da spazio; le righe che contengono solo barre, trattini, due punti e spazi sono scartate, come le linee orizzontali `---`, `***` e `___`;
- dopo la pulizia gli spazi sono compressi; una frase rimasta senza lettere o cifre non viene sintetizzata.

Una marcatura che si estende su più frasi è ripulita in ciascuna frase per i soli simboli che contiene; un collegamento spezzato fra due frasi può lasciare parentesi o indirizzo, che restano pronunciati.

#### Metadata
  * type: behavior

#### Relations
  * define: [Risposta parlata senza marcatura testuale](../Requirements/FamilyConversation.md#risposta-parlata-senza-marcatura-testuale)
---

### Responsabilità di Domain Application e adapter

Nel modulo business «Conversazioni», Domain contiene le regole e i tipi del dominio della conversazione; Application contiene i casi d'uso e le porte necessarie per collaborare con componenti esterni; gli adapter realizzano gli ingressi del modulo e le integrazioni tecniche richieste dalle porte. Questa suddivisione riguarda le responsabilità del codice, indipendentemente dai percorsi delle cartelle.

#### Metadata
  * type: specification

#### Relations
  * define: [Separazione delle responsabilità nel modulo Conversazioni](../Requirements/FamilyConversation.md#separazione-delle-responsabilità-nel-modulo-conversazioni)
---

### Ricerca dei file degli agenti nella directory del prodotto

Il server cerca i moduli TypeScript degli agenti nella directory `/etc/ambrogio/agents`. In Docker l'installatore può montare una directory di configurazione scelta sull'host in `/etc/ambrogio`, così da fornire `agents/` insieme agli altri moduli TypeScript locali senza incorporarli nell'immagine. La directory contiene configurazioni gestite dall'utente. Il nome `orchestrator.ts` identifica l'orchestratore ed è riservato. Ogni altro file `<id>.ts` identifica un agente specializzato: `id` inizia con una lettera minuscola e prosegue soltanto con lettere minuscole, cifre o trattini, secondo `^[a-z][a-z0-9-]*$`; `orchestrator` non è un identificativo valido per un agente specializzato. Ogni modulo TypeScript con nome valido presente nella directory è preso in carico secondo il contratto di attivazione degli agenti e quello di bootstrap dei componenti.

#### Metadata
  * type: specification

#### Relations
  * define: [Scoperta delle configurazioni degli agenti](../Requirements/FamilyConversation.md#scoperta-delle-configurazioni-degli-agenti)
---

### Risposta HTTP dell'elenco conversazioni

`GET /api/conversations` legge la prima pagina. Il parametro di query opzionale `cursor` richiede la pagina successiva; il parametro opzionale `limit` indica un intero decimale da 1 a `maxListPageSize` incluso. Se `limit` manca, si usa `listPageSize` dal configurazione conversazionale. La risposta `200` ha `Content-Type: application/json`, `Cache-Control: no-store` e corpo `{ "items": [{ "id": "...", "lastActivityAt": "..." }], "nextCursor": null }`. `items` segue l'ordine dell'archivio, `lastActivityAt` è una stringa ISO 8601 UTC e `nextCursor` è una stringa quando esiste un'altra pagina, altrimenti `null`.

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

### Risposta dell'agente senza connettore MCP

Decisione concordata con la persona il 17 ottobre 2026. Un agente specializzato il cui file non contiene `mcp` è preparato senza aprire connessioni MCP e senza scoprire strumenti. Quando l'orchestratore lo sceglie, l'adapter AI SDK gli consegna le sue istruzioni, con la stessa indicazione del formato della risposta degli altri agenti, e lo storico conservato della conversazione, senza offrire strumenti al modello; l'agente produce in streaming il testo della risposta e l'indicazione `expectsReply` con lo stesso output strutturato degli altri agenti. Per questo agente non si applica un limite di chiamate agli strumenti. Lo stesso agente può usare un modello diverso da quello degli altri agenti, indicato nel proprio `llm`; per esempio un agente generico che risponde con la conoscenza del modello.

#### Metadata
  * type: behavior

#### Relations
  * define: [Agente specializzato senza connettore MCP](../Requirements/FamilyConversation.md#agente-specializzato-senza-connettore-mcp)
---

### Scelta dell'agente con risposta strutturata dell'orchestratore

Decisione concordata con la persona il 17 ottobre 2026, che sostituisce la precedente delega mediante chiamata di funzione, in cui l'orchestratore poteva rispondere direttamente oppure chiamare una funzione senza argomenti con il nome dell'agente, con le chiamate parallele disattivate. L'orchestratore è un selettore: non formula mai la risposta del turno. Riceve lo storico conservato della conversazione e restituisce, tramite l'output strutturato dell'AI SDK e non tramite chiamate di funzione, un oggetto JSON con il solo campo `agent`, il cui valore appartiene all'elenco chiuso degli identificativi degli agenti specializzati attivi, dichiarato come `enum` nello schema JSON. Alle istruzioni configurate dell'orchestratore l'adapter aggiunge l'elenco degli agenti attivi con identificativo e `description` e la richiesta di scegliere l'agente che deve rispondere all'ultimo messaggio della famiglia. La richiesta di scelta non è trasmessa in streaming alla famiglia e non produce testo della risposta.

L'agente scelto riceve lo stesso storico conservato, il cui ultimo turno contiene il testo originale della famiglia, senza un compito riformulato, e formula l'intera risposta con la relativa indicazione `expectsReply`, trasmessa come risposta del turno senza ulteriori chiamate all'orchestratore. Un'uscita mancante, non conforme allo schema o con un identificativo che non corrisponde esattamente a un agente attivo è un guasto tecnico della produzione della risposta: il turno termina con il messaggio pubblico previsto e nessun agente viene attivato. Le istruzioni e le credenziali degli agenti specializzati restano nei loro adapter.

Motivazione registrata con le misure del 17 ottobre 2026 sul server installato, con le istruzioni generali dell'orchestratore e tre ripetizioni per caso: `mistral-small-latest` come orchestratore che poteva rispondere ha passato all'agente Home Assistant richieste generali che seguivano un turno precedente, per esempio «fammi una domanda» 3 volte su 3 e «in section» dopo una domanda sul film preferito; `mistral-medium-latest` ha scelto correttamente in tutti questi casi con primo testo in 0,25–0,6 secondi, come `mistral-small-latest`, ma, potendo rispondere da solo, ha risposto «Ho spento la luce in camera» a «spegnila» senza delegare, 3 volte su 3, dichiarando un'azione mai eseguita; `mistral-large-latest` ha fallito ogni delega con `AI_NoOutputGeneratedError`. Un orchestratore che non può rispondere elimina strutturalmente le azioni dichiarate e non eseguite. Il modello consigliato per l'orchestratore nell'installazione è `mistral-medium-latest`; la scelta del modello resta nel file `orchestrator.ts` dell'utente.

#### Metadata
  * type: behavior

#### Relations
  * define: [Orchestrazione della risposta conversazionale](../Requirements/FamilyConversation.md#orchestrazione-della-risposta-conversazionale)
---

### Schema delle richieste HTTP conversazionali

Le rotte HTTP JSON di elenco e storico dichiarano con TypeBox la forma delle parti di richiesta che usano: query e parametri di percorso. Fastify valida tali schemi con Ajv prima del gestore. Gli oggetti di richiesta dichiarati sono chiusi: campi non previsti producono un rifiuto, senza essere eliminati. La configurazione Ajv dell'ingresso usa `coerceTypes: false`, `useDefaults: false`, `removeAdditional: false` e `allErrors: false`; la validazione non converte tipi, inserisce valori predefiniti né altera i dati ricevuti.

Lo schema controlla la forma del protocollo. L'adapter converte esplicitamente le rappresentazioni ammesse nei dati Application, come il limite decimale e il cursore dell'elenco. Le precondizioni contestuali e gli invarianti restano ai rispettivi proprietari. Un errore di schema o di conversione interrompe la richiesta prima del caso d'uso e viene presentato secondo il contratto HTTP pubblico della rotta. Questa scelta non introduce la pubblicazione OpenAPI. I messaggi del canale conversazionale seguono invece lo schema JSON del protocollo `ambrogio.v1`.

#### Metadata
  * type: specification

#### Relations
  * define: [Validazione strutturale delle richieste conversazionali HTTP](../Requirements/FamilyConversation.md#validazione-strutturale-delle-richieste-conversazionali-http)
---

### Selezione della voce inclusa dalla lingua conversazionale

Decisione concordata il 21 ottobre 2026 e precisata con la persona: la lingua effettiva del componente Conversazioni è la sorgente comune per messaggi pubblici, trascrizione Vosk e sintesi. Il file vocale può avere `languages`, un oggetto con profili `it` ed `en`; ciascun profilo usa gli stessi campi del file vocale esistente: `voskModelPath`, `voiceEngine`, `voiceModelDir` e, con Kokoro, `voiceSpeaker` e `voiceLanguage`. I percorsi sono quelli visibili nel container: possono puntare alle directory incluse nell'immagine oppure a directory fornite da mount Docker Compose, senza ID di catalogo o tabella fissa di modelli. All'avvio viene richiesto e validato il profilo della lingua effettiva in `conversations.json`; l'altro profilo è facoltativo e viene validato strutturalmente, senza caricarne i modelli. Restano validi i file vocali precedenti con un singolo profilo alla radice, per non interrompere le installazioni esistenti. La voce resta disabilitata quando manca `AMBROGIO_VOICE_CONFIG_PATH`.

#### Metadata
  * type: specification

#### Relations
  * define: [Selezione dei modelli vocali inclusi per lingua](../Requirements/FamilyConversation.md#selezione-dei-modelli-vocali-inclusi-per-lingua)
---

### Semantica locale delle porte verso servizi esterni

Ogni porta outbound di Application descrive una capacità coerente richiesta da uno o più casi d'uso del modulo «Conversazioni». Nomi delle operazioni, input, output e rifiuti descrivono il significato per il modulo, senza riprodurre automaticamente metodi, payload o tipi di SDK, protocollo o API del fornitore. L'adapter realizza la porta e converte richieste, risposte e rifiuti fra le due rappresentazioni. La granularità delle porte segue le capacità effettivamente richieste, senza imporre un numero di operazioni per porta.

La capacità di produzione della risposta riceve il contesto applicativo dello storico conservato e una richiesta di annullamento definita in Application, consegna l'eventuale identificativo dell'agente che formula la risposta e i nuovi frammenti testuali nell'ordine di produzione insieme all'indicazione strutturata della replica attesa e permette al coordinamento applicativo di distinguere conclusione e guasto della produzione. Le firme possono evolvere per usare i meccanismi SDK attraverso adapter, mantenendo dati ed esiti definiti in Application; non è prescritta una particolare firma TypeScript. Non attraversano la porta messaggi del protocollo conversazionale, eventi SSE, `UIMessage`, risultati `streamText`, `AbortSignal`, writer e callback dell'SDK o altri tipi del fornitore o della piattaforma. Eventuali callback definiti da Application scambiano soltanto dati applicativi. Eventuali nuovi dati applicativi richiedono un bisogno concreto del modulo e non la duplicazione generale del protocollo SDK.

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

### Sintesi vocale con Kokoro

Decisione concordata con la persona il 18 ottobre 2026, che estende la sintesi sherpa-onnx senza sostituire le voci Piper. Oltre alle voci Piper VITS, il backend può sintetizzare con un modello Kokoro della release `tts-models` di k2-fsa/sherpa-onnx, eseguito dalla stessa libreria `sherpa-onnx-node` 1.13.8. Il motore si sceglie per installazione con `voiceEngine` nel file vocale. Sono state considerate la sostituzione completa di Piper con Kokoro e la sintesi Kokoro con una libreria Python separata: la prima avrebbe reso la voce inutilizzabile sui server modesti, la seconda avrebbe reintrodotto un processo esterno.

Decisione concordata con la persona il 18 ottobre 2026, che sostituisce le restrizioni della prima versione di questo contratto: il prodotto non vincola la lingua né il modello Kokoro. La prima versione ammetteva soltanto l'archivio `kokoro-multi-lang-v1_0`, le voci italiane `if_sara` e `im_nicola`, tradotte in `sid` 35 e 36 da una tabella fissa, e la lingua `it`. Ora il backend accetta qualunque modello Kokoro caricabile da sherpa-onnx, comprese le varianti int8 e `kokoro-multi-lang-v1_1`; la voce è indicata con `voiceSpeaker`, l'identificativo numerico `sid` della voce nel modello, e la lingua di fonetizzazione con `voiceLanguage`, un codice di lingua espeak-ng come `it`, `en`, `es`, `fr`, `hi` o `pt-br`. Sono state considerate l'estensione a tutte le famiglie di modelli TTS di sherpa-onnx, la scelta della voce per nome con una tabella mantenuta nel backend, la lingua ricavata dal nome della voce e un campo per i file di lessico: la prima richiede un intervento molto più ampio, la seconda e la terza legano il backend all'elenco delle voci di un modello, l'ultima non è necessaria per le lingue fonetizzate da espeak-ng. Il backend non passa file di lessico; le lingue che sherpa-onnx fonetizza soltanto tramite lessico, come il cinese dei modelli multilingue, non sono supportate. La scelta del modello in base alle prestazioni della macchina spetta a chi installa.

Misure del 18 ottobre 2026 con 4 thread e sei frasi italiane, comprese frasi con numeri, orari e nomi inglesi: sul server dell'installazione di riferimento (Celeron N5095, 4 core, senza AVX) il rapporto fra tempo di sintesi e durata dell'audio è 1,68 per `kokoro-multi-lang-v1_0`, con 10,1 secondi per una frase di 6,4 secondi, 3,09 per la sua variante int8 e 0,19 per Paola medium; su una postazione x86 a 12 core sotto carico Kokoro ha un rapporto di 0,78. Su CPU della classe del N5095 Kokoro non segue il parlato e resta indicata una voce Piper; Kokoro è destinato a CPU più potenti, e la variante int8 su quelle macchine è risultata più lenta della variante in virgola mobile.

Con `voiceEngine` uguale a `kokoro` il backend passa a `OfflineTts.createAsync` la sezione `kokoro` con l'unico file `.onnx`, `voices.bin`, `tokens.txt` ed `espeak-ng-data/` della directory `voiceModelDir` e con `lang` uguale a `voiceLanguage`, e usa `voiceSpeaker` come `sid` di ogni generazione. Dopo il caricamento, un `voiceSpeaker` non inferiore al numero di voci dichiarato dal modello (`numSpeakers`) impedisce l'avvio. Il backend non controlla il codice di lingua contro l'elenco di espeak-ng. Con `voiceEngine` uguale a `piper` il backend passa la sezione `vits` e usa `sid` 0. Caricamento unico, generazione asincrona, sintesi delle frasi una alla volta, formato PCM16 alla frequenza del modello caricato (24 kHz per i modelli Kokoro multilingue), interruzione e arresto seguono la sintesi sherpa-onnx esistente.

L'immagine backend include un modello Kokoro multilingue per italiano e inglese, selezionabile senza mount. Un modello Kokoro esterno resta utilizzabile montando la directory estratta in sola lettura in un percorso distinto da `/opt/ambrogio/voices`.

#### Metadata
  * type: specification

#### Relations
  * define: [Scelta del motore di sintesi vocale](../Requirements/FamilyConversation.md#scelta-del-motore-di-sintesi-vocale)
---

### Sintesi vocale con sherpa-onnx nel processo backend

Decisione concordata con la persona il 17 ottobre 2026, che sostituisce la precedente sintesi Piper con processo pre-avviato. La risposta parlata è sintetizzata nel processo del backend con la libreria `sherpa-onnx-node` 1.13.8 (licenza Apache-2.0), usando le voci Piper VITS italiane convertite da k2-fsa (release `tts-models`: `vits-piper-it_IT-paola-medium` e `vits-piper-it_IT-riccardo-x_low`). Non viene avviato alcun processo Piper né mantenuto un processo di riserva. Dal 18 ottobre 2026 la stessa libreria può eseguire anche il modello Kokoro, scelto dall'installazione con `voiceEngine` secondo la specifica «Sintesi vocale con Kokoro».

Misure sul server installato (Celeron N5095, 4 core): con Paola medium e 4 thread la sintesi richiede 0,33–0,37 secondi per una frase breve e 0,75 secondi per una frase lunga. Il processo Piper già pronto impiegava 0,35–0,41 secondi da solo, ma 0,83–1,18 secondi mentre si avviava il processo Piper successivo, e ogni avvio Piper richiedeva 3,2–3,5 secondi. La sintesi nel processo ha quindi velocità equivalente, senza avvio di processi, senza processo di riserva e senza contesa della CPU, con un'architettura più semplice.

All'avvio, quando la voce è abilitata, il backend carica una sola volta la voce configurata, con il motore indicato da `voiceEngine`, tramite `OfflineTts.createAsync`, con `numThreads` pari al minimo fra 4 e `os.availableParallelism()`; un errore di caricamento impedisce l'avvio prima dell'ascolto. Ogni frase è sintetizzata con `generateAsync`, che non blocca l'event loop; la variante sincrona `generate` non è usata. Le frasi sono sintetizzate appena complete secondo la regola di separazione delle frasi esistente, la parte residua alla fine del testo. Poiché la voce caricata è unica e la libreria non documenta generazioni concorrenti sulla stessa istanza, le frasi di trasmissioni contemporanee sono sintetizzate una alla volta, nell'ordine di richiesta. L'audio è PCM16 little-endian mono alla frequenza di campionamento del modello caricato, ottenuto convertendo i campioni in virgola mobile prodotti dalla libreria. Un'interruzione della trasmissione impedisce la sintesi delle frasi successive e scarta l'audio non ancora inviato; la trasmissione termina dopo l'ultima frase sintetizzata. All'arresto il backend rilascia il riferimento alla voce caricata e non avvia nuove sintesi.

#### Metadata
  * type: behavior

#### Relations
  * define: [Risposta parlata su richiesta del client](../Requirements/FamilyConversation.md#risposta-parlata-su-richiesta-del-client)
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

### Valori della paginazione conversazionale

Il modulo TypeScript locale del componente «Conversazioni» ammette i campi opzionali `listPageSize` e `maxListPageSize`. Se assenti, valgono rispettivamente 20 e 100. Ciascun valore presente è un intero positivo; `listPageSize` non supera `maxListPageSize` dopo l'applicazione dei valori predefiniti. Un modulo necessario assente, non importabile, con struttura incompatibile o valori invalidi impedisce l'attivazione dell'ingresso interessato. La composition root importa il modulo una volta e consegna i due valori validati al caso d'uso di elenco e all'adapter di lettura dell'archivio. Il modulo può ricavarli dall'ambiente con conversione numerica esplicita. Il massimo limita la dimensione accettata per una pagina; il contratto HTTP dell'elenco definisce come un client può richiedere una dimensione diversa da quella predefinita.

Il percorso del file è indicato dalla variabile d'ambiente `AMBROGIO_CONVERSATIONS_CONFIG_PATH`, che non contiene valori di paginazione. Se la variabile manca o non indica un percorso utilizzabile, la preparazione del componente fallisce prima di attivare gli ingressi.

#### Metadata
  * type: specification

#### Relations
  * define: [Configurazione della paginazione conversazionale](../Requirements/FamilyConversation.md#configurazione-della-paginazione-conversazionale)
---
