# Elements

### Archivio SQLite con Kysely

Le conversazioni e i loro scambi testuali sono conservati in un database SQLite dell'installazione. Le operazioni applicative di lettura e scrittura dell'archivio usano Kysely. La scelta riguarda l'archivio delle conversazioni; non prescrive lo stack degli altri componenti del monorepo.

#### Metadata
  * type: specification

#### Relations
  * define: [Disponibilità dello storico dopo riavvio](../Requirements/FamilyConversation.md#disponibilità-dello-storico-dopo-riavvio)
---

### Canale SSE del turno riaperto

Il client che riapre una conversazione mentre un turno testuale è in corso apre una nuova connessione di sola ricezione associata alla conversazione e al turno già accettato, senza inviare nuovamente il testo del turno. La risposta usa `Content-Type: text/event-stream` e messaggi Server-Sent Events in UTF-8. Sul nuovo flusso, il backend emette come `delta` il testo della risposta già prodotto, eventualmente in uno o più frammenti, e poi gli ulteriori frammenti nell'ordine di produzione; la loro concatenazione ricostruisce la risposta senza lacune né duplicati. Ogni `delta` ha `data` JSON con il campo stringa `text`. La conclusione riuscita usa `done` con `data: {}` e l'errore usa `error` con `data` JSON contenente il campo stringa `error` e un messaggio pubblico sicuro. La connessione aperta dopo la riapertura è distinta dalla risposta SSE alla richiesta POST originale. Il percorso della richiesta resta da definire.

#### Metadata
  * type: input-output

#### Relations
  * define: [Flusso degli aggiornamenti del turno riaperto](../Requirements/FamilyConversation.md#flusso-degli-aggiornamenti-del-turno-riaperto)
---

### Dati della richiesta del turno della chat testuale

La richiesta HTTP POST della chat testuale usa `Content-Type: application/json` e un corpo JSON con `text`, stringa che contiene il nuovo turno testuale, e `conversationId`, stringa presente quando si prosegue una conversazione conservata e assente quando se ne avvia una nuova. Il valore di `text`, eliminati gli spazi bianchi iniziali e finali per la sola verifica di validità, deve contenere almeno un carattere. Il corpo non contiene gli scambi precedenti: lo storico è recuperato dal backend dall'archivio delle conversazioni.

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

### Profilo di trasporto SSE della chat

Il client invia il turno della chat testuale con una richiesta HTTP POST. Il backend restituisce il flusso sulla risposta della stessa richiesta, con `Content-Type: text/event-stream` ed eventi nel formato Server-Sent Events codificati in UTF-8. Quando il turno crea una nuova conversazione, il primo evento applicativo del flusso è `event: conversation` e comunica `conversationId`, corrispondente all'identificativo della conversazione conservata, prima di qualsiasi incremento della risposta testuale. Il valore del campo SSE `data` di questo evento è la serializzazione JSON di un oggetto con il campo stringa `conversationId`, per esempio `{"conversationId":"..."}`. Ogni evento che trasporta testo di risposta è `event: delta` e usa nel proprio campo SSE `data` la serializzazione JSON di un oggetto con il campo stringa `text`, contenente soltanto il nuovo frammento; la concatenazione ordinata dei frammenti ricostruisce la risposta testuale. Quando la risposta è prodotta in più incrementi, il backend trasmette gli incrementi disponibili prima del completamento della generazione, senza attendere di disporre dell'intera risposta. Dopo l'ultimo incremento di una risposta completata correttamente, il backend invia un evento con `event: done` e `data: {}`, terminato da una riga vuota secondo il formato SSE, e poi chiude il flusso. `done` segnala il completamento riuscito; la sola chiusura del flusso senza `done` non lo segnala. Se un errore impedisce il completamento dopo l'avvio del flusso, il backend invia `event: error` con `data` contenente la serializzazione JSON di un oggetto con il campo stringa `error` e un messaggio pubblico sicuro, per esempio `{"error":"..."}`; termina l'evento con una riga vuota e chiude il flusso senza `done`. Il messaggio pubblico rispetta l'esclusione dei dettagli tecnici dai messaggi di guasto.

#### Metadata
  * type: input-output

#### Relations
  * define: [Risposta progressiva SSE nella chat testuale](../Requirements/FamilyConversation.md#risposta-progressiva-sse-nella-chat-testuale)
---

### Responsabilità di Domain Application e adapter

Nel modulo business «Conversazioni», Domain contiene le regole e i tipi del dominio della conversazione; Application contiene i casi d'uso e le porte necessarie per collaborare con componenti esterni; gli adapter realizzano gli ingressi del modulo e le integrazioni tecniche richieste dalle porte. Questa suddivisione riguarda le responsabilità del codice, indipendentemente dai percorsi delle cartelle.

#### Metadata
  * type: specification

#### Relations
  * define: [Separazione delle responsabilità nel modulo Conversazioni](../Requirements/FamilyConversation.md#separazione-delle-responsabilità-nel-modulo-conversazioni)
---

### Risposta di errore HTTP prima del flusso testuale

Se un errore viene determinato prima dell'invio degli header SSE, il backend risponde alla richiesta POST con uno stato HTTP di errore `4xx` o `5xx` e `Content-Type: application/json`. Il corpo è un oggetto JSON con il campo stringa `error` contenente un messaggio pubblico sicuro, per esempio `{"error":"..."}`. Il messaggio non espone dettagli tecnici del guasto. Questa risposta non usa `text/event-stream` e non contiene eventi SSE. Se `text` è vuoto o contiene soltanto spazi bianchi, il codice di stato è `400`, anche quando è presente un `conversationId` inesistente. Se `text` è valido ma il `conversationId` non identifica una conversazione conservata, il codice di stato è `404`. La scelta del codice di stato specifico per gli altri casi di errore resta da definire.

#### Metadata
  * type: input-output

#### Relations
  * define: [Segnalazione dell'errore HTTP prima del flusso testuale](../Requirements/FamilyConversation.md#segnalazione-dellerrore-http-prima-del-flusso-testuale)
---

### Stati del turno testuale alla riapertura

Un turno testuale accettato e ancora in elaborazione è distinguibile dagli scambi conclusi quando si consulta la conversazione. Finché il relativo esito non è conservato, la consultazione lo identifica come `in elaborazione` e lo associa al testo del turno. Se è già disponibile testo generato per la risposta, il client lo mostra come risposta parziale nello stesso messaggio, senza presentarlo come risposta completa. Gli aggiornamenti successivi alla riapertura arrivano al client tramite messaggi SSE del turno riaperto. Quando l'esito è conservato, il client presenta lo scambio concluso con risposta oppure errore e non presenta più per lo stesso turno lo stato `in elaborazione`.

#### Metadata
  * type: state

#### Relations
  * define: [Stato del turno in elaborazione alla riapertura](../Requirements/FamilyConversation.md#stato-del-turno-in-elaborazione-alla-riapertura)
---

### Stati dell'interazione vocale

L'interazione vocale ha gli stati `chiusa` e `attiva`. Nello stato `attiva` è associata a una sola conversazione. Un avvio esplicito crea una nuova conversazione e la rende attiva anche se un'altra interazione era ancora attiva. Una replica arrivata prima della scadenza dell'intervallo di inattività appartiene alla conversazione attiva. L'intervallo decorre dalla fine della risposta vocale e ricomincia dopo ogni risposta vocale. Alla scadenza, l'interazione passa a `chiusa`; un successivo turno vocale richiede un nuovo avvio e una nuova conversazione. Il valore iniziale dell'intervallo è 15 secondi ed è configurabile con un valore positivo.

#### Metadata
  * type: state

#### Relations
  * define: [Chiusura per inattività vocale](../Requirements/FamilyConversation.md#chiusura-per-inattività-vocale)
---

### Struttura testuale dello scambio

Lo storico di una conversazione è una sequenza ordinata di scambi. Ogni scambio contiene il testo del turno della famiglia, il tipo di esito comunicato da Ambrogio (risposta oppure errore) e il testo di tale esito. Uno scambio appartiene a una sola conversazione. Per un turno vocale, il testo del turno è la trascrizione.

#### Metadata
  * type: input-output

#### Relations
  * define: [Conservazione dello scambio testuale](../Requirements/FamilyConversation.md#conservazione-dello-scambio-testuale)
---
