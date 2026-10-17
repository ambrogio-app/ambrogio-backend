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

Un'installazione può non abilitare l'ingresso vocale. L'assenza della variabile di percorso `AMBROGIO_VOICE_CONFIG_PATH` lo disabilita: la composition root non legge file vocali e non costruisce né avvia Vosk o la sintesi vocale. I turni testuali del canale conversazionale restano utilizzabili con le proprie dipendenze, e i turni che trasmettono audio o chiedono la risposta in audio ricevono il rifiuto previsto. Quando il percorso è presente, il file JSON vocale contiene esattamente `voskModelPath` (directory del modello Vosk) e `voiceModelDir` (directory della voce di sintesi); un campo sconosciuto, compresi i precedenti `piperModelPath` e `piperBinaryPath`, rende il file invalido. L'intervallo di inattività della replica è configurato dal satellite. All'avvio la directory Vosk deve essere leggibile; la directory della voce deve contenere esattamente un file `.onnx`, il file `tokens.txt` e la directory `espeak-ng-data/`, tutti leggibili. Un valore mancante o invalido, una risorsa assente o illeggibile o il fallimento del caricamento della voce impediscono l'avvio prima dell'ascolto del server. La configurazione e il modello Vosk restano esterni all'immagine; l'immagine include due voci e consente di sostituirle tramite un mount della directory dedicata.

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

Il caso d'uso del turno conversazionale riceve un input Application costruito dall'adapter di ingresso a partire dai dati già decodificati. I suoi dati di successo, compresi gli eventuali incrementi della risposta progressiva, hanno significato proprio del modulo e non sono messaggi del protocollo conversazionale, oggetti HTTP, righe di terminale o dati audio. Ogni adapter di ingresso converte tali valori nella rappresentazione richiesta dal proprio protocollo; il caso d'uso non restituisce direttamente oggetti Domain o rappresentazioni del trasporto. Il caso d'uso consegna prima la notifica di ammissione e poi ciascun incremento nell'ordine di produzione, attendendo che la consegna di una notifica sia terminata prima di iniziare la successiva. Tale attesa riguarda la consegna all'adapter, non la lettura da parte della persona. Se la consegna fallisce dopo l'ammissione, anche per un guasto tecnico diverso dalla disconnessione, il caso d'uso continua il turno e conserva l'esito prodotto senza trasformare il solo guasto di consegna in un errore conversazionale. L'adapter che esegue la consegna distingue la disconnessione dal guasto tecnico e registra quest'ultimo nel canale diagnostico prima che il caso d'uso ignori il fallimento della notifica; non delega al caso d'uso la classificazione o il log. La normale disconnessione del client non richiede di per sé un log di errore. Gli altri casi d'uso del modulo seguono lo stesso confine quando ricevono input o producono dati di successo.

#### Metadata
  * type: input-output

#### Relations
  * define: [Dati Application dei casi d'uso conversazionali](../Requirements/FamilyConversation.md#dati-application-dei-casi-duso-conversazionali)
---

### Decisione di delega mediante chiamata di funzione

Per ogni agente specializzato attivo, l'adapter presenta all'orchestratore una funzione di delega identificata dall'agente e descritta mediante il suo campo `description`. L'orchestratore riceve lo storico del turno e può produrre direttamente testo oppure scegliere un agente chiamando la sua funzione. Ambrogio accetta una sola delega per turno, esegue soltanto la funzione corrispondente a un agente attivo e usa la risposta dell'agente come esito del turno nella conversazione corrente. Una funzione sconosciuta, argomenti invalidi o più deleghe nello stesso turno causano il guasto pubblico previsto per la produzione della risposta. Le istruzioni e le credenziali dell'agente specializzato restano nel suo adapter.

Decisione concordata il 17 ottobre 2026: la delega comunica soltanto l'agente scelto. La funzione di delega non ha argomenti e accetta solo un oggetto vuoto; l'orchestratore non riformula la richiesta né rielabora la risposta. L'agente scelto riceve lo storico conservato della conversazione, il cui ultimo turno contiene il testo originale della famiglia, e la sua risposta, con la relativa indicazione `expectsReply`, è trasmessa come risposta del turno senza ulteriori chiamate all'orchestratore. Sostituisce il precedente argomento `task`, con cui l'orchestratore riformulava la richiesta e talvolta ne perdeva dettagli.

Decisione concordata il 17 ottobre 2026: nella richiesta dell'orchestratore l'adapter disattiva le chiamate di funzione parallele del provider (`parallelToolCalls: false` per Mistral). La prova con il backend installato ha mostrato che `mistral-small-latest` emetteva spesso due deleghe nello stesso passo, identiche o riformulate, facendo fallire il turno; con l'opzione disattivata, nove richieste su nove hanno prodotto una sola delega. La regola della delega singola resta invariata e una richiesta con più deleghe resta un guasto. L'opzione non si applica agli agenti specializzati, che eseguono gli strumenti MCP uno alla volta entro il proprio limite.

Decisione concordata il 17 ottobre 2026: il nome della funzione di delega è l'identificativo dell'agente, cioè il nome del suo file JSON senza estensione, per esempio `home-assistant`. L'identificativo è già vincolato a lettere minuscole, cifre e trattini e unico per costruzione, quindi è un nome di funzione valido per il provider e non richiede trasformazioni. Sostituisce i nomi posizionali `delegate_<indice>`, che il modello ha talvolta riprodotto in modo errato, per esempio `delegate__0`, con trascrizioni rumorose. Un nome che non corrisponde esattamente a un agente attivo resta una funzione sconosciuta.

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

La produzione delle risposte dell'orchestratore e degli agenti specializzati usa un adapter del componente «Conversazioni» basato su Vercel AI SDK, con provider Mistral configurato per ciascun agente. L'adapter implementa la porta applicativa `ProduceConversationReply`: riceve a ogni turno lo storico dall'archivio comune, restituisce i frammenti testuali della risposta e l'indicazione strutturata `expectsReply`, con un unico percorso di generazione indipendente dal tipo di contenuto del turno, e mantiene i tipi dell'SDK fuori da Domain e Application. L'adapter del canale conversazionale presenta frammenti ed esito secondo il protocollo `ambrogio.v1`.

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

### Profilo dell'ingresso conversazionale con agenti

L'ingresso eseguibile valida prima dell'ascolto i JSON HTTP, Conversazioni, degli agenti attivi e, se configurato, quello della voce, apre l'archivio e recupera i turni pendenti, prepara gli adapter dei provider e i client MCP degli agenti specializzati, quindi registra il canale conversazionale `/api/session` insieme ai due GET già disponibili. Il canale usa l'agente orchestratore come produttore concreto della risposta tramite la porta Application `ProduceConversationReply`; quando la voce è configurata usa Vosk per trascrivere i turni audio e sherpa-onnx, con la voce caricata prima dell'ascolto, per le risposte richieste in audio. La politica CORS riguarda le rotte GET; l'apertura del canale segue il controllo dell'origine definito per la sessione. L'arresto dell'ingresso segue la politica generale del ciclo di vita del server; la richiesta al provider non viene annullata esplicitamente dall'adapter.

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

### Proprietà dei controlli del turno conversazionale

L'adapter del canale conversazionale possiede la verifica della forma dei messaggi e della decodifica del proprio protocollo: ferma i dati non validi prima del caso d'uso, senza decidere invarianti o precondizioni di business. Application riceve dati già interpretati e coordina le precondizioni che richiedono contesto, per esempio il recupero della conversazione richiesta, tramite porte; un rifiuto previsto ferma il turno prima degli effetti successivi. Domain garantisce gli stati e le transizioni del singolo turno anche se un ingresso ha eseguito controlli preliminari. L'archivio SQLite garantisce atomicamente l'ammissione di al massimo un turno attivo per conversazione; una lettura o un controllo preliminare non sostituisce tale garanzia. I controlli pubblici aggiuntivi sono ammessi solo se servono al rispettivo confine e non ridefiniscono la regola autorevole di un altro livello.

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

### Schema delle richieste HTTP conversazionali

Le rotte HTTP JSON di elenco e storico dichiarano con TypeBox la forma delle parti di richiesta che usano: query e parametri di percorso. Fastify valida tali schemi con Ajv prima del gestore. Gli oggetti di richiesta dichiarati sono chiusi: campi non previsti producono un rifiuto, senza essere eliminati. La configurazione Ajv dell'ingresso usa `coerceTypes: false`, `useDefaults: false`, `removeAdditional: false` e `allErrors: false`; la validazione non converte tipi, inserisce valori predefiniti né altera i dati ricevuti.

Lo schema controlla la forma del protocollo. L'adapter converte esplicitamente le rappresentazioni ammesse nei dati Application, come il limite decimale e il cursore dell'elenco. Le precondizioni contestuali e gli invarianti restano ai rispettivi proprietari. Un errore di schema o di conversione interrompe la richiesta prima del caso d'uso e viene presentato secondo il contratto HTTP pubblico della rotta. Questa scelta non introduce la pubblicazione OpenAPI. I messaggi del canale conversazionale seguono invece lo schema JSON del protocollo `ambrogio.v1`.

#### Metadata
  * type: specification

#### Relations
  * define: [Validazione strutturale delle richieste conversazionali HTTP](../Requirements/FamilyConversation.md#validazione-strutturale-delle-richieste-conversazionali-http)
---

### Semantica locale delle porte verso servizi esterni

Ogni porta outbound di Application descrive una capacità coerente richiesta da uno o più casi d'uso del modulo «Conversazioni». Nomi delle operazioni, input, output e rifiuti descrivono il significato per il modulo, senza riprodurre automaticamente metodi, payload o tipi di SDK, protocollo o API del fornitore. L'adapter realizza la porta e converte richieste, risposte e rifiuti fra le due rappresentazioni. La granularità delle porte segue le capacità effettivamente richieste, senza imporre un numero di operazioni per porta.

La capacità di produzione della risposta riceve il contesto applicativo dello storico conservato, consegna i nuovi frammenti testuali nell'ordine di produzione insieme all'indicazione strutturata della replica attesa e permette al coordinamento applicativo di distinguere conclusione e guasto della produzione. Le firme possono evolvere per usare i meccanismi SDK attraverso adapter, mantenendo dati ed esiti definiti in Application; non è prescritta una particolare firma TypeScript. Non attraversano la porta messaggi del protocollo conversazionale, eventi SSE, `UIMessage`, risultati `streamText`, writer e callback dell'SDK o altri tipi del fornitore. Eventuali callback definiti da Application scambiano soltanto dati applicativi. Eventuali nuovi dati applicativi richiedono un bisogno concreto del modulo e non la duplicazione generale del protocollo SDK.

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

### Sintesi vocale con sherpa-onnx nel processo backend

Decisione concordata con la persona il 17 ottobre 2026, che sostituisce la precedente sintesi Piper con processo pre-avviato. La risposta parlata è sintetizzata nel processo del backend con la libreria `sherpa-onnx-node` 1.13.8 (licenza Apache-2.0), usando le voci Piper VITS italiane convertite da k2-fsa (release `tts-models`: `vits-piper-it_IT-paola-medium` e `vits-piper-it_IT-riccardo-x_low`). Non viene avviato alcun processo Piper né mantenuto un processo di riserva.

Misure sul server installato (Celeron N5095, 4 core): con Paola medium e 4 thread la sintesi richiede 0,33–0,37 secondi per una frase breve e 0,75 secondi per una frase lunga. Il processo Piper già pronto impiegava 0,35–0,41 secondi da solo, ma 0,83–1,18 secondi mentre si avviava il processo Piper successivo, e ogni avvio Piper richiedeva 3,2–3,5 secondi. La sintesi nel processo ha quindi velocità equivalente, senza avvio di processi, senza processo di riserva e senza contesa della CPU, con un'architettura più semplice.

All'avvio, quando la voce è abilitata, il backend carica una sola volta la voce configurata con `OfflineTts.createAsync`, con `numThreads` pari al minimo fra 4 e `os.availableParallelism()`; un errore di caricamento impedisce l'avvio prima dell'ascolto. Ogni frase è sintetizzata con `generateAsync`, che non blocca l'event loop; la variante sincrona `generate` non è usata. Le frasi sono sintetizzate appena complete secondo la regola di separazione delle frasi esistente, la parte residua alla fine del testo. L'audio è PCM16 little-endian mono alla frequenza di campionamento del modello caricato, ottenuto convertendo i campioni in virgola mobile prodotti dalla libreria. Un'interruzione della trasmissione impedisce la sintesi delle frasi successive e scarta l'audio non ancora inviato; la trasmissione termina dopo l'ultima frase sintetizzata. All'arresto il backend rilascia la voce caricata.

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

### Valori JSON della paginazione conversazionale

Il file JSON locale del componente «Conversazioni» ammette i campi opzionali `listPageSize` e `maxListPageSize`. Se assenti, valgono rispettivamente 20 e 100. Ciascun valore presente è un intero positivo; `listPageSize` non supera `maxListPageSize` dopo l'applicazione dei valori predefiniti. Un file necessario assente, illeggibile, non JSON, con struttura incompatibile o con valori invalidi impedisce l'attivazione dell'ingresso interessato. La composition root carica il file una volta, consegna i due valori validati al caso d'uso di elenco e all'adapter di lettura dell'archivio e non li sostituisce con variabili d'ambiente. Il massimo limita la dimensione accettata per una pagina; il contratto HTTP dell'elenco definisce come un client può richiedere una dimensione diversa da quella predefinita.

Il percorso del file è indicato dalla variabile d'ambiente `AMBROGIO_CONVERSATIONS_CONFIG_PATH`, che non contiene valori di paginazione. Se la variabile manca o non indica un percorso utilizzabile, la preparazione del componente fallisce prima di attivare gli ingressi.

#### Metadata
  * type: specification

#### Relations
  * define: [Configurazione della paginazione conversazionale](../Requirements/FamilyConversation.md#configurazione-della-paginazione-conversazionale)
---

