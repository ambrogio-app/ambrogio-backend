# Elements

### Apertura della sessione conversazionale

Quando un client apre il canale conversazionale, il backend deve accettare la sessione soltanto con la versione del protocollo dichiarata dal client e deve ammettere turni soltanto dopo che il client si è identificato con un identificativo stabile e un nome.

#### Concept References
  * [Sessione conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#sessione-conversazionale)
  * [Client conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#client-conversazionale)
  * [Backend](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#backend)

#### Metadata
  * type: requirement

#### Contract References
  * [Ciclo di vita della sessione conversazionale](../Contracts/ConversationProtocol.md#ciclo-di-vita-della-sessione-conversazionale)

#### Relations
  * satisfiedBy: [session-route.ts](../../apps/server/src/adapters/in/session-route.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Canale conversazionale comune a testo e voce

Ambrogio deve offrire ai client testuali e vocali un unico canale conversazionale WebSocket in cui l'invio dei turni, la trasmissione delle risposte e la comunicazione degli esiti seguono lo stesso protocollo e le stesse regole, qualunque sia il tipo di contenuto trasmesso.

#### Details
Alternative: due protocolli, SSE di AI SDK per il testo e Micdrop per la voce (regole diverse per canale: rifiuti HTTP per il testo e risposte parlate per la voce, conferma di successo soltanto nel testo, `expectsReply` soltanto nella voce, una copia della conversazione nella memoria di Micdrop, patch locali del client Micdrop e fine della risposta stimata dal silenzio); un protocollo solo testuale con trascrizione e sintesi sul satellite (modelli e scelta della voce su ogni dispositivo, contro i modelli vocali inclusi nell'immagine del backend); una connessione per conversazione (la chat si riconnette a ogni cambio di conversazione).

Motivo: un solo protocollo applica a testo e voce le stesse regole su rifiuti, esiti e replica attesa, lascia trascrizione e sintesi nel backend e trasporta in una sessione i turni di più conversazioni. Per questo il protocollo non dipende da Micdrop né dal formato UI Message Stream di AI SDK, e il backend non offre il profilo SSE della chat né il protocollo vocale Micdrop.

#### Concept References
  * [Sessione conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#sessione-conversazionale)
  * [Client conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#client-conversazionale)
  * [Turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#turno)
  * [Turno vocale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#turno-vocale)
  * [Esito del turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#esito-del-turno)

#### Metadata
  * type: requirement

#### Contract References
  * [Versioni dell'API HTTP pubblica](../Contracts/HttpApi.md#versioni-dellapi-http-pubblica)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [ambrogio-v1.schema.json](../../protocol/ambrogio-v1.schema.json)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Correlazione diagnostica della sessione conversazionale

Quando il server accetta l'apertura di una sessione conversazionale, deve associare alla sessione un `correlationId` UUID v4 distinto e includerlo in ogni evento diagnostico emesso per quella sessione e per i turni trasmessi in essa.

#### Details
Origine: baseline Reqvire «Explicit diagnostic context», adottata.

#### Concept References
  * [Sessione conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#sessione-conversazionale)

#### Metadata
  * type: requirement

#### Contract References
  * [Profilo iniziale di osservabilità del backend](../Contracts/ServerFoundation.md#profilo-iniziale-di-osservabilità-del-backend)

#### Relations
  * satisfiedBy: [session-route.ts](../../apps/server/src/adapters/in/session-route.ts)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Errore di protocollo senza perdita della sessione

Se il backend riceve dal client un messaggio non conforme al protocollo o di un tipo non previsto, deve comunicare al client un errore di protocollo senza chiudere la sessione e senza alterare i turni già in corso.

#### Details
Alternativa non adottata: una risposta generica del client ai messaggi del server fuori dai turni, `client.result` con `ok` e `reason: "unsupported"`. Nessun messaggio del server la richiede, e obbligherebbe ogni client a implementarla; un messaggio del client di tipo `client.result` è quindi un tipo sconosciuto. Una richiesta del server che attende una risposta si introduce con i requisiti che la motivano.

#### Concept References
  * [Sessione conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#sessione-conversazionale)
  * [Client conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#client-conversazionale)

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * satisfiedBy: [protocol-decoder.ts](../../packages/conversations/src/adapters/in/session/protocol-decoder.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Origini consentite per il canale conversazionale

Quando una richiesta di apertura del canale conversazionale dichiara un'origine, il backend deve accettarla soltanto se quell'origine è esplicitamente configurata per il componente HTTP; in assenza di origini configurate non deve accettare richieste che dichiarano un'origine.

#### Concept References
  * [Sessione conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#sessione-conversazionale)

#### Metadata
  * type: requirement

#### Contract References
  * [Politica CORS del componente HTTP](../Contracts/ServerFoundation.md#politica-cors-del-componente-http)

#### Relations
  * satisfiedBy: [session-route.ts](../../apps/server/src/adapters/in/session-route.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Presentazione del rifiuto del turno da parte del client

Quando un client riceve `turn.rejected` per un turno, deve presentare alla famiglia il rifiuto come esito di errore del turno, al posto di ogni contenuto già presentato per quel turno: un client testuale deve mostrare il messaggio pubblico del rifiuto e un client vocale deve riprodurne l'audio, oppure, quando il messaggio gli arriva in testo perché la voce non è disponibile, deve segnalare localmente l'errore senza pronunciarlo.

#### Details
Regola di interpretazione del protocollo per ogni client. Ogni client la raffina con il proprio codice e le proprie verifiche; il modo in cui un client vocale segnala localmente l'errore appartiene al client.

#### Concept References
  * [Client conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#client-conversazionale)
  * [Rifiuto del turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#rifiuto-del-turno)
  * [Messaggio pubblico](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#messaggio-pubblico)

#### Metadata
  * type: requirement

#### Contract References
  * [Esiti del turno nel protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#esiti-del-turno-nel-protocollo-ambrogio-v1)
  * [Motivi di rifiuto del turno](../Contracts/ConversationProtocol.md#motivi-di-rifiuto-del-turno)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Presentazione dell'errore dopo l'ammissione da parte del client

Quando un client riceve `turn.failed` per un turno ammesso, deve presentare alla famiglia il messaggio pubblico dell'errore come esito del turno, al posto di ogni frammento di risposta già presentato per quel turno: un client testuale deve mostrarne il testo e un client vocale deve riprodurne l'audio.

#### Details
Regola di interpretazione del protocollo per ogni client, corrispettivo lato client della segnalazione dell'errore dopo l'ammissione da parte del backend. Ogni client la raffina con il proprio codice e le proprie verifiche.

#### Concept References
  * [Client conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#client-conversazionale)
  * [Ammissione del turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#ammissione-del-turno)
  * [Messaggio pubblico](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#messaggio-pubblico)

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
Regola di interpretazione del protocollo per ogni client: la fine della generazione, `output.end` o la chiusura della sessione non attestano un esito riuscito. Ogni client la raffina con il proprio codice e le proprie verifiche.

#### Concept References
  * [Client conversazionale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#client-conversazionale)
  * [Esito del turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#esito-del-turno)

#### Metadata
  * type: requirement

#### Contract References
  * [Esiti del turno nel protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#esiti-del-turno-nel-protocollo-ambrogio-v1)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Rifiuto del turno audio senza voce abilitata

Quando la voce non è abilitata nell'installazione e un turno trasmette audio o chiede la risposta in audio, il backend deve rifiutare il turno con il motivo `audio_unavailable` e trasmettere il messaggio pubblico in testo, senza ammetterlo né conservarlo.

#### Concept References
  * [Turno vocale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#turno-vocale)
  * [Rifiuto del turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#rifiuto-del-turno)
  * [Messaggio pubblico](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#messaggio-pubblico)

#### Metadata
  * type: requirement

#### Contract References
  * [Motivi di rifiuto del turno](../Contracts/ConversationProtocol.md#motivi-di-rifiuto-del-turno)
  * [Configurazione facoltativa della voce](../Contracts/FamilyConversation.md#configurazione-facoltativa-della-voce)

#### Relations
  * derivedFrom: [Rifiuto del turno prima dell'ammissione](FamilyConversation.md#rifiuto-del-turno-prima-dellammissione)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione a voce](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-a-voce)
---

### Rifiuto del turno oltre i limiti di trasmissione

Quando la trasmissione di un turno supera il limite di dimensione del testo o di durata dell'audio stabilito dal protocollo, il backend deve rifiutare il turno con il motivo `too_large`, interrompendo l'eventuale trascrizione in corso e scartandone il risultato, senza ammetterlo o conservarlo.

#### Concept References
  * [Turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#turno)
  * [Rifiuto del turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#rifiuto-del-turno)

#### Metadata
  * type: requirement

#### Contract References
  * [Motivi di rifiuto del turno](../Contracts/ConversationProtocol.md#motivi-di-rifiuto-del-turno)
  * [Trasmissione in ingresso del protocollo Ambrogio v1](../Contracts/ConversationProtocol.md#trasmissione-in-ingresso-del-protocollo-ambrogio-v1)

#### Relations
  * derivedFrom: [Rifiuto del turno prima dell'ammissione](FamilyConversation.md#rifiuto-del-turno-prima-dellammissione)
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Trasmissione della richiesta del turno

Quando un client invia un turno, il backend deve riceverlo come una trasmissione con apertura, contenuto e chiusura, con la stessa struttura per il testo e per l'audio, e deve considerare completa la richiesta soltanto alla chiusura della trasmissione.

#### Details
Il backend consegna l'audio al trascrittore mentre la richiesta è ancora aperta: trascrivere l'intero audio soltanto dopo la chiusura aggiungerebbe al turno il tempo di trascrizione di tutto l'audio ricevuto.

#### Concept References
  * [Turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#turno)
  * [Turno vocale](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#turno-vocale)
  * [Ammissione del turno](../../../ambrogio-model/system-model/Thesaurus/Lessico.md#ammissione-del-turno)

#### Metadata
  * type: requirement

#### Contract References
  * [Trascrizione vocale in streaming con sherpa-onnx](../Contracts/FamilyConversation.md#trascrizione-vocale-in-streaming-con-sherpa-onnx)

#### Relations
  * satisfiedBy: [conversation-session.adapter.ts](../../packages/conversations/src/adapters/in/session/conversation-session.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

