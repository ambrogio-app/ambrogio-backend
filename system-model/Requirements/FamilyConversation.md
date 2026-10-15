# Elements

### Adapter tecnici nel package Conversazioni

Quando un componente tecnico esterno viene integrato come ingresso del modulo «Conversazioni» o come implementazione di una sua porta Application, l'adapter deve risiedere nel package «Conversazioni», rispettivamente in `src/adapters/in/` o `src/adapters/out/`.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Aggiornamento automatico dell'esito alla riapertura

Quando una conversazione riaperta nel client della chat testuale mostra un turno «In elaborazione» e il backend ne conserva l'esito, il client deve aggiornare automaticamente quel turno con la risposta completa o il messaggio pubblico di errore, senza richiedere un'azione della famiglia.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati del turno testuale alla riapertura](../Contracts/FamilyConversation.md#stati-del-turno-testuale-alla-riapertura)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Archiviazione comune degli scambi CLI

Quando la CLI produce uno scambio testuale, Ambrogio deve conservarlo nell'archivio comune delle conversazioni usato anche dagli ingressi HTTP e voce.

#### Metadata
  * type: requirement

#### Contract References
  * [Archivio SQLite con Kysely](../Contracts/FamilyConversation.md#archivio-sqlite-con-kysely)
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Assemblaggio delle porte nella composition root

Quando l'applicazione server assembla il modulo «Conversazioni», deve scegliere e fornire le implementazioni delle porte Application tramite la propria composition root.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Assenza di accodamento dei turni

Quando Ambrogio non può avviare l'elaborazione di un nuovo turno al momento della richiesta, deve rifiutarlo come esito previsto senza accettarlo né conservarlo per eseguirlo in seguito.

#### Metadata
  * type: requirement

#### Contract References
  * [Occupazione dell'installazione e ammissione dei turni](../Contracts/FamilyConversation.md#occupazione-dellinstallazione-e-ammissione-dei-turni)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Assenza di conversazioni CLI senza turni ammessi

Quando un'esecuzione CLI termina senza alcun turno testuale ammesso, Ambrogio non deve aver creato né conservato una conversazione per quell'esecuzione.

#### Metadata
  * type: requirement

#### Contract References
  * [Ammissione del primo turno CLI](../Contracts/FamilyConversation.md#ammissione-del-primo-turno-cli)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### CLI limitata alla conversazione dell'esecuzione corrente

Quando la CLI elabora turni ammessi in un'esecuzione, deve operare soltanto sulla conversazione testuale creata per quell'esecuzione al primo turno ammesso e non deve offrire funzioni per leggere o riaprire conversazioni preesistenti.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Cartelle del modulo Conversazioni

Il package del modulo business «Conversazioni» deve collocare il codice Domain in `src/domain/`, Application in `src/application/` e gli adapter che appartengono al package in `src/adapters/`.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Chiusura della risorsa SQLite conversazionale

Quando un processo che ha creato la risorsa SQLite/Kysely dell'archivio termina normalmente o fallisce durante l'avvio, il proprietario deve chiudere la risorsa dopo le operazioni che ne dipendono, anche nel percorso CLI.

#### Metadata
  * type: requirement

#### Contract References
  * [Ciclo di vita della risorsa SQLite conversazionale](../Contracts/FamilyConversation.md#ciclo-di-vita-della-risorsa-sqlite-conversazionale)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Chiusura per inattività vocale

Quando trascorre l'intervallo di inattività configurato senza repliche vocali, Ambrogio deve terminare l'interazione vocale attiva.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Classificazione degli esiti delle scritture conversazionali

Quando l'adapter SQLite dell'archivio esegue una mutazione conversazionale, deve comunicare un rifiuto previsto della porta soltanto se l'esito tecnico dimostra la condizione prevista dal contratto dell'operazione; deve propagare come guasto inatteso gli esiti non classificabili e non deve comunicare un successo senza che la postcondizione della mutazione sia soddisfatta.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Codice di uscita della sessione CLI chiusa normalmente

Quando la persona chiude normalmente una sessione CLI ancora operativa, la CLI deve terminare con codice di uscita 0 anche se uno o più turni precedenti sono terminati con errore e sono stati segnalati durante la sessione.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Completamento del turno accettato dopo disconnessione

Quando il backend ha accettato un turno della chat testuale e il client si disconnette durante l'elaborazione, il backend deve proseguire il turno fino a un esito di risposta o di errore e conservarne lo scambio nella conversazione, indipendentemente dalla disponibilità del flusso SSE.

#### Metadata
  * type: requirement

#### Contract References
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Comunicazione dell'identificativo della nuova conversazione testuale

Quando un turno della chat testuale avvia una nuova conversazione, il backend deve comunicare al client l'identificativo della conversazione nel primo evento applicativo SSE, prima degli incrementi della risposta testuale.

#### Metadata
  * type: requirement

#### Contract References
  * [Identità di conversazioni e turni](../Contracts/FamilyConversation.md#identità-di-conversazioni-e-turni)
  * [Profilo di trasporto SSE della chat](../Contracts/FamilyConversation.md#profilo-di-trasporto-sse-della-chat)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conservazione del testo originale del turno

Quando Ambrogio accetta un turno testuale dalla chat, dalla CLI o dalla trascrizione vocale, deve conservare il testo ricevuto senza rimuovere né modificare gli spazi iniziali, finali o interni. L'eventuale rimozione degli spazi per verificare se il testo è vuoto non modifica il testo accettato.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conservazione dello scambio testuale

Quando Ambrogio comunica l'esito di un turno rappresentato come testo, deve conservare nello stesso scambio il testo del turno e il testo della risposta o del messaggio di errore.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conservazione dell'errore dopo risposta testuale parziale

Quando il backend ha trasmesso frammenti della risposta a un turno della chat testuale e poi comunica un errore SSE, deve conservare lo scambio con esito di errore e con il messaggio pubblico comunicato nell'evento `error`, senza registrare i frammenti precedenti come risposta completata.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di trasporto SSE della chat](../Contracts/FamilyConversation.md#profilo-di-trasporto-sse-della-chat)
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * derivedFrom: [Conservazione dello scambio testuale](#conservazione-dello-scambio-testuale)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conservazione solo testuale della conversazione

Quando Ambrogio conserva una conversazione, deve conservarne la rappresentazione testuale senza conservare registrazioni audio.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Consultazione familiare delle conversazioni CLI

Quando la famiglia consulta lo storico delle conversazioni, Ambrogio deve rendere consultabili anche le conversazioni e gli scambi creati dalla CLI.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Continuazione testuale di ogni conversazione

Quando la famiglia riapre nella chat testuale una conversazione conservata, indipendentemente dall'ingresso in cui è iniziata, e invia un turno testuale, Ambrogio deve aggiungere il nuovo scambio alla stessa conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Contratti delle porte nei termini di Conversazioni

Quando un caso d'uso del modulo «Conversazioni» richiede una capacità esterna, la sua porta Application deve esprimere le operazioni e i dati necessari nel linguaggio del modulo, senza esporre tipi o chiamate specifici del fornitore; l'adapter deve tradurre tra tale contratto e l'integrazione concreta.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Contratti di lettura separati dell'archivio conversazioni

Quando Application del modulo «Conversazioni» consulta lo storico o l'elenco delle conversazioni, deve usare contratti di lettura distinti dalle operazioni di scrittura e adatti ai dati richiesti dal caso d'uso.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Contratto di scrittura dell'archivio conversazioni

Quando Application del modulo «Conversazioni» conserva turni o esiti, deve usare un contratto di persistenza dedicato al modello di scrittura della conversazione, con semantica sufficiente alle transizioni richieste dai casi d'uso. Il contratto può esporre il salvataggio dell'aggregato oppure operazioni di transizione esplicite; non deve imporre un'interfaccia CRUD universale ai casi d'uso.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conversione esplicita dei dati conversazionali persistenti

Quando un adapter del modulo «Conversazioni» legge o scrive l'archivio SQLite, deve convertire esplicitamente tra le rappresentazioni tecniche delle righe e i valori Domain o le proiezioni Application previsti dai rispettivi contratti, senza esporre righe o tipi Kysely a Domain e Application.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Creazione della conversazione CLI al primo turno ammesso

Quando un'esecuzione CLI presenta il primo turno testuale valido e Ambrogio lo ammette, deve creare per quell'esecuzione una nuova conversazione testuale distinta da quelle delle altre esecuzioni e conservarvi il turno.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Dati Application dei casi d'uso conversazionali

Quando un caso d'uso del modulo «Conversazioni» riceve dati di ingresso o produce dati di successo, deve usare contratti definiti in Application e indipendenti dai formati HTTP, CLI e voce. Gli adapter di ingresso devono tradurre i rispettivi dati di protocollo in tali contratti e rappresentarne gli esiti nel proprio formato.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Disabilitazione degli ingressi durante un turno

Quando l'installazione elabora un turno o ne comunica la risposta, i client devono impedire l'invio di nuovi turni tramite testo o voce nell'intera installazione fino alla conclusione o all'interruzione del turno in corso.

#### Metadata
  * type: requirement

#### Contract References
  * [Occupazione dell'installazione e ammissione dei turni](../Contracts/FamilyConversation.md#occupazione-dellinstallazione-e-ammissione-dei-turni)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Disponibilità degli agenti e tool conversazionali nella CLI

Quando la composition root CLI assembla il caso d'uso del modulo «Conversazioni», deve rendere disponibili al dialogo gli stessi agenti e tool conversazionali assemblati dagli ingressi HTTP e voce.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Disponibilità dello storico dopo riavvio

Quando Ambrogio viene riavviato, deve rendere nuovamente disponibili alla famiglia le conversazioni e gli scambi testuali conservati prima del riavvio.

#### Concept References
  * [Famiglia](../Thesaurus/Lessico.md#famiglia)
  * [Conversazione](../Thesaurus/Lessico.md#conversazione)
  * [Scambio](../Thesaurus/Lessico.md#scambio)

#### Metadata
  * type: requirement

#### Contract References
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Elenco paginato delle conversazioni

Quando la famiglia consulta l'elenco delle conversazioni conservate, Ambrogio deve fornirlo a pagine invece di restituire l'intero elenco in una sola risposta.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Esito pubblico dell'avvio CLI fallito

Quando la CLI non può avviare la sessione, deve terminare con codice di uscita 2 per argomenti del comando non validi e con codice 1 per configurazione non valida o guasto tecnico inatteso, comunicando in ciascun caso un errore pubblico comprensibile e privo di dettagli tecnici sensibili.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo testuale degli errori CLI](../Contracts/FamilyConversation.md#profilo-testuale-degli-errori-cli)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Flusso degli aggiornamenti del turno riaperto

Quando un client della chat testuale riapre una conversazione con un turno testuale accettato ancora in elaborazione, il backend deve consentire al client di collegarsi agli aggiornamenti SSE di quel turno e trasmetterne l'avanzamento e l'esito tramite messaggi nello stream, senza avviare un nuovo turno.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Forma TypeScript dei contratti Application

Quando Application del modulo «Conversazioni» dichiara una porta outbound a oggetto con metodi nominati, deve usare `interface`; quando dichiara dati, unioni o contratti callable, deve usare `type`.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Fornitura esplicita dell'ora corrente alla conversazione

Quando un caso d'uso Application del modulo «Conversazioni» richiede l'ora corrente per accettare un turno o valutare una regola temporale, deve ottenerla da una capacità di orologio fornita dalla composition root e passare l'istante necessario al Domain, senza leggere l'ora ambientale nel Domain.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Generazione degli identificativi prima del Domain

Quando un caso d'uso Application del modulo «Conversazioni» crea una conversazione o un turno, deve ottenere il nuovo identificativo tramite una capacità di generazione fornita dalla composition root e passarlo al Domain prima della creazione dello stato, senza generarlo dentro Domain o l'adapter di persistenza.

#### Metadata
  * type: requirement

#### Contract References
  * [Identità di conversazioni e turni](../Contracts/FamilyConversation.md#identità-di-conversazioni-e-turni)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Identificativi UUID v4 di conversazioni e turni

Quando Ambrogio crea una nuova conversazione o accetta un nuovo turno, deve assegnargli un identificativo UUID v4 distinto, stabile nello storico e dopo il riavvio.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Ignorare le righe vuote nella CLI

Quando la CLI interattiva riceve una riga vuota o composta solo da spazi bianchi, deve ignorarla senza invocare il caso d'uso conversazionale, creare o modificare una conversazione né mostrare un errore, e deve restare pronta a ricevere il turno successivo.

#### Metadata
  * type: requirement

#### Contract References
  * [Ammissione del primo turno CLI](../Contracts/FamilyConversation.md#ammissione-del-primo-turno-cli)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Import del Domain entro il proprio componente

Il codice di produzione Domain del modulo «Conversazioni» deve importare soltanto codice Domain dello stesso modulo, anche quando l'importazione riguarda solo tipi.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Import dell'Application entro il proprio modulo

Il codice di produzione Application del modulo «Conversazioni» deve importare soltanto codice Application o Domain dello stesso modulo, anche quando l'importazione riguarda solo tipi.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Indipendenza tecnica di Domain e Application

Il codice di produzione Domain e Application del modulo «Conversazioni» deve usare API standard ECMAScript indipendenti dall'ambiente e non deve dipendere da API Node.js né da package npm usati a runtime.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Ingressi testuali indipendenti dalla voce

Quando un'installazione non abilita l'interazione vocale, Ambrogio deve consentire l'uso della chat testuale e della CLI senza richiedere la configurazione o l'avvio dei componenti necessari soltanto alla voce.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Integrazione esterna tramite porte e adapter

Quando un caso d'uso del modulo «Conversazioni» richiede una capacità tecnica esterna, Application deve dichiarare una porta per tale capacità e un adapter deve realizzarne l'integrazione concreta.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Integrità dello stato del turno nel Domain

Quando il modulo «Conversazioni» crea, modifica o ricostruisce lo stato di un turno, Domain deve ammettere soltanto stati e transizioni validi per quel turno, preservando identità e testo, e lasciare invariato lo stato se una transizione è rifiutata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Invio HTTP del turno della chat testuale

Quando la famiglia invia un turno testuale da un client della chat testuale, il client deve trasmettere il turno al backend mediante una richiesta HTTP POST.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Istanti validi e protetti della conversazione

Quando Application e Domain rappresentano un istante della conversazione, devono usare un `Date` valido. Gli oggetti Domain che ricevono o espongono un `Date` devono proteggerlo con copie difensive in ingresso e in uscita.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Migrazione automatica dell'archivio delle conversazioni

Quando l'archivio SQLite richiede migrazioni per la versione del server avviata, Ambrogio deve applicarle automaticamente prima di accettare nuovi turni e impedire l'avvio degli ingressi conversazionali se una migrazione fallisce.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Modulo business unico per la conversazione

I flussi applicativi di conversazione testuale e vocale del server devono appartenere al medesimo modulo business «Conversazioni».

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Nessuna ripetizione automatica del turno interrotto

Quando Ambrogio riconosce dopo un riavvio un turno interrotto senza esito conservato, non deve ripeterne automaticamente l'elaborazione né richiamare i connettori per quel turno.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati persistenti dei turni conversazionali](../Contracts/FamilyConversation.md#stati-persistenti-dei-turni-conversazionali)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Nomi delle porte Application secondo la capacità richiesta

Quando Application del modulo «Conversazioni» dichiara una porta verso una capacità esterna, deve darle un nome che descriva la capacità richiesta dal caso d'uso, senza incorporare il nome del prodotto, del protocollo o della libreria dell'implementazione tecnica.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Nuovo avvio dell'interazione vocale

Quando la famiglia avvia esplicitamente una nuova interazione vocale, Ambrogio deve creare una nuova conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati dell'interazione vocale](../Contracts/FamilyConversation.md#stati-dellinterazione-vocale)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Ordinamento delle conversazioni per ultima attività

Quando Ambrogio fornisce una pagina dell'elenco delle conversazioni, deve ordinare le conversazioni dalla più recente per ultima attività alla meno recente, mantenendo un ordine deterministico anche a parità di ultima attività.

#### Metadata
  * type: requirement

#### Contract References
  * [Istanti della conversazione e orologio applicativo](../Contracts/FamilyConversation.md#istanti-della-conversazione-e-orologio-applicativo)
  * [Pagine dell'elenco conversazioni](../Contracts/FamilyConversation.md#pagine-dellelenco-conversazioni)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Permanenza della sessione CLI dopo rifiuto per occupazione

Quando il primo turno valido di una sessione CLI viene rifiutato perché l'installazione è occupata, la CLI deve comunicare il rifiuto e restare aperta per un nuovo input, senza creare una conversazione, accodare il turno rifiutato o riprovarlo automaticamente.

#### Metadata
  * type: requirement

#### Contract References
  * [Ciclo della sessione CLI interattiva](../Contracts/FamilyConversation.md#ciclo-della-sessione-cli-interattiva)
  * [Profilo testuale degli errori CLI](../Contracts/FamilyConversation.md#profilo-testuale-degli-errori-cli)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Persistenza degli istanti conversazionali in millisecondi Unix

Quando l'adapter dell'archivio salva o ricostruisce un istante della conversazione, deve convertirlo esplicitamente tra un `Date` valido nel codice e un intero di millisecondi trascorsi dall'epoca Unix nella riga SQLite, preservando esattamente l'istante.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Precondizioni contestuali nel caso d'uso conversazionale

Quando un turno supera la validazione dell'ingresso, il caso d'uso Application deve coordinare le precondizioni dipendenti dal contesto della conversazione tramite le proprie porte e interrompere il flusso con un rifiuto previsto quando esse non sono soddisfatte, lasciando al Domain gli invarianti del turno e all'archivio SQLite la garanzia atomica dell'unico turno attivo.

#### Metadata
  * type: requirement

#### Contract References
  * [Proprietà dei controlli del turno conversazionale](../Contracts/FamilyConversation.md#proprietà-dei-controlli-del-turno-conversazionale)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Presentazione dell'errore HTTP prima del flusso testuale

Quando il client della chat testuale riceve una risposta HTTP di errore in formato JSON prima del flusso SSE, deve mostrare il messaggio pubblico contenuto nel campo `error` come esito di errore del turno nella chat.

#### Metadata
  * type: requirement

#### Contract References
  * [Risposta di errore HTTP prima del flusso testuale](../Contracts/FamilyConversation.md#risposta-di-errore-http-prima-del-flusso-testuale)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Presentazione dell'errore del flusso testuale

Quando il client della chat testuale riceve un evento SSE `error`, deve mostrare il messaggio pubblico contenuto nell'evento come esito di errore del turno nella conversazione, sostituendo gli eventuali frammenti di risposta già mostrati per quel turno.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di trasporto SSE della chat](../Contracts/FamilyConversation.md#profilo-di-trasporto-sse-della-chat)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Presentazione testuale degli errori nella CLI

Quando la CLI comunica alla persona un errore di avvio o l'esito di errore di un turno, deve scrivere un messaggio pubblico leggibile su `stderr`, separato dalle risposte conversazionali su `stdout`, senza usare JSON per la presentazione pubblica dell'errore.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Pronuncia della risposta vocale

Quando Ambrogio produce una risposta a un turno vocale, deve pronunciare la risposta alla famiglia.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Esclusione dell'audio persistente](../Contracts/FamilyConversation.md#esclusione-dellaudio-persistente)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Proprietà della risorsa SQLite conversazionale

Quando un processo usa l'archivio delle conversazioni, la sua composition root deve creare un solo proprietario della risorsa SQLite/Kysely per quell'archivio e fornire agli adapter le capacità necessarie senza trasferire loro la responsabilità di chiuderla.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Prosecuzione della sessione CLI dopo errore del turno

Quando un turno ammesso nella CLI termina con un esito di errore e la CLI con l'archivio restano operativi, la sessione deve tornare a consentire un nuovo turno senza ripetere automaticamente quello fallito; il nuovo turno ammesso deve appartenere alla stessa conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Ciclo della sessione CLI interattiva](../Contracts/FamilyConversation.md#ciclo-della-sessione-cli-interattiva)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Recupero dello storico per il turno testuale

Quando il backend riceve da un client della chat testuale un nuovo turno con l'identificativo di una conversazione conservata, deve recuperare dall'archivio lo storico testuale di quella conversazione per elaborare il turno.

#### Metadata
  * type: requirement

#### Contract References
  * [Archivio SQLite con Kysely](../Contracts/FamilyConversation.md#archivio-sqlite-con-kysely)
  * [Dati della richiesta del turno della chat testuale](../Contracts/FamilyConversation.md#dati-della-richiesta-del-turno-della-chat-testuale)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Registrazione dei turni conversazionali accettati

Quando Ambrogio accetta un turno rappresentato come testo dalla chat, dalla CLI o dalla trascrizione vocale, deve conservarne il testo e lo stato in elaborazione prima di avviarne l'elaborazione, affinché il turno sia riconoscibile dopo un riavvio.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati persistenti dei turni conversazionali](../Contracts/FamilyConversation.md#stati-persistenti-dei-turni-conversazionali)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Replica vocale nella conversazione attiva

Mentre un'interazione vocale è attiva, quando la famiglia formula una replica immediata, Ambrogio deve aggiungere il turno alla conversazione vocale attiva.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati dell'interazione vocale](../Contracts/FamilyConversation.md#stati-dellinterazione-vocale)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Riapertura delle conversazioni tramite chat testuale

Quando un ingresso tenta di riaprire una conversazione conservata per aggiungere nuovi turni, Ambrogio deve consentire la riapertura soltanto tramite un client della chat testuale; una nuova interazione vocale o esecuzione CLI deve usare una nuova conversazione.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Riconoscimento del completamento della risposta testuale

Quando il flusso SSE di un turno della chat testuale termina, il client deve considerare la risposta completata correttamente soltanto se ha ricevuto l'evento `done`.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di trasporto SSE della chat](../Contracts/FamilyConversation.md#profilo-di-trasporto-sse-della-chat)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Segnalazione locale dell'interruzione della chat testuale

Quando il flusso SSE di un turno della chat testuale termina senza un evento `done` né un evento `error`, il client deve mostrare lo stato locale «Risposta interrotta» senza trasformare automaticamente la disconnessione in uno scambio di errore conservato.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di trasporto SSE della chat](../Contracts/FamilyConversation.md#profilo-di-trasporto-sse-della-chat)

#### Relations
  * derivedFrom: [Riconoscimento del completamento della risposta testuale](#riconoscimento-del-completamento-della-risposta-testuale)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Riconoscimento del turno interrotto dopo riavvio

Quando Ambrogio si riavvia e trova un turno accettato senza esito conservato, deve mostrarlo alla famiglia come «Interrotto» nella conversazione.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Rifiuto dei turni concorrenti nell'installazione

Quando l'installazione ha un turno accettato il cui esito non è ancora conservato, Ambrogio deve rifiutare come esito previsto ogni nuovo turno proveniente da testo, CLI o voce, indipendentemente dal client e dalla conversazione, senza accettarlo né conservarlo.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Ripartenza dell'elenco conversazioni dopo un aggiornamento

Quando il client della chat testuale aggiorna l'elenco delle conversazioni conservate, deve scartare il riferimento alla pagina successiva della consultazione precedente e richiedere la prima pagina dell'elenco corrente.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Ripresa della risposta parziale nel turno riaperto

Quando il client della chat testuale riapre una conversazione mentre la risposta a un turno è ancora in elaborazione, deve mostrare il testo già prodotto come risposta parziale e continuare ad aggiornare lo stesso messaggio con i frammenti successivi, senza lacune o duplicazioni del testo.

#### Metadata
  * type: requirement

#### Contract References
  * [Canale SSE del turno riaperto](../Contracts/FamilyConversation.md#canale-sse-del-turno-riaperto)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Risposta progressiva SSE nella chat testuale

Quando il backend avvia il flusso di risposta a un turno della chat testuale, deve trasmettere progressivamente la risposta come Server-Sent Events nella risposta alla stessa richiesta HTTP POST che ha ricevuto il turno, conforme al profilo di trasporto SSE della chat.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Risposta progressiva nella CLI

Quando un turno della sessione CLI produce una risposta testuale per incrementi, la CLI deve mostrare gli incrementi nell'ordine in cui diventano disponibili, prima che la risposta completa sia stata generata, senza attendere l'esito finale per mostrarla tutta insieme.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Risposta testuale nella conversazione

Quando la famiglia invia un turno testuale, Ambrogio deve comunicare una risposta testuale o un messaggio di errore nella conversazione a cui appartiene il turno.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Riutilizzo del caso d'uso conversazionale nella CLI

Quando la CLI invia un turno testuale a una conversazione, deve invocare lo stesso caso d'uso Application del modulo «Conversazioni» usato dagli ingressi HTTP e voce per elaborare il turno, come ingresso alternativo alla conversazione.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Scritture atomiche dello stato dei turni

Quando Ambrogio accetta, conclude o interrompe un turno, deve confermare insieme lo stato persistente del turno e l'occupazione dell'installazione in una transazione SQLite.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Segnalazione del completamento della risposta testuale

Quando il backend completa correttamente la risposta a un turno della chat testuale, deve trasmettere un evento SSE `done` dopo tutti gli incrementi testuali e prima di chiudere il flusso.

#### Metadata
  * type: requirement

#### Contract References
  * [Confini atomici dell'archivio conversazioni](../Contracts/FamilyConversation.md#confini-atomici-dellarchivio-conversazioni)
  * [Profilo di trasporto SSE della chat](../Contracts/FamilyConversation.md#profilo-di-trasporto-sse-della-chat)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Segnalazione dell'errore HTTP prima del flusso testuale

Quando un turno della chat testuale non può avviare la risposta SSE, il backend deve restituire una risposta HTTP di errore con un messaggio pubblico sicuro in formato JSON, senza iniziare un flusso SSE.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esclusione dei dettagli tecnici dal messaggio pubblico](ServerFoundation.md#esclusione-dei-dettagli-tecnici-dal-messaggio-pubblico)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Rifiuto HTTP del turno concorrente

Quando il backend riceve un turno valido della chat testuale e lo rifiuta perché l'installazione sta già elaborando un altro turno, deve rispondere con HTTP 409 e un messaggio pubblico sicuro nel corpo JSON di errore, senza avviare SSE né conservare il turno rifiutato.

#### Metadata
  * type: requirement

#### Contract References
  * [Risposta di errore HTTP prima del flusso testuale](../Contracts/FamilyConversation.md#risposta-di-errore-http-prima-del-flusso-testuale)

#### Relations
  * derivedFrom: [Segnalazione dell'errore HTTP prima del flusso testuale](#segnalazione-dellerrore-http-prima-del-flusso-testuale)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Rifiuto del turno vuoto della chat testuale

Quando il campo `text` di un turno della chat testuale è vuoto o contiene soltanto spazi bianchi, il backend deve rifiutare il turno con HTTP 400 senza creare una conversazione né aggiungere uno scambio.

#### Metadata
  * type: requirement

#### Contract References
  * [Dati della richiesta del turno della chat testuale](../Contracts/FamilyConversation.md#dati-della-richiesta-del-turno-della-chat-testuale)
  * [Risposta di errore HTTP prima del flusso testuale](../Contracts/FamilyConversation.md#risposta-di-errore-http-prima-del-flusso-testuale)

#### Relations
  * derivedFrom: [Segnalazione dell'errore HTTP prima del flusso testuale](#segnalazione-dellerrore-http-prima-del-flusso-testuale)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Rifiuto della continuazione testuale con conversazione inesistente

Quando una richiesta della chat testuale contiene un `text` valido e un `conversationId` che non identifica una conversazione conservata, il backend deve rifiutare il turno con HTTP 404 senza creare una nuova conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Risposta di errore HTTP prima del flusso testuale](../Contracts/FamilyConversation.md#risposta-di-errore-http-prima-del-flusso-testuale)

#### Relations
  * derivedFrom: [Segnalazione dell'errore HTTP prima del flusso testuale](#segnalazione-dellerrore-http-prima-del-flusso-testuale)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Segnalazione dell'errore dopo risposta CLI parziale

Quando la CLI ha già mostrato incrementi di risposta e il turno termina con un errore, deve lasciare visibile il testo parziale e mostrare una segnalazione pubblica chiara che quel testo non è una risposta completata.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo testuale degli errori CLI](../Contracts/FamilyConversation.md#profilo-testuale-degli-errori-cli)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Segnalazione dell'errore nel flusso testuale

Quando un errore impedisce di completare la risposta a un turno della chat testuale dopo l'avvio del flusso SSE, il backend deve trasmettere un evento SSE `error` con un messaggio pubblico sicuro e terminare il flusso senza inviare `done`.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo di trasporto SSE della chat](../Contracts/FamilyConversation.md#profilo-di-trasporto-sse-della-chat)

#### Relations
  * derivedFrom: [Esclusione dei dettagli tecnici dal messaggio pubblico](ServerFoundation.md#esclusione-dei-dettagli-tecnici-dal-messaggio-pubblico)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Separazione degli adapter di ingresso e uscita

Nel package del modulo business «Conversazioni», gli adapter d'ingresso presenti devono risiedere in `src/adapters/in/` e gli adapter che implementano porte Application presenti devono risiedere in `src/adapters/out/`.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Separazione delle responsabilità nel modulo Conversazioni

Il modulo business «Conversazioni» deve distinguere Domain, Application e adapter secondo le rispettive responsabilità definite per il modulo.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Sessione conversazionale interattiva nella CLI

Quando la CLI è avviata per conversare, deve consentire alla persona di inviare più turni testuali in sequenza nella stessa esecuzione, usando per ogni turno ammesso dopo il primo la conversazione creata dal primo turno ammesso, fino alla chiusura della sessione.

#### Metadata
  * type: requirement

#### Contract References
  * [Ammissione del primo turno CLI](../Contracts/FamilyConversation.md#ammissione-del-primo-turno-cli)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Stato del turno in elaborazione alla riapertura

Quando la famiglia riapre tramite un client della chat testuale una conversazione con un turno testuale accettato il cui esito non è ancora conservato, Ambrogio deve mostrare quel turno come «In elaborazione» fino alla disponibilità dell'esito conservato.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Transazioni brevi dell'archivio conversazioni

Quando Ambrogio esegue chiamate ad agenti o connettori oppure trasmette la risposta progressiva di un turno, non deve mantenere aperta una transazione SQLite relativa a quel turno.

#### Metadata
  * type: requirement

#### Contract References
  * [Confini atomici dell'archivio conversazioni](../Contracts/FamilyConversation.md#confini-atomici-dellarchivio-conversazioni)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Trascrizione del turno vocale

Quando la famiglia pronuncia un turno vocale trascrivibile, Ambrogio deve rappresentare quel turno nella conversazione mediante la sua trascrizione testuale.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Esclusione dell'audio persistente](../Contracts/FamilyConversation.md#esclusione-dellaudio-persistente)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Trascrizione vocale non riuscita

Se Ambrogio non ottiene una trascrizione utilizzabile di un turno vocale, non deve creare uno scambio per quel turno.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Uscita CLI dopo guasto irreversibile della sessione

Quando un guasto tecnico inatteso rende inutilizzabile una sessione CLI già avviata, la CLI deve smettere di accettare turni, comunicare un errore pubblico sicuro, chiudere le risorse che può chiudere e terminare con codice di uscita 1, senza ripetere automaticamente il turno in corso.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo testuale degli errori CLI](../Contracts/FamilyConversation.md#profilo-testuale-degli-errori-cli)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Validazione del formato negli ingressi conversazionali

Quando un ingresso HTTP o CLI riceve un turno, il suo adapter deve verificare forma e decodifica dei dati del rispettivo protocollo prima di invocare il caso d'uso conversazionale, interrompendo il flusso per input non validi senza attribuirsi le regole di stato della conversazione.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---
