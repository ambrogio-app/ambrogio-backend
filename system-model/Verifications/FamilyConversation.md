# Elements

### Verifica degli invarianti dei turni

Raggruppa le prove delle transizioni di stato e della ricostruzione dei turni nel Domain.

#### Metadata
  * type: verification-objective
---

### Prova degli stati validi del turno

Nel Domain, creare un turno accettato e provare ciascuna conclusione con risposta, errore e interruzione. Tentare poi una seconda conclusione o un risultato tardivo dopo l'interruzione. Ricostruire anche stati persistenti validi e uno incompatibile con il contratto.

#### Details
La prova passa se ogni turno nasce in elaborazione, raggiunge una sola volta uno stato terminale valido, conserva identità e testo originario, rifiuta le transizioni successive senza mutare stato e non accetta uno stato persistente incompatibile come valido. La ricostruzione non riesegue le transizioni storiche. Fallisce se una transizione invalida cambia lo stato o se la ricostruzione corregge silenziosamente un dato incompatibile.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica degli invarianti dei turni](#verifica-degli-invarianti-dei-turni)
  * satisfiedBy: [turn.test.ts](../../packages/conversations/test/domain/turn.test.ts)
  * verify: [Integrità dello stato del turno nel Domain](../Requirements/FamilyConversation.md#integrità-dello-stato-del-turno-nel-domain)
---

### Verifica dell'interazione vocale

Raggruppa le verifiche della trascrizione, della risposta parlata, della conservazione solo testuale e del ciclo di vita delle interazioni vocali.

#### Metadata
  * type: verification-objective
---

### Prova degli ingressi testuali senza voce

Avviare un'installazione con la configurazione e le risorse vocali assenti, mantenendo configurati i soli componenti necessari alla chat testuale e alla CLI. Eseguire un turno tramite ciascuno dei due ingressi.

#### Details
La prova passa se entrambi gli ingressi testuali si avviano e completano un turno senza caricare configurazione vocale né costruire componenti vocali. Fallisce se uno dei due richiede un file o una risorsa solo vocale o non può conversare. La prova resta da eseguire quando gli ingressi sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * verify: [Ingressi testuali indipendenti dalla voce](../Requirements/FamilyConversation.md#ingressi-testuali-indipendenti-dalla-voce)
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

### Analisi dei dati al confine dei casi d'uso

Esaminare le firme e i valori scambiati tra i casi d'uso Application di «Conversazioni» e gli adapter HTTP, CLI e voce disponibili. Seguire un turno dalla decodifica dell'ingresso fino alla rappresentazione dell'esito, compresi gli incrementi progressivi, e controllare anche i casi d'uso di lettura presenti.

#### Details
L'analisi passa se input e dati di successo sono definiti in Application con significato indipendente dal protocollo, gli adapter traducono in entrambe le direzioni e nessun caso d'uso espone oggetti Domain o tipi di trasporto. Fallisce se Application riceve un oggetto HTTP o vocale, produce direttamente SSE o output CLI, oppure se ingressi diversi mantengono contratti Application incompatibili per la stessa intenzione. L'analisi resta da svolgere quando casi d'uso e adapter esistono.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Dati Application dei casi d'uso conversazionali](../Requirements/FamilyConversation.md#dati-application-dei-casi-duso-conversazionali)
---

### Analisi della semantica delle porte esterne

Per ciascuna porta outbound di «Conversazioni», confrontare il bisogno del caso d'uso, le operazioni e i tipi dichiarati in Application, l'API del fornitore e le conversioni dell'adapter. Esaminare anche se la porta raccoglie capacità non richieste dal modulo o contiene tipi tecnici del fornitore.

#### Details
L'analisi passa se ogni porta rappresenta una capacità coerente richiesta dal modulo con operazioni e dati espressi nei suoi termini, e l'adapter traduce le differenze rispetto al fornitore. Fallisce se Application importa tipi del fornitore, se la porta replica senza motivo l'API tecnica o se dati ed esiti del fornitore attraversano il confine senza traduzione. L'analisi resta da svolgere quando esistono porte e adapter concreti.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Contratti delle porte nei termini di Conversazioni](../Requirements/FamilyConversation.md#contratti-delle-porte-nei-termini-di-conversazioni)
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

### Controllo dei contratti di archivio della conversazione

Esaminare i contratti Application usati per accettare turni, conservare esiti e interruzioni, recuperare lo storico e produrre l'elenco delle conversazioni; seguire i relativi adapter di persistenza.

#### Details
Il controllo passa se il contratto di scrittura dedicato esprime le transizioni richieste dai casi d'uso, anche tramite il salvataggio coerente dell'aggregato, le letture hanno contratti separati adatti a storico ed elenco e nessuna interfaccia CRUD universale è imposta ai casi d'uso. Fallisce se Application dipende da un repository generico con sole operazioni create/get/update/delete o se le proiezioni di lettura sono accoppiate alle operazioni di scrittura. Il controllo resta da eseguire quando l'archivio è implementato.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Contratti di lettura separati dell'archivio conversazioni](../Requirements/FamilyConversation.md#contratti-di-lettura-separati-dellarchivio-conversazioni)
  * verify: [Contratto di scrittura dell'archivio conversazioni](../Requirements/FamilyConversation.md#contratto-di-scrittura-dellarchivio-conversazioni)
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

### Controllo delle dichiarazioni delle porte Application

Esaminare le dichiarazioni TypeScript delle porte outbound, dei dati, delle unioni e dei contratti callable di Application nel modulo «Conversazioni». Confrontare i nomi delle porte con la capacità richiesta dai casi d'uso e con i nomi delle implementazioni tecniche.

#### Details
Il controllo passa se le porte a oggetto con metodi nominati sono `interface`, dati, unioni e callable sono `type`, e i nomi delle porte descrivono la capacità dal punto di vista del caso d'uso senza includere prodotto, protocollo o libreria dell'adapter. Fallisce se una dichiarazione usa la forma sbagliata o una porta assume il nome della propria implementazione tecnica. Il controllo resta da eseguire quando le porte sono implementate.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Forma TypeScript dei contratti Application](../Requirements/FamilyConversation.md#forma-typescript-dei-contratti-application)
  * verify: [Nomi delle porte Application secondo la capacità richiesta](../Requirements/FamilyConversation.md#nomi-delle-porte-application-secondo-la-capacità-richiesta)
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

### Verifica della concorrenza dei turni

Raggruppa le verifiche sul singolo turno attivo nell'installazione e sul rifiuto immediato dei nuovi turni senza accodamento.

#### Metadata
  * type: verification-objective
---

### Prova degli ingressi disabilitati durante un turno

Avviare un turno testuale e, quando la voce è abilitata, un turno vocale. Durante l'elaborazione e l'emissione della risposta controllare i comandi testuali e vocali su tutti i client collegati all'installazione; ripetere dopo conclusione, errore e interruzione, riavviando l'ingresso se il server si è fermato.

#### Details
La prova passa se nessun client permette l'invio di nuovi turni tramite testo o voce mentre il turno è in corso e se l'interazione torna disponibile dopo il suo termine quando il server è operativo. Dopo un'interruzione dovuta all'arresto, l'interazione torna disponibile al riavvio. Fallisce se un client resta utilizzabile durante il turno o bloccato quando il server è nuovamente operativo.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * verify: [Disabilitazione degli ingressi durante un turno](../Requirements/FamilyConversation.md#disabilitazione-degli-ingressi-durante-un-turno)
---

### Prova del rifiuto dei turni concorrenti

Avviare un turno in una conversazione e, prima che il suo esito sia conservato, inviare nuovi turni tramite ingressi e client diversi, rivolti sia alla stessa conversazione sia a una nuova. Includere una richiesta HTTP con testo valido e acquisirne stato, `Content-Type` e corpo. Inviare anche due richieste contemporaneamente da processi diversi, per esempio HTTP e CLI. Ripetere dopo la conclusione del primo turno e dopo un'interruzione seguita dal riavvio del server.

#### Details
La prova passa se ogni turno concorrente riceve un rifiuto previsto senza essere accettato, elaborato o conservato, se tra due richieste simultanee ne viene accettata al massimo una e se un nuovo turno può essere accettato dopo la conclusione del primo o, in caso di arresto, dopo il riavvio. La richiesta HTTP rifiutata riceve `409` con `Content-Type: application/json` e un campo stringa `error` sicuro, senza avviare SSE né lasciare il turno in coda. Fallisce se turni di conversazioni o ingressi diversi vengono elaborati insieme, se un turno rifiutato compare nello storico, se la risposta HTTP usa uno stato o formato diverso o se l'installazione resta bloccata quando torna operativa.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * verify: [Rifiuto dei turni concorrenti nell'installazione](../Requirements/FamilyConversation.md#rifiuto-dei-turni-concorrenti-nellinstallazione)
  * verify: [Rifiuto HTTP del turno concorrente](../Requirements/FamilyConversation.md#rifiuto-http-del-turno-concorrente)
---

### Prova dell'assenza di turni in coda

Mantenere occupata l'installazione con un turno e tentare un altro invio tramite un ingresso diverso. Rendere poi nuovamente possibile l'elaborazione senza ripetere la seconda richiesta.

#### Details
La prova passa se il nuovo turno è rifiutato subito come esito previsto, non viene conservato e non parte successivamente da solo. Fallisce se resta accettato in attesa o viene elaborato quando la disponibilità torna. Ripetere durante l'arresto del server quando il relativo ingresso è implementato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * verify: [Assenza di accodamento dei turni](../Requirements/FamilyConversation.md#assenza-di-accodamento-dei-turni)
---

### Prova della classificazione delle scritture SQLite

Su un archivio SQLite reale preparato con le migrazioni dell'applicazione, esercitare l'adapter di scrittura con un'ammissione concorrente, una mutazione che non modifica righe perché il turno è già interrotto, una condizione di vincolo non dichiarata come rifiuto della porta e un errore di scrittura o commit. Ispezionare separatamente l'esito osservato dal chiamante e lo stato persistente finale.

#### Details
La prova passa se solo l'ammissione concorrente accertata produce il rifiuto previsto corrispondente, il turno interrotto resta interrotto senza falso successo, e vincoli non traducibili, esiti ambigui ed errori tecnici si propagano come guasti senza confermare modifiche parziali. Il messaggio tecnico SQLite non diventa un rifiuto pubblico e nessun caso viene ritentato automaticamente. Fallisce se zero righe sono sempre trattate come assenza o successo, se un guasto diventa rifiuto previsto oppure se l'esito dichiarato contraddice lo stato persistente. La prova resta da eseguire quando l'adapter esiste.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * satisfiedBy: [sqlite-conversation-write.test.ts](../../packages/conversations/test/adapters/out/sqlite-conversation-write.test.ts)
  * verify: [Classificazione degli esiti delle scritture conversazionali](../Requirements/FamilyConversation.md#classificazione-degli-esiti-delle-scritture-conversazionali)
---

### Prova delle transazioni brevi del turno

Bloccare in modo controllato una chiamata a un agente o connettore e la trasmissione progressiva di una risposta dopo l'ammissione del turno. Durante ciascun blocco osservare le transazioni dell'archivio e tentare una scrittura SQLite indipendente.

#### Details
La prova passa se nessuna transazione del turno resta aperta durante l'attesa della chiamata esterna o l'invio progressivo e la scrittura indipendente può completarsi. Fallisce se una transazione del turno copre l'attesa o lo streaming, oppure impedisce la scrittura indipendente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * verify: [Transazioni brevi dell'archivio conversazioni](../Requirements/FamilyConversation.md#transazioni-brevi-dellarchivio-conversazioni)
---

### Prova delle transizioni atomiche del turno

Forzare un errore dopo la prima scrittura dell'ammissione, della conclusione e dell'interruzione; ripetere senza errore e osservare stato persistente del turno, occupazione dell'installazione ed esito comunicato al chiamante.

#### Details
La prova passa se in caso di errore nessuna transizione resta parziale e il chiamante non riceve un successo; nei casi riusciti stato del turno e occupazione cambiano insieme dopo il commit. Un evento SSE `done` è emesso solo dopo il commit dell'esito riuscito. Fallisce se resta un turno accettato senza occupazione coerente, se l'occupazione è liberata prima che l'esito sia conservato o se il successo è comunicato prima del commit.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * verify: [Scritture atomiche dello stato dei turni](../Requirements/FamilyConversation.md#scritture-atomiche-dello-stato-dei-turni)
---

### Verifica della conversazione testuale

Raggruppa le verifiche della risposta testuale, dello storico degli scambi e della continuazione in chat delle conversazioni iniziate a voce.

#### Metadata
  * type: verification-objective
---

### Analisi della proprietà dei controlli conversazionali

Esaminare il percorso di un turno dagli adapter HTTP e CLI al caso d'uso Application, al Domain e all'archivio SQLite. Confrontare i controlli implementati con i contratti del turno vuoto, della conversazione richiesta, degli stati del turno e dell'ammissione concorrente; osservare anche dove il flusso si arresta dopo ciascun rifiuto.

#### Details
L'analisi passa se gli adapter fermano forma e decodifica non valide prima del caso d'uso senza contenere regole di stato, Application coordina le precondizioni contestuali e i rifiuti tramite porte senza dipendere dal protocollo, Domain resta l'autorità per stati e transizioni, e SQLite mantiene l'ammissione atomica anche quando esiste un controllo preliminare. Fallisce se un ingresso decide un invariante Domain, se il caso d'uso riceve input non decodificato, se un rifiuto permette effetti successivi, se Domain legge il protocollo o se un controllo preliminare sostituisce la garanzia atomica. L'analisi resta da svolgere quando il codice è implementato.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Precondizioni contestuali nel caso d'uso conversazionale](../Requirements/FamilyConversation.md#precondizioni-contestuali-nel-caso-duso-conversazionale)
  * verify: [Validazione del formato negli ingressi conversazionali](../Requirements/FamilyConversation.md#validazione-del-formato-negli-ingressi-conversazionali)
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

### Prova degli esiti di avvio CLI fallito

Avviare la CLI separatamente con un argomento non valido, con una configurazione richiesta assente o non valida e con un guasto tecnico controllato nella preparazione delle dipendenze. Acquisire esito pubblico, codice di uscita, chiamate al caso d'uso e stato delle risorse eventualmente aperte.

#### Details
La prova passa se l'argomento non valido non invoca il caso d'uso e termina con codice 2, mentre configurazione non valida e guasto tecnico terminano con codice 1. Il messaggio di configurazione identifica la categoria del problema senza esporre segreti; quello del guasto tecnico è comprensibile ma non copia messaggi o stack della dipendenza. Le risorse già aperte vengono chiuse prima dell'uscita. Fallisce se le tre condizioni sono confuse, se un guasto tecnico viene presentato come errore d'uso o se un messaggio pubblico rivela dati tecnici sensibili. La prova resta da eseguire quando la CLI esiste.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Esito pubblico dell'avvio CLI fallito](../Requirements/FamilyConversation.md#esito-pubblico-dellavvio-cli-fallito)
---

### Prova dei canali degli errori CLI

Acquisire separatamente `stdout` e `stderr` in una sessione CLI che produce una risposta riuscita, un turno con risposta parziale seguita da errore e poi un turno valido; ripetere con un errore di avvio per argomenti non validi e con un guasto tecnico controllato.

#### Details
La prova passa se il testo delle risposte e i frammenti parziali compaiono su `stdout` e ciascun messaggio pubblico di errore compare come testo leggibile su `stderr`, senza essere serializzato come JSON né contenere dettagli tecnici della dipendenza. Dopo il turno fallito, la sessione resta utilizzabile quando CLI e archivio sono operativi. Gli eventuali log diagnostici non sono scambiati per messaggi pubblici. Fallisce se un errore pubblico appare nella risposta su `stdout`, se un messaggio pubblico usa JSON, se i frammenti parziali sono cancellati o se trapelano dettagli tecnici. La prova resta da eseguire quando la CLI esiste.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Presentazione testuale degli errori nella CLI](../Requirements/FamilyConversation.md#presentazione-testuale-degli-errori-nella-cli)
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

### Prova dell'arresto per input conversazionale non valido

Inviare all'ingresso HTTP un corpo JSON malformato e poi un corpo ben formato con `text` di tipo errato; invocare la CLI con argomenti non validi per il comando conversazionale. Strumentare il caso d'uso e l'archivio per osservare eventuali chiamate ed effetti.

#### Details
La prova passa se gli adapter rifiutano ciascun input al proprio confine prima di invocare il caso d'uso, senza creare conversazioni o turni né tentare scritture. Gli esiti pubblici seguono i contratti HTTP e CLI previsti per errori di protocollo. Fallisce se un input non decodificato arriva ad Application, se il rifiuto avviene soltanto nel Domain o nell'archivio, oppure se resta un effetto persistente. La prova resta da eseguire quando gli ingressi esistono.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Validazione del formato negli ingressi conversazionali](../Requirements/FamilyConversation.md#validazione-del-formato-negli-ingressi-conversazionali)
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

### Prova dell'errore dopo risposta CLI parziale

Avviare nella CLI un turno che emette almeno due frammenti riconoscibili e poi termina con un errore controllato contenente dettagli diagnostici distintivi. Osservare l'output già mostrato, la segnalazione successiva e lo storico della conversazione.

#### Details
La prova passa se i frammenti restano visibili, una segnalazione separata indica chiaramente che la risposta è incompleta e fallita, i dettagli diagnostici non compaiono nel messaggio pubblico e lo storico registra un esito di errore con messaggio pubblico senza trattare i frammenti come risposta completata. Fallisce se la CLI cancella il testo parziale, presenta il turno come riuscito, omette l'errore o conserva i frammenti come esito di risposta.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Segnalazione dell'errore dopo risposta CLI parziale](../Requirements/FamilyConversation.md#segnalazione-dellerrore-dopo-risposta-cli-parziale)
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

### Prova dell'uscita CLI per guasto della sessione

Avviare una sessione CLI con un turno ammesso, poi forzare un guasto tecnico che rende l'archivio inutilizzabile prima di conservare l'esito. Osservare ingresso, `stdout`, `stderr`, codice di uscita, tentativi di chiusura e numero di elaborazioni del turno. Ripristinare l'archivio e riavviare l'installazione per esaminare lo stato del turno.

#### Details
La prova passa se la CLI non presenta altri ingressi, segnala su `stderr` un errore pubblico sicuro distinto dai dettagli diagnostici, tenta di chiudere le risorse possedute e termina con codice 1 senza accodare input né ripetere il turno. Gli eventuali frammenti su `stdout` non sono presentati come risposta completata; al riavvio il turno accettato senza esito è riconosciuto come interrotto. Fallisce se la CLI resta interattiva pur non potendo usare l'archivio, esce con 0, espone il guasto tecnico, dichiara riuscito il turno parziale o lo ripete automaticamente. La prova resta da eseguire quando la CLI e l'archivio esistono.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Uscita CLI dopo guasto irreversibile della sessione](../Requirements/FamilyConversation.md#uscita-cli-dopo-guasto-irreversibile-della-sessione)
---

### Prova della conservazione del testo originale

Inviare tramite chat e CLI un turno valido con spazi iniziali, finali e interni e, quando la voce è abilitata, simulare una trascrizione valida con gli stessi caratteri. Consultare poi lo storico di ciascuna conversazione. Verificare separatamente il rifiuto già previsto per un input composto solo da spazi nei rispettivi ingressi che lo definiscono.

#### Details
La prova passa se ogni turno accettato compare nello storico con il testo identico a quello ricevuto, inclusi spazi iniziali, finali e interni, mentre la verifica di vuotezza non altera il testo. Fallisce se il testo accettato viene tagliato o normalizzato implicitamente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Conservazione del testo originale del turno](../Requirements/FamilyConversation.md#conservazione-del-testo-originale-del-turno)
---

### Prova della continuazione testuale con identificativo inesistente

Registrare le conversazioni conservate, poi inviare da un client della chat testuale una richiesta POST con un `text` valido e un `conversationId` che non corrisponde ad alcuna di esse. Intercettare risposta HTTP e stato dell'archivio prima e dopo il tentativo.

#### Details
La prova passa se il backend restituisce HTTP `404` prima di avviare SSE, con `Content-Type: application/json` e campo stringa `error` con messaggio pubblico sicuro, e se non viene creata alcuna nuova conversazione. Fallisce se crea una conversazione sostitutiva, risponde con uno stato diverso, avvia SSE o espone dettagli tecnici. La prova resta da eseguire quando client e backend sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Precondizioni contestuali nel caso d'uso conversazionale](../Requirements/FamilyConversation.md#precondizioni-contestuali-nel-caso-duso-conversazionale)
  * verify: [Rifiuto della continuazione testuale con conversazione inesistente](../Requirements/FamilyConversation.md#rifiuto-della-continuazione-testuale-con-conversazione-inesistente)
---

### Prova della continuazione testuale delle conversazioni

Creare e conservare separatamente una conversazione da un client della chat testuale, una dalla CLI e una dalla voce, ciascuna con scambi testuali distintivi. Terminare le interazioni CLI e vocali; riaprire ciascuna conversazione da un client della chat testuale e inviare un nuovo turno testuale con il solo identificativo della conversazione, senza reinviare gli scambi precedenti. Osservare l'accesso del backend all'archivio e il contesto usato per elaborare il turno. Avviare poi una nuova esecuzione CLI con un turno valido ammesso e una nuova interazione vocale e osservare quali conversazioni usano.

#### Details
La prova passa se, per ogni origine, il backend recupera dall'archivio lo storico della conversazione identificata e lo usa per elaborare il nuovo turno; la chat testuale aggiunge il nuovo scambio alla medesima conversazione mantenendo identificativo e ordine degli scambi; e le nuove esecuzioni CLI e vocali con turni ammessi creano conversazioni distinte senza riaprire quelle conservate. Fallisce se il backend dipende dallo storico inviato dal client, recupera lo storico di un'altra conversazione, il client della chat testuale crea una copia o una nuova conversazione per il turno aggiunto, non può continuare una delle conversazioni conservate o CLI o voce riaprono uno storico. Le repliche immediate dell'interazione vocale ancora attiva sono verificate separatamente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Continuazione testuale di ogni conversazione](../Requirements/FamilyConversation.md#continuazione-testuale-di-ogni-conversazione)
  * verify: [Recupero dello storico per il turno testuale](../Requirements/FamilyConversation.md#recupero-dello-storico-per-il-turno-testuale)
  * verify: [Riapertura delle conversazioni tramite chat testuale](../Requirements/FamilyConversation.md#riapertura-delle-conversazioni-tramite-chat-testuale)
---

### Prova della creazione della conversazione al primo turno CLI

Avviare la CLI e uscire senza inviare testo; ripetere inviando solo testo vuoto o spazi. Durante un turno già attivo nell'installazione, inviare da una nuova esecuzione CLI un testo valido che venga rifiutato. Verificare che la CLI resti aperta, poi liberare l'installazione e inviare dalla stessa esecuzione un nuovo testo valido; ripetere il rifiuto uscendo invece senza altri turni. Infine, in due esecuzioni distinte, inviare il primo turno valido e ammesso e osservare l'archivio prima e dopo l'ammissione.

#### Details
La prova passa se avvio, input vuoto e rifiuto per occupazione non creano conversazioni; dopo il rifiuto compare un messaggio pubblico testuale su `stderr`, la CLI resta pronta per un nuovo input e non ripete né accoda il testo rifiutato. Il nuovo turno inviato dalla persona, quando ammesso, crea insieme conversazione e turno iniziale solo in quel momento; ogni esecuzione ammessa usa un identificativo distinto. La sessione chiusa dopo il solo rifiuto non lascia una conversazione vuota. Fallisce se la CLI esce al rifiuto, crea la conversazione prima dell'ammissione, elabora più tardi il testo rifiutato o condivide la conversazione tra esecuzioni. La prova resta da eseguire quando la CLI è implementata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Assenza di conversazioni CLI senza turni ammessi](../Requirements/FamilyConversation.md#assenza-di-conversazioni-cli-senza-turni-ammessi)
  * verify: [Creazione della conversazione CLI al primo turno ammesso](../Requirements/FamilyConversation.md#creazione-della-conversazione-cli-al-primo-turno-ammesso)
  * verify: [Permanenza della sessione CLI dopo rifiuto per occupazione](../Requirements/FamilyConversation.md#permanenza-della-sessione-cli-dopo-rifiuto-per-occupazione)
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

### Prova della prosecuzione CLI dopo errore

In una sessione CLI, far concludere il primo turno ammesso con un errore controllato dopo alcuni frammenti, mantenendo operativi CLI e archivio. Dopo la segnalazione dell'errore, inviare un nuovo turno valido e farlo concludere correttamente; quindi chiudere normalmente la sessione. Consultare lo storico, osservare se il primo turno viene rielaborato e rilevare il codice di uscita del processo.

#### Details
La prova passa se, dopo che l'esito di errore è conservato, la CLI consente il nuovo turno nella stessa conversazione, lo storico contiene un solo scambio di errore per il primo turno e un successivo scambio riuscito, nessuna elaborazione del primo viene ripetuta automaticamente e la chiusura normale termina con codice 0. Ripetere chiudendo normalmente dopo il solo turno fallito: anche in questo caso il codice è 0. Fallisce se la sessione si chiude nonostante le risorse operative, crea una nuova conversazione, riavvia il turno fallito, permette il secondo prima che il primo abbia un esito conservato oppure usa il fallimento di un turno per assegnare un codice di uscita diverso da 0 alla chiusura normale.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Codice di uscita della sessione CLI chiusa normalmente](../Requirements/FamilyConversation.md#codice-di-uscita-della-sessione-cli-chiusa-normalmente)
  * verify: [Prosecuzione della sessione CLI dopo errore del turno](../Requirements/FamilyConversation.md#prosecuzione-della-sessione-cli-dopo-errore-del-turno)
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

### Prova della risposta progressiva nella CLI

Avviare una sessione CLI con una risposta controllata che produce almeno tre frammenti distinti separati da pause. Osservare `stdout`, `stderr` e la disponibilità dell'ingresso per il turno successivo dopo ogni frammento, prima di consentire la generazione del successivo.

#### Details
La prova passa se il primo frammento compare su `stdout` prima che la risposta sia completa, ogni frammento successivo compare una sola volta nell'ordine prodotto, il testo concatenato coincide con la risposta conclusa e la CLI non accetta un nuovo turno mentre emette i frammenti. Gli eventuali log tecnici non compaiono nel testo della risposta su `stdout`. Fallisce se tutti i frammenti sono mostrati solo alla fine, sono duplicati o riordinati, oppure se l'ingresso del turno successivo si abilita prima della conclusione.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Risposta progressiva nella CLI](../Requirements/FamilyConversation.md#risposta-progressiva-nella-cli)
---

### Prova della sessione CLI con più turni

Avviare una CLI interattiva e inviare un primo turno valido; durante la sua elaborazione tentare un secondo invio. Dopo l'esito del primo, inviare un secondo turno valido e poi chiudere la sessione. Consultare lo storico e ripetere con una nuova esecuzione CLI.

#### Details
La prova passa se i due turni ammessi della prima esecuzione appartengono alla stessa conversazione, in ordine, e il secondo può partire solo quando il primo è terminato; nessun input tentato durante il turno attivo viene conservato per essere elaborato più tardi. La conversazione resta consultabile dopo la chiusura e la nuova esecuzione usa una conversazione distinta al suo primo turno ammesso. Fallisce se la CLI termina obbligatoriamente dopo il primo turno, crea una conversazione per ogni turno o accoda un input tentato durante l'elaborazione. La prova resta da eseguire quando la CLI è implementata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Sessione conversazionale interattiva nella CLI](../Requirements/FamilyConversation.md#sessione-conversazionale-interattiva-nella-cli)
---

### Prova delle righe vuote nella CLI

In una sessione CLI nuova inviare una riga vuota e una composta solo da spazi, poi un primo turno valido ammesso. Dopo il suo esito, inviare di nuovo una riga vuota e un'altra composta solo da spazi, quindi un secondo turno valido. Osservare le invocazioni del caso d'uso, l'output CLI e l'archivio dopo ogni input.

#### Details
La prova passa se ogni riga vuota o fatta solo di spazi non invoca il caso d'uso, non produce un messaggio d'errore, non crea né modifica turni o conversazioni e lascia la CLI pronta al prossimo input. I due turni validi sono conservati nella stessa conversazione, che nasce solo al primo turno ammesso. Fallisce se un input vuoto viene elaborato, genera un errore o cambia l'archivio.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Ignorare le righe vuote nella CLI](../Requirements/FamilyConversation.md#ignorare-le-righe-vuote-nella-cli)
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

### Verifica della risorsa SQLite conversazionale

Raggruppa le verifiche sulla proprietà, preparazione e chiusura della risorsa SQLite/Kysely nei processi che usano l'archivio.

#### Metadata
  * type: verification-objective
---

### Controllo del proprietario della risorsa SQLite

Esaminare le composition root dei processi che usano l'archivio, gli adapter che vi accedono e le firme Domain e Application.

#### Details
Il controllo passa se ogni processo ha un solo proprietario della risorsa SQLite/Kysely per l'archivio delle conversazioni, gli adapter ricevono solo l'accesso necessario senza possedere la chiusura e Domain/Application non espongono handle SQLite o Kysely. Fallisce se ciascun adapter crea o chiude la propria risorsa, se più proprietari indipendenti sono creati per lo stesso archivio nello stesso processo o se il core dipende da handle tecnici.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della risorsa SQLite conversazionale](#verifica-della-risorsa-sqlite-conversazionale)
  * verify: [Proprietà della risorsa SQLite conversazionale](../Requirements/FamilyConversation.md#proprietà-della-risorsa-sqlite-conversazionale)
---

### Prova della chiusura della risorsa SQLite

Avviare il server e la CLI con un archivio di prova, osservando l'apertura, le migrazioni e la chiusura della risorsa. Ripetere con un guasto controllato dopo la creazione della risorsa ma prima dell'attivazione degli ingressi e con un errore durante l'esecuzione CLI.

#### Details
La prova passa se l'archivio è preparato prima degli ingressi, ogni risorsa creata viene chiusa una sola volta dal suo proprietario dopo le operazioni che la usano e la chiusura avviene anche dopo avvio fallito o errore CLI. Fallisce se il processo accetta turni prima della preparazione, lascia aperta una risorsa dopo un errore o la chiude mentre una transizione del turno ne ha ancora bisogno.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della risorsa SQLite conversazionale](#verifica-della-risorsa-sqlite-conversazionale)
  * verify: [Chiusura della risorsa SQLite conversazionale](../Requirements/FamilyConversation.md#chiusura-della-risorsa-sqlite-conversazionale)
---

### Verifica delle conversioni di persistenza

Raggruppa le verifiche del confine tra righe SQLite e valori Domain o proiezioni Application della conversazione.

#### Metadata
  * type: verification-objective
---

### Controllo del confine di conversione dell'archivio

Esaminare gli adapter SQLite/Kysely, i contratti Application di scrittura e lettura e i tipi esposti a Domain e Application.

#### Details
Il controllo passa se ogni percorso di scrittura e lettura traduce esplicitamente le rappresentazioni delle righe nei valori del contratto pertinente e nessuna firma Domain o Application espone righe, tipi o handle Kysely. Fallisce se righe del database sono usate direttamente come modelli Domain o proiezioni Application, oppure se la conversione è demandata a un ingresso HTTP o CLI.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica delle conversioni di persistenza](#verifica-delle-conversioni-di-persistenza)
  * verify: [Conversione esplicita dei dati conversazionali persistenti](../Requirements/FamilyConversation.md#conversione-esplicita-dei-dati-conversazionali-persistenti)
---

### Prova della conversione temporale SQLite

Con un archivio SQLite reale, salvare e rileggere turni e ultime attività con istanti `Date` prima e dopo l'epoca Unix, compreso un valore con millisecondi non nulli. Ispezionare i valori grezzi delle colonne e ripetere la lettura con valori persistenti invalidi quando lo schema consente di prepararli.

#### Details
La prova passa se le colonne contengono interi pari ai rispettivi `getTime()`, la ricostruzione restituisce `Date` validi con gli stessi millisecondi e valori assenti, non interi, di tipo incompatibile o fuori dall'intervallo rappresentabile non diventano istanti validi né sono corretti silenziosamente. Fallisce se le conversioni arrotondano, applicano un fuso orario, usano l'ora corrente al caricamento o accettano dati temporali invalidi. La prova resta da eseguire quando l'adapter e lo schema sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica delle conversioni di persistenza](#verifica-delle-conversioni-di-persistenza)
  * verify: [Persistenza degli istanti conversazionali in millisecondi Unix](../Requirements/FamilyConversation.md#persistenza-degli-istanti-conversazionali-in-millisecondi-unix)
---

### Prova della fedeltà delle conversioni dell'archivio

Con un archivio SQLite di prova, conservare turni con identificativi, ordine, testo con spazi significativi e stati o esiti distinti; recuperare la conversazione e le proiezioni di storico ed elenco. Ripetere con un dato persistente incompatibile con il contratto corrente, preparato direttamente nell'archivio di prova.

#### Details
La prova passa se i valori recuperati preservano identità, ordine, testo originale, stato ed esito attesi e se un dato incompatibile produce un guasto osservabile invece di una correzione silenziosa. Fallisce se una conversione perde o altera distinzioni semantiche oppure presenta dati incompatibili come validi.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica delle conversioni di persistenza](#verifica-delle-conversioni-di-persistenza)
  * verify: [Conversione esplicita dei dati conversazionali persistenti](../Requirements/FamilyConversation.md#conversione-esplicita-dei-dati-conversazionali-persistenti)
---

### Verifica delle identità conversazionali

Raggruppa le verifiche della generazione, persistenza e esposizione degli identificativi di conversazioni e turni.

#### Metadata
  * type: verification-objective
---

### Controllo della generazione degli identificativi

Esaminare i casi d'uso Application che creano conversazioni o turni, la porta di generazione, la composition root, Domain e l'adapter SQLite.

#### Details
Il controllo passa se Application ottiene i nuovi valori dal generatore fornito dalla composition root e li passa al Domain prima della creazione dello stato, mentre Domain e persistenza non generano nuovi identificativi. Fallisce se Domain invoca una fonte ambientale di UUID, se l'adapter assegna l'identità iniziale o se il caso d'uso crea lo stato prima di conoscere l'identificativo.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica delle identità conversazionali](#verifica-delle-identità-conversazionali)
  * verify: [Generazione degli identificativi prima del Domain](../Requirements/FamilyConversation.md#generazione-degli-identificativi-prima-del-domain)
---

### Prova degli UUID v4 conversazionali

Creare conversazioni e turni tramite gli ingressi disponibili, anche da processi distinti; leggere i rispettivi identificativi nell'archivio, riavviare e rileggere le stesse conversazioni. Per la chat confrontare il conversationId comunicato dal server con quello conservato. Provare separatamente a persistere due nuovi oggetti con lo stesso identificativo tramite un generatore controllato.

#### Details
La prova passa se ogni nuovo identificativo è un UUID v4, gli identificativi creati sono distinti, rimangono invariati dopo il riavvio e il conversationId pubblico coincide con quello conservato. Un duplicato non sovrascrive l'oggetto esistente. Fallisce se il formato è diverso, un identificativo cambia durante il ciclo di vita, è sostituito dalla persistenza o un duplicato corrompe un oggetto esistente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica delle identità conversazionali](#verifica-delle-identità-conversazionali)
  * verify: [Identificativi UUID v4 di conversazioni e turni](../Requirements/FamilyConversation.md#identificativi-uuid-v4-di-conversazioni-e-turni)
---

### Verifica dello storico e del riavvio

Raggruppa le prove sulla persistenza dei turni, il recupero dopo un'interruzione, le migrazioni dell'archivio e l'elenco paginato delle conversazioni.

#### Metadata
  * type: verification-objective
---

### Controllo dell'orologio applicativo

Esaminare i casi d'uso che assegnano o confrontano istanti conversazionali, la composition root e il codice Domain.

#### Details
Il controllo passa se tali casi d'uso ricevono un orologio dalla composition root e passano al Domain istanti espliciti, mentre Domain non legge l'ora di sistema. Fallisce se Domain invoca direttamente un orologio ambientale o se un adapter di persistenza sostituisce gli istanti decisi dal caso d'uso.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * verify: [Fornitura esplicita dell'ora corrente alla conversazione](../Requirements/FamilyConversation.md#fornitura-esplicita-dellora-corrente-alla-conversazione)
---

### Prova degli istanti di attività conversazionale

Usare un orologio controllato per accettare turni in due conversazioni in istanti noti e poi riaprire l'archivio con un orologio che restituisce un istante successivo. Consultare i turni e l'elenco delle conversazioni.

#### Details
La prova passa se ogni turno e l'ultima attività della sua conversazione usano l'istante fornito all'accettazione, la riapertura non cambia gli istanti storici e l'elenco segue la loro sequenza temporale anziché quella degli UUID. Fallisce se gli istanti sono ricalcolati al caricamento, sono discordanti entro la stessa accettazione o l'ordine deriva dagli identificativi.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * verify: [Fornitura esplicita dell'ora corrente alla conversazione](../Requirements/FamilyConversation.md#fornitura-esplicita-dellora-corrente-alla-conversazione)
---

### Prova del turno interrotto dopo riavvio

Accettare turni con elaborazione controllata dalla chat testuale, dalla CLI e dalla voce trascritta quando abilitata; terminare bruscamente il processo prima di conservarne l'esito e riavviare Ambrogio. Ripetere dopo un arresto ordinato che interrompe un turno attivo, con un turno concluso normalmente e con una semplice disconnessione del client.

#### Details
La prova passa se ciascun turno accettato è persistito con il suo testo prima dell'elaborazione e, dopo un'interruzione senza esito, compare come «Interrotto» senza risposta o errore concluso e senza nuova elaborazione o chiamata ai connettori. Un turno già concluso conserva il suo esito; la sola disconnessione del client lascia proseguire Ambrogio e non produce «Interrotto». Fallisce se il turno sparisce, resta indefinitamente «In elaborazione», viene ripetuto o viene presentato falsamente come concluso. La prova resta da eseguire quando gli ingressi sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * verify: [Nessuna ripetizione automatica del turno interrotto](../Requirements/FamilyConversation.md#nessuna-ripetizione-automatica-del-turno-interrotto)
  * verify: [Registrazione dei turni conversazionali accettati](../Requirements/FamilyConversation.md#registrazione-dei-turni-conversazionali-accettati)
  * verify: [Riconoscimento del turno interrotto dopo riavvio](../Requirements/FamilyConversation.md#riconoscimento-del-turno-interrotto-dopo-riavvio)
---

### Prova dell'elenco paginato per ultima attività

Creare più conversazioni di quante ne contenga una pagina, da chat testuale, CLI e voce quando abilitata; aggiungere un turno a una conversazione meno recente e consultare tutte le pagine senza mutare ulteriormente l'archivio. Includere almeno due conversazioni con la stessa ultima attività.

#### Details
La prova passa se l'elenco è diviso in pagine limitate, la conversazione aggiornata compare prima di quelle con attività più vecchia, l'ordine è deterministico anche a parità di ultima attività e la consultazione di tutte le pagine restituisce ciascuna conversazione una sola volta senza omissioni. Fallisce se l'intero elenco è restituito in una sola risposta, l'ordine dipende implicitamente dal database o una conversazione compare due volte o manca. La prova resta da eseguire quando l'ingresso di consultazione è implementato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * verify: [Elenco paginato delle conversazioni](../Requirements/FamilyConversation.md#elenco-paginato-delle-conversazioni)
  * verify: [Ordinamento delle conversazioni per ultima attività](../Requirements/FamilyConversation.md#ordinamento-delle-conversazioni-per-ultima-attività)
---

### Prova della ripartenza dell'elenco aggiornato

Caricare almeno due pagine nel client della chat testuale, poi aggiungere una conversazione o aggiornare l'ultima attività di una conversazione meno recente nell'archivio. Attivare l'aggiornamento dell'elenco e osservare la richiesta successiva e le voci mostrate.

#### Details
La prova passa se il client scarta il riferimento alla vecchia pagina successiva, richiede la prima pagina e presenta l'ordine corrente delle conversazioni, compresa quella nuova o aggiornata. Fallisce se continua dalla pagina della consultazione precedente o tratta le pagine già caricate come una fotografia immutabile. La prova resta da eseguire quando il client e l'ingresso di consultazione sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * verify: [Ripartenza dell'elenco conversazioni dopo un aggiornamento](../Requirements/FamilyConversation.md#ripartenza-dellelenco-conversazioni-dopo-un-aggiornamento)
---

### Prova della validità e delle copie degli istanti

Creare e ricostruire oggetti Domain della conversazione con istanti `Date` validi e invalidi; dopo la creazione, modificare il `Date` passato in ingresso e quelli restituiti dagli accessori. Confrontare gli istanti interni prima e dopo le mutazioni tramite `getTime()`.

#### Details
La prova passa se gli istanti validi conservano il valore temporale fornito, quelli invalidi sono rifiutati e nessuna mutazione di un `Date` in ingresso o in uscita modifica lo stato Domain. Fallisce se un istante è accettato con `getTime()` non finito, se lo stato condivide un riferimento mutabile con il chiamante o se la ricostruzione sostituisce l'istante storico. La prova resta da eseguire quando gli oggetti Domain sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * satisfiedBy: [turn.test.ts](../../packages/conversations/test/domain/turn.test.ts)
  * verify: [Istanti validi e protetti della conversazione](../Requirements/FamilyConversation.md#istanti-validi-e-protetti-della-conversazione)
---

### Prova delle migrazioni automatiche dell'archivio

Avviare la versione nuova del server contro un archivio SQLite con schema della versione precedente e dati di conversazione distintivi; ripetere provocando un errore controllato in una migrazione.

#### Details
La prova passa se le migrazioni pendenti sono applicate automaticamente prima che gli ingressi accettino turni, lo storico preesistente resta consultabile e un errore di migrazione impedisce l'accettazione di turni e rende osservabile il guasto tecnico. Fallisce se occorre un comando manuale, gli ingressi si attivano prima della migrazione, i dati preesistenti sono persi o un errore lascia il server operativo. La prova resta da eseguire quando archivio e server sono implementati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * verify: [Migrazione automatica dell'archivio delle conversazioni](../Requirements/FamilyConversation.md#migrazione-automatica-dellarchivio-delle-conversazioni)
---
