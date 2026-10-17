# Elements

### Adozione del protocollo conversazionale Ambrogio v1

Decisione concordata il 17 ottobre 2026: chat testuale e voce usano un unico protocollo conversazionale di Ambrogio, `ambrogio.v1`, trasportato su WebSocket. Il protocollo è posseduto dal backend e non dipende da Micdrop né dal formato UI Message Stream di AI SDK.

#### Decisioni
- Il protocollo sostituisce, senza un periodo di compatibilità parallela, il profilo SSE della chat basato su UI Message Stream v1 di AI SDK (`POST /api/conversations/turns`) e il protocollo vocale Micdrop su `/api/voice`. Client testuali e vocali si aggiornano alla revisione del backend che introduce il protocollo e la registrano nei rispettivi modelli.
- Testo e voce condividono gli stessi messaggi: ogni richiesta e ogni contenuto per la famiglia è una trasmissione con apertura, contenuto e chiusura, e il tipo di contenuto, testo o audio, è dichiarato all'apertura. Rifiuti, errori ed esiti seguono le stesse regole per ogni client.
- Trascrizione con Vosk e sintesi con Piper restano nel backend: un client vocale trasmette e riceve audio, un client testuale trasmette e riceve testo.
- Una sessione WebSocket per client trasporta turni di più conversazioni; la conversazione non dipende dalla connessione. Il client decide se continuare una conversazione esistente o iniziarne una nuova, e il backend applica le stesse regole di continuazione a turni testuali e vocali. La regola per cui il satellite apre una nuova conversazione a ogni attivazione con la wake word e prosegue la stessa solo per le repliche immediate appartiene al modello del satellite.
- Ogni turno completato comunica `expectsReply`, indipendentemente dal tipo di contenuto; la produzione della risposta segue un unico percorso con l'indicazione strutturata della replica attesa.
- Elenco e storico delle conversazioni restano rotte HTTP GET.
- La definizione macchina dei messaggi è uno schema JSON versionato nel repository backend.
- Il protocollo ammette messaggi del server non legati a un turno, con una regola di risposta esplicita del client, senza una dichiarazione preventiva delle capacità del client.

#### Alternative e conseguenze
Sono state considerate la conservazione dei due protocolli, SSE di AI SDK per il testo e Micdrop per la voce, un protocollo solo testuale con trascrizione e sintesi sul satellite, e una connessione per conversazione. La conservazione dei protocolli lasciava regole diverse per canale: rifiuti HTTP per il testo e risposte parlate per la voce, conferma di successo soltanto nel testo, `expectsReply` soltanto nella voce, una copia della conversazione nella memoria di Micdrop, patch locali del client Micdrop e la stima della fine della risposta tramite silenzio. Trascrizione e sintesi sul satellite avrebbero spostato modelli e scelta della voce su ogni dispositivo, contro la decisione di includere le voci Piper nell'immagine backend. Una connessione per conversazione avrebbe obbligato la chat a riconnettersi a ogni cambio di conversazione.

Questa decisione sostituisce i contratti «Profilo di trasporto SSE della chat», «Protocollo vocale del prodotto», «Stati dell'interazione vocale», «Chiusura coordinata con la riproduzione», «Dati della richiesta del turno della chat testuale» e «Risposta di errore HTTP prima del flusso testuale», e i requisiti «Riapertura delle conversazioni tramite chat testuale» e «Replica vocale nella conversazione attiva». Riduce l'adozione di AI SDK ai soli agenti. Restano invariate le regole su ammissione atomica per conversazione, completamento dopo disconnessione, esiti conservati, diagnostica, configurazione e lingua. Il cambiamento richiede di aggiornare i modelli, i contratti di compatibilità e le prove di integrazione di `ambrogio-cli` e `ambrogio-satellite`.

#### Impatto sulle guide esterne
Sito e documentazione utente risiedono in repository separati; gli esempi di integrazione della chat e della voce vanno aggiornati al nuovo protocollo. La validazione locale non dimostra l'allineamento di quei repository.

#### Metadata
  * type: specification

#### Relations
  * define: [Canale conversazionale comune a testo e voce](../Requirements/ConversationProtocol.md#canale-conversazionale-comune-a-testo-e-voce)
---

### Ciclo di vita della sessione conversazionale

Una sessione conversazionale attraversa gli stati `aperta`, dopo l'upgrade accettato e in attesa di `session.hello`, `pronta`, dopo `session.ready`, quando accetta trasmissioni, e `chiusa`. La sessione passa a `chiusa` quando il client o il server chiudono la WebSocket, quando non risponde ai ping o all'arresto del server. Alla chiusura il backend rilascia le risorse della sessione: le trasmissioni in ingresso non concluse vengono scartate senza creare turni e le sintesi audio in corso per la sessione vengono interrotte, mentre i turni già ammessi proseguono fino all'esito conservato. La chiusura di una sessione non influenza le sessioni degli altri client. Il backend non deduce né attende la fine della riproduzione sul client: decidere quando attendere una replica o chiudere la sessione appartiene al client.

#### Metadata
  * type: state

#### Relations
  * define: [Chiusura della sessione conversazionale](../Requirements/FamilyConversation.md#chiusura-della-sessione-conversazionale)
---

### Controllo dell'origine all'apertura della sessione

L'upgrade WebSocket del canale conversazionale applica l'elenco di origini autorizzate del JSON locale del componente HTTP. Una richiesta senza header `Origin`, tipica dei client non browser, è accettata. Una richiesta con `Origin` è accettata soltanto se il valore corrisponde esattamente a un'origine dell'elenco; altrimenti il server rifiuta l'upgrade con HTTP 403 prima di creare la sessione. Con elenco vuoto o assente nessuna origine dichiarata è accettata. Il controllo non sostituisce le restrizioni di rete e reverse proxy previste per l'installazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Origini consentite per il canale conversazionale](../Requirements/ConversationProtocol.md#origini-consentite-per-il-canale-conversazionale)
---

### Correlazione diagnostica della sessione Ambrogio v1

Decisione concordata il 17 ottobre 2026: ogni sessione conversazionale ha un identificativo di correlazione per la diagnostica. Il `correlationId` della sessione è quello UUID v4 generato dal confine HTTP per la richiesta di upgrade; tutti gli eventi diagnostici emessi dall'adapter del canale per la sessione e per i suoi turni, inclusi guasti di ammissione, di conclusione, di consegna e di sintesi, lo riportano nel campo `correlationId`, accanto ai soli campi selezionati esplicitamente. Sessioni diverse, anche dello stesso `clientId`, hanno identificativi diversi. L'identificativo serve soltanto a collegare gli eventi diagnostici: non viene trasmesso nei messaggi del protocollo, non identifica il client e non è una traccia distribuita. La risposta `101` di upgrade, scritta dalla libreria WebSocket, non è tenuta a riportare `X-Request-Id` né gli header di sicurezza delle risposte HTTP gestite.

#### Metadata
  * type: specification

#### Relations
  * define: [Correlazione diagnostica della sessione conversazionale](../Requirements/ConversationProtocol.md#correlazione-diagnostica-della-sessione-conversazionale)
---

### Errori ed estensioni del protocollo Ambrogio v1

Un messaggio del client non conforme allo schema JSON, di tipo sconosciuto, riferito a una richiesta o trasmissione inesistente o già chiusa, inviato prima di `session.ready`, oppure un frame binario non attribuibile a una trasmissione aperta, riceve `session.error` con `code` (`invalid_message`, `unknown_type`, `unknown_stream`, `session_not_ready`, `audio_busy`), un `message` sicuro e, quando ricavabile, il `requestId`. La sessione resta aperta e i turni già ammessi proseguono. Una seconda trasmissione audio in ingresso mentre una è aperta riceve `audio_busy` e non apre la richiesta.

Oltre ai messaggi `session.*`, `input.*`, `output.*` e `turn.*`, revisioni compatibili del protocollo possono introdurre famiglie di messaggi del server non legate a un turno. Un messaggio del server che richiede un'azione al client contiene `id`; il client risponde sempre con `client.result` e lo stesso `id`, con `ok: true` oppure con `ok: false` e `reason: "unsupported"` quando non sa eseguirla, anche se il tipo gli è sconosciuto. Un messaggio informativo senza `id` può essere ignorato da un client che non lo conosce. Il server accetta `client.result` e ignora quelli con un `id` che non corrisponde a un proprio messaggio. La versione v1 non definisce ancora messaggi del server fuori dai turni; la loro introduzione richiede requisiti propri.

#### Metadata
  * type: behavior

#### Relations
  * define: [Errore di protocollo senza perdita della sessione](../Requirements/ConversationProtocol.md#errore-di-protocollo-senza-perdita-della-sessione)
---

### Esiti del turno nel protocollo Ambrogio v1

Dopo `input.end` il server comunica l'ammissione oppure il rifiuto del turno. `turn.accepted` contiene `requestId`, `conversationId`, `turnId` e `text`, il testo del turno conservato, che per un turno vocale è la trascrizione. Precede ogni trasmissione della risposta ed è presente anche quando si continua una conversazione.

Ogni turno termina con un solo messaggio di esito, successivo all'ultima trasmissione del turno: `turn.completed` con `turnId` ed `expectsReply` booleano, inviato soltanto dopo la conferma del commit dell'esito riuscito; `turn.failed` con `turnId` e `message`, uguale al messaggio pubblico conservato come esito di errore; `turn.interrupted` con `turnId`, quando l'arresto del server interrompe il turno; `turn.rejected` con `requestId`, `reason` e `message` per un turno non ammesso, senza `turnId`. La fine della generazione del modello, `output.end` o la chiusura della sessione non attestano un esito conservato.

Se la sessione si chiude dopo l'ammissione, il backend completa il turno e ne conserva l'esito; i messaggi non consegnati non vengono ripetuti in una sessione successiva e l'esito si legge dallo storico. Un guasto della persistenza dopo l'ammissione segue la politica di indisponibilità degli ingressi e non viene comunicato come `turn.completed`: il server trasmette il messaggio standard del guasto conversazionale e conclude il turno con `turn.failed` con lo stesso messaggio, anche se l'esito non è stato conservato; il turno rimasto senza esito viene riconosciuto come interrotto al riavvio.

#### Metadata
  * type: input-output

#### Relations
  * define: [Conferma del completamento del turno](../Requirements/FamilyConversation.md#conferma-del-completamento-del-turno)
---

### Motivi di rifiuto del turno

Un turno non ammesso riceve una trasmissione del server con il messaggio pubblico, nel tipo di contenuto chiesto dal client salvo `audio_unavailable`, seguita da `turn.rejected` con `requestId`, `reason` e lo stesso `message`. Il turno non viene conservato né accodato e, se non indicava una conversazione esistente, non crea una conversazione. I messaggi non espongono dettagli tecnici e seguono la lingua configurata; per ogni motivo il primo testo è inglese e il secondo italiano.

- `invalid`: il testo del turno è vuoto o composto soltanto da spazi bianchi; «Invalid message.» oppure «Messaggio non valido.». Ha precedenza anche quando `conversationId` non identifica una conversazione conservata.
- `conversation_not_found`: `conversationId` non identifica una conversazione conservata; «Conversation not found.» oppure «Conversazione non trovata.».
- `occupied`: la conversazione indicata ha già un turno attivo; «Another turn is in progress.» oppure «Un altro turno è in corso.».
- `unavailable`: l'archivio rifiuta temporaneamente l'ammissione, il server sta arrestandosi, oppure gli ingressi sono disabilitati fino al riavvio perché non è stato possibile conservare l'esito di un turno già ammesso; «Service temporarily unavailable.» oppure «Servizio temporaneamente non disponibile.».
- `too_large`: il testo supera 64 KiB o l'audio supera 60 secondi; «Request too large.» oppure «Richiesta troppo grande.».
- `transcription_failed`: la trascrizione dell'audio non è utilizzabile; «I didn't understand the request.» oppure «Non ho capito la richiesta.».
- `audio_unavailable`: l'interazione vocale non è abilitata e il turno trasmette audio o chiede la risposta in audio; «Voice is not available.» oppure «La voce non è disponibile.». Il messaggio è trasmesso sempre in testo.
- `failure`: un guasto tecnico inatteso avviene prima dell'ammissione; il messaggio standard del guasto conversazionale nella lingua configurata.

#### Metadata
  * type: input-output

#### Relations
  * define: [Rifiuto del turno prima dell'ammissione](../Requirements/FamilyConversation.md#rifiuto-del-turno-prima-dellammissione)
---

### Schema JSON del protocollo Ambrogio v1

La forma dei messaggi JSON di `ambrogio.v1`, in entrambe le direzioni, è definita in JSON Schema 2020-12 dal file `protocol/ambrogio-v1.schema.json` del repository backend. Lo schema espone le definizioni `clientMessage` e `serverMessage`. Il server valida ogni messaggio ricevuto rispetto a `clientMessage` prima di interpretarlo, usando Ajv come per le richieste HTTP, senza coercizione dei tipi, valori predefiniti impliciti o rimozione dei campi aggiuntivi; gli oggetti dei messaggi sono chiusi. La composition root del server legge lo schema all'avvio e lo fornisce all'adapter del canale. I messaggi inviati dal server sono conformi a `serverMessage`. Una modifica incompatibile dello schema richiede una nuova versione del sottoprotocollo. I client fissano la revisione dello schema compatibile e la usano nelle proprie prove. Lo schema descrive la forma dei messaggi e non sostituisce i contratti di comportamento del turno.

#### Metadata
  * type: specification

#### Relations
  * define: [Validazione del formato negli ingressi conversazionali](../Requirements/FamilyConversation.md#validazione-del-formato-negli-ingressi-conversazionali)
---

### Sessione del protocollo Ambrogio v1

Il canale conversazionale è una WebSocket sul percorso `/api/session`, sulla stessa porta del server HTTP. Il client richiede il sottoprotocollo `ambrogio.v1`; il server accetta l'upgrade soltanto se il client lo offre e lo seleziona nella risposta. Una richiesta che non offre `ambrogio.v1` viene rifiutata prima dell'upgrade.

I frame di testo contengono un solo messaggio JSON con il campo stringa `type`. I frame binari contengono contenuto audio: i primi 4 byte sono il numero della trasmissione `stream`, intero senza segno a 32 bit big-endian, e i byte successivi sono campioni PCM a 16 bit little-endian mono. Il protocollo non fissa un limite per il singolo frame oltre ai limiti del turno: vale il limite predefinito della libreria WebSocket del server, come concordato il 17 ottobre 2026.

Il primo messaggio del client è `session.hello` con `clientId`, stringa non vuota e stabile fornita dalla configurazione del client, e `name`, stringa non vuota leggibile dalla famiglia. Il server risponde `session.ready` con `protocol: "ambrogio.v1"`. Prima di `session.ready` il server non accetta trasmissioni; un secondo `session.hello` è un errore di protocollo. Il protocollo non prevede dichiarazioni delle capacità del client.

Il server invia ping WebSocket periodici a ogni sessione e chiude la sessione che non risponde con un pong entro l'intervallo successivo. Il client che perde la connessione può aprire una nuova sessione; i turni ammessi nella sessione precedente proseguono secondo le regole del turno e i loro esiti si leggono dallo storico. Una nuova sessione non riprende trasmissioni interrotte. Più sessioni con lo stesso `clientId` restano indipendenti.

#### Metadata
  * type: specification

#### Relations
  * define: [Apertura della sessione conversazionale](../Requirements/ConversationProtocol.md#apertura-della-sessione-conversazionale)
---

### Trasmissione in ingresso del protocollo Ambrogio v1

Il client apre una richiesta con `input.start`, che contiene: `requestId`, stringa non vuota scelta dal client e unica tra le richieste aperte nella sessione; `conversationId` facoltativo, assente per iniziare una nuova conversazione; `stream`, intero positivo unico tra le trasmissioni aperte dal client nella sessione; `content`, che vale `{"type":"text"}` oppure `{"type":"audio","sampleRate":16000}`; `reply`, che vale `"text"` oppure `"audio"` e indica il tipo di contenuto con cui il client vuole ricevere ogni trasmissione del server per quel turno.

Per il contenuto testuale il client invia uno o più messaggi `input.chunk` con `requestId` e `text`; il testo del turno è la concatenazione ordinata dei frammenti e non supera 64 KiB (65 536 byte) in UTF-8. Per il contenuto audio il client invia frame binari con il proprio numero `stream`, campioni PCM16 mono a 16 kHz, per una durata complessiva non superiore a 60 secondi. Il client chiude la richiesta con `input.end` e `requestId`; per la voce la chiusura corrisponde alla fine del parlato rilevata dal client. Il server elabora la richiesta soltanto dopo `input.end`, salvo il rifiuto immediato per superamento dei limiti.

Decisione concordata il 17 ottobre 2026, dopo la misura sul server installato in cui la trascrizione dell'intero audio dopo `input.end` richiedeva circa 0,8 secondi: quando la voce è abilitata, il server consegna i frame di una richiesta audio al trascrittore man mano che li riceve, così che a `input.end` resti da completare soltanto la parte finale. Il testo trascritto è usato soltanto dopo `input.end`: la verifica della trascrizione, l'ammissione e ogni altro effetto del turno restano successivi alla chiusura della richiesta. Se la richiesta non si conclude, perché supera i limiti o perché la sessione si chiude prima di `input.end`, la trascrizione in corso viene interrotta e il suo risultato scartato, senza turni né conversazioni.

Una sessione ha al massimo una trasmissione audio in ingresso aperta; richieste testuali su conversazioni diverse possono essere aperte contemporaneamente. Il testo di un turno è valido se, eliminati gli spazi iniziali e finali per la sola verifica, contiene almeno un carattere, e viene conservato com'è stato ricevuto. Quando un limite è superato il server rifiuta il turno senza attendere `input.end` e ignora il resto della trasmissione con lo stesso `requestId`. Un `input.start` non conforme allo schema produce un errore di protocollo e non apre la richiesta. La richiesta non contiene gli scambi precedenti: lo storico è recuperato dal backend.

#### Metadata
  * type: input-output

#### Relations
  * define: [Trasmissione della richiesta del turno](../Requirements/ConversationProtocol.md#trasmissione-della-richiesta-del-turno)
---

### Trasmissione in uscita del protocollo Ambrogio v1

Ogni contenuto destinato alla famiglia per un turno, cioè la risposta, il messaggio di un rifiuto o il messaggio di un errore, viaggia in una trasmissione del server composta da `output.start`, contenuto e `output.end`. `output.start` contiene `requestId`, `turnId` quando il turno è stato ammesso, `stream`, numero assegnato dal server e unico tra le trasmissioni aperte dal server nella sessione, e `content`, che vale `{"type":"text"}` oppure `{"type":"audio","sampleRate":<frequenza della voce Piper configurata>}`. Il tipo di contenuto è quello chiesto dal client con `reply`, salvo il rifiuto `audio_unavailable`, trasmesso sempre in testo.

Il testo viaggia in messaggi `output.chunk` con `stream` e `text`, che contiene soltanto il nuovo frammento; la concatenazione ordinata ricostruisce il messaggio. L'audio viaggia in frame binari con il numero `stream` della trasmissione, campioni PCM16 mono alla frequenza dichiarata. La risposta viene trasmessa progressivamente durante la generazione: per il testo i frammenti disponibili, per l'audio la sintesi dei tratti di testo già prodotti. `output.end` con `stream` segnala che il server non invierà altro contenuto per quella trasmissione.

Le trasmissioni di uno stesso turno sono sequenziali e non si sovrappongono. Se un errore avviene a risposta già iniziata, il server chiude la trasmissione in corso con `output.end` e apre una nuova trasmissione con il messaggio pubblico di errore. Una sessione ha al massimo una trasmissione audio in uscita aperta. Le trasmissioni non contengono ragionamento, risultati interni dei tool o credenziali.

#### Metadata
  * type: input-output

#### Relations
  * define: [Trasmissione progressiva della risposta del turno](../Requirements/FamilyConversation.md#trasmissione-progressiva-della-risposta-del-turno)
---

