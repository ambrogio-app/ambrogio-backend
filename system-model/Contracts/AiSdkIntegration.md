# Elements

### Adozione di AI SDK nei layer conversazionali

Ambrogio usa Vercel AI SDK per i meccanismi di generazione, tool calling e streaming degli agenti che lo strumento già offre, mantenendo l'architettura a layer e le garanzie applicative del prodotto. Il trasporto verso i client non usa AI SDK: segue il protocollo conversazionale del prodotto definito da «Adozione del protocollo conversazionale Ambrogio v1». Il criterio di riuscita è eliminare meccanismi tecnici duplicati nella produzione della risposta e rendere più leggibile il coordinamento, con evidenze sulle garanzie preservate.

#### Decisioni e responsabilità
- Domain possiede identità, stati e transizioni valide di conversazioni e turni. Application possiede ammissione, coordinamento della generazione, conclusione persistente e rifiuti del turno. I loro contratti sono espressi nei termini del modulo; non importano AI SDK, Fastify, WebSocket, sherpa-onnx, MCP o PostgreSQL, neppure soltanto per i tipi.
- Gli adapter degli agenti usano direttamente le API di AI SDK pertinenti, senza riprodurle in un framework locale: primitive di generazione, tool calling e output strutturato. La configurazione degli agenti viene validata dalla composition root e dagli adapter responsabili prima dell'ascolto.
- Le porte e la scomposizione dei casi d'uso ammettono evoluzioni che esprimano chiaramente ammissione, produzione progressiva, indicazione della replica attesa ed esito conservato. La firma attuale di `ProduceConversationReply` e il coordinamento attuale di `ExchangeTurn` non sono vincoli architetturali da conservare. Ogni modifica conserva il significato applicativo dei dati e le regole comuni a tutti i turni; l'evoluzione non richiede di copiare gli eventi tecnici dell'SDK in un modello locale.
- I callback dell'SDK che invocano casi d'uso Application lo fanno tramite dati tradotti dall'adapter. Il solo termine del modello o di un callback non prova che il commit sia riuscito; il segnale pubblico di successo segue la conferma della transazione applicativa.
- L'archivio PostgreSQL/Kysely resta autorevole per turni, esiti e occupazione della conversazione interessata. AI SDK non introduce un secondo archivio autorevole né obbliga a sostituire il Domain con `UIMessage`.
- Restano le configurazioni degli agenti come file JSON di soli dati, secondo «Formato JSON dei file degli agenti» e «Profilo di bootstrap della configurazione del backend», la politica di delega singola, i limiti delle chiamate ai tool e il client MCP ufficiale esistente con la sua autenticazione. La selezione tra `streamText` e le astrazioni Agent dell'SDK segue le politiche già definite e la semplicità risultante, senza cambiare quelle politiche per adattarle a un esempio della libreria.
- Ogni agente sceglie nel proprio file uno dei pacchetti di provider ufficiali di AI SDK ammessi dal contratto della produzione della risposta. Lo stesso adapter, con le stesse primitive di generazione, tool calling e output strutturato, serve tutti i provider; aggiungere un provider richiede il suo pacchetto, la sua costruzione nell'adapter e le sue verifiche, non un secondo percorso di generazione.
- La dipendenza da AI SDK resta esplicita negli adapter degli agenti: un aggiornamento della libreria richiede la riesecuzione delle verifiche degli agenti e una revisione dell'uso di AI SDK negli agenti richiede una decisione separata.

#### Fonti e versione di riferimento
Le API tecniche sono verificate sulla dipendenza `ai` 7.0.143 e sui pacchetti `@ai-sdk/mistral` 4.0.66, `@ai-sdk/openai` 4.0.96, `@ai-sdk/anthropic` 4.0.82, `@ai-sdk/google` 4.0.99 e `@ai-sdk/openai-compatible` 3.0.71 presenti nel lockfile, e sulle fonti ufficiali: [agenti](https://ai-sdk.dev/docs/agents/overview), [persistenza dei messaggi](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence). Le regole del prodotto su ammissione, esito conservato e continuità tra ingressi sono scelte di Ambrogio, non garanzie attribuite automaticamente a queste API.

#### Metadata
  * type: specification

#### Relations
  * define: [Separazione delle responsabilità nel modulo Conversazioni](../Requirements/FamilyConversation.md#separazione-delle-responsabilità-nel-modulo-conversazioni)
---
