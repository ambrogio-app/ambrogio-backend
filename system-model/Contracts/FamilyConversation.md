# Elements

### Ammissione del primo turno CLI

La CLI considera valido un testo che, eliminati gli spazi iniziali e finali per la sola verifica, contiene almeno un carattere; il testo accettato resta quello originale. Una riga vuota o composta solo da spazi viene ignorata in silenzio e la CLI torna a chiedere input, senza invocare il caso d'uso né modificare l'archivio. L'avvio della CLI e un turno valido rifiutato perché l'installazione è occupata non creano né conservano una conversazione. La prima ammissione crea la conversazione e conserva atomicamente il turno iniziale; i turni successivi ammessi nella stessa esecuzione usano tale conversazione. Se l'esecuzione termina senza turni ammessi, l'archivio non contiene una conversazione vuota attribuita a essa.

#### Metadata
  * type: behavior

#### Relations
  * define: [Creazione della conversazione CLI al primo turno ammesso](../Requirements/FamilyConversation.md#creazione-della-conversazione-cli-al-primo-turno-ammesso)
---

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

### Canale SSE del turno riaperto

Il client che riapre una conversazione mentre un turno testuale è in corso apre una nuova connessione di sola ricezione associata alla conversazione e al turno già accettato, senza inviare nuovamente il testo del turno. La risposta usa `Content-Type: text/event-stream` e messaggi Server-Sent Events in UTF-8. Sul nuovo flusso, il backend emette come `delta` il testo della risposta già prodotto, eventualmente in uno o più frammenti, e poi gli ulteriori frammenti nell'ordine di produzione; la loro concatenazione ricostruisce la risposta senza lacune né duplicati. Ogni `delta` ha `data` JSON con il campo stringa `text`. La conclusione riuscita usa `done` con `data: {}` e l'errore usa `error` con `data` JSON contenente il campo stringa `error` e un messaggio pubblico sicuro. La connessione aperta dopo la riapertura è distinta dalla risposta SSE alla richiesta POST originale. Il percorso della richiesta resta da definire.

#### Metadata
  * type: input-output

#### Relations
  * define: [Flusso degli aggiornamenti del turno riaperto](../Requirements/FamilyConversation.md#flusso-degli-aggiornamenti-del-turno-riaperto)
---

### Ciclo della sessione CLI interattiva

L'esecuzione CLI presenta un ingresso testuale per il primo turno senza creare ancora una conversazione. Se il primo turno valido viene rifiutato perché l'installazione è occupata, la CLI comunica il rifiuto secondo il profilo testuale degli errori, resta pronta a ricevere un nuovo input e non crea una conversazione; non conserva il turno per dopo e non lo riprova automaticamente. Dopo un turno ammesso, attende la conservazione del suo esito e, quando l'installazione è nuovamente disponibile, consente un nuovo turno nella stessa conversazione. Questo vale anche quando l'esito del turno è un errore, purché la CLI e l'archivio restino operativi; il turno fallito non viene ripetuto automaticamente. Durante il turno attivo la CLI non presenta un ingresso per nuovi turni e non acquisisce input da elaborare più tardi; una richiesta concorrente che raggiunga comunque il caso d'uso è rifiutata secondo la regola comune dell'installazione. La sessione prosegue con turni sequenziali fino alla chiusura richiesta dalla persona; la chiusura non cancella la conversazione già conservata. La forma del comando di uscita resta da definire nel contratto pubblico CLI.

#### Metadata
  * type: behavior

#### Relations
  * define: [Sessione conversazionale interattiva nella CLI](../Requirements/FamilyConversation.md#sessione-conversazionale-interattiva-nella-cli)
---

### Ciclo di vita della risorsa SQLite conversazionale

Per ciascun processo che usa l'archivio delle conversazioni, la composition root costruisce e possiede una risorsa SQLite/Kysely condivisa dagli adapter interessati. Gli adapter ricevono l'accesso necessario per le proprie operazioni e non ne controllano la chiusura; Domain e Application non ricevono handle tecnici SQLite o Kysely. Prima di abilitare il lavoro che dipende dall'archivio, il proprietario ne verifica l'apertura e completa le migrazioni richieste. Se la preparazione fallisce, chiude la risorsa già creata. Al termine del processo, la chiude dopo il completamento o l'interruzione delle operazioni che la usano; la CLI la chiude anche quando il comando termina con errore. Processi distinti possiedono risorse distinte che accedono allo stesso archivio dell'installazione. Non si prescrive un pool PostgreSQL né un numero di connessioni fisiche SQLite.

#### Metadata
  * type: specification

#### Relations
  * define: [Proprietà della risorsa SQLite conversazionale](../Requirements/FamilyConversation.md#proprietà-della-risorsa-sqlite-conversazionale)
---

### Classificazione dei fallimenti di avvio CLI

Un argomento mancante, sconosciuto o non valido secondo il contratto del comando è un errore d'uso: la CLI non invoca il caso d'uso conversazionale, comunica l'errore pubblico e termina con codice 2. Una configurazione richiesta assente o non valida impedisce l'avvio e produce un messaggio pubblico specifico che indica il problema di configurazione, con codice 1. Un guasto tecnico inatteso durante l'avvio produce un messaggio pubblico generico, con codice 1; il dettaglio tecnico resta nella diagnostica e non è copiato nel messaggio. Se sono state aperte risorse prima del fallimento, la CLI ne completa la chiusura prima di terminare. I messaggi pubblici seguono il profilo testuale degli errori CLI.

#### Metadata
  * type: specification

#### Relations
  * define: [Esito pubblico dell'avvio CLI fallito](../Requirements/FamilyConversation.md#esito-pubblico-dellavvio-cli-fallito)
---

### Configurazione facoltativa dell'interazione vocale

Un'installazione può non abilitare l'ingresso vocale. In tal caso la configurazione richiesta soltanto dai componenti vocali può essere assente e la composition root non costruisce né avvia tali componenti. La chat testuale HTTP e la CLI restano utilizzabili con le rispettive dipendenze. Quando la voce è abilitata, i suoi componenti sono configurati e avviati secondo i requisiti dell'interazione vocale.

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

Il caso d'uso del turno conversazionale riceve un input Application costruito dall'adapter di ingresso a partire dai dati già decodificati. I suoi dati di successo, compresi gli eventuali incrementi della risposta progressiva, hanno significato proprio del modulo e non sono oggetti HTTP, eventi SSE, righe di terminale o dati audio. Ogni adapter di ingresso converte tali valori nella rappresentazione richiesta dal proprio protocollo; il caso d'uso non restituisce direttamente oggetti Domain o rappresentazioni del trasporto. Gli altri casi d'uso del modulo seguono lo stesso confine quando ricevono input o producono dati di successo.

#### Metadata
  * type: input-output

#### Relations
  * define: [Dati Application dei casi d'uso conversazionali](../Requirements/FamilyConversation.md#dati-application-dei-casi-duso-conversazionali)
---

### Dati della richiesta del turno della chat testuale

La richiesta HTTP POST della chat testuale usa `Content-Type: application/json` e un corpo JSON con `text`, stringa che contiene il nuovo turno testuale, e `conversationId`, stringa presente quando si prosegue una conversazione conservata e assente quando se ne avvia una nuova. Il valore di `text`, eliminati gli spazi bianchi iniziali e finali per la sola verifica di validità, deve contenere almeno un carattere. Il corpo non contiene gli scambi precedenti: lo storico è recuperato dal backend dall'archivio delle conversazioni.

#### Metadata
  * type: input-output

#### Relations
  * define: [Invio HTTP del turno della chat testuale](../Requirements/FamilyConversation.md#invio-http-del-turno-della-chat-testuale)
---

### Errore CLI dopo testo parziale

Se il turno termina con errore dopo che la CLI ha già mostrato frammenti di risposta, i frammenti restano visibili su `stdout`. La CLI separa dal testo parziale una segnalazione pubblica leggibile su `stderr` che indica esplicitamente il fallimento del turno e che il testo precedente è incompleto; non prova a cancellare o riscrivere l'output già emesso. Il messaggio non espone dettagli tecnici del guasto e non usa JSON. Lo storico conserva l'esito di errore del turno e il relativo messaggio pubblico, senza considerare i frammenti una risposta completata.

#### Metadata
  * type: input-output

#### Relations
  * define: [Segnalazione dell'errore dopo risposta CLI parziale](../Requirements/FamilyConversation.md#segnalazione-dellerrore-dopo-risposta-cli-parziale)
---

### Esclusione dell'audio persistente

L'audio acquisito dalla famiglia e quello generato per la risposta possono essere trattati durante l'interazione, ma non fanno parte dello stato persistente della conversazione. Nessuna registrazione audio del turno o della risposta viene conservata.

#### Metadata
  * type: constraint

#### Relations
  * define: [Conservazione solo testuale della conversazione](../Requirements/FamilyConversation.md#conservazione-solo-testuale-della-conversazione)
---

### Esito della chiusura normale della CLI

Un errore conclusivo di un singolo turno è comunicato durante la sessione e resta registrato nello storico; non determina retroattivamente il codice di uscita dell'intera esecuzione. Quando la persona chiude volontariamente una sessione funzionante, anche dopo uno o più turni falliti, il processo completa la chiusura delle risorse e termina con codice 0. Un guasto che impedisce alla CLI o all'archivio di proseguire non costituisce una chiusura normale; il suo esito pubblico è definito separatamente.

#### Metadata
  * type: specification

#### Relations
  * define: [Codice di uscita della sessione CLI chiusa normalmente](../Requirements/FamilyConversation.md#codice-di-uscita-della-sessione-cli-chiusa-normalmente)
---

### Esito della sessione CLI resa inutilizzabile

Un errore del singolo turno non rende di per sé inutilizzabile la sessione: se CLI e archivio restano operativi, vale la prosecuzione nella stessa conversazione e la successiva chiusura normale può terminare con codice 0. Se invece un guasto tecnico impedisce alla CLI di ricevere altri turni o di usare correttamente l'archivio, la sessione non presenta più un ingresso, segnala un errore pubblico testuale su `stderr` senza esporre il dettaglio tecnico, prova a chiudere le risorse possedute e termina con codice 1. Non conserva input per una futura elaborazione e non ripete il turno. Un turno già ammesso segue le regole esistenti di conservazione dell'esito o di riconoscimento dell'interruzione al riavvio se l'archivio non permette di conservarlo prima dell'uscita; nessuna risposta parziale diventa un successo.

#### Metadata
  * type: behavior

#### Relations
  * define: [Uscita CLI dopo guasto irreversibile della sessione](../Requirements/FamilyConversation.md#uscita-cli-dopo-guasto-irreversibile-della-sessione)
---

### Esito della trascrizione vocale

Una trascrizione è utilizzabile quando il testo restituito, eliminati gli spazi iniziali e finali, contiene almeno un carattere. Un errore del servizio di trascrizione o un testo vuoto dopo tale normalizzazione costituisce trascrizione non riuscita. Il tentativo non genera uno scambio nello storico.

#### Metadata
  * type: behavior

#### Relations
  * define: [Trascrizione vocale non riuscita](../Requirements/FamilyConversation.md#trascrizione-vocale-non-riuscita)
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

### Occupazione dell'installazione e ammissione dei turni

L'ammissione di un turno è coordinata in modo atomico tra gli ingressi HTTP, CLI e voce dell'installazione, anche se operano in processi distinti. L'installazione è occupata dall'accettazione di un turno fino alla conservazione del suo esito o dello stato `interrotto`; durante l'arresto non torna disponibile per nuovi turni. Tra richieste simultanee, al massimo una ottiene l'ammissione: le altre ricevono un rifiuto previsto e non vengono conservate né accodate. Al riavvio, il riconoscimento dei turni interrotti libera l'occupazione residua prima che gli ingressi accettino nuovi turni.

#### Metadata
  * type: specification

#### Relations
  * define: [Rifiuto dei turni concorrenti nell'installazione](../Requirements/FamilyConversation.md#rifiuto-dei-turni-concorrenti-nellinstallazione)
---

### Pagine dell'elenco conversazioni

L'elenco delle conversazioni conservate è restituito in pagine di dimensione limitata. Ogni pagina segue l'ordine decrescente dell'ultima attività della conversazione; a parità di ultima attività usa un criterio stabile e univoco. L'ultima attività corrisponde all'accettazione del turno più recente della conversazione, indipendentemente dall'ingresso testuale, CLI o vocale. Ogni richiesta di pagina consulta lo stato corrente dell'archivio, senza mantenere una fotografia fissa tra richieste. Il contratto di continuazione consente di richiedere la pagina successiva senza perdere o duplicare conversazioni quando l'archivio non cambia durante la consultazione; se cambia, un aggiornamento dell'elenco riparte dalla prima pagina. La dimensione massima e la rappresentazione del riferimento alla pagina successiva restano da precisare nel contratto pubblico dell'ingresso.

#### Metadata
  * type: input-output

#### Relations
  * define: [Elenco paginato delle conversazioni](../Requirements/FamilyConversation.md#elenco-paginato-delle-conversazioni)
---

### Profilo di trasporto SSE della chat

Il client invia il turno della chat testuale con una richiesta HTTP POST. Il backend restituisce il flusso sulla risposta della stessa richiesta, con `Content-Type: text/event-stream` ed eventi nel formato Server-Sent Events codificati in UTF-8. Quando il turno crea una nuova conversazione, il primo evento applicativo del flusso è `event: conversation` e comunica `conversationId`, corrispondente all'identificativo della conversazione conservata, prima di qualsiasi incremento della risposta testuale. Il valore del campo SSE `data` di questo evento è la serializzazione JSON di un oggetto con il campo stringa `conversationId`, per esempio `{"conversationId":"..."}`. Ogni evento che trasporta testo di risposta è `event: delta` e usa nel proprio campo SSE `data` la serializzazione JSON di un oggetto con il campo stringa `text`, contenente soltanto il nuovo frammento; la concatenazione ordinata dei frammenti ricostruisce la risposta testuale. Quando la risposta è prodotta in più incrementi, il backend trasmette gli incrementi disponibili prima del completamento della generazione, senza attendere di disporre dell'intera risposta. Dopo l'ultimo incremento di una risposta completata correttamente, il backend invia un evento con `event: done` e `data: {}`, terminato da una riga vuota secondo il formato SSE, e poi chiude il flusso. `done` segnala il completamento riuscito; la sola chiusura del flusso senza `done` non lo segnala. Se un errore impedisce il completamento dopo l'avvio del flusso, il backend invia `event: error` con `data` contenente la serializzazione JSON di un oggetto con il campo stringa `error` e un messaggio pubblico sicuro, per esempio `{"error":"..."}`; termina l'evento con una riga vuota e chiude il flusso senza `done`. Il messaggio pubblico rispetta l'esclusione dei dettagli tecnici dai messaggi di guasto.

#### Metadata
  * type: input-output

#### Relations
  * define: [Risposta progressiva SSE nella chat testuale](../Requirements/FamilyConversation.md#risposta-progressiva-sse-nella-chat-testuale)
---

### Profilo testuale degli errori CLI

La CLI presenta ogni errore pubblico come testo leggibile su `stderr`, distinguibile dalla risposta del turno che compare su `stdout`. Il profilo vale per argomenti non validi, configurazione non valida, guasti tecnici che impediscono l'avvio ed esiti di errore dei turni durante la sessione. Non è previsto un renderer JSON per questi messaggi pubblici. Se una risposta parziale è già comparsa su `stdout`, resta visibile e il messaggio su `stderr` indica che il turno è fallito e la risposta è incompleta. Gli eventuali log diagnostici tecnici su `stderr` restano distinti dai messaggi pubblici e non ne determinano il contenuto.

#### Metadata
  * type: input-output

#### Relations
  * define: [Presentazione testuale degli errori nella CLI](../Requirements/FamilyConversation.md#presentazione-testuale-degli-errori-nella-cli)
---

### Proprietà dei controlli del turno conversazionale

Gli adapter HTTP e CLI possiedono la verifica della forma dell'input e della decodifica del proprio protocollo: fermano i dati non validi prima del caso d'uso, senza decidere invarianti o precondizioni di business. Application riceve dati già interpretati e coordina le precondizioni che richiedono contesto, per esempio il recupero della conversazione richiesta, tramite porte; un rifiuto previsto ferma il turno prima degli effetti successivi. Domain garantisce gli stati e le transizioni del singolo turno anche se un ingresso ha eseguito controlli preliminari. L'archivio SQLite garantisce atomicamente l'ammissione di al massimo un turno nell'installazione; una lettura o un controllo preliminare non sostituisce tale garanzia. I controlli pubblici aggiuntivi sono ammessi solo se servono al rispettivo confine e non ridefiniscono la regola autorevole di un altro livello.

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

### Risposta di errore HTTP prima del flusso testuale

Se un errore viene determinato prima dell'invio degli header SSE, il backend risponde alla richiesta POST con uno stato HTTP di errore `4xx` o `5xx` e `Content-Type: application/json`. Il corpo è un oggetto JSON con il campo stringa `error` contenente un messaggio pubblico sicuro, per esempio `{"error":"..."}`. Il messaggio non espone dettagli tecnici del guasto. Questa risposta non usa `text/event-stream` e non contiene eventi SSE. Se `text` è vuoto o contiene soltanto spazi bianchi, il codice di stato è `400`, anche quando è presente un `conversationId` inesistente. Se `text` è valido ma il `conversationId` non identifica una conversazione conservata, il codice di stato è `404`. Se il turno valido è rifiutato perché l'installazione è occupata, il codice di stato è `409`; il turno non viene conservato né accodato. La scelta del codice di stato specifico per gli altri casi di errore resta da definire.

#### Metadata
  * type: input-output

#### Relations
  * define: [Segnalazione dell'errore HTTP prima del flusso testuale](../Requirements/FamilyConversation.md#segnalazione-dellerrore-http-prima-del-flusso-testuale)
---

### Semantica locale delle porte verso servizi esterni

Ogni porta outbound di Application descrive una capacità coerente richiesta da uno o più casi d'uso del modulo «Conversazioni». Nomi delle operazioni, input, output e rifiuti descrivono il significato per il modulo, senza riprodurre automaticamente metodi, payload o tipi di SDK, protocollo o API del fornitore. L'adapter realizza la porta e converte richieste, risposte e rifiuti fra le due rappresentazioni. La granularità delle porte segue le capacità effettivamente richieste, senza imporre un numero di operazioni per porta.

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

Un turno testuale accettato e ancora in elaborazione è distinguibile dagli scambi conclusi quando si consulta la conversazione. Finché l'elaborazione è effettivamente in corso e il relativo esito non è conservato, la consultazione lo identifica come `in elaborazione` e lo associa al testo del turno. Se è già disponibile testo generato per la risposta, il client lo mostra come risposta parziale nello stesso messaggio, senza presentarlo come risposta completa. Gli aggiornamenti successivi alla riapertura arrivano al client tramite messaggi SSE del turno riaperto. Quando l'esito è conservato, il client presenta lo scambio concluso con risposta oppure errore e non presenta più per lo stesso turno lo stato `in elaborazione`. Dopo un'interruzione del processo, il turno senza esito segue lo stato `interrotto` definito nel contratto degli stati persistenti del turno testuale.

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

Un turno della chat testuale, della CLI o della voce trascritta è conservato come accettato con il suo testo e lo stato `in elaborazione` prima che Ambrogio ne avvii l'elaborazione. Quando l'esito è conservato, il turno diventa uno scambio concluso con risposta oppure errore. Al riavvio, un turno ancora nello stato `in elaborazione` senza esito conservato diventa `interrotto`: resta consultabile con il testo originario, non è rappresentato come risposta o errore concluso e non viene rielaborato automaticamente. La sola disconnessione del client non cambia lo stato persistente in `interrotto`.

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

### Uscita progressiva della risposta CLI

La CLI scrive su `stdout` il testo della risposta di un turno man mano che riceve nuovi incrementi dal caso d'uso conversazionale. Gli incrementi sono mostrati una sola volta, nell'ordine di produzione, così che il testo visibile risultante corrisponda alla risposta completa quando il turno riesce. La CLI non trattiene tutti gli incrementi fino al termine e non presenta un nuovo ingresso per turni mentre la risposta è in corso. I log tecnici restano su `stderr` secondo il profilo comune. La rappresentazione pubblica di un errore dopo testo parziale è definita separatamente.

#### Metadata
  * type: input-output

#### Relations
  * define: [Risposta progressiva nella CLI](../Requirements/FamilyConversation.md#risposta-progressiva-nella-cli)
---

### Valori Date della conversazione

Gli istanti del turno e dell'ultima attività della conversazione sono valori `Date` standard nel codice Application e Domain. Un `Date` è valido soltanto se `getTime()` restituisce un numero finito; creazione e ricostruzione di oggetti Domain rifiutano valori invalidi. Gli oggetti Domain copiano ogni `Date` ricevuto prima di conservarlo e restituiscono nuove copie quando lo espongono, così le mutazioni del chiamante non alterano lo stato interno. Il confronto tra istanti usa il loro valore temporale. I formati dei payload esterni seguono i rispettivi contratti di confine; la rappresentazione SQLite è specificata nel contratto di persistenza degli istanti.

#### Metadata
  * type: specification

#### Relations
  * define: [Istanti validi e protetti della conversazione](../Requirements/FamilyConversation.md#istanti-validi-e-protetti-della-conversazione)
---
