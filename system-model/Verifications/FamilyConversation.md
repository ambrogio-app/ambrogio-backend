# Elements

### Verifica dell'interazione vocale

Raggruppa le verifiche della trascrizione, della risposta parlata, della conservazione solo testuale e del ciclo di vita delle interazioni vocali.

#### Metadata
  * type: verification-objective
---

### Prova del ciclo dell'interazione vocale

Avviare esplicitamente due interazioni vocali; nella seconda inviare una replica prima della scadenza e un turno dopo la scadenza dell'intervallo configurato.

#### Details
La prova passa se ogni avvio esplicito usa una nuova conversazione, la replica tempestiva usa quella attiva, allo scadere dell'intervallo l'interazione diventa chiusa e il turno successivo richiede un nuovo avvio con una nuova conversazione. Verificare il valore iniziale di 15 secondi e ripetere con un valore positivo configurato diverso. Fallisce se una replica attraversa il confine di scadenza o se un avvio esplicito riusa una conversazione precedente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * verify: [Chiusura per inattività vocale](../Requirements/FamilyConversation.md#chiusura-per-inattività-vocale)
  * verify: [Nuovo avvio dell'interazione vocale](../Requirements/FamilyConversation.md#nuovo-avvio-dellinterazione-vocale)
  * verify: [Replica vocale nella conversazione attiva](../Requirements/FamilyConversation.md#replica-vocale-nella-conversazione-attiva)
---

### Prova dell'assenza di audio persistente

Eseguire un turno vocale con risposta parlata, riavviare Ambrogio e ispezionare lo stato persistente prodotto dalla prova.

#### Details
La prova passa se lo storico conserva solo testo e dati non audio e se nessuna registrazione dell'input o dell'output vocale è presente tra i dati persistenti della prova. Fallisce se un file o un campo persistente contiene audio del turno o della risposta.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * verify: [Conservazione solo testuale della conversazione](../Requirements/FamilyConversation.md#conservazione-solo-testuale-della-conversazione)
---

### Prova della trascrizione e della risposta parlata

Inviare un campione vocale trascrivibile con testo atteso e ottenere una risposta controllata.

#### Details
La prova passa se il turno conservato contiene la trascrizione testuale attesa, la risposta è emessa in voce e il suo testo compare nello scambio. Fallisce se viene creato un tipo diverso di conversazione, se manca la trascrizione o se la risposta non viene pronunciata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * verify: [Pronuncia della risposta vocale](../Requirements/FamilyConversation.md#pronuncia-della-risposta-vocale)
  * verify: [Trascrizione del turno vocale](../Requirements/FamilyConversation.md#trascrizione-del-turno-vocale)
---

### Prova della trascrizione non riuscita

Simulare un errore del servizio di trascrizione e una trascrizione composta solo da spazi.

#### Details
La prova passa se nessuno dei due tentativi genera uno scambio nello storico. Fallisce se compare un turno o un esito persistente per tali tentativi.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * verify: [Trascrizione vocale non riuscita](../Requirements/FamilyConversation.md#trascrizione-vocale-non-riuscita)
---

### Verifica dell'organizzazione delle conversazioni

Raggruppa i controlli sulla collocazione dei flussi testuali e vocali nel modulo business «Conversazioni».

#### Metadata
  * type: verification-objective
---

### Analisi statica dei confini degli import

Analizzare il grafo degli import del codice TypeScript di produzione del modulo «Conversazioni», includendo gli import di valori, gli `import type` e le riesportazioni.

#### Details
L'analisi passa se ogni import originato da Domain punta a Domain dello stesso modulo e ogni import originato da Application punta a Domain o Application dello stesso modulo. Fallisce se è presente anche un solo collegamento verso un componente o modulo non ammesso, compresi quelli che importano soltanto tipi.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Import del Domain entro il proprio componente](../Requirements/FamilyConversation.md#import-del-domain-entro-il-proprio-componente)
  * verify: [Import dell'Application entro il proprio modulo](../Requirements/FamilyConversation.md#import-dellapplication-entro-il-proprio-modulo)
---

### Controllo degli adapter per componenti tecnici esterni

Esaminare gli ingressi e le implementazioni delle porte Application del modulo «Conversazioni» che integrano componenti tecnici esterni.

#### Details
Il controllo passa se ciascun adapter di ingresso di questo tipo risiede in `src/adapters/in/` del package «Conversazioni» e ciascun adapter che implementa una porta risiede in `src/adapters/out/` dello stesso package. Fallisce se uno di questi adapter è collocato nell'applicazione o in un altro package.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Adapter tecnici nel package Conversazioni](../Requirements/FamilyConversation.md#adapter-tecnici-nel-package-conversazioni)
---

### Controllo del modulo business Conversazioni

Esaminare i flussi applicativi che elaborano i turni testuali e vocali e la loro appartenenza ai moduli business del server.

#### Details
Il controllo passa se entrambi i flussi appartengono allo stesso modulo business denominato «Conversazioni». Fallisce se la logica applicativa della conversazione testuale e quella della conversazione vocale sono distribuite in moduli business distinti.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Modulo business unico per la conversazione](../Requirements/FamilyConversation.md#modulo-business-unico-per-la-conversazione)
---

### Controllo dell'assemblaggio nella composition root

Esaminare la composition root dell'applicazione server e seguire il collegamento tra le porte Application di «Conversazioni» e le loro implementazioni concrete.

#### Details
Il controllo passa se la composition root dell'applicazione sceglie e fornisce a ciascun caso d'uso le implementazioni delle porte richieste. Fallisce se la scelta o il collegamento avvengono nel codice Domain o Application del modulo anziché nella composition root.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Assemblaggio delle porte nella composition root](../Requirements/FamilyConversation.md#assemblaggio-delle-porte-nella-composition-root)
---

### Controllo dell'indipendenza tecnica di Domain e Application

Esaminare il codice di produzione e il grafo delle dipendenze dei componenti Domain e Application del modulo «Conversazioni».

#### Details
Il controllo passa se i due componenti usano soltanto API standard ECMAScript indipendenti dall'ambiente e non dipendono da API Node.js o package npm usati a runtime. Fallisce se uno dei due componenti usa un'API Node.js o importa una dipendenza npm runtime.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Indipendenza tecnica di Domain e Application](../Requirements/FamilyConversation.md#indipendenza-tecnica-di-domain-e-application)
---

### Controllo delle cartelle del modulo Conversazioni

Esaminare i file di produzione del package «Conversazioni» e classificare il codice Domain, Application e degli adapter secondo la responsabilità descritta nella specifica del modulo.

#### Details
Il controllo passa se il codice Domain risiede in `src/domain/`, i casi d'uso e le porte Application in `src/application/` e gli adapter in `src/adapters/` del package. Fallisce se codice di una di queste categorie si trova fuori dalla directory corrispondente.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Cartelle del modulo Conversazioni](../Requirements/FamilyConversation.md#cartelle-del-modulo-conversazioni)
---

### Controllo delle integrazioni tramite porte e adapter

Esaminare i casi d'uso del modulo «Conversazioni» che accedono a capacità tecniche esterne e seguire ciascun collegamento fino all'integrazione concreta.

#### Details
Il controllo passa se ogni capacità tecnica esterna richiesta da un caso d'uso è espressa da una porta dichiarata in Application e realizzata da un adapter. Fallisce se un caso d'uso integra direttamente un componente tecnico esterno o se una porta necessaria è definita fuori da Application.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Integrazione esterna tramite porte e adapter](../Requirements/FamilyConversation.md#integrazione-esterna-tramite-porte-e-adapter)
---

### Controllo delle responsabilità Domain Application e adapter

Esaminare i componenti del modulo business «Conversazioni» e classificare le regole e i tipi di dominio, i casi d'uso, le porte e le integrazioni tecniche effettivamente implementati.

#### Details
Il controllo passa se le regole e i tipi di dominio sono in Domain, i casi d'uso e le porte in Application, e gli ingressi e le integrazioni tecniche negli adapter. Fallisce se una di queste responsabilità è implementata in un componente diverso da quello definito dalla specifica.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Separazione delle responsabilità nel modulo Conversazioni](../Requirements/FamilyConversation.md#separazione-delle-responsabilità-nel-modulo-conversazioni)
---

### Controllo delle sottocartelle degli adapter

Esaminare gli adapter contenuti nel package «Conversazioni» e distinguere gli ingressi dalle implementazioni delle porte Application.

#### Details
Il controllo passa se ogni adapter d'ingresso del package si trova in `src/adapters/in/` e ogni adapter del package che implementa una porta Application si trova in `src/adapters/out/`. Fallisce se un adapter del package è collocato fuori dalla sottocartella prevista per il suo ruolo.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Separazione degli adapter di ingresso e uscita](../Requirements/FamilyConversation.md#separazione-degli-adapter-di-ingresso-e-uscita)
---

### Verifica della conversazione testuale

Raggruppa le verifiche della risposta testuale, dello storico degli scambi e della continuazione in chat delle conversazioni iniziate a voce.

#### Metadata
  * type: verification-objective
---

### Controllo degli agenti e tool della CLI

Per ogni agente e tool conversazionale presente, esaminare l'assemblaggio delle composition root CLI, HTTP e voce e confrontare gli insiemi resi disponibili al caso d'uso del modulo «Conversazioni».

#### Details
Il controllo passa se la CLI rende disponibili al dialogo tutti e soli gli agenti e tool conversazionali disponibili tramite HTTP e voce, anche quando le composition root creano istanze distinte. Fallisce se un agente o tool del dialogo manca nella CLI o se la CLI usa un insieme conversazionale diverso. Il controllo resta da eseguire quando tali componenti sono implementati.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Disponibilità degli agenti e tool conversazionali nella CLI](../Requirements/FamilyConversation.md#disponibilità-degli-agenti-e-tool-conversazionali-nella-cli)
---

### Controllo del caso d'uso condiviso dalla CLI

Esaminare gli adapter d'ingresso e le composition root di CLI, HTTP e voce che inoltrano turni alla conversazione; seguire le chiamate fino all'Application del modulo «Conversazioni».

#### Details
Il controllo passa se la CLI invoca per il turno testuale lo stesso caso d'uso Application usato dagli ingressi HTTP e voce, senza duplicarne la logica in un percorso CLI separato. Fallisce se la CLI usa un caso d'uso distinto per la stessa elaborazione o reimplementa la logica conversazionale. Il controllo per un ingresso non ancora presente resta da eseguire quando viene introdotto.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Riutilizzo del caso d'uso conversazionale nella CLI](../Requirements/FamilyConversation.md#riutilizzo-del-caso-duso-conversazionale-nella-cli)
---

### Controllo dell'archivio SQLite e dell'accesso Kysely

Esaminare l'implementazione dell'archivio delle conversazioni e le dipendenze effettivamente usate per leggerlo e scriverlo.

#### Details
Il controllo passa se lo stato persistente delle conversazioni è in SQLite e le operazioni applicative di lettura e scrittura dell'archivio passano tramite Kysely. Fallisce se è usato un altro archivio per le conversazioni o se un percorso applicativo legge o scrive l'archivio senza Kysely.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Disponibilità dello storico dopo riavvio](../Requirements/FamilyConversation.md#disponibilità-dello-storico-dopo-riavvio)
---

### Prova del completamento dopo disconnessione della chat testuale

Avviare un turno della chat testuale la cui risposta sia controllabile e produca almeno un frammento; dopo aver ricevuto il primo frammento, chiudere la connessione del client e lasciare completare l'elaborazione. Riaprire la conversazione tramite un client della chat testuale e leggere lo storico. Ripetere con un guasto controllato che produca un errore dopo il primo frammento.

#### Details
La prova passa se, in entrambi i casi, il backend prosegue l'elaborazione dopo la disconnessione senza dipendere dalla scrittura sul flusso SSE ormai chiuso e conserva un solo scambio per il turno accettato nella conversazione corretta. Nel caso riuscito, lo scambio contiene l'intera risposta; nel caso di errore, contiene l'esito di errore e il messaggio pubblico, senza trattare i frammenti precedenti come risposta completa. Fallisce se il turno viene annullato per la sola disconnessione, se l'esito manca o resta incompleto nello storico, se compare più di uno scambio o se un errore di scrittura sul flusso sostituisce l'esito del turno. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Completamento del turno accettato dopo disconnessione](../Requirements/FamilyConversation.md#completamento-del-turno-accettato-dopo-disconnessione)
---

### Prova del completamento esplicito della risposta testuale

Da un client della chat testuale di prova, eseguire un turno la cui risposta produca almeno due frammenti e completi correttamente; acquisire tutti gli eventi SSE e lo stato con cui il client conclude il turno. Ripetere interrompendo il flusso dopo il primo frammento, senza emettere né `done` né `error`; osservare anche le richieste che il client invia al backend dopo l'interruzione.

#### Details
La prova passa se, nel caso completato, dopo l'ultimo frammento e prima della chiusura arriva un evento SSE `event: done` con `data: {}` seguito dalla riga vuota che lo rende consegnabile, e il client considera il turno concluso correttamente. Nel caso interrotto, il client mostra lo stato locale «Risposta interrotta», non considera la risposta completata correttamente e non invia un esito di errore da conservare per la sola disconnessione. La prova non presume che il backend abbia interrotto l'elaborazione: il suo esito persistente va verificato separatamente. Fallisce se `done` precede un frammento successivo, non è un evento SSE valido, manca nel caso completato, la sola chiusura del flusso è trattata come successo oppure il client registra automaticamente uno scambio di errore. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Riconoscimento del completamento della risposta testuale](../Requirements/FamilyConversation.md#riconoscimento-del-completamento-della-risposta-testuale)
  * verify: [Segnalazione del completamento della risposta testuale](../Requirements/FamilyConversation.md#segnalazione-del-completamento-della-risposta-testuale)
  * verify: [Segnalazione locale dell'interruzione della chat testuale](../Requirements/FamilyConversation.md#segnalazione-locale-dellinterruzione-della-chat-testuale)
---

### Prova del flusso del turno riaperto

Avviare un turno testuale con generazione controllabile, ricevere un primo frammento sullo stream della richiesta POST e disconnettere il client. Riaprire la conversazione durante l'elaborazione, collegarsi al flusso del turno già accettato e far produrre un ulteriore frammento e l'esito. Ripetere con un errore dopo il collegamento. Osservare le richieste e gli scambi conservati.

#### Details
La prova passa se la riapertura stabilisce una nuova connessione SSE associata allo stesso turno senza inviare nuovamente il testo come nuovo turno; gli aggiornamenti successivi arrivano come eventi SSE `delta` e la conclusione come `done` con `data: {}` oppure `error` con un messaggio pubblico sicuro nel campo JSON `error`. Il backend conserva un solo scambio per il turno. Fallisce se il client deve interrogare periodicamente lo stato per conoscere l'esito, se la riapertura crea un altro turno, se gli aggiornamenti successivi non arrivano nello stream o se l'evento finale non corrisponde all'esito conservato. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Flusso degli aggiornamenti del turno riaperto](../Requirements/FamilyConversation.md#flusso-degli-aggiornamenti-del-turno-riaperto)
---

### Prova del rifiuto del turno vuoto della chat testuale

Inviare da un client della chat testuale una richiesta con `text` vuoto e una con `text` composto solo da spazi bianchi, sia per una nuova conversazione sia per una conversazione esistente. Ripetere con testo vuoto e un `conversationId` inesistente. Confrontare lo stato dell'archivio prima e dopo ogni richiesta.

#### Details
La prova passa se ogni richiesta restituisce HTTP `400` con `Content-Type: application/json` e campo stringa `error` con messaggio pubblico sicuro, senza iniziare SSE, creare una conversazione o aggiungere uno scambio. Il caso con ID inesistente restituisce comunque `400` per la precedenza della validazione del testo. Fallisce se viene avviato il flusso, se lo stato è diverso da `400` o se l'archivio cambia. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Rifiuto del turno vuoto della chat testuale](../Requirements/FamilyConversation.md#rifiuto-del-turno-vuoto-della-chat-testuale)
---

### Prova del trasporto HTTP e SSE della chat

Da un client della chat testuale di prova, inviare un nuovo turno testuale e intercettare la richiesta HTTP POST e la relativa risposta del backend. Ripetere l'invio per continuare una conversazione conservata. Far produrre al caso d'uso una risposta controllata in due frammenti testuali distinti, mantenendo la generazione aperta dopo il primo; leggere il flusso mentre è ancora attivo.

#### Details
La prova passa se ogni richiesta dichiara `Content-Type: application/json` e il corpo JSON contiene `text` con il solo nuovo turno come contenuto conversazionale; `conversationId` è assente per una nuova conversazione e contiene l'identificativo di quella conservata nella continuazione, senza includere gli scambi precedenti. La risposta SSE arriva sulla stessa richiesta senza aprire una seconda connessione per riceverla e dichiara `Content-Type: text/event-stream`. Gli eventi sono SSE validi codificati in UTF-8; ciascun incremento è `event: delta` e ha nel campo `data` un oggetto JSON con `text` uguale al solo frammento nuovo, e la loro concatenazione ordinata ricostruisce esattamente la risposta. Il primo frammento è ricevuto prima che la generazione dell'intera risposta sia completata. La prova fallisce se il turno usa un metodo o un trasporto diverso, se il payload viola il contratto, se il flusso richiede una seconda richiesta, se la risposta non è SSE valida, se gli incrementi non usano `delta`, se `text` contiene ogni volta il testo cumulativo o se tutti gli incrementi sono trattenuti fino alla fine. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Invio HTTP del turno della chat testuale](../Requirements/FamilyConversation.md#invio-http-del-turno-della-chat-testuale)
  * verify: [Risposta progressiva SSE nella chat testuale](../Requirements/FamilyConversation.md#risposta-progressiva-sse-nella-chat-testuale)
---

### Prova dell'aggiornamento automatico dell'esito riaperto

Avviare un turno testuale con elaborazione controllabile, disconnettere il client e riaprire la stessa conversazione mentre il turno mostra «In elaborazione». Senza ulteriori azioni della famiglia, far conservare al backend l'esito e osservare la conversazione già aperta. Eseguire una volta con una risposta completa e una volta con un errore pubblico.

#### Details
La prova passa se, dopo la conservazione dell'esito, il client aggiorna automaticamente il turno già visibile, rimuove «In elaborazione» e mostra la risposta completa oppure il messaggio pubblico di errore corrispondente allo scambio conservato, senza ricaricare manualmente la vista, riaprire la conversazione o inviare un nuovo turno. Fallisce se lo stato resta invariato fino a un'azione della famiglia, se compare una risposta parziale come completa, se viene mostrato un esito diverso da quello conservato o se il turno è duplicato. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Aggiornamento automatico dell'esito alla riapertura](../Requirements/FamilyConversation.md#aggiornamento-automatico-dellesito-alla-riapertura)
---

### Prova dell'ambito conversazionale della CLI

Esaminare comandi e opzioni della CLI; avviare due esecuzioni con una conversazione testuale ciascuna e verificare quali conversazioni la seconda esecuzione può leggere o modificare, usando l'identificativo della prima dove un ingresso lo consente.

#### Details
La prova passa se ogni esecuzione opera soltanto sulla propria nuova conversazione e la CLI non offre comandi o opzioni per leggere, selezionare o riaprire conversazioni precedenti. Fallisce se la seconda esecuzione può leggere o aggiungere turni alla conversazione della prima. La prova resta da eseguire quando la CLI è implementata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [CLI limitata alla conversazione dell'esecuzione corrente](../Requirements/FamilyConversation.md#cli-limitata-alla-conversazione-dellesecuzione-corrente)
---

### Prova dell'archivio comune delle conversazioni CLI

Con l'archivio dell'installazione avviato, creare uno scambio testuale dalla CLI e uno da HTTP o voce; ispezionare l'archivio usato dai due ingressi e consultare lo storico tramite l'ingresso destinato alla famiglia.

#### Details
La prova passa se entrambi gli scambi sono conservati nello stesso archivio delle conversazioni, la conversazione CLI è distinta e la famiglia può leggere la conversazione CLI e il suo scambio testuale dallo storico. Fallisce se la CLI conserva gli scambi in un archivio separato, se gli scambi non persistono o se la conversazione CLI non è consultabile dalla famiglia. La prova resta da eseguire quando gli ingressi e l'archivio sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Archiviazione comune degli scambi CLI](../Requirements/FamilyConversation.md#archiviazione-comune-degli-scambi-cli)
  * verify: [Consultazione familiare delle conversazioni CLI](../Requirements/FamilyConversation.md#consultazione-familiare-delle-conversazioni-cli)
---

### Prova dell'errore HTTP prima del flusso testuale

Da un client della chat testuale di prova, inviare un turno che il backend rifiuta prima di avviare SSE; ripetere provocando un guasto tecnico controllato prima dell'invio degli header della risposta. Intercettare stato, header e corpo HTTP e osservare l'esito mostrato dal client.

#### Details
La prova passa se ogni caso restituisce uno stato HTTP `4xx` o `5xx` e `Content-Type: application/json`, con un corpo JSON contenente un campo stringa `error` con messaggio pubblico sicuro. La risposta non dichiara `text/event-stream` e non invia eventi SSE. Il client mostra il messaggio come errore del turno; nel caso di guasto tecnico non compaiono dettagli diagnostici nel messaggio. La prova fallisce se la risposta è `2xx`, se il payload non rispetta il contratto, se viene avviato SSE, se l'errore non è mostrato o se trapelano dettagli tecnici. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Presentazione dell'errore HTTP prima del flusso testuale](../Requirements/FamilyConversation.md#presentazione-dellerrore-http-prima-del-flusso-testuale)
  * verify: [Segnalazione dell'errore HTTP prima del flusso testuale](../Requirements/FamilyConversation.md#segnalazione-dellerrore-http-prima-del-flusso-testuale)
---

### Prova dell'errore nel flusso testuale

Avviare un turno in una conversazione della chat testuale conservata con un backend di prova che emette un frammento testuale e poi incontra un guasto controllato contenente dettagli diagnostici riconoscibili. Intercettare il resto del flusso SSE, osservare l'esito mostrato dal client prima e dopo l'evento di errore e riaprire lo storico della conversazione.

#### Details
La prova passa se, dopo il guasto, il backend emette un evento SSE `event: error` con `data` JSON contenente un campo stringa `error` con un messaggio pubblico sicuro, completa l'evento con una riga vuota e chiude il flusso senza `done`. Il client sostituisce i frammenti testuali già mostrati per quel turno con il messaggio pubblico come esito di errore e non considera la risposta completata correttamente. Lo storico contiene uno scambio con il testo del turno, tipo di esito `errore` e testo dell'esito uguale al messaggio pubblico dell'evento; non contiene i frammenti emessi come risposta completata. Il messaggio non contiene dettagli tecnici del guasto. La prova fallisce se l'evento manca o è malformato, se viene emesso `done`, se il client conserva visibile la risposta parziale come esito del turno, se lo storico registra una risposta completata dai frammenti o se espone i dettagli diagnostici. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Conservazione dell'errore dopo risposta testuale parziale](../Requirements/FamilyConversation.md#conservazione-dellerrore-dopo-risposta-testuale-parziale)
  * verify: [Presentazione dell'errore del flusso testuale](../Requirements/FamilyConversation.md#presentazione-dellerrore-del-flusso-testuale)
  * verify: [Segnalazione dell'errore nel flusso testuale](../Requirements/FamilyConversation.md#segnalazione-dellerrore-nel-flusso-testuale)
---

### Prova dell'identificativo iniziale della conversazione testuale

Inviare da un client della chat testuale un turno che avvia una nuova conversazione; intercettare in ordine gli eventi applicativi della risposta SSE e l'identificativo assegnato alla conversazione conservata. Far produrre alla conversazione almeno un incremento di risposta testuale.

#### Details
La prova passa se il primo evento applicativo SSE è `event: conversation` e ha un campo `data` che si interpreta come oggetto JSON con `conversationId` stringa, il valore coincide con l'identificativo della nuova conversazione conservata ed è ricevuto prima del primo evento `delta`. Fallisce se il nome dell'evento, il formato JSON o l'identificativo sono assenti o invalidi, se il valore identifica una conversazione diversa o se l'evento arriva dopo un incremento della risposta. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Comunicazione dell'identificativo della nuova conversazione testuale](../Requirements/FamilyConversation.md#comunicazione-dellidentificativo-della-nuova-conversazione-testuale)
---

### Prova della continuazione testuale con identificativo inesistente

Registrare le conversazioni conservate, poi inviare da un client della chat testuale una richiesta POST con un `text` valido e un `conversationId` che non corrisponde ad alcuna di esse. Intercettare risposta HTTP e stato dell'archivio prima e dopo il tentativo.

#### Details
La prova passa se il backend restituisce HTTP `404` prima di avviare SSE, con `Content-Type: application/json` e campo stringa `error` con messaggio pubblico sicuro, e se non viene creata alcuna nuova conversazione. Fallisce se crea una conversazione sostitutiva, risponde con uno stato diverso, avvia SSE o espone dettagli tecnici. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Rifiuto della continuazione testuale con conversazione inesistente](../Requirements/FamilyConversation.md#rifiuto-della-continuazione-testuale-con-conversazione-inesistente)
---

### Prova della continuazione testuale delle conversazioni

Creare e conservare separatamente una conversazione da un client della chat testuale, una dalla CLI e una dalla voce, ciascuna con scambi testuali distintivi. Terminare le interazioni CLI e vocali; riaprire ciascuna conversazione da un client della chat testuale e inviare un nuovo turno testuale con il solo identificativo della conversazione, senza reinviare gli scambi precedenti. Osservare l'accesso del backend all'archivio e il contesto usato per elaborare il turno. Avviare poi una nuova esecuzione CLI e una nuova interazione vocale e osservare quali conversazioni usano.

#### Details
La prova passa se, per ogni origine, il backend recupera dall'archivio lo storico della conversazione identificata e lo usa per elaborare il nuovo turno; la chat testuale aggiunge il nuovo scambio alla medesima conversazione mantenendo identificativo e ordine degli scambi; e le nuove esecuzioni CLI e vocali creano conversazioni distinte senza riaprire quelle conservate. Fallisce se il backend dipende dallo storico inviato dal client, recupera lo storico di un'altra conversazione, il client della chat testuale crea una copia o una nuova conversazione per il turno aggiunto, non può continuare una delle conversazioni conservate o CLI o voce riaprono uno storico. Le repliche immediate dell'interazione vocale ancora attiva sono verificate separatamente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Continuazione testuale di ogni conversazione](../Requirements/FamilyConversation.md#continuazione-testuale-di-ogni-conversazione)
  * verify: [Recupero dello storico per il turno testuale](../Requirements/FamilyConversation.md#recupero-dello-storico-per-il-turno-testuale)
  * verify: [Riapertura delle conversazioni tramite chat testuale](../Requirements/FamilyConversation.md#riapertura-delle-conversazioni-tramite-chat-testuale)
---

### Prova della disponibilità dello storico dopo riavvio

Creare una conversazione con più scambi testuali, riavviare l'installazione e recuperare la stessa conversazione.

#### Details
La prova passa se, dopo il riavvio, la famiglia può recuperare la conversazione con lo stesso identificativo e tutti gli scambi precedenti nello stesso ordine, con testo del turno, tipo di esito e testo dell'esito invariati. Fallisce se la conversazione o uno scambio manca o cambia contenuto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Disponibilità dello storico dopo riavvio](../Requirements/FamilyConversation.md#disponibilità-dello-storico-dopo-riavvio)
---

### Prova della nuova conversazione a ogni avvio CLI

Avviare la CLI in due esecuzioni separate, inviare almeno un turno testuale in ciascuna e osservare le conversazioni e gli scambi registrati.

#### Details
La prova passa se ciascuna esecuzione usa una nuova conversazione testuale con identità distinta e i suoi scambi appartengono soltanto a quella conversazione. Fallisce se la seconda esecuzione riusa la conversazione della prima o se i turni delle due esecuzioni confluiscono nello stesso storico. La prova resta da eseguire quando la CLI è implementata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Nuova conversazione testuale per esecuzione CLI](../Requirements/FamilyConversation.md#nuova-conversazione-testuale-per-esecuzione-cli)
---

### Prova della ripresa della risposta parziale

Avviare un turno della chat testuale che generi almeno tre frammenti riconoscibili. Ricevere il primo frammento, disconnettere il client, lasciare che il backend produca un secondo frammento, poi riaprire la conversazione e mantenere il nuovo stream connesso mentre viene prodotto il terzo frammento e l'esito finale. Ripetere con un errore finale.

#### Details
La prova passa se, alla riapertura, lo stesso messaggio mostra come parziale il testo già prodotto e poi si aggiorna con il testo successivo, senza perdere o duplicare alcun carattere. Il nuovo stream consente di ricostruire nell'ordine l'intera risposta fino a `done`; nel caso di `error`, il client sostituisce il testo parziale con il messaggio pubblico di errore. Il turno e lo scambio conservato restano unici. Fallisce se il client riparte con un nuovo messaggio, mostra solo i frammenti successivi, duplica il prefisso già visibile o considera completa la risposta prima dell'esito terminale. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Ripresa della risposta parziale nel turno riaperto](../Requirements/FamilyConversation.md#ripresa-della-risposta-parziale-nel-turno-riaperto)
---

### Prova della risposta e dello storico testuale

Eseguire una conversazione con un turno che produce una risposta e uno che produce un errore controllato; riaprire lo storico.

#### Details
La prova passa se ogni turno riceve l'esito testuale nella conversazione corretta e lo storico conserva nell'ordine due scambi, ciascuno con testo del turno, tipo di esito e testo dell'esito. Fallisce se un testo manca, il tipo di esito è errato, l'ordine cambia o uno scambio compare in un'altra conversazione.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Conservazione dello scambio testuale](../Requirements/FamilyConversation.md#conservazione-dello-scambio-testuale)
  * verify: [Risposta testuale nella conversazione](../Requirements/FamilyConversation.md#risposta-testuale-nella-conversazione)
---

### Prova dello stato del turno alla riapertura

Avviare da un client della chat testuale un turno con elaborazione controllabile, poi disconnettere il client dopo l'accettazione e prima dell'esito. Mantenere l'elaborazione in corso, riaprire la stessa conversazione da un client della chat testuale e osservare lo stato del turno. Far poi terminare il turno, consultare nuovamente la conversazione e ripetere la prova con un esito di errore.

#### Details
La prova passa se, durante l'elaborazione, il client mostra il testo del turno con lo stato «In elaborazione» e non presenta eventuali frammenti ricevuti prima della disconnessione come risposta completa. Dopo la conservazione dell'esito, la consultazione mostra un solo scambio concluso con risposta completa oppure messaggio pubblico di errore, e lo stato «In elaborazione» scompare per quel turno. Fallisce se il turno non è visibile durante l'elaborazione, se appare già concluso, se lo stato rimane dopo l'esito o se la riapertura crea uno scambio duplicato. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Stato del turno in elaborazione alla riapertura](../Requirements/FamilyConversation.md#stato-del-turno-in-elaborazione-alla-riapertura)
---
