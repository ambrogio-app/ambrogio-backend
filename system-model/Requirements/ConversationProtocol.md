# Elements

### Apertura della sessione conversazionale

Quando un client apre il canale conversazionale, il backend deve accettare la sessione soltanto con la versione del protocollo dichiarata dal client e deve ammettere turni soltanto dopo che il client si è identificato con un identificativo stabile e un nome.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [session-route.adapter.ts](../../apps/server/src/adapters/in/session-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Canale conversazionale comune a testo e voce

Ambrogio deve offrire ai client testuali e vocali un unico canale conversazionale WebSocket in cui l'invio dei turni, la trasmissione delle risposte e la comunicazione degli esiti seguono lo stesso protocollo e le stesse regole, qualunque sia il tipo di contenuto trasmesso.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [ambrogio-v1.schema.json](../../protocol/ambrogio-v1.schema.json)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Correlazione diagnostica della sessione conversazionale

Quando il server accetta l'apertura di una sessione conversazionale, deve associare alla sessione un `correlationId` UUID v4 distinto e includerlo in ogni evento diagnostico emesso per quella sessione e per i turni trasmessi in essa.

#### Details
Origine: baseline Reqvire «Explicit diagnostic context», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo iniziale di osservabilità del backend](../Contracts/ServerFoundation.md#profilo-iniziale-di-osservabilità-del-backend)

#### Relations
  * satisfiedBy: [session-route.adapter.ts](../../apps/server/src/adapters/in/session-route.adapter.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Errore di protocollo senza perdita della sessione

Se il backend riceve dal client un messaggio non conforme al protocollo o di un tipo non previsto, deve comunicare al client un errore di protocollo senza chiudere la sessione e senza alterare i turni già in corso.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [protocol-decoder.ts](../../packages/conversations/src/adapters/in/session/protocol-decoder.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Origini consentite per il canale conversazionale

Quando una richiesta di apertura del canale conversazionale dichiara un'origine, il backend deve accettarla soltanto se quell'origine è esplicitamente configurata per il componente HTTP; in assenza di origini configurate non deve accettare richieste che dichiarano un'origine.

#### Metadata
  * type: requirement

#### Contract References
  * [Politica CORS del componente HTTP](../Contracts/ServerFoundation.md#politica-cors-del-componente-http)

#### Relations
  * satisfiedBy: [session-route.adapter.ts](../../apps/server/src/adapters/in/session-route.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Presentazione del rifiuto del turno da parte del client

Quando un client riceve `turn.rejected` per un turno, deve presentare alla famiglia il messaggio pubblico del rifiuto come esito di errore del turno, al posto di ogni contenuto già presentato per quel turno.

#### Details
Regola di interpretazione del protocollo valida per ogni client. Ogni client la raffina con il proprio codice e le proprie verifiche.

#### Metadata
  * type: requirement

#### Contract References
  * [Esiti del turno nel protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#esiti-del-turno-nel-protocollo-ambrogio-v1)
  * [Motivi di rifiuto del turno](../Contracts/ConversationProtocol.md#motivi-di-rifiuto-del-turno)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Presentazione dell'errore dopo l'ammissione da parte del client

Quando un client riceve `turn.failed` per un turno ammesso, deve presentare alla famiglia il messaggio pubblico dell'errore come esito del turno, al posto di ogni frammento di risposta già presentato per quel turno.

#### Details
Corrispettivo lato client di «Segnalazione dell'errore dopo l'ammissione». Ogni client la raffina con il proprio codice e le proprie verifiche.

#### Metadata
  * type: requirement

#### Contract References
  * [Esiti del turno nel protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#esiti-del-turno-nel-protocollo-ambrogio-v1)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Riconoscimento dell'esito riuscito del turno da parte del client

Quando un turno si conclude, un client del protocollo `ambrogio.v1` deve considerare riuscita la risposta soltanto se ha ricevuto `turn.completed` per quel turno.

#### Details
Regola di interpretazione del protocollo valida per ogni client: la fine della generazione, `output.end` o la chiusura della sessione non attestano un esito riuscito. Ogni client la raffina con il proprio codice e le proprie verifiche.

#### Metadata
  * type: requirement

#### Contract References
  * [Esiti del turno nel protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#esiti-del-turno-nel-protocollo-ambrogio-v1)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Rifiuto del turno audio senza voce abilitata

Quando la voce non è abilitata nell'installazione e un turno trasmette audio o chiede la risposta in audio, il backend deve rifiutare il turno con il motivo `audio_unavailable` e trasmettere il messaggio pubblico in testo, senza ammetterlo né conservarlo.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Rifiuto del turno prima dell'ammissione](FamilyConversation.md#rifiuto-del-turno-prima-dellammissione)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Rifiuto del turno oltre i limiti di trasmissione

Quando la trasmissione di un turno supera il limite di dimensione del testo o di durata dell'audio stabilito dal protocollo, il backend deve rifiutare il turno con il motivo `too_large`, interrompendo l'eventuale trascrizione in corso e scartandone il risultato, senza ammetterlo o conservarlo.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Rifiuto del turno prima dell'ammissione](FamilyConversation.md#rifiuto-del-turno-prima-dellammissione)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Trasmissione della richiesta del turno

Quando un client invia un turno, il backend deve riceverlo come una trasmissione con apertura, contenuto e chiusura, con le stesse regole per il testo e per l'audio, e deve considerare completa la richiesta soltanto alla chiusura della trasmissione.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---
