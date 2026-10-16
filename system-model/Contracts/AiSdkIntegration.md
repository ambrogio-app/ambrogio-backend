# Elements

### Adozione di AI SDK nei layer conversazionali

Decisione concordata il 16 ottobre 2026: Ambrogio adotta Vercel AI SDK per i meccanismi di generazione, tool calling e streaming della chat che lo strumento già offre, mantenendo l'architettura a layer e le garanzie applicative del prodotto. La migrazione riguarda il percorso completo del turno, dall'agente alla risposta HTTP. Il criterio di riuscita è eliminare meccanismi tecnici duplicati e rendere più leggibile il coordinamento, con evidenze sulle garanzie preservate.

#### Decisioni e responsabilità

- Domain possiede identità, stati e transizioni valide di conversazioni e turni. Application possiede ammissione, coordinamento della generazione, conclusione persistente e rifiuti del turno. I loro contratti sono espressi nei termini del modulo; non importano AI SDK, Fastify, Micdrop, MCP o SQLite, neppure soltanto per i tipi.
- Gli adapter possono usare direttamente le API di AI SDK pertinenti, senza riprodurle in un framework locale. L'adapter degli agenti usa le primitive di generazione e tool calling dell'SDK; l'adapter HTTP usa il suo protocollo UI Message Stream e gli strumenti di serializzazione e invio. La configurazione JSON viene validata dalla composition root e dagli adapter responsabili prima dell'ascolto.
- Le porte e la scomposizione dei casi d'uso possono evolvere per esprimere chiaramente ammissione, produzione progressiva ed esito conservato. La firma attuale di `ProduceConversationReply` e il coordinamento attuale di `ExchangeTurn` non sono vincoli architetturali da conservare. Ogni modifica conserva il significato applicativo dei dati e i contratti comuni a chat e voce; l'evoluzione non richiede di copiare tutti gli eventi tecnici dell'SDK in un modello locale.
- I callback dell'SDK possono invocare casi d'uso Application, tramite dati tradotti dall'adapter. Il callback scelto e il consumo dello stream devono garantire la conclusione del turno ammesso anche dopo la disconnessione. Il solo termine del modello, del trasporto o di un callback UI non prova che il commit sia riuscito. Il segnale pubblico di successo segue la conferma della transazione applicativa.
- L'archivio SQLite/Kysely resta autorevole per turni, esiti e occupazione dell'installazione. La guida AI SDK alla persistenza fornisce punti di integrazione utilizzabili con questo archivio; non introduce un secondo archivio autorevole né obbliga a sostituire il Domain con `UIMessage`. Una rappresentazione UI per il client può essere derivata dai dati conservati senza duplicare lo stato del turno.
- Restano le configurazioni locali degli agenti in JSON, il provider Mistral iniziale, la politica di delega singola, i limiti delle chiamate ai tool, il client MCP ufficiale esistente con la sua autenticazione e il canale vocale Micdrop. La selezione tra `streamText` e le astrazioni Agent dell'SDK segue le politiche già definite e la semplicità risultante, senza cambiare quelle politiche per adattarle a un esempio della libreria.
- La chat adotta il profilo UI Message Stream definito nel contratto di trasporto. Il protocollo SSE precedente viene sostituito, senza un percorso parallelo di compatibilità con eventi `conversation`, `delta` e `done`. Il futuro client può usare il trasporto AI SDK adattando le richieste al contratto HTTP del prodotto. Non vengono introdotti in questa migrazione resume automatico, esposizione dei tool o del ragionamento al client, né cambiamenti del protocollo vocale.

#### Alternative e conseguenze

Sono state considerate la manutenzione del trasporto SSE locale, l'adozione di `@fastify/sse` conservando gli eventi locali e l'adozione del protocollo UI di AI SDK. La scelta è la terza: usa la dipendenza già introdotta per gli agenti e prepara l'integrazione con il futuro client. Richiede l'aggiornamento dei contratti pubblici, dei test del protocollo e delle eventuali guide di integrazione esterne. La dipendenza dal formato UI dell'SDK resta esplicita negli adapter e nel contratto HTTP; gli aggiornamenti della libreria richiedono la riesecuzione delle verifiche di compatibilità.

La guida alla persistenza è integrata con i casi d'uso del prodotto. L'alternativa di affidare lo stato del turno direttamente a messaggi UI e callback di trasporto richiederebbe riprogettare ammissione atomica, recupero dopo riavvio e coordinamento con la voce; questa migrazione conserva tali obblighi.

#### Fonti e versione di riferimento

Le API tecniche sono verificate sulla dipendenza `ai` 7.0.142 presente nel lockfile e sulle fonti ufficiali: [agenti](https://ai-sdk.dev/docs/agents/overview), [Fastify](https://ai-sdk.dev/cookbook/api-servers/fastify), [persistenza dei messaggi](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence), [protocollo degli stream](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol), [composizione di stream UI](https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream). Le regole del prodotto su ammissione, esito conservato e continuità tra ingressi sono scelte di Ambrogio, non garanzie attribuite automaticamente a queste API.

#### Impatto sulle guide esterne

Sito e documentazione utente risiedono in repository separati. Il cambiamento del protocollo pubblico richiede di aggiornare eventuali esempi di integrazione della chat e la descrizione di eventi, metadata e conferma del successo. La validazione locale non dimostra l’allineamento di quei repository.

#### Metadata
  * type: specification

#### Relations
  * define: [Separazione delle responsabilità nel modulo Conversazioni](../Requirements/FamilyConversation.md#separazione-delle-responsabilità-nel-modulo-conversazioni)
---
