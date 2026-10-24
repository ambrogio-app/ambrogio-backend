# Elements

### Catalogo comune dei problemi di protocollo HTTP

Quando una richiesta HTTP fallisce per un errore di protocollo rilevato prima dell'invocazione del caso d'uso, il server deve tradurlo centralmente in un problema del catalogo comune dei problemi di protocollo, distinto dagli esiti dei casi d'uso e senza esporre dettagli del parser, del validatore o del framework.

#### Details
Origine: baseline Reqvire «Common catalog of protocol problems», adattata: il catalogo comprende il rifiuto dell'apertura della sessione conversazionale, non comprende problemi di autenticazione, perché il backend non ha autenticazione applicativa, e usa due soli codici pubblici di validazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Schema delle richieste HTTP conversazionali](../Contracts/FamilyConversation.md#schema-delle-richieste-http-conversazionali)
  * [Forma dei Problem Details dell'API HTTP](../Contracts/HttpApi.md#forma-dei-problem-details-dellapi-http)

#### Relations
  * satisfiedBy: [session-route.adapter.ts](../../apps/server/src/adapters/in/session-route.adapter.ts)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * satisfiedBy: [problem-details.ts](../../packages/conversations/src/adapters/in/http/problem-details.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Composizione scritta a mano

La composition root dell'applicazione server deve costruire il proprio grafo chiamando factory e passando le dipendenze direttamente nel codice, senza un container di dependency injection.

#### Details
La regola `no-dependency-container` di «Regole di architettura del backend» vieta gli import dei container di dependency injection.

Origine: baseline Reqvire «Composition written by hand», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Regole di architettura del backend](../Contracts/ServerFoundation.md#regole-di-architettura-del-backend)

#### Relations
  * derivedFrom: [Capacità dell'ambiente fornite dalla composition root](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#capacità-dellambiente-fornite-dalla-composition-root)
  * satisfiedBy: [http-surface.ts](../../apps/server/src/composition/http-surface.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Errori HTTP nel formato Problem Details

Quando il server HTTP del backend produce una risposta 4xx o 5xx, deve usare il formato Problem Details di RFC 9457 con `application/problem+json`, con `type`, `title` e `status` sempre presenti, `type` come unico discriminante pubblico e soltanto le estensioni sicure dichiarate nello schema del problema concreto.

#### Details
Origine: baseline Reqvire «Problem Details for error responses», adattata: i `type` sono riferimenti relativi `/problems/<nome>` non risolti dal backend e documentati in `ambrogio-docs`.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * satisfiedBy: [problem-details.ts](../../packages/conversations/src/adapters/in/http/problem-details.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Factory tecniche senza conoscenza business

Le factory tecniche del runtime dell'applicazione server devono creare meccanismi tecnici senza conoscere i moduli business né scegliere come sono usati, senza importare package business, la composition o gli adapter dell'applicazione, e la composition root deve consegnare loro le risorse e le registrazioni già costruite tramite dipendenze esplicite.

#### Details
Oggi la factory tecnica del runtime è il server HTTP, `apps/server/src/runtime/http-server.ts`; la regola `technical-factory-imports` di «Regole di architettura del backend» ne controlla gli import.

Origine: baseline Reqvire «Technical factories without business knowledge», adattata: la regola automatica riguarda le factory tecniche elencate nel contratto delle regole di architettura, non gli ingressi del processo del runtime che coordinano l'avvio.

#### Metadata
  * type: requirement

#### Contract References
  * [Regole di architettura del backend](../Contracts/ServerFoundation.md#regole-di-architettura-del-backend)

#### Relations
  * derivedFrom: [Capacità dell'ambiente fornite dalla composition root](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#capacità-dellambiente-fornite-dalla-composition-root)
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Interpretazione degli errori HTTP per tipo da parte del client

Quando un client riceve dall'API HTTP versionata una risposta d'errore, deve riconoscerne il significato soltanto dal membro `type` del Problem Details e presentare alla famiglia un proprio testo per quel tipo, con un testo generico per i tipi che non riconosce o per una risposta d'errore che non è un Problem Details.

#### Details
Regola di interpretazione dell'API HTTP valida per ogni client che la usa. `title` e `detail` sono testi inglesi del backend e non servono da discriminante; ogni client la raffina con il proprio catalogo dei testi, il proprio codice e le proprie verifiche.

#### Metadata
  * type: requirement

#### Contract References
  * [Risposta HTTP dell'elenco conversazioni](../Contracts/FamilyConversation.md#risposta-http-dellelenco-conversazioni)
  * [Risposta HTTP dello storico conversazionale](../Contracts/FamilyConversation.md#risposta-http-dello-storico-conversazionale)
  * [Catalogo dei problemi di protocollo HTTP](../Contracts/HttpApi.md#catalogo-dei-problemi-di-protocollo-http)
  * [Forma dei Problem Details dell'API HTTP](../Contracts/HttpApi.md#forma-dei-problem-details-dellapi-http)

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Mappatura HTTP esplicita degli esiti previsti per operazione

Quando un'operazione HTTP invoca un caso d'uso con esiti negativi previsti, la registrazione della rotta deve mappare esplicitamente ogni variante dell'unione chiusa in un Problem Details dichiarato da quell'operazione, scegliendone il significato pubblico e soltanto campi sicuri dichiarati, senza una tabella globale dai tipi interni agli stati e senza lanciare gli esiti previsti come eccezioni; Domain e Application non devono contenere stati HTTP, header, tipi di problema o oggetti di risposta.

#### Details
Origine: baseline Reqvire «Explicit HTTP mapping of expected outcomes per operation», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Risposta HTTP dell'elenco conversazioni](../Contracts/FamilyConversation.md#risposta-http-dellelenco-conversazioni)
  * [Risposta HTTP dello storico conversazionale](../Contracts/FamilyConversation.md#risposta-http-dello-storico-conversazionale)
  * [Forma dei Problem Details dell'API HTTP](../Contracts/HttpApi.md#forma-dei-problem-details-dellapi-http)

#### Relations
  * derivedFrom: [Gestione esplicita dei rifiuti previsti](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#gestione-esplicita-dei-rifiuti-previsti)
  * satisfiedBy: [get-conversation.route.adapter.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.route.adapter.ts)
  * satisfiedBy: [list-conversations.route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.route.adapter.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Namespace e versione maggiore dell'API HTTP nel percorso

Il backend deve esporre la propria API HTTP pubblica sotto un namespace con la versione maggiore nel percorso, `/api/v1/`, con un ciclo di versione indipendente da quello del protocollo conversazionale.

#### Details
La sessione conversazionale resta sul percorso `/api/session`, fuori dal namespace versionato, ed è versionata dal sottoprotocollo `ambrogio.v1`. Un cambio incompatibile dell'API cambia la versione nel percorso e si fa nella stessa modifica dei client che la usano, senza mantenere la versione precedente, secondo «Compatibilità fra release per versione d'interfaccia»; un percorso sotto `/api` senza versione non ha rotte e riceve la risposta della rotta inesistente.

Origine: baseline Reqvire «API namespace and major version in the path», adattata: la sessione WebSocket non entra nel namespace versionato perché la versiona il sottoprotocollo.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Risposta opaca per i guasti inattesi dell'API HTTP

Quando un guasto inatteso non mappato da un'operazione né dal catalogo dei problemi di protocollo raggiunge il confine HTTP, il server deve gestirlo nella gestione centrale degli errori e rispondere soltanto con il Problem Details opaco di stato 500, senza proprietà aggiuntive né il messaggio originale.

#### Details
Origine: baseline Reqvire «Opaque response for unexpected faults», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Catalogo dei problemi di protocollo HTTP](../Contracts/HttpApi.md#catalogo-dei-problemi-di-protocollo-http)

#### Relations
  * satisfiedBy: [http-server.ts](../../apps/server/src/runtime/http-server.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---

### Slice delle rotte HTTP con aggregatori espliciti

Ogni rotta HTTP del backend deve essere una slice con responsabilità distinte per registrazione, schemi e gestore, il cui gestore traduce esplicitamente ingressi e risposte riuscite da e verso i contratti Application, e l'applicazione server deve registrare rotte e scope tramite aggregatori espliciti che ricevono le dipendenze già costruite.

#### Details
Origine: baseline Reqvire «HTTP route slices with explicit aggregators», adottata.

#### Metadata
  * type: requirement

#### Contract References
  * [Dati dei casi d'uso indipendenti dagli ingressi](../Contracts/FamilyConversation.md#dati-dei-casi-duso-indipendenti-dagli-ingressi)

#### Relations
  * derivedFrom: [Capacità dell'ambiente fornite dalla composition root](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#capacità-dellambiente-fornite-dalla-composition-root)
  * satisfiedBy: [http-surface.ts](../../apps/server/src/composition/http-surface.ts)
  * satisfiedBy: [conversation-routes.ts](../../packages/conversations/src/adapters/in/http/conversation-routes.ts)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Stato HTTP dall'esito effettivo

Ogni operazione HTTP del backend deve scegliere lo stato di successo dall'esito effettivo e gli stati d'errore da un vocabolario fisso, dichiararli nel proprio contratto e non dedurli meccanicamente dal metodo HTTP, dalla durata dell'operazione o da categorie di errori del Domain.

#### Details
Origine: baseline Reqvire «Status from the actual outcome», adattata: il vocabolario comprende soltanto gli stati usati dalle rotte attuali e dal catalogo dei problemi di protocollo.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [get-conversation.route.adapter.ts](../../packages/conversations/src/adapters/in/http/get-conversation/get-conversation.route.adapter.ts)
  * satisfiedBy: [list-conversations.route.adapter.ts](../../packages/conversations/src/adapters/in/http/list-conversations/list-conversations.route.adapter.ts)
  * specify: [Conversazione familiare](../../../ambrogio-model/system-model/Capabilities/Product.md#conversazione-familiare)
---
