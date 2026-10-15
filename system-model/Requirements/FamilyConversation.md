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

### Avvio consultivo dell'API conversazioni

Quando il processo avvia l'ingresso HTTP di consultazione delle conversazioni, deve rendere disponibili le rotte di elenco e storico dopo aver validato le configurazioni attive e preparato l'archivio.

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

Quando il server termina normalmente o fallisce durante l'avvio dopo aver creato la risorsa SQLite/Kysely dell'archivio, il proprietario deve chiudere la risorsa dopo le operazioni che ne dipendono.

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
  * satisfiedBy: [sqlite-conversation-write.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-write.ts)
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

### Configurazione della paginazione conversazionale

Quando il server prepara la consultazione dell'elenco delle conversazioni, deve individuare il file JSON locale del componente «Conversazioni» tramite `AMBROGIO_CONVERSATIONS_CONFIG_PATH` e usare i valori di dimensione della pagina e dimensione massima scelti dall'utente nel file, applicando i valori predefiniti concordati se i campi sono assenti e impedendo l'attivazione se il percorso o i valori sono invalidi.

#### Metadata
  * type: requirement

#### Contract References
  * [Pagine dell'elenco conversazioni](../Contracts/FamilyConversation.md#pagine-dellelenco-conversazioni)
  * [Profilo di bootstrap dei JSON dei componenti](../Contracts/ServerFoundation.md#profilo-di-bootstrap-dei-json-dei-componenti)

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [conversation-config-path.ts](../../apps/server/src/runtime/conversation-config-path.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conservazione del testo originale del turno

Quando Ambrogio accetta un turno testuale dalla chat o dalla trascrizione vocale, deve conservare il testo ricevuto senza rimuovere né modificare gli spazi iniziali, finali o interni. L'eventuale rimozione degli spazi per verificare se il testo è vuoto non modifica il testo accettato.

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

### Continuazione testuale di ogni conversazione

Quando la famiglia riapre nella chat testuale una conversazione conservata, indipendentemente dall'ingresso in cui è iniziata, e invia un turno testuale, Ambrogio deve aggiungere il nuovo scambio alla stessa conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Continuità del turno dopo un guasto di consegna

Quando la consegna di una notifica di un turno già ammesso all'ingresso fallisce, Ambrogio deve proseguire l'elaborazione e conservare l'esito del turno indipendentemente da quel guasto di consegna.

#### Metadata
  * type: requirement

#### Contract References
  * [Dati dei casi d'uso indipendenti dagli ingressi](../Contracts/FamilyConversation.md#dati-dei-casi-duso-indipendenti-dagli-ingressi)

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
  * satisfiedBy: [conversation-history-read.ts](../../packages/conversations/src/application/conversation-history-read.ts)
  * satisfiedBy: [conversation-list-read.ts](../../packages/conversations/src/application/conversation-list-read.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Contratto di scrittura dell'archivio conversazioni

Quando Application del modulo «Conversazioni» conserva turni o esiti, deve usare un contratto di persistenza dedicato al modello di scrittura della conversazione, con semantica sufficiente alle transizioni richieste dai casi d'uso. Il contratto può esporre il salvataggio dell'aggregato oppure operazioni di transizione esplicite; non deve imporre un'interfaccia CRUD universale ai casi d'uso.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-write.ts](../../packages/conversations/src/application/conversation-write.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conversione esplicita dei dati conversazionali persistenti

Quando un adapter del modulo «Conversazioni» legge o scrive l'archivio SQLite, deve convertire esplicitamente tra le rappresentazioni tecniche delle righe e i valori Domain o le proiezioni Application previsti dai rispettivi contratti, senza esporre righe o tipi Kysely a Domain e Application.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Dati Application dei casi d'uso conversazionali

Quando un caso d'uso del modulo «Conversazioni» riceve dati di ingresso o produce dati di successo, deve usare contratti definiti in Application e indipendenti dai formati HTTP e voce. Gli adapter di ingresso devono tradurre i rispettivi dati di protocollo in tali contratti e rappresentarne gli esiti nel proprio formato.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Diagnostica del guasto tecnico di consegna

Quando la consegna di una notifica conversazionale fallisce per un guasto tecnico diverso dalla disconnessione del client, il componente tecnico che gestisce la consegna deve registrare il guasto nel canale diagnostico del server.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Diagnostica dei guasti nei componenti tecnici](ServerFoundation.md#diagnostica-dei-guasti-nei-componenti-tecnici)
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
  * satisfiedBy: [list-route.ts](../../packages/conversations/src/adapters/in/http/list-route.ts)
  * satisfiedBy: [sqlite-conversation-list-read.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-list-read.ts)
  * satisfiedBy: [list-conversations.use-case.ts](../../packages/conversations/src/application/list-conversations.use-case.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Forma TypeScript dei contratti Application

Quando Application del modulo «Conversazioni» dichiara una porta outbound a oggetto con metodi nominati, deve usare `interface`; quando dichiara dati, unioni o contratti callable, deve usare `type`.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-write.ts](../../packages/conversations/src/application/conversation-write.ts)
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

### Gestione del turno ammesso senza storico utilizzabile

Quando, dopo l'ammissione di un turno, il server non riesce a leggere uno storico utilizzabile per elaborarlo, Ambrogio deve provare a conservarne l'esito «Errore» e liberare l'occupazione; se la conservazione dell'esito fallisce, il server deve smettere di accettare nuovi turni fino al riavvio.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [turn-route.ts](../../packages/conversations/src/adapters/in/http/turn-route.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Identificativi UUID v4 di conversazioni e turni

Quando Ambrogio crea una nuova conversazione o accetta un nuovo turno, deve assegnargli un identificativo UUID v4 distinto, stabile nello storico e dopo il riavvio.

#### Metadata
  * type: requirement

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

Quando un'installazione non abilita l'interazione vocale, Ambrogio deve consentire l'uso della chat testuale senza richiedere la configurazione o l'avvio dei componenti necessari soltanto alla voce.

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
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Invio HTTP del turno della chat testuale

Quando la famiglia invia un turno testuale da un client della chat testuale, il client deve trasmettere il turno al backend mediante una richiesta HTTP POST.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Invito ad aggiornare la conversazione in elaborazione

Quando una conversazione riaperta nel client della chat testuale mostra un turno «In elaborazione», il client deve invitare la persona ad aggiornare manualmente la pagina più tardi per consultarne l'esito.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati del turno testuale alla riapertura](../Contracts/FamilyConversation.md#stati-del-turno-testuale-alla-riapertura)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Istanti validi e protetti della conversazione

Quando Application e Domain rappresentano un istante della conversazione, devono usare un `Date` valido. Gli oggetti Domain che ricevono o espongono un `Date` devono proteggerlo con copie difensive in ingresso e in uscita.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [turn.ts](../../packages/conversations/src/domain/turn.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Lettura HTTP dell'elenco conversazioni

Quando un client della chat testuale consulta l'elenco delle conversazioni conservate, il backend deve restituire una pagina dell'elenco e un riferimento utilizzabile per richiedere la pagina successiva secondo il contratto HTTP pubblico dell'elenco.

#### Metadata
  * type: requirement

#### Contract References
  * [Pagine dell'elenco conversazioni](../Contracts/FamilyConversation.md#pagine-dellelenco-conversazioni)

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [list-route.ts](../../packages/conversations/src/adapters/in/http/list-route.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Lettura HTTP dello storico conversazionale

Quando un client della chat testuale consulta una conversazione conservata, il backend deve restituire lo storico testuale ordinato e lo stato corrente dei suoi turni mediante la risposta alla richiesta HTTP di lettura, secondo il contratto pubblico dello storico conversazionale.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [history-route.ts](../../packages/conversations/src/adapters/in/http/history-route.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Localizzazione dell'errore conversazionale inatteso

Quando un turno ammesso termina con un guasto inatteso, Ambrogio deve comunicare e conservare lo stesso messaggio pubblico standard tradotto nella lingua scelta dall'utente nel file JSON locale del componente «Conversazioni».

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
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
  * satisfiedBy: [turn-capabilities.ts](../../packages/conversations/src/application/turn-capabilities.ts)
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
  * satisfiedBy: [sqlite-conversation-list-read.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-list-read.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Persistenza degli istanti conversazionali in millisecondi Unix

Quando l'adapter dell'archivio salva o ricostruisce un istante della conversazione, deve convertirlo esplicitamente tra un `Date` valido nel codice e un intero di millisecondi trascorsi dall'epoca Unix nella riga SQLite, preservando esattamente l'istante.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [sqlite-conversation-write.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-write.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Precondizioni contestuali nel caso d'uso conversazionale

Quando un turno supera la validazione dell'ingresso, il caso d'uso Application deve coordinare le precondizioni dipendenti dal contesto della conversazione tramite le proprie porte e interrompere il flusso con un rifiuto previsto quando esse non sono soddisfatte, lasciando al Domain gli invarianti del turno e all'archivio SQLite la garanzia atomica dell'unico turno attivo.

#### Metadata
  * type: requirement

#### Contract References
  * [Proprietà dei controlli del turno conversazionale](../Contracts/FamilyConversation.md#proprietà-dei-controlli-del-turno-conversazionale)

#### Relations
  * satisfiedBy: [begin-turn.use-case.ts](../../packages/conversations/src/application/begin-turn.use-case.ts)
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

Quando il server usa l'archivio delle conversazioni, la sua composition root deve creare un solo proprietario della risorsa SQLite/Kysely per quell'archivio e fornire agli adapter le capacità necessarie senza trasferire loro la responsabilità di chiuderla.

#### Metadata
  * type: requirement

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

Quando Ambrogio accetta un turno rappresentato come testo dalla chat o dalla trascrizione vocale, deve conservarne il testo e lo stato in elaborazione prima di avviarne l'elaborazione, affinché il turno sia riconoscibile dopo un riavvio.

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

Quando un ingresso tenta di riaprire una conversazione conservata per aggiungere nuovi turni, Ambrogio deve consentire la riapertura soltanto tramite un client della chat testuale; una nuova interazione vocale deve usare una nuova conversazione.

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

Quando il server si avvia e trova turni conservati come «In elaborazione» senza esito, Ambrogio deve contrassegnarli tutti come «Interrotti» prima di accettare nuovi turni e mostrarli come tali nelle rispettive conversazioni.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Rifiuto dei turni concorrenti nell'installazione

Quando l'installazione ha un turno accettato il cui esito non è ancora conservato, Ambrogio deve rifiutare come esito previsto ogni nuovo turno proveniente da testo o voce, indipendentemente dal client e dalla conversazione, senza accettarlo né conservarlo.

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

### Risposta progressiva SSE nella chat testuale

Quando il backend avvia il flusso di risposta a un turno della chat testuale, deve trasmettere progressivamente la risposta come Server-Sent Events nella risposta alla stessa richiesta HTTP POST che ha ricevuto il turno, conforme al profilo di trasporto SSE della chat.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [sse-events.ts](../../packages/conversations/src/adapters/in/http/sse-events.ts)
  * satisfiedBy: [turn-route.ts](../../packages/conversations/src/adapters/in/http/turn-route.ts)
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Risposta testuale nella conversazione

Quando la famiglia invia un turno testuale, Ambrogio deve comunicare una risposta testuale o un messaggio di errore nella conversazione a cui appartiene il turno.

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
  * satisfiedBy: [sqlite-conversation-write.ts](../../packages/conversations/src/adapters/out/sqlite/sqlite-conversation-write.ts)
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

Quando un turno della chat testuale non può avviare la risposta SSE, il backend deve restituire una risposta HTTP di errore con un messaggio pubblico sicuro in formato JSON, senza iniziare un flusso SSE; se l'archivio rifiuta temporaneamente l'ammissione perché occupato o gli ingressi sono disabilitati dopo una conclusione non conservata, deve usare HTTP 503 con il messaggio di indisponibilità nella lingua configurata; se un guasto tecnico inatteso avviene prima dell'ammissione, deve usare HTTP 500 e il messaggio standard nella lingua configurata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Esclusione dei dettagli tecnici dal messaggio pubblico](ServerFoundation.md#esclusione-dei-dettagli-tecnici-dal-messaggio-pubblico)
  * satisfiedBy: [turn-route.ts](../../packages/conversations/src/adapters/in/http/turn-route.ts)
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
  * satisfiedBy: [turn-route.ts](../../packages/conversations/src/adapters/in/http/turn-route.ts)
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
  * satisfiedBy: [turn-route.ts](../../packages/conversations/src/adapters/in/http/turn-route.ts)
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
  * satisfiedBy: [turn-route.ts](../../packages/conversations/src/adapters/in/http/turn-route.ts)
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

### Selezione dell'archivio conversazionale all'avvio

Quando il processo prepara l'ingresso HTTP di consultazione, deve aprire l'archivio SQLite al percorso dichiarato nel JSON locale del componente «Conversazioni» e impedire l'avvio se il percorso manca o è invalido.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversations.ts](../../apps/server/src/composition/conversations.ts)
  * satisfiedBy: [conversation-config.ts](../../packages/conversations/src/adapters/out/conversation-config.ts)
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

### Stato del turno in elaborazione alla riapertura

Quando la famiglia consulta tramite un client della chat testuale una conversazione con un turno testuale accettato il cui esito non è ancora conservato, Ambrogio deve mostrare quel turno come «In elaborazione»; a una nuova consultazione dopo la conservazione dell'esito deve mostrare lo scambio concluso.

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

### Validazione del formato negli ingressi conversazionali

Quando l'ingresso HTTP riceve un turno, il suo adapter deve verificare forma e decodifica dei dati del rispettivo protocollo prima di invocare il caso d'uso conversazionale, interrompendo il flusso per input non validi senza attribuirsi le regole di stato della conversazione.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---
