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

### CLI limitata alla conversazione dell'esecuzione corrente

Quando la CLI è in esecuzione, deve operare soltanto sulla nuova conversazione testuale creata per quell'esecuzione e non deve offrire funzioni per leggere o riaprire conversazioni preesistenti.

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

### Chiusura per inattività vocale

Quando trascorre l'intervallo di inattività configurato senza repliche vocali, Ambrogio deve terminare l'interazione vocale attiva.

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
  * [Profilo di trasporto SSE della chat](../Contracts/FamilyConversation.md#profilo-di-trasporto-sse-della-chat)

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

### Flusso degli aggiornamenti del turno riaperto

Quando un client della chat testuale riapre una conversazione con un turno testuale accettato ancora in elaborazione, il backend deve consentire al client di collegarsi agli aggiornamenti SSE di quel turno e trasmetterne l'avanzamento e l'esito tramite messaggi nello stream, senza avviare un nuovo turno.

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

### Integrazione esterna tramite porte e adapter

Quando un caso d'uso del modulo «Conversazioni» richiede una capacità tecnica esterna, Application deve dichiarare una porta per tale capacità e un adapter deve realizzarne l'integrazione concreta.

#### Metadata
  * type: requirement

#### Contract References
  * [Responsabilità di Domain Application e adapter](../Contracts/FamilyConversation.md#responsabilità-di-domain-application-e-adapter)

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

### Modulo business unico per la conversazione

I flussi applicativi di conversazione testuale e vocale del server devono appartenere al medesimo modulo business «Conversazioni».

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Nuova conversazione testuale per esecuzione CLI

Quando viene avviata una nuova esecuzione della CLI, Ambrogio deve iniziare una nuova conversazione testuale distinta da quelle delle esecuzioni precedenti.

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

### Segnalazione del completamento della risposta testuale

Quando il backend completa correttamente la risposta a un turno della chat testuale, deve trasmettere un evento SSE `done` dopo tutti gli incrementi testuali e prima di chiudere il flusso.

#### Metadata
  * type: requirement

#### Contract References
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

### Stato del turno in elaborazione alla riapertura

Quando la famiglia riapre tramite un client della chat testuale una conversazione con un turno testuale accettato il cui esito non è ancora conservato, Ambrogio deve mostrare quel turno come «In elaborazione» fino alla disponibilità dell'esito conservato.

#### Metadata
  * type: requirement

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
