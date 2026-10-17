# Elements

### Verifica del protocollo conversazionale

Raggruppa le verifiche del canale WebSocket `ambrogio.v1` comune a testo e voce: apertura della sessione, trasmissioni in ingresso e in uscita, esiti, rifiuti, errori di protocollo e controllo dell'origine. Le verifiche sono definite il 17 ottobre 2026 prima dell'implementazione; le evidenze dei precedenti trasporti SSE e Micdrop non dimostrano il nuovo protocollo.

#### Metadata
  * type: verification-objective
---

### Analisi dell'uniformità del protocollo per testo e voce

Esaminare schema JSON, adapter del canale e casi d'uso seguendo un turno testuale e un turno vocale dello stesso tipo di esito: risposta riuscita, rifiuto, errore dopo l'ammissione e interruzione. Esaminare le dipendenze del server.

#### Details
L'analisi passa se testo e voce usano gli stessi messaggi di sessione, trasmissione ed esito e lo stesso caso d'uso, differendo soltanto per il `content` dichiarato e per il contenuto dei frame; se rifiuti ed esiti hanno gli stessi motivi e lo stesso ordine; se non esistono rotte o percorsi di turno dedicati a un solo canale; e se il server non dipende più da `@micdrop/server`, `@micdrop/piper` o dal formato UI Message Stream di `ai` per il trasporto. Fallisce se un canale ha messaggi, regole di rifiuto o conferme di successo proprie, o se resta un trasporto dei turni alternativo.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](#verifica-del-protocollo-conversazionale)
  * verify: [Canale conversazionale comune a testo e voce](../Requirements/ConversationProtocol.md#canale-conversazionale-comune-a-testo-e-voce)
---

### Prova degli errori di protocollo

Con un turno ammesso in corso nella sessione, inviare JSON malformato, un messaggio senza `type`, un tipo sconosciuto, un oggetto con campi aggiuntivi, un `input.chunk` per un `requestId` inesistente, un frame binario con `stream` sconosciuto e un `client.result` con `id` mai emesso dal server.

#### Details
La prova passa se ciascun messaggio non conforme riceve `session.error` con il `code` previsto e un `message` privo di dettagli tecnici, con il `requestId` quando ricavabile; la sessione resta aperta, il turno in corso arriva al proprio esito e nessun caso d'uso viene invocato per i messaggi non conformi. Il `client.result` con `id` sconosciuto è ignorato senza errore. Fallisce se la sessione si chiude, se il turno in corso viene alterato, se un messaggio non conforme produce effetti persistenti o se l'errore espone dettagli interni.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](#verifica-del-protocollo-conversazionale)
  * verify: [Errore di protocollo senza perdita della sessione](../Requirements/ConversationProtocol.md#errore-di-protocollo-senza-perdita-della-sessione)
---

### Prova del controllo dell'origine della sessione

Avviare il server con elenco di origini assente e poi con un'origine ammessa. Aprire il canale senza header `Origin`, con l'origine ammessa e con un'origine non ammessa.

#### Details
La prova passa se la richiesta senza `Origin` è accettata in entrambe le configurazioni; con elenco assente ogni richiesta con `Origin` riceve HTTP 403 prima dell'upgrade; con l'elenco è accettata soltanto l'origine con corrispondenza esatta. Nessuna sessione viene creata per le richieste rifiutate. Fallisce se un'origine non ammessa ottiene una sessione o se il controllo dipende da una corrispondenza parziale.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](#verifica-del-protocollo-conversazionale)
  * verify: [Origini consentite per il canale conversazionale](../Requirements/ConversationProtocol.md#origini-consentite-per-il-canale-conversazionale)
---

### Prova del rifiuto audio senza voce abilitata

Avviare il server senza `AMBROGIO_VOICE_CONFIG_PATH`. Inviare un turno audio, un turno testuale con `reply: "audio"` e un turno testuale con `reply: "text"`.

#### Details
La prova passa se i primi due turni ricevono una trasmissione testuale con il messaggio pubblico previsto e `turn.rejected` con `reason: "audio_unavailable"`, senza creare conversazioni o turni e senza caricare componenti vocali, mentre il turno testuale con risposta in testo viene ammesso e completato. Fallisce se un turno audio viene ammesso, se il messaggio di rifiuto viene trasmesso in audio o se il server tenta di costruire Vosk o Piper.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](#verifica-del-protocollo-conversazionale)
  * verify: [Rifiuto del turno audio senza voce abilitata](../Requirements/ConversationProtocol.md#rifiuto-del-turno-audio-senza-voce-abilitata)
---

### Prova del rifiuto oltre i limiti di trasmissione

Inviare turni testuali di 65 536 e 65 537 byte UTF-8, anche suddivisi in più frammenti, e turni audio di 60 secondi e di poco oltre 60 secondi, con `language` impostato separatamente a `en` e `it`. Strumentare trascrittore, caso d'uso e archivio.

#### Details
La prova passa se i turni entro il limite proseguono normalmente, mentre quelli oltre il limite ricevono, senza attendere `input.end`, la trasmissione del messaggio pubblico esatto e `turn.rejected` con `reason: "too_large"`; il trascrittore non viene invocato per l'audio oltre il limite, nessun turno o conversazione viene creato e il resto della trasmissione è ignorato. Fallisce se un turno oltre il limite viene trascritto, ammesso o conservato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](#verifica-del-protocollo-conversazionale)
  * verify: [Rifiuto del turno oltre i limiti di trasmissione](../Requirements/ConversationProtocol.md#rifiuto-del-turno-oltre-i-limiti-di-trasmissione)
---

### Prova dell'apertura della sessione conversazionale

Aprire `/api/session` con il sottoprotocollo `ambrogio.v1`, senza sottoprotocollo e con un sottoprotocollo diverso. Nella sessione accettata inviare un `input.start` prima di `session.hello`, poi `session.hello` con `clientId` e `name`, poi un secondo `session.hello`. Aprire due sessioni con lo stesso `clientId`. Lasciare una sessione senza risposta ai ping.

#### Details
La prova passa se l'upgrade è accettato soltanto quando il client offre `ambrogio.v1` e la risposta lo seleziona; le altre richieste sono rifiutate prima dell'upgrade. Prima di `session.ready` un `input.start` riceve `session.error` con `session_not_ready` e non apre richieste. `session.hello` valido riceve `session.ready` con `protocol: "ambrogio.v1"`; un secondo `session.hello` riceve un errore di protocollo senza chiudere la sessione. Le due sessioni con lo stesso `clientId` restano indipendenti. La sessione che non risponde ai ping viene chiusa dal server e i turni già ammessi proseguono. Fallisce se una sessione senza sottoprotocollo diventa operativa, se un turno viene ammesso prima di `session.ready` o se il server richiede dichiarazioni di capacità.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](#verifica-del-protocollo-conversazionale)
  * verify: [Apertura della sessione conversazionale](../Requirements/ConversationProtocol.md#apertura-della-sessione-conversazionale)
---

### Prova della trasmissione della richiesta del turno

In una sessione pronta inviare un turno testuale in un solo `input.chunk` e uno diviso in più frammenti con Unicode e ritorni a capo; inviare un turno audio con frame binari intestati dal proprio `stream` e chiuso da `input.end`, usando un trascrittore controllato. Ritardare `input.end` dopo l'ultimo frammento. Aprire in parallelo due richieste testuali su conversazioni diverse e tentare una seconda trasmissione audio mentre la prima è aperta.

#### Details
La prova passa se il server non avvia l'ammissione prima di `input.end`, il testo ammesso è la concatenazione esatta dei frammenti conservata com'è stata ricevuta e il testo di un turno audio è la trascrizione dei frame della sua trasmissione. Le due richieste testuali procedono indipendentemente. La seconda trasmissione audio riceve `session.error` con `audio_busy` senza aprire la richiesta né disturbare la prima. La richiesta non porta lo storico. Fallisce se il server ammette un turno incompleto, mescola frame di trasmissioni diverse, modifica il testo ricevuto o richiede al client gli scambi precedenti.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](#verifica-del-protocollo-conversazionale)
  * verify: [Trasmissione della richiesta del turno](../Requirements/ConversationProtocol.md#trasmissione-della-richiesta-del-turno)
---

