# Elements

### Catalogo dei problemi di protocollo HTTP

I problemi di protocollo sono comuni a tutte le rotte e distinti dagli esiti dei casi d'uso:

| Situazione | Stato | `type` | `title` | Altri membri |
|---|---|---|---|---|
| Rotta inesistente, per qualunque percorso e metodo senza rotta | `404` | `about:blank` | `Not Found` | nessuno |
| Metodo `POST`, `PUT`, `PATCH` o `DELETE` su una rotta dell'API versionata | `405` | `about:blank` | `Method Not Allowed` | header `Allow: GET, HEAD` |
| Corpo oltre il limite | `413` | `about:blank` | `Content Too Large` | nessuno |
| Tipo di contenuto del corpo non supportato | `415` | `about:blank` | `Unsupported Media Type` | nessuno |
| Corpo dichiarato JSON vuoto o non decodificabile | `400` | `/problems/malformed-json` | `Malformed JSON` | `detail`: `The request body is not valid JSON.` |
| Richiesta decodificata che viola lo schema della rotta | `400` | `/problems/request-validation` | `Request validation failed` | `errors` |
| Apertura della sessione conversazionale con un `Origin` non consentito | `403` | `/problems/origin-not-allowed` | `Origin not allowed` | nessuno |
| Apertura della sessione conversazionale che non offre `ambrogio.v1` | `400` | `/problems/unsupported-subprotocol` | `Unsupported subprotocol` | nessuno |
| Guasto inatteso | `500` | `about:blank` | `Internal Server Error` | nessuno |

`errors` è un array con almeno una violazione; ogni elemento ha soltanto `location`, uno fra `body`, `query`, `path` e `header`, `pointer`, un JSON Pointer RFC 6901 relativo a quella parte della richiesta, `code` e `detail`. I codici pubblici sono due: `unknown-field`, per un campo non previsto da uno schema chiuso, con `pointer` sul campo e `detail` `The field is not allowed.`, e `invalid-value`, per ogni altra violazione, con `pointer` sul valore e `detail` `The value is not valid.`. Nomi delle parole chiave del validatore, percorsi dello schema, parametri, messaggi originali e valori rifiutati non compaiono nella risposta.

La gestione centrale degli errori e delle rotte inesistenti della factory tecnica del server HTTP produce i problemi `404`, `413`, `415`, `/problems/malformed-json`, `/problems/request-validation` e `500`; la registrazione di ogni rotta dell'API versionata produce il `405` per i metodi non ammessi; la registrazione della sessione conversazionale produce i due rifiuti dell'apertura della sessione. Il corpo è letto prima della scelta del gestore: una richiesta con corpo a una rotta che non lo accetta riceve `413`, `415` o `/problems/malformed-json` quando il corpo li provoca, altrimenti `405`. Oggi nessuna rotta accetta un corpo. Un errore di Fastify o di un plugin non elencato segue la risposta opaca del guasto inatteso finché il catalogo non gli assegna un problema. Il guasto inatteso produce esattamente `{ "type": "about:blank", "title": "Internal Server Error", "status": 500 }` ed è registrato una volta dalla gestione centrale con l'evento `http.unexpected_failure`. L'autenticazione non è nel catalogo, perché l'API non ha autenticazione applicativa.

#### Metadata
  * type: specification

#### Relations
  * define: [Catalogo comune dei problemi di protocollo HTTP](../Requirements/HttpApi.md#catalogo-comune-dei-problemi-di-protocollo-http)
---

### Forma dei Problem Details dell'API HTTP

Ogni risposta 4xx o 5xx del server HTTP del backend, cioè delle rotte dell'API versionata, delle rotte inesistenti, dei guasti inattesi e del rifiuto dell'apertura della sessione conversazionale, è un oggetto JSON Problem Details secondo RFC 9457, con `Content-Type: application/problem+json` e `Cache-Control: no-store`.

`type`, `title` e `status` sono sempre presenti. `type` è l'unico discriminante pubblico per i programmi: vale `about:blank` per un problema descritto completamente dallo stato HTTP, con il nome standard dello stato come `title`, oppure un riferimento URI relativo stabile della forma `/problems/<nome>`. I riferimenti `/problems/<nome>` sono identificatori: il backend non serve un documento a quell'indirizzo e il significato di ciascuno è descritto dal catalogo di questo contratto o dal contratto della rotta che lo produce; i client li confrontano come stringhe esatte. `title` è un testo inglese breve, uguale in ogni risposta con lo stesso `type`; `status` è uguale allo stato HTTP effettivo. `detail`, quando presente, è un testo inglese sicuro per le persone, che non copia messaggi di eccezioni o del parser e non serve da discriminante. I testi dei problemi non dipendono dalla lingua configurata: ogni client sceglie il proprio testo in base a `type`. La forma comune non aggiunge `instance`, `timestamp`, `path`, `success`, metadati generici né un `code` parallelo a `type`.

Ogni problema concreto ha uno schema TypeBox chiuso che elenca i propri membri e dichiara le proprie estensioni; più problemi con lo stesso stato sulla stessa rotta formano un'unione esplicita. Chi costruisce una risposta crea un oggetto nuovo selezionando i membri, senza copiare per espansione esiti, eccezioni o richieste. Le risposte non contengono stack, cause, SQL, nomi di tabelle, codici del database, messaggi di eccezioni, di driver, di SDK o di provider, configurazione, credenziali o dati sensibili. Un cambio incompatibile del significato di un problema introduce un nuovo `type`; i `type` non contengono la versione maggiore dell'API e restano gli stessi fra versioni dell'API.

#### Metadata
  * type: specification

#### Relations
  * define: [Errori HTTP nel formato Problem Details](../Requirements/HttpApi.md#errori-http-nel-formato-problem-details)
---

### Struttura delle slice delle rotte HTTP

Ogni rotta HTTP del modulo «Conversazioni» è una slice nella cartella `packages/conversations/src/adapters/in/http/<operazione>/`, con tre responsabilità in file distinti:

- `<operazione>.schemas.ts` dichiara con TypeBox gli schemi delle parti di richiesta usate, della risposta riuscita e di ogni Problem Details proprio della rotta;
- `<operazione>.handler.ts` traduce esplicitamente la richiesta accettata nell'input Application del caso d'uso, lo invoca e traduce l'esito riuscito nella rappresentazione pubblica, restituendo come valori gli esiti negativi previsti;
- `<operazione>.route.adapter.ts` registra la rotta dell'API versionata, compresa la risposta `405` ai metodi non ammessi, e mappa l'esito del gestore nello stato e nel corpo del contratto della rotta.

Le operazioni attuali sono `list-conversations` e `get-conversation`. Il file `problem-details.ts` della stessa cartella contiene lo schema comune dei Problem Details e il loro invio, usati dalle slice e dalla registrazione della sessione conversazionale.

Il file `conversation-routes.ts` della stessa cartella esporta l'aggregatore esplicito `conversationApiRoutes(dependencies)`, per l'API `v1`: riceve i casi d'uso e i valori già costruiti e restituisce la funzione che registra le proprie slice in uno scope Fastify, senza risolvere dipendenze durante la registrazione o le richieste. La composition root dell'applicazione server, in `apps/server/src/composition/http-surface.ts`, costruisce i casi d'uso, la sessione conversazionale e le componenti vocali, chiama l'aggregatore e consegna le registrazioni, quella dell'API `v1` con il prefisso `/api/v1` e quella della sessione conversazionale, alla factory tecnica `createHttpServer(config, options)` di `apps/server/src/runtime/http-server.ts`, insieme alla serializzazione diagnostica di `err`. La factory crea l'istanza Fastify con logger, identificativo di richiesta, header di sicurezza, CORS, WebSocket, opzioni Ajv e gestione centrale di errori e rotte inesistenti, poi registra le registrazioni ricevute nell'ordine dato.

Gli schemi delle richieste alimentano la validazione di Fastify; gli schemi delle risposte riuscite e dei problemi sono verificati dalle prove sulle risposte effettive e non sono usati per la serializzazione di Fastify. Il backend non pubblica un contratto OpenAPI.

#### Metadata
  * type: specification

#### Relations
  * define: [Slice delle rotte HTTP con aggregatori espliciti](../Requirements/HttpApi.md#slice-delle-rotte-http-con-aggregatori-espliciti)
---

### Versioni dell'API HTTP pubblica

L'API HTTP pubblica del backend porta namespace e versione maggiore nel percorso. La versione corrente è `v1`, con le rotte sotto `/api/v1/`: `GET /api/v1/conversations`, definita in «Risposta HTTP dell'elenco conversazioni», e `GET /api/v1/conversations/:conversationId`, definita in «Risposta HTTP dello storico conversazionale». Il ciclo di versione dell'API HTTP è indipendente da quello del protocollo conversazionale: la sessione `ambrogio.v1` resta sul percorso `/api/session`, fuori dal namespace versionato, ed è versionata dal sottoprotocollo WebSocket. Un cambio incompatibile dell'API HTTP introduce un nuovo namespace, come `/api/v2/`, senza cambiare il protocollo, e un cambio incompatibile del protocollo non cambia la versione dell'API HTTP.

Il backend offre una sola versione dell'API HTTP alla volta. Un cambio incompatibile dell'API si fa nella stessa modifica dei client che la usano, secondo «Compatibilità fra release per versione d'interfaccia», e la versione precedente non resta disponibile; `ambrogio-docs/reference/versions.md` elenca le versioni dell'API offerte e usate dalle release che la documentazione copre. Un percorso sotto `/api` fuori da `/api/v1/` e da `/api/session`, come `/api/conversations`, non ha rotte e riceve la risposta della rotta inesistente del catalogo dei problemi di protocollo.

#### Metadata
  * type: specification

#### Relations
  * define: [Namespace e versione maggiore dell'API HTTP nel percorso](../Requirements/HttpApi.md#namespace-e-versione-maggiore-dellapi-http-nel-percorso)
---

### Vocabolario degli stati HTTP

Le operazioni HTTP del backend scelgono lo stato di successo dall'esito effettivo e lo dichiarano nel proprio contratto. Le rotte attuali di elenco e storico rispondono `200` con una rappresentazione utile in `application/json`. Gli stati d'errore appartengono a un vocabolario fisso: `400` per una richiesta non valida per il protocollo o per l'operazione, `403` per un'origine non consentita all'apertura della sessione conversazionale, `404` per una risorsa assente o una rotta inesistente, `405` con `Allow`, `413`, `415` e `500` per un guasto inatteso. Gli stati `201`, `202`, `204`, `401`, `429`, `502`, `503` e `504` non sono usati; un'operazione che ne adotta uno lo dichiara nel proprio contratto con il significato di RFC 9110, `Location` per `201` e `202` e nessun corpo per `204`. I gestori non impostano `Content-Length` e le risposte non aggiungono header `X-*` diversi da `X-Request-Id`.

#### Metadata
  * type: specification

#### Relations
  * define: [Stato HTTP dall'esito effettivo](../Requirements/HttpApi.md#stato-http-dallesito-effettivo)
---
