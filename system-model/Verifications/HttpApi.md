# Elements

### Prova delle regole sulle factory tecniche e sulla composizione

Eseguire le regole `technical-factory-imports` e `no-dependency-container` di `test/repository/architecture-rules.ts` sul grafo degli import del repository e sulle loro fixture negative.

#### Details
La prova passa se la factory tecnica del server HTTP non importa package del workspace, la composition o gli adapter dell'applicazione, se nessun file importa un container di dependency injection e se le fixture negative delle due regole producono violazioni soltanto con il nome della regola attesa. Fallisce per ogni violazione o fixture che non fallisce.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](Workspace.md#verifica-della-struttura-del-monorepo)
  * satisfiedBy: [import-boundaries.spec.ts](../../test/repository/import-boundaries.spec.ts)
  * verify: [Composizione scritta a mano](../Requirements/HttpApi.md#composizione-scritta-a-mano)
  * verify: [Factory tecniche senza conoscenza business](../Requirements/HttpApi.md#factory-tecniche-senza-conoscenza-business)
---

### Verifica dell'API HTTP pubblica

Raggruppa le prove degli esiti pubblici, della versione e della struttura dell'API HTTP del backend.

#### Metadata
  * type: verification-objective
---

### Prova degli esiti pubblici dell'API HTTP

Con il server conversazionale composto come in produzione e un archivio con conversazioni note, esercitare ogni rotta dell'API `v1` nel caso riuscito e in ogni esito negativo dichiarato; inviare poi un parametro di query non previsto, un parametro ripetuto, un parametro di percorso vuoto, un metodo non ammesso, un corpo JSON malformato, un corpo oltre il limite, un tipo di contenuto non supportato, una rotta inesistente, un'apertura della sessione con un'origine non consentita e senza sottoprotocollo, e una richiesta che provoca un guasto inatteso con marcatori distinti nel messaggio. Validare ogni risposta d'errore con Ajv contro lo schema TypeBox del proprio problema.

#### Details
La prova passa se ogni successo usa `200`, `application/json` e gli header dichiarati; se ogni esito negativo previsto produce il Problem Details dichiarato dalla rotta; se gli errori di protocollo producono i problemi del catalogo, con `errors` composti soltanto da `location`, `pointer`, `code` e `detail` sicuri e `Allow: GET, HEAD` per il `405`; se il guasto produce esattamente la risposta opaca `500` ed è registrato una volta; e se ogni risposta d'errore usa `application/problem+json` e `Cache-Control: no-store` con `type`, `title` e `status` uguale allo stato effettivo. Fallisce per uno stato non dichiarato, un membro mancante o in più, un dettaglio trapelato, un marcatore del guasto nella risposta, una mappatura generica o una risposta d'errore che non è un Problem Details.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'API HTTP pubblica](#verifica-dellapi-http-pubblica)
  * satisfiedBy: [http-surface.spec.ts](../../apps/server/src/composition/http-surface.spec.ts)
  * satisfiedBy: [http-server.spec.ts](../../apps/server/src/runtime/http-server.spec.ts)
  * verify: [Catalogo comune dei problemi di protocollo HTTP](../Requirements/HttpApi.md#catalogo-comune-dei-problemi-di-protocollo-http)
  * verify: [Errori HTTP nel formato Problem Details](../Requirements/HttpApi.md#errori-http-nel-formato-problem-details)
  * verify: [Risposta opaca per i guasti inattesi dell'API HTTP](../Requirements/HttpApi.md#risposta-opaca-per-i-guasti-inattesi-dellapi-http)
  * verify: [Stato HTTP dall'esito effettivo](../Requirements/HttpApi.md#stato-http-dallesito-effettivo)
---

### Prova dell'API HTTP senza versione

Leggere elenco e storico con `GET /api/conversations` e `GET /api/conversations/:conversationId` in lingua italiana e inglese: pagine con cursore, conversazione assente, cursore e limite invalidi, parametro non previsto e guasto tecnico dell'archivio.

#### Details
La prova passa se le risposte riuscite sono uguali a quelle delle rotte `v1` e le risposte d'errore mantengono stati, corpi `{ "error": "..." }` nella lingua configurata, `Cache-Control: no-store` ed eventi diagnostici del contratto dell'API senza versione. Fallisce se una risposta della versione precedente cambia forma o se un errore espone dettagli tecnici.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'API HTTP pubblica](#verifica-dellapi-http-pubblica)
  * satisfiedBy: [get-conversation.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.unversioned-route.adapter.spec.ts)
  * satisfiedBy: [list-conversations.unversioned-route.adapter.spec.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.unversioned-route.adapter.spec.ts)
  * verify: [Lettura HTTP dell'elenco conversazioni nell'API senza versione](../Requirements/HttpApi.md#lettura-http-dellelenco-conversazioni-nellapi-senza-versione)
  * verify: [Lettura HTTP dello storico conversazionale nell'API senza versione](../Requirements/HttpApi.md#lettura-http-dello-storico-conversazionale-nellapi-senza-versione)
---

### Prova della mappatura esplicita degli esiti HTTP

Leggere il testo delle registrazioni delle rotte HTTP che invocano casi d'uso con esiti negativi previsti e il codice di produzione di Domain e Application del modulo «Conversazioni».

#### Details
La prova passa se ogni registrazione mappa gli esiti negativi previsti con uno `switch` su `kind` che termina con `assertNever`, senza cast e senza un `default` con un Problem Details generico; se non esiste una tabella globale da tipi di rifiuto a stati HTTP; e se Domain e Application non contengono stati HTTP, header, `application/problem+json`, riferimenti `/problems/` od oggetti di risposta di Fastify. Fallisce per ogni deviazione.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'API HTTP pubblica](#verifica-dellapi-http-pubblica)
  * satisfiedBy: [http-mapping.spec.ts](../../test/repository/http-mapping.spec.ts)
  * verify: [Mappatura HTTP esplicita degli esiti previsti per operazione](../Requirements/HttpApi.md#mappatura-http-esplicita-degli-esiti-previsti-per-operazione)
---

### Prova della struttura della superficie HTTP

Avviare il server conversazionale composto come in produzione e raccogliere le rotte registrate con metodo e percorso; leggere le cartelle delle slice di `packages/conversations/src/adapters/in/http/` e gli aggregatori che le registrano.

#### Details
La prova passa se ogni rotta HTTP diversa dalla sessione `/api/session` e dalle rotte dell'API senza versione sta sotto `/api/v1/`; se le rotte senza versione sono esattamente `GET /api/conversations` e `GET /api/conversations/:conversationId`, con le stesse risposte riuscite delle rotte `v1`; se ogni slice ha i propri file `.schemas.ts`, `.handler.ts` e `.route.adapter.ts` e le registrazioni ricevono i casi d'uso già costruiti; e se le rotte sono registrate soltanto dagli aggregatori consegnati alla factory tecnica. Fallisce se una rotta manca del prefisso di versione, se una slice unisce le responsabilità o se una rotta è registrata fuori da un aggregatore.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'API HTTP pubblica](#verifica-dellapi-http-pubblica)
  * satisfiedBy: [http-surface.spec.ts](../../apps/server/src/composition/http-surface.spec.ts)
  * verify: [Namespace e versione maggiore dell'API HTTP nel percorso](../Requirements/HttpApi.md#namespace-e-versione-maggiore-dellapi-http-nel-percorso)
  * verify: [Slice delle rotte HTTP con aggregatori espliciti](../Requirements/HttpApi.md#slice-delle-rotte-http-con-aggregatori-espliciti)
---
