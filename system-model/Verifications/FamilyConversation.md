# Elements

### Prova dei rifiuti prima dell'ammissione

Con `language` impostato separatamente a `en` e `it`, provocare ciascun rifiuto prima dell'ammissione: testo vuoto, conversazione inesistente, conversazione occupata, archivio temporaneamente occupato, server in arresto, ingressi disabilitati dopo una conclusione non conservata e guasto tecnico controllato prima dell'ammissione. Ripetere i casi con `reply: "text"` e con `reply: "audio"` a voce abilitata. Confrontare lo stato dell'archivio prima e dopo.

#### Details
La prova passa se ogni caso riceve una trasmissione del messaggio pubblico nel tipo di contenuto richiesto, seguita da `turn.rejected` con il `reason` previsto (`invalid`, `conversation_not_found`, `occupied`, `unavailable`, `failure`) e lo stesso `message`, che corrisponde esattamente al testo definito per la lingua configurata. Non compaiono `turn.accepted` né nuovi turni o conversazioni, e il guasto tecnico non espone dettagli diagnostici. Fallisce se un rifiuto viene comunicato con un messaggio diverso, se manca la trasmissione del messaggio, se viene creato un effetto persistente o se trapelano dettagli tecnici. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](ConversationProtocol.md#verifica-del-protocollo-conversazionale)
  * satisfiedBy: [session-rejections.test.ts](../../apps/server/test/runtime/session-rejections.test.ts)
  * verify: [Rifiuto del turno prima dell'ammissione](../Requirements/FamilyConversation.md#rifiuto-del-turno-prima-dellammissione)
---

### Prova del ciclo della sessione conversazionale

Aprire due sessioni di client distinti; tenere attiva la prima mentre la seconda avvia e completa un turno. Chiudere una sessione dopo un turno concluso, durante una trasmissione audio in ingresso non conclusa, durante una risposta audio in corso e durante un turno ammesso. Inviare turni senza identificativo di conversazione e osservare quando nasce la conversazione, anche per un turno rifiutato.

#### Details
La prova passa se la chiusura di una sessione rilascia soltanto le sue risorse: la trasmissione in ingresso non conclusa viene scartata senza creare turni, la sintesi in corso viene interrotta, il turno già ammesso prosegue fino all'esito conservato e l'altra sessione continua senza effetti. Una nuova conversazione nasce soltanto con l'ammissione del turno che la crea; un turno rifiutato non crea conversazioni. Il backend non attende né richiede conferme di fine riproduzione dal client. Fallisce se la chiusura interrompe altre sessioni o turni ammessi, se resta una sintesi attiva per una sessione chiusa o se un turno rifiutato lascia una conversazione. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](ConversationProtocol.md#verifica-del-protocollo-conversazionale)
  * satisfiedBy: [session-lifecycle.test.ts](../../apps/server/test/runtime/session-lifecycle.test.ts)
  * verify: [Chiusura della sessione conversazionale](../Requirements/FamilyConversation.md#chiusura-della-sessione-conversazionale)
  * verify: [Creazione della conversazione all'ammissione del turno](../Requirements/FamilyConversation.md#creazione-della-conversazione-allammissione-del-turno)
---

### Prova della conferma di completamento del turno

Eseguire un turno con almeno due frammenti, prima con risposta in testo e poi in audio. Ritardare il commit del completamento dopo l'ultimo frammento, quindi consentirlo; ripetere facendolo fallire. Chiudere la sessione del client dopo `output.end` ma prima del commit.

#### Details
La prova passa se `turn.completed` arriva una sola volta come ultimo messaggio del turno, dopo `output.end` e dopo il commit riuscito, con `turnId` ed `expectsReply` booleano. Finché il commit è bloccato non arriva; se il commit fallisce non viene inviato e il guasto segue la politica di indisponibilità degli ingressi. La fine della generazione, `output.end` e la chiusura della sessione non sono trattate come successo. Fallisce se viene confermato un esito non conservato, se la conferma precede l'ultima trasmissione o se manca `expectsReply`. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](ConversationProtocol.md#verifica-del-protocollo-conversazionale)
  * satisfiedBy: [session-turns.test.ts](../../apps/server/test/runtime/session-turns.test.ts)
  * verify: [Conferma del completamento del turno](../Requirements/FamilyConversation.md#conferma-del-completamento-del-turno)
---

### Prova della segnalazione della replica attesa

Con un produttore controllato, eseguire turni testuali e vocali in cui la risposta chiede una replica e turni in cui conclude lo scambio. Ripetere con un produttore che non fornisce l'indicazione o la fornisce con tipo invalido. Osservare le chiamate al modello.

#### Details
La prova passa se l'agente produce il booleano strutturato `expectsReply` durante la stessa generazione della risposta, senza una seconda chiamata dedicata alla classificazione, e `turn.completed` porta il valore corretto per turni testuali e vocali, indipendentemente dal tipo di contenuto della risposta. Un'indicazione mancante o invalida produce l'esito di errore del turno e non `expectsReply: false`. Turni rifiutati, falliti o interrotti non portano `expectsReply`. Fallisce se il valore è dedotto dal testo, se differisce per canale o se un valore mancante viene presentato come `false`. Il comportamento dei client che usano l'indicazione è verificato nei rispettivi modelli. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](ConversationProtocol.md#verifica-del-protocollo-conversazionale)
  * satisfiedBy: [session-turns.test.ts](../../apps/server/test/runtime/session-turns.test.ts)
  * satisfiedBy: [exchange-turn.test.ts](../../packages/conversations/test/application/exchange-turn.test.ts)
  * verify: [Determinazione della replica attesa](../Requirements/FamilyConversation.md#determinazione-della-replica-attesa)
  * verify: [Segnalazione della replica attesa](../Requirements/FamilyConversation.md#segnalazione-della-replica-attesa)
---

### Prova della trasmissione progressiva della risposta

In una sessione pronta inviare un nuovo turno e poi continuare una conversazione conservata, prima con `reply: "text"` e poi con `reply: "audio"` usando un sintetizzatore controllato. Produrre almeno due frammenti controllati, inclusi Unicode e ritorni a capo, mantenendo la generazione aperta dopo il primo. Ritardare la consegna di una notifica all'adapter e osservare l'ordine delle successive.

#### Details
La prova passa se, dopo `turn.accepted`, il server apre una trasmissione con `output.start` contenente `requestId`, `turnId`, un `stream` non in uso e il `content` richiesto; per il testo ogni `output.chunk` contiene soltanto il nuovo frammento e la concatenazione ricostruisce il testo esatto; per l'audio i frame binari portano il numero `stream` della trasmissione e campioni PCM16 alla frequenza dichiarata della voce configurata. Il primo contenuto arriva prima della fine della generazione. `output.end` chiude la trasmissione prima dell'esito del turno. Le notifiche applicative sono consegnate in ordine. Fallisce se la risposta viene accumulata fino alla fine, se i frammenti si ripetono o si mescolano tra trasmissioni, se il contenuto non è nel tipo richiesto o se espone dati interni dei tool o credenziali. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del protocollo conversazionale](ConversationProtocol.md#verifica-del-protocollo-conversazionale)
  * satisfiedBy: [session-turns.test.ts](../../apps/server/test/runtime/session-turns.test.ts)
  * verify: [Trasmissione progressiva della risposta del turno](../Requirements/FamilyConversation.md#trasmissione-progressiva-della-risposta-del-turno)
---

### Verifica degli invarianti dei turni

Raggruppa le prove delle transizioni di stato e della ricostruzione dei turni nel Domain.

#### Metadata
  * type: verification-objective
---

### Prova degli stati validi del turno

Nel Domain, creare un turno accettato e provare ciascuna conclusione con risposta, errore e interruzione. Tentare poi una seconda conclusione o un risultato tardivo dopo l'interruzione. Ricostruire anche stati persistenti validi e uno incompatibile con il contratto.

#### Details
La prova passa se ogni turno nasce in elaborazione, raggiunge una sola volta uno stato terminale valido, conserva identità e testo originario, rifiuta le transizioni successive senza mutare stato e non accetta uno stato persistente incompatibile come valido. La ricostruzione non riesegue le transizioni storiche. Fallisce se una transizione invalida cambia lo stato o se la ricostruzione corregge silenziosamente un dato incompatibile.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica degli invarianti dei turni](#verifica-degli-invarianti-dei-turni)
  * satisfiedBy: [turn.test.ts](../../packages/conversations/test/domain/turn.test.ts)
  * verify: [Integrità dello stato del turno nel Domain](../Requirements/FamilyConversation.md#integrità-dello-stato-del-turno-nel-domain)
---

### Verifica dei connettori MCP

Raggruppa le prove di connessione, scoperta e invocazione dei tool tramite il client MCP comune.

#### Metadata
  * type: verification-objective
---

### Dimostrazione del connettore Home Assistant su un'installazione reale

Su un'installazione Home Assistant reale abilitare l'integrazione «Model Context Protocol Server», esporre ad Assist almeno due luci in aree diverse e un sensore, creare un token di accesso di lunga durata e installare `examples/agents/home-assistant.ts` completato con indirizzo, token e chiave API. Avviare il backend e chiedere in conversazione lo stato del sensore, se una luce di un'area è accesa, poi di accendere e spegnere quella luce e di spegnere tutte le luci; chiedere infine di comandare un'entità non esposta. Ripetere l'avvio con un token errato.

#### Details
La dimostrazione passa se il backend si avvia scoprendo gli strumenti di Home Assistant, la risposta riporta lo stato effettivo del sensore, la domanda sullo stato della luce riceve lo stato effettivo senza che alcun dispositivo cambi stato, la luce cambia stato in Home Assistant e la risposta lo dichiara solo dopo la conferma dello strumento, la richiesta di spegnere tutte le luci spegne tutte le luci esposte, l'entità non esposta non viene comandata e, con il token errato, l'avvio fallisce con l'evento `server_startup_failed` che indica `Agent MCP connection failed: home-assistant` senza mostrare il token. Fallisce se uno di questi esiti non si verifica.

Non automatizzabile: richiede un'istanza reale di Home Assistant con entità esposte ad Assist, un token di accesso di lunga durata e un modello linguistico reale.

#### Metadata
  * type: demonstration-verification

#### Relations
  * derivedFrom: [Verifica dei connettori MCP](#verifica-dei-connettori-mcp)
  * verify: [Connettore Home Assistant tramite il server MCP di Home Assistant](../Requirements/FamilyConversation.md#connettore-home-assistant-tramite-il-server-mcp-di-home-assistant)
---

### Prova dei nomi degli strumenti MCP

Preparare un agente specializzato con strumenti scoperti di nome `HassTurnOff`, `GetLiveContext`, `light.toggle`, un nome di 65 caratteri, `mcp_7`, `_private`, `1st-tool` e `-dash`, e un modello controllato che registra i nomi offerti e chiama alcuni strumenti con nomi presentati. Osservare i nomi offerti al modello e le chiamate ricevute dal client MCP.

#### Details
La prova passa se `HassTurnOff`, `GetLiveContext` e `_private` sono offerti con il proprio nome, `light.toggle`, il nome di 65 caratteri, `mcp_7`, `1st-tool` e `-dash` sono offerti come `mcp_<indice>` secondo la posizione nella lista scoperta, descrizioni e schemi restano quelli del server, ogni chiamata del modello raggiunge il client MCP con il nome originale dello strumento corrispondente e il limite `maxToolCalls` continua a valere. Fallisce se un nome ammesso viene sostituito, se un nome non ammesso viene offerto al modello o se una chiamata raggiunge uno strumento diverso.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dei connettori MCP](#verifica-dei-connettori-mcp)
  * satisfiedBy: [ai-sdk-reply.test.ts](../../packages/conversations/test/adapters/out/ai-sdk-reply.test.ts)
  * verify: [Nomi degli strumenti MCP offerti al modello](../Requirements/FamilyConversation.md#nomi-degli-strumenti-mcp-offerti-al-modello)
---

### Prova del Bearer token per i connettori MCP

Configurare due agenti con `mcp.url` verso endpoint MCP Streamable HTTP di prova e token Bearer distinti in `mcp.auth: { "type": "bearer", "token": "…" }`. Far inizializzare i client, scoprire i tool e invocare un tool per agente; osservare gli header ricevuti dai due server e i log del processo. Ripetere con un token errato per uno degli agenti. Configurare un terzo endpoint senza `mcp.auth` e ripetere inizializzazione e invocazione. Provare anche un tipo di autenticazione non supportato e un token assente o vuoto.

#### Details
La prova passa se ogni richiesta MCP dell'agente autenticato invia `Authorization: Bearer <token>` soltanto al proprio endpoint, l'agente senza `mcp.auth` non invia `Authorization`, i token non si mescolano tra agenti e non compaiono nei log o nei messaggi rivolti al modello. Con il token errato il server di prova rifiuta l'accesso e il client non presenta i tool come disponibili. Un tipo non supportato o un token mancante o vuoto impedisce l'attivazione dell'agente prima della connessione. Fallisce se una richiesta omette il token configurato, lo invia al server dell'altro agente o ne divulga il valore.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dei connettori MCP](#verifica-dei-connettori-mcp)
  * satisfiedBy: [mcp-tool-client.test.ts](../../packages/conversations/test/adapters/out/mcp-tool-client.test.ts)
  * verify: [Autenticazione Bearer del client MCP](../Requirements/FamilyConversation.md#autenticazione-bearer-del-client-mcp)
---

### Prova del client MCP comune

Configurare due agenti specializzati in modulo TypeScript distinti, ciascuno con `mcp.url` di un server MCP di prova che usa Streamable HTTP ed espone tool con nomi e schemi diversi. Le configurazioni non contengono un campo `transport`. Avviare gli agenti tramite la stessa implementazione client, completare l'inizializzazione MCP via HTTP, scoprire i rispettivi tool e invocarne uno con argomenti validi. Ripetere con `mcp.url` assente e con un URL non HTTP o HTTPS.

#### Details
La prova passa se ogni agente riceve soltanto l'endpoint MCP definito nel proprio file, entrambe le connessioni usano il client comune e Streamable HTTP, ciascuna espone i tool del proprio server e le invocazioni raggiungono il server corretto senza un campo `transport`. Una configurazione invalida impedisce l'attivazione dell'agente interessato prima di contattare un server. Fallisce se serve un client specifico per un server, se le connessioni o i tool si confondono tra agenti oppure se la configurazione invalida raggiunge un server.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dei connettori MCP](#verifica-dei-connettori-mcp)
  * satisfiedBy: [mcp-tool-client.test.ts](../../packages/conversations/test/adapters/out/mcp-tool-client.test.ts)
  * verify: [Client MCP comune ai connettori](../Requirements/FamilyConversation.md#client-mcp-comune-ai-connettori)
  * verify: [Configurazione MCP dell'agente specializzato](../Requirements/FamilyConversation.md#configurazione-mcp-dellagente-specializzato)
  * verify: [Trasporto HTTP dei connettori MCP](../Requirements/FamilyConversation.md#trasporto-http-dei-connettori-mcp)
---

### Prova del limite di chiamate MCP per agente

Preparare due agenti specializzati con limiti di chiamata differenti nei rispettivi JSON e usare modelli controllati che richiedano più chiamate MCP dei limiti previsti. Osservare le chiamate inoltrate ai due server MCP, l'esito pubblico e lo storico del turno.

#### Details
La prova passa se ciascun agente usa il proprio limite, nessuna chiamata viene inoltrata oltre tale limite e il turno eccedente termina con il messaggio pubblico di guasto nella propria conversazione. Fallisce se un limite viene condiviso tra agenti, se viene eseguita una chiamata eccedente o se il guasto espone dettagli tecnici.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dei connettori MCP](#verifica-dei-connettori-mcp)
  * satisfiedBy: [ai-sdk-reply.test.ts](../../packages/conversations/test/adapters/out/ai-sdk-reply.test.ts)
  * verify: [Limite delle chiamate agli strumenti per agente](../Requirements/FamilyConversation.md#limite-delle-chiamate-agli-strumenti-per-agente)
---

### Prova della configurazione pronta di Home Assistant

Copiare `examples/agents/home-assistant.ts` in una directory degli agenti di prova insieme a un orchestratore valido e caricarla con la validazione delle configurazioni degli agenti usata all'avvio. Esaminare i valori del file e cercare nei campi delle credenziali valori diversi dai segnaposto previsti.

#### Details
La prova passa se il file è accettato senza modifiche come agente specializzato `home-assistant` con connettore MCP, `mcp.url` termina con `/api/mcp`, `mcp.auth` è di tipo `bearer`, `maxToolCalls` vale 5, `llm` usa il provider `mistral` con il modello `mistral-medium-latest`, `description` e `instructions` corrispondono al contratto e le credenziali sono esattamente i segnaposto `<MISTRAL_API_KEY>` e `<HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN>`. Fallisce se il file viene rifiutato, se un campo differisce dal contratto o se contiene un valore che può essere una credenziale effettiva.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dei connettori MCP](#verifica-dei-connettori-mcp)
  * satisfiedBy: [home-assistant-example.test.ts](../../apps/server/test/runtime/home-assistant-example.test.ts)
  * verify: [Configurazione pronta del connettore Home Assistant](../Requirements/FamilyConversation.md#configurazione-pronta-del-connettore-home-assistant)
---

### Prova della disponibilità degli agenti dai moduli TypeScript

Avviare il server con `orchestrator.ts` e un file specializzato valido in `/etc/ambrogio/agents`, usando agenti di prova osservabili dall'orchestratore. Aggiungere un secondo file `<id>.ts` valido e riavviare; rimuovere il primo file e riavviare ancora, senza modificare altri elenchi di abilitazione.

#### Details
La prova passa se al primo avvio l'orchestratore può scegliere il primo agente, al secondo entrambi e al terzo soltanto il secondo. Fallisce se un file presente richiede registrazione altrove, se un agente rimosso resta disponibile dopo il riavvio o se un file viene associato all'identificativo sbagliato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dei connettori MCP](#verifica-dei-connettori-mcp)
  * satisfiedBy: [agents.test.ts](../../apps/server/test/composition/agents.test.ts)
  * verify: [Disponibilità degli agenti dai moduli TypeScript](../Requirements/FamilyConversation.md#disponibilità-degli-agenti-dai-moduli-typescript)
---

### Prova della selezione degli strumenti MCP

Preparare agenti specializzati con un server MCP controllato che scopre gli strumenti `alpha`, `light.toggle`, `beta` e `gamma`. Un agente non ha `mcp.tools`; uno ha `mcp.tools: ["gamma", "light.toggle"]`; uno elenca anche `delta`, che il server non offre. Verificare inoltre la validazione di `mcp.tools` non array, vuoto, con un elemento vuoto o non stringa e con un nome ripetuto. Con un modello controllato registrare gli strumenti offerti e far chiamare sia uno strumento offerto sia `alpha`.

#### Details
La prova passa se l'agente senza `mcp.tools` riceve tutti e quattro gli strumenti; l'agente con l'elenco riceve soltanto `light.toggle`, presentato come `mcp_1`, e `gamma`, in quest'ordine e con descrizioni e schemi del server; la chiamata a uno strumento offerto raggiunge il client MCP con il nome originale mentre quella ad `alpha` non lo raggiunge; le configurazioni invalide sono rifiutate prima dell'attivazione; l'agente che elenca `delta` impedisce l'avvio con il messaggio `Agent MCP tool unavailable: <id>` privo di URL e credenziali. Fallisce se uno strumento non elencato è offerto o invocato, se l'ordine o i nomi presentati cambiano rispetto alla lista scoperta o se l'avvio prosegue con un nome assente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dei connettori MCP](#verifica-dei-connettori-mcp)
  * satisfiedBy: [agents.test.ts](../../apps/server/test/composition/agents.test.ts)
  * satisfiedBy: [agent-config.test.ts](../../apps/server/test/runtime/agent-config.test.ts)
  * satisfiedBy: [ai-sdk-reply.test.ts](../../packages/conversations/test/adapters/out/ai-sdk-reply.test.ts)
  * verify: [Rifiuto dell'avvio con uno strumento MCP elencato non disponibile](../Requirements/FamilyConversation.md#rifiuto-dellavvio-con-uno-strumento-mcp-elencato-non-disponibile)
  * verify: [Selezione degli strumenti MCP offerti all'agente](../Requirements/FamilyConversation.md#selezione-degli-strumenti-mcp-offerti-allagente)
---

### Prova delle configurazioni degli agenti con e senza MCP

Caricare la directory degli agenti con un agente con `mcp` e `maxToolCalls` e un agente senza `mcp` e senza `maxToolCalls`. In tentativi separati usare un agente senza `mcp` ma con `maxToolCalls`, un agente con `mcp` senza `maxToolCalls` e una directory con il solo `orchestrator.ts`; avviare inoltre il server con la directory priva di agenti specializzati.

#### Details
La prova passa se la prima directory viene caricata con entrambi gli agenti disponibili all'orchestratore, l'agente senza MCP privo di connettore e di limite; se ciascun tentativo invalido viene rifiutato prima dell'attivazione, senza aprire connessioni MCP; e se il server senza agenti specializzati non si mette in ascolto e chiude le risorse già preparate. Fallisce se un file invalido viene accettato, se l'agente senza MCP viene rifiutato o se il server si avvia senza agenti specializzati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dei connettori MCP](#verifica-dei-connettori-mcp)
  * satisfiedBy: [agents.test.ts](../../apps/server/test/composition/agents.test.ts)
  * satisfiedBy: [agent-config.test.ts](../../apps/server/test/runtime/agent-config.test.ts)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * verify: [Agente specializzato senza connettore MCP](../Requirements/FamilyConversation.md#agente-specializzato-senza-connettore-mcp)
  * verify: [Disponibilità degli agenti dai moduli TypeScript](../Requirements/FamilyConversation.md#disponibilità-degli-agenti-dai-moduli-typescript)
---

### Prova delle istruzioni del server MCP

Con un server MCP Streamable HTTP di prova che dichiara la capacità `prompts` ed espone un prompt senza argomenti, un prompt con un argomento obbligatorio e uno strumento, preparare un agente specializzato con connettore MCP e un modello controllato che registra le istruzioni ricevute. Elaborare due turni cambiando il testo del prompt fra il primo e il secondo. Ripetere con un server che non dichiara la capacità `prompts`, con un server la cui lista dei prompt fallisce all'avvio e con un server la cui lettura del prompt fallisce durante il turno.

#### Details
La prova passa se all'avvio il backend conserva soltanto il prompt senza argomenti obbligatori; a ogni turno il modello riceve le istruzioni del modulo TypeScript, l'intestazione `Instructions and context from the connected MCP server:` e il testo corrente del prompt, prima delle indicazioni sul formato della risposta, e il secondo turno vede il testo aggiornato senza riavvio; il server senza capacità `prompts` non riceve `prompts/list` e il modello riceve soltanto le istruzioni del modulo TypeScript con le indicazioni sul formato; l'errore della lista all'avvio impedisce l'attivazione con `Agent MCP connection failed: <id>`; l'errore di lettura durante il turno termina il turno con il guasto `MCP prompt retrieval failed` senza chiamare il modello. Le letture dei prompt non contano per `maxToolCalls`. Fallisce se uno di questi esiti non si verifica.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dei connettori MCP](#verifica-dei-connettori-mcp)
  * satisfiedBy: [agents.test.ts](../../apps/server/test/composition/agents.test.ts)
  * satisfiedBy: [ai-sdk-reply.test.ts](../../packages/conversations/test/adapters/out/ai-sdk-reply.test.ts)
  * satisfiedBy: [mcp-tool-client.test.ts](../../packages/conversations/test/adapters/out/mcp-tool-client.test.ts)
  * verify: [Istruzioni del server MCP per l'agente](../Requirements/FamilyConversation.md#istruzioni-del-server-mcp-per-lagente)
---

### Prova di OAuth tra servizi per i connettori MCP

Configurare un agente con `mcp.auth` di tipo `oauth_client_credentials`, `clientId`, `clientSecret`, `issuer` e `scope` facoltativo. Usare un server MCP di prova che pubblica i metadata OAuth e un authorization server di prova associato all'issuer configurato. Eseguire inizializzazione, scoperta e invocazione di un tool; ripetere dopo la scadenza del token e con un secondo agente dotato di credenziali distinte. Ripetere con un issuer pubblicato diverso da quello configurato e con campi obbligatori mancanti o vuoti; osservare richieste, log e messaggi inviati al modello.

#### Details
La prova passa se il client ottiene un token con `client_credentials` senza login interattivo, usa l'eventuale scope configurato, invia il token solo al server MCP dell'agente e rinnova le credenziali secondo il comportamento del SDK. Un issuer diverso impedisce l'invio del segreto; una configurazione invalida impedisce l'attivazione prima della connessione. Credenziali e token non si mescolano tra agenti e non compaiono in log o messaggi al modello. Fallisce se il segreto raggiunge un issuer diverso, se il token viene usato per un altro agente o se l'agente espone tool dopo un fallimento di autenticazione.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dei connettori MCP](#verifica-dei-connettori-mcp)
  * satisfiedBy: [agent-config.test.ts](../../apps/server/test/runtime/agent-config.test.ts)
  * satisfiedBy: [mcp-tool-client.test.ts](../../packages/conversations/test/adapters/out/mcp-tool-client.test.ts)
  * verify: [Autenticazione OAuth tra servizi del client MCP](../Requirements/FamilyConversation.md#autenticazione-oauth-tra-servizi-del-client-mcp)
---

### Verifica dell'interazione vocale

Raggruppa le verifiche della trascrizione, della risposta parlata, della conservazione solo testuale e del ciclo di vita delle interazioni vocali.

#### Metadata
  * type: verification-objective
---

### Prova degli ingressi testuali senza voce

Avviare un'installazione con la configurazione e le risorse vocali assenti, mantenendo configurati i soli componenti necessari alla chat testuale. Eseguire un turno tramite la chat testuale.

#### Details
La prova passa se l'ingresso conversazionale si avvia e completa un turno testuale senza caricare configurazione vocale né costruire componenti vocali. Fallisce se l'ingresso richiede un file o una risorsa solo vocale o non può conversare.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * satisfiedBy: [config-bootstrap.test.ts](../../apps/server/test/runtime/config-bootstrap.test.ts)
  * verify: [Ingressi testuali indipendenti dalla voce](../Requirements/FamilyConversation.md#ingressi-testuali-indipendenti-dalla-voce)
---

### Prova dell'assenza di audio persistente

Eseguire un turno vocale con risposta parlata, riavviare Ambrogio e ispezionare lo stato persistente prodotto dalla prova.

#### Details
La prova passa se lo storico conserva solo testo e dati non audio e se nessuna registrazione dell'input o dell'output vocale è presente tra i dati persistenti della prova. Fallisce se un file o un campo persistente contiene audio del turno o della risposta.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * satisfiedBy: [session-lifecycle.test.ts](../../apps/server/test/runtime/session-lifecycle.test.ts)
  * verify: [Conservazione solo testuale della conversazione](../Requirements/FamilyConversation.md#conservazione-solo-testuale-della-conversazione)
---

### Prova della scelta del motore di sintesi

Caricare file vocali di prova con directory di voce fittizie per entrambi i motori: `voiceEngine` uguale a `piper` senza `voiceSpeaker` né `voiceLanguage`; uguale a `kokoro` con `voiceSpeaker` 0, 35 e 52 e `voiceLanguage` `it`, `en` e `pt-br`; directory Kokoro con `model.onnx` e con un unico `model.int8.onnx`. Provare poi i casi invalidi: `voiceEngine` assente, vuoto o sconosciuto; `voiceSpeaker` o `voiceLanguage` presenti con `piper`; uno dei due assente con `kokoro`; `voiceSpeaker` negativo, decimale, stringa numerica o nome di voce come `if_sara`; `voiceLanguage` vuoto o non stringa; directory Kokoro priva di file `.onnx`, con due file `.onnx` o priva di `voices.bin`, `tokens.txt` o `espeak-ng-data/`. Con il motore di sintesi controllato costruire il sintetizzatore per ciascun motore, sintetizzare una frase e registrare la configurazione passata a `createAsync` e il `sid` di ogni generazione; ripetere con un motore controllato che dichiara meno voci del `voiceSpeaker` configurato. Quando la variabile d'ambiente che indica una directory Kokoro reale è presente, sintetizzare inoltre una breve frase italiana con le voci 35 e 36 e una breve frase inglese con la voce 0 e lingua `en`.

#### Details
La prova passa se i file validi sono accettati con il motore, la voce e la lingua indicati; ogni caso invalido rende il file vocale invalido oppure la directory della voce non disponibile prima della costruzione del sintetizzatore; con `piper` la configurazione contiene la sola sezione `vits` con i file della directory e ogni generazione usa `sid` 0; con `kokoro` la configurazione contiene la sola sezione `kokoro` con l'unico file `.onnx`, `voices.bin`, `tokens.txt`, `espeak-ng-data/` e `lang` uguale a `voiceLanguage`, e ogni generazione usa `sid` uguale a `voiceSpeaker`; un `voiceSpeaker` non inferiore a `numSpeakers` impedisce la costruzione del sintetizzatore; caricamento unico, `numThreads` e formato dell'audio restano quelli della prova della sintesi nel processo backend. Con il modello Kokoro reale la prova passa se l'audio di ogni voce provata è non vuoto alla frequenza del modello. Fallisce se un file invalido è accettato, se il motore, la voce o la lingua usati differiscono da quelli configurati, se la lingua o la voce sono imposte dal backend o se una voce fuori intervallo raggiunge la sintesi.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * satisfiedBy: [sherpa-synthesizer.test.ts](../../packages/conversations/test/adapters/in/sherpa-synthesizer.test.ts)
  * satisfiedBy: [voice-config.test.ts](../../packages/conversations/test/adapters/out/voice-config.test.ts)
  * verify: [Scelta del motore di sintesi vocale](../Requirements/FamilyConversation.md#scelta-del-motore-di-sintesi-vocale)
---

### Prova della selezione vocale per lingua

Preparare un file con profili italiani e inglesi che indicano percorsi espliciti alle directory incluse e a directory esterne montate, scegliendo tra più voci della stessa lingua, Piper e Kokoro. Provare la lingua effettiva italiana e inglese, il profilo attivo mancante, i campi invalidi nell'altro profilo, il formato precedente a profilo singolo e la voce disabilitata. Osservare risorse caricate, lingua Vosk, voce e lingua di fonetizzazione Kokoro.

#### Details
La prova passa se ciascuna lingua seleziona esattamente i percorsi indicati, anche quando provengono da un mount o quando esistono più voci della stessa lingua; il profilo mancante o strutturalmente invalido rende il file invalido, l'altro profilo non carica i modelli, il formato precedente funziona e la voce disabilitata non carica modelli. Fallisce se una lingua carica percorsi diversi da quelli indicati, se un profilo mancante o invalido è accettato o se vengono caricati modelli di un profilo non attivo o della voce disabilitata.

I casi di configurazione sono provati da `voice-config.test.ts`, la selezione dei profili e della voce montata con i modelli dell'immagine da `scripts/verify-docker-image.mjs` e l'avvio senza voce da `config-bootstrap.test.ts`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * satisfiedBy: [config-bootstrap.test.ts](../../apps/server/test/runtime/config-bootstrap.test.ts)
  * satisfiedBy: [voice-config.test.ts](../../packages/conversations/test/adapters/out/voice-config.test.ts)
  * satisfiedBy: [verify-docker-image.mjs](../../scripts/verify-docker-image.mjs)
  * verify: [Selezione dei modelli vocali inclusi per lingua](../Requirements/FamilyConversation.md#selezione-dei-modelli-vocali-inclusi-per-lingua)
---

### Prova della sintesi senza marcatura Markdown

Con il motore di sintesi controllato, sintetizzare risposte frammentate che contengono grassetto e corsivo con asterischi e trattini bassi, un nome composto con trattino basso, tilde doppie, codice in linea, un collegamento, un titolo, una citazione, un elenco puntato, un elenco numerato, una tabella con riga di separazione, una linea orizzontale e un grassetto spezzato fra due frammenti, conservando i frammenti consegnati al sintetizzatore.

#### Details
La prova passa se i testi consegnati al motore non contengono asterischi, tilde doppie, apici inversi, segni di titolo, citazione o elenco puntato iniziali, barre di tabella né indirizzi dei collegamenti; conservano il testo leggibile, il nome composto con trattino basso e il numero dell'elenco numerato; la riga di tabella diventa celle separate da virgole; la riga di separazione e la linea orizzontale non sono sintetizzate; il grassetto spezzato fra frammenti è ripulito; i frammenti ricevuti dal sintetizzatore, che sono lo stesso testo trasmesso e conservato, restano invariati. Fallisce se un simbolo di formattazione previsto raggiunge la sintesi, se si perde testo leggibile o se i frammenti ricevuti vengono alterati.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * satisfiedBy: [sherpa-synthesizer.test.ts](../../packages/conversations/test/adapters/in/sherpa-synthesizer.test.ts)
  * verify: [Risposta parlata senza marcatura testuale](../Requirements/FamilyConversation.md#risposta-parlata-senza-marcatura-testuale)
---

### Prova della sintesi vocale nel processo backend

Con un motore di sintesi controllato, che espone `createAsync`, `generateAsync` e `sampleRate` e registra le chiamate, costruire il sintetizzatore, eseguire più trasmissioni con testo frammentato in più frasi, anche contemporanee, interromperne una dopo la prima frase e chiudere il sintetizzatore. Verificare che una sintesi controllata lenta non blocchi l'event loop. Quando la variabile d'ambiente che indica una directory di voce reale è presente, caricare inoltre il modello reale e sintetizzare una breve frase italiana.

#### Details
La prova passa se la voce è caricata una sola volta per tutte le trasmissioni, con `numThreads` pari al minimo fra 4 e il parallelismo disponibile; ogni frase completa è sintetizzata con `generateAsync` appena disponibile e la parte residua alla fine del testo; due trasmissioni contemporanee non hanno mai due generazioni in corso insieme e ciascuna riceve solo il proprio audio; l'audio è PCM16 little-endian mono con campioni convertiti correttamente e la frequenza esposta è quella del modello; dopo l'interruzione non viene sintetizzata alcuna frase successiva; un timer dell'event loop scatta mentre una sintesi è in corso; un errore di caricamento rifiuta la costruzione. Con la voce reale la prova passa se l'audio prodotto è non vuoto e la frequenza è quella del modello. Fallisce se la voce viene ricaricata per una trasmissione, se viene usata la sintesi sincrona, se l'audio non rispetta il formato, se le generazioni si sovrappongono o se una frase successiva a un'interruzione viene sintetizzata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * satisfiedBy: [sherpa-synthesizer.test.ts](../../packages/conversations/test/adapters/in/sherpa-synthesizer.test.ts)
  * verify: [Risposta parlata su richiesta del client](../Requirements/FamilyConversation.md#risposta-parlata-su-richiesta-del-client)
---

### Prova della trascrizione e della risposta parlata

Inviare un turno audio trascrivibile con testo atteso e `reply: "audio"`, ottenendo una risposta controllata; ripetere con un turno testuale e `reply: "audio"`.

#### Details
La prova passa se il turno conservato contiene la trascrizione testuale attesa, `turn.accepted` riporta lo stesso testo, la risposta è trasmessa in audio con la frequenza della voce configurata e il suo testo compare nello scambio conservato. Fallisce se manca la trascrizione, se la risposta non viene trasmessa in audio quando richiesto o se lo scambio conserva audio invece di testo. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * satisfiedBy: [session-lifecycle.test.ts](../../apps/server/test/runtime/session-lifecycle.test.ts)
  * satisfiedBy: [sherpa-synthesizer.test.ts](../../packages/conversations/test/adapters/in/sherpa-synthesizer.test.ts)
  * verify: [Risposta parlata su richiesta del client](../Requirements/FamilyConversation.md#risposta-parlata-su-richiesta-del-client)
  * verify: [Trascrizione del turno vocale](../Requirements/FamilyConversation.md#trascrizione-del-turno-vocale)
---

### Prova della trascrizione non riuscita

Simulare un errore del servizio di trascrizione e una trascrizione composta solo da spazi, con risposta richiesta in audio.

#### Details
La prova passa se entrambi i tentativi ricevono la trasmissione del messaggio pubblico e `turn.rejected` con `reason: "transcription_failed"`, senza `turn.accepted`, e nessuno genera uno scambio nello storico. Fallisce se compare un turno o un esito persistente per tali tentativi o se il motivo è diverso. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * satisfiedBy: [session-rejections.test.ts](../../apps/server/test/runtime/session-rejections.test.ts)
  * verify: [Trascrizione vocale non riuscita](../Requirements/FamilyConversation.md#trascrizione-vocale-non-riuscita)
---

### Verifica dell'organizzazione delle conversazioni

Raggruppa i controlli sulla collocazione dei flussi testuali e vocali nel modulo business «Conversazioni».

#### Metadata
  * type: verification-objective
---

### Analisi dei dati al confine dei casi d'uso

Esaminare firme e valori scambiati tra Application e l'adapter del canale conversazionale. Seguire un turno testuale e uno vocale dalla decodifica fino al commit e alla rappresentazione dell'esito, compresi ammissione, incrementi, conclusione e chiusura della sola sessione. Controllare anche i casi d'uso di lettura.

#### Details
L'analisi passa se i dati sono definiti in Application con significato indipendente dal protocollo e l'adapter traduce in entrambe le direzioni. Il coordinamento del turno è unico per testo e voce; un turno ammesso raggiunge l'esito previsto anche se la sessione viene chiusa. Un callback tecnico invoca Application senza farle ricevere oggetti SDK. Fallisce se Application riceve messaggi del protocollo, oggetti HTTP o audio, produce direttamente messaggi del protocollo, espone oggetti Domain o se testo e voce implementano due autorità incompatibili per la stessa intenzione.

Non automatizzabile: giudicare il significato dei dati scambiati e l'unicità del coordinamento richiede di leggere firme e flusso.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Dati Application dei casi d'uso conversazionali](../Requirements/FamilyConversation.md#dati-application-dei-casi-duso-conversazionali)
---

### Analisi della semantica delle porte esterne

Per ciascuna porta outbound di «Conversazioni», confrontare il bisogno del caso d'uso, le operazioni e i tipi dichiarati in Application, l'API del fornitore e le conversioni dell'adapter. Esaminare la capacità di produzione progressiva e l'eventuale evoluzione dei contratti durante la migrazione AI SDK.

#### Details
L'analisi passa se ogni porta rappresenta una capacità richiesta dal modulo e l'adapter traduce le differenze rispetto al fornitore. Il contesto della produzione deriva dallo storico applicativo; frammenti, conclusione ed errori hanno significato applicativo, con ordine di consegna preservato. La firma può evolvere senza essere vincolata a `AsyncIterable<string>` e senza copiare ogni evento SDK. Fallisce se Application importa tipi del fornitore, se una porta espone `UIMessage`, writer o risultati SDK, se replica senza bisogno la loro API o se perde dati necessari alla persistenza e alla voce. La revisione deve motivare le astrazioni aggiunte o rimosse rispetto ai bisogni dei casi d'uso.

Non automatizzabile: confrontare il bisogno del caso d'uso con l'API del fornitore richiede giudizio umano.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Contratti delle porte nei termini di Conversazioni](../Requirements/FamilyConversation.md#contratti-delle-porte-nei-termini-di-conversazioni)
---

### Analisi statica dei confini degli import

Analizzare il grafo degli import del codice TypeScript di produzione del modulo «Conversazioni», includendo gli import di valori, gli `import type` e le riesportazioni.

#### Details
L'analisi passa se ogni import originato da Domain punta a Domain dello stesso modulo e ogni import originato da Application punta a Domain o Application dello stesso modulo. Fallisce se è presente anche un solo collegamento verso un componente o modulo non ammesso, compresi quelli che importano soltanto tipi.

Non automatizzabile: Domain e Application importano `src/project-error.ts`, esterno alle cartelle dei layer, e attribuirlo a un componente secondo la responsabilità richiede giudizio umano.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Import del Domain entro il proprio componente](../Requirements/FamilyConversation.md#import-del-domain-entro-il-proprio-componente)
  * verify: [Import dell'Application entro il proprio modulo](../Requirements/FamilyConversation.md#import-dellapplication-entro-il-proprio-modulo)
---

### Controllo degli adapter per componenti tecnici esterni

Esaminare gli ingressi e le implementazioni delle porte Application del modulo «Conversazioni» che integrano componenti tecnici esterni.

#### Details
Il controllo passa se ciascun adapter di ingresso di questo tipo risiede in `src/adapters/in/` del package «Conversazioni» e ciascun adapter che implementa una porta risiede in `src/adapters/out/` dello stesso package. Fallisce se uno di questi adapter è collocato nell'applicazione o in un altro package.

Non automatizzabile: stabilire quali componenti integrano tecnologie esterne e quale ruolo realizzano richiede di leggere il codice.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Adapter tecnici nel package Conversazioni](../Requirements/FamilyConversation.md#adapter-tecnici-nel-package-conversazioni)
---

### Controllo dei contratti di archivio della conversazione

Esaminare i contratti Application usati per accettare turni, conservare esiti e interruzioni, recuperare lo storico e produrre l'elenco delle conversazioni; seguire i relativi adapter di persistenza.

#### Details
Il controllo passa se il contratto di scrittura dedicato esprime le transizioni richieste dai casi d'uso, anche tramite il salvataggio coerente dell'aggregato, le letture hanno contratti separati adatti a storico ed elenco e nessuna interfaccia CRUD universale è imposta ai casi d'uso. Fallisce se Application dipende da un repository generico con sole operazioni create/get/update/delete o se le proiezioni di lettura sono accoppiate alle operazioni di scrittura.

Non automatizzabile: giudicare se un contratto esprime le transizioni richieste o un'interfaccia CRUD generica richiede giudizio umano.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Contratti di lettura separati dell'archivio conversazioni](../Requirements/FamilyConversation.md#contratti-di-lettura-separati-dellarchivio-conversazioni)
  * verify: [Contratto di scrittura dell'archivio conversazioni](../Requirements/FamilyConversation.md#contratto-di-scrittura-dellarchivio-conversazioni)
---

### Controllo del modulo business Conversazioni

Esaminare i flussi applicativi che elaborano i turni testuali e vocali e la loro appartenenza ai moduli business del server.

#### Details
Il controllo passa se entrambi i flussi appartengono allo stesso modulo business denominato «Conversazioni». Fallisce se la logica applicativa della conversazione testuale e quella della conversazione vocale sono distribuite in moduli business distinti.

Non automatizzabile: attribuire la logica applicativa a un modulo business richiede di leggerne la responsabilità.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Modulo business unico per la conversazione](../Requirements/FamilyConversation.md#modulo-business-unico-per-la-conversazione)
---

### Controllo dell'assemblaggio nella composition root

Esaminare la composition root dell'applicazione server e seguire il collegamento tra le porte Application di «Conversazioni» e le loro implementazioni concrete.

#### Details
Il controllo passa se la composition root dell'applicazione sceglie e fornisce a ciascun caso d'uso le implementazioni delle porte richieste. Fallisce se la scelta o il collegamento avvengono nel codice Domain o Application del modulo anziché nella composition root.

Non automatizzabile: individuare dove avviene la scelta delle implementazioni richiede di seguire il collegamento nel codice.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Assemblaggio delle porte nella composition root](../Requirements/FamilyConversation.md#assemblaggio-delle-porte-nella-composition-root)
---

### Controllo delle cartelle del modulo Conversazioni

Esaminare i file di produzione del package «Conversazioni» e classificare il codice Domain, Application e degli adapter secondo la responsabilità descritta nella specifica del modulo.

#### Details
Il controllo passa se il codice Domain risiede in `src/domain/`, i casi d'uso e le porte Application in `src/application/` e gli adapter in `src/adapters/` del package. Fallisce se codice di una di queste categorie si trova fuori dalla directory corrispondente.

Non automatizzabile: la classificazione del codice in Domain, Application e adapter si basa sulla responsabilità e non sulla cartella.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Cartelle del modulo Conversazioni](../Requirements/FamilyConversation.md#cartelle-del-modulo-conversazioni)
---

### Controllo delle dichiarazioni delle porte Application

Esaminare le dichiarazioni TypeScript delle porte outbound, dei dati, delle unioni e dei contratti callable di Application nel modulo «Conversazioni». Confrontare i nomi delle porte con la capacità richiesta dai casi d'uso e con i nomi delle implementazioni tecniche.

#### Details
Il controllo passa se le porte a oggetto con metodi nominati sono `interface`, dati, unioni e callable sono `type`, e i nomi delle porte descrivono la capacità dal punto di vista del caso d'uso senza includere prodotto, protocollo o libreria dell'adapter. Fallisce se una dichiarazione usa la forma sbagliata o una porta assume il nome della propria implementazione tecnica.

Non automatizzabile: giudicare se il nome di una porta descrive la capacità dal punto di vista del caso d'uso richiede giudizio umano.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Forma TypeScript dei contratti Application](../Requirements/FamilyConversation.md#forma-typescript-dei-contratti-application)
  * verify: [Nomi delle porte Application secondo la capacità richiesta](../Requirements/FamilyConversation.md#nomi-delle-porte-application-secondo-la-capacità-richiesta)
---

### Controllo delle integrazioni tramite porte e adapter

Esaminare i casi d'uso del modulo «Conversazioni» che accedono a capacità tecniche esterne e seguire ciascun collegamento fino all'integrazione concreta.

#### Details
Il controllo passa se ogni capacità tecnica esterna richiesta da un caso d'uso è espressa da una porta dichiarata in Application e realizzata da un adapter. Fallisce se un caso d'uso integra direttamente un componente tecnico esterno o se una porta necessaria è definita fuori da Application.

Non automatizzabile: riconoscere una capacità tecnica esterna richiesta da un caso d'uso richiede di leggerne il codice.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Integrazione esterna tramite porte e adapter](../Requirements/FamilyConversation.md#integrazione-esterna-tramite-porte-e-adapter)
---

### Controllo delle responsabilità Domain Application e adapter

Esaminare i componenti del modulo «Conversazioni» e seguire il percorso completo di un turno testuale e di un turno vocale nel canale conversazionale. Classificare regole di dominio, coordinamento applicativo, porte, gestione degli agenti, trascrizione e sintesi, persistenza e trasporto.

#### Details
Il controllo passa se Domain contiene stati e transizioni, Application coordina ammissione ed esito tramite porte e gli adapter possiedono i tipi e i meccanismi di AI SDK, Fastify, WebSocket, Vosk, sherpa-onnx, MCP e SQLite. Un callback SDK può invocare un caso d'uso attraverso dati tradotti; non determina autonomamente una transizione persistente. Verificare anche gli import solo di tipi. Gli adapter contengono conversioni e politiche di integrazione necessarie, senza duplicare un framework agentico o un secondo protocollo dei turni. Fallisce se una dipendenza tecnica raggiunge i layer interni, se un adapter diventa autorità delle regole comuni ai turni o se resta un percorso tecnico parallelo privo di obbligo applicativo.

Non automatizzabile: la classificazione di regole, coordinamento e meccanismi tecnici richiede giudizio umano.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Separazione delle responsabilità nel modulo Conversazioni](../Requirements/FamilyConversation.md#separazione-delle-responsabilità-nel-modulo-conversazioni)
---

### Controllo delle sottocartelle degli adapter

Esaminare gli adapter contenuti nel package «Conversazioni» e distinguere gli ingressi dalle implementazioni delle porte Application.

#### Details
Il controllo passa se ogni adapter d'ingresso del package si trova in `src/adapters/in/` e ogni adapter del package che implementa una porta Application si trova in `src/adapters/out/`. Fallisce se un adapter del package è collocato fuori dalla sottocartella prevista per il suo ruolo.

Non automatizzabile: distinguere un adapter di ingresso da uno che implementa una porta richiede di leggerne la responsabilità.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * verify: [Separazione degli adapter di ingresso e uscita](../Requirements/FamilyConversation.md#separazione-degli-adapter-di-ingresso-e-uscita)
---

### Prova dell'indipendenza tecnica di Domain e Application

Con l'API del compilatore TypeScript, compilare senza emissione i file di `src/domain/` e `src/application/` del package «Conversazioni», con le sole librerie standard ECMAScript (`lib` uguale a `ESNext`) e senza dichiarazioni di tipo dell'ambiente (`types` vuoto); leggere inoltre gli import, gli `import type`, le riesportazioni e gli import dinamici dei file compilati.

#### Details
La prova passa se la compilazione non produce diagnostiche e se ogni import dei file compilati è un percorso relativo che resta in `src/` del package. Fallisce se un file usa un'API Node.js o un'altra API globale dell'ambiente, come `process`, `Buffer` o `setTimeout`, oppure se importa un modulo Node.js o un package npm, anche soltanto per i tipi. Fallisce anche se, in un file d'esempio compilato con le stesse opzioni, l'uso di `process` e `setTimeout` non produce diagnostiche.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'organizzazione delle conversazioni](#verifica-dellorganizzazione-delle-conversazioni)
  * satisfiedBy: [domain-application-independence.test.ts](../../test/repository/domain-application-independence.test.ts)
  * verify: [Indipendenza tecnica di Domain e Application](../Requirements/FamilyConversation.md#indipendenza-tecnica-di-domain-e-application)
---

### Verifica della concorrenza dei turni

Raggruppa le verifiche sul singolo turno attivo per conversazione, sull'elaborazione parallela di conversazioni diverse e sul rifiuto senza accodamento dei turni in conflitto.

#### Metadata
  * type: verification-objective
---

### Prova degli ingressi disabilitati durante un turno

Avviare un turno nella conversazione A e, mentre è in elaborazione, inviare dallo stesso e da un altro client nuovi turni testuali e vocali sulla conversazione A e su una conversazione B. Ripetere dopo la conclusione di A.

#### Details
La prova passa se, finché il turno di A non ha un esito conservato, ogni nuovo turno testuale o vocale su A è rifiutato come `occupied` senza essere conservato né accodato, mentre i turni su B e quelli che aprono nuove conversazioni sono ammessi e completati prima della conclusione di A; dopo la conclusione A torna utilizzabile. La prova copre la parte di questa obbligazione che spetta al backend, cioè l'ammissione dei turni condivisa da tutti i client. La disabilitazione dell'ingresso locale durante elaborazione e riproduzione è un obbligo dei client e si verifica nei rispettivi modelli; il recupero dopo un arresto è verificato dalle prove degli stati persistenti dei turni.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [session-rejections.test.ts](../../apps/server/test/runtime/session-rejections.test.ts)
  * verify: [Disabilitazione degli ingressi durante un turno](../Requirements/FamilyConversation.md#disabilitazione-degli-ingressi-durante-un-turno)
---

### Prova del rifiuto dei turni concorrenti

Preparare una conversazione esistente A e inviare contemporaneamente due turni verso A da sessioni di client diversi, uno testuale e uno audio quando la voce è abilitata. Ritardare la produzione del turno ammesso. Inviare nel frattempo turni verso B e turni che creano conversazioni nuove.

#### Details
Nella stessa conversazione viene ammesso al massimo un turno; gli altri ricevono la trasmissione del messaggio pubblico nel tipo di contenuto richiesto e `turn.rejected` con `reason: "occupied"`, senza persistenza né coda. Il rifiuto è identico per turni testuali e vocali. B e le conversazioni nuove possono progredire e concludersi mentre A è ancora in elaborazione. Storici, identificativi, frammenti e risultati restano separati. Dopo la conclusione di A si può ammettere un nuovo turno in A. Ripetere dopo errore e dopo interruzione con riavvio; un completamento tardivo non modifica un turno interrotto e non libera l'occupazione di un altro turno. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * satisfiedBy: [session-rejections.test.ts](../../apps/server/test/runtime/session-rejections.test.ts)
  * verify: [Elaborazione parallela di conversazioni diverse](../Requirements/FamilyConversation.md#elaborazione-parallela-di-conversazioni-diverse)
  * verify: [Rifiuto dei turni concorrenti nella stessa conversazione](../Requirements/FamilyConversation.md#rifiuto-dei-turni-concorrenti-nella-stessa-conversazione)
  * verify: [Rifiuto del turno nella conversazione occupata](../Requirements/FamilyConversation.md#rifiuto-del-turno-nella-conversazione-occupata)
---

### Prova dell'assenza di turni in coda

Mantenere occupata una conversazione con un turno e tentare un altro invio verso la stessa conversazione tramite un ingresso diverso. Rendere poi nuovamente possibile l'elaborazione senza ripetere la seconda richiesta.

#### Details
La prova passa se il secondo turno è rifiutato subito, non viene conservato e non parte successivamente da solo. Un turno di un'altra conversazione può invece essere ammesso senza attendere il primo. Ripetere durante l'arresto, che impedisce nuove ammissioni globalmente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [session-rejections.test.ts](../../apps/server/test/runtime/session-rejections.test.ts)
  * verify: [Assenza di accodamento dei turni](../Requirements/FamilyConversation.md#assenza-di-accodamento-dei-turni)
---

### Prova della classificazione delle scritture SQLite

Su un archivio SQLite reale preparato con le migrazioni dell'applicazione, esercitare l'adapter di scrittura con un'ammissione concorrente, una mutazione che non modifica righe perché il turno è già interrotto, una condizione di vincolo non dichiarata come rifiuto della porta e un errore di scrittura o commit. Ispezionare separatamente l'esito osservato dal chiamante e lo stato persistente finale.

#### Details
La prova passa se solo l'ammissione concorrente accertata produce il rifiuto previsto corrispondente, il turno interrotto resta interrotto senza falso successo, e vincoli non traducibili, esiti ambigui ed errori tecnici si propagano come guasti senza confermare modifiche parziali. Il messaggio tecnico SQLite non diventa un rifiuto pubblico e nessun caso viene ritentato automaticamente. Fallisce se zero righe sono sempre trattate come assenza o successo, se un guasto diventa rifiuto previsto oppure se l'esito dichiarato contraddice lo stato persistente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * satisfiedBy: [sqlite-conversation-write.test.ts](../../packages/conversations/test/adapters/out/sqlite-conversation-write.test.ts)
  * verify: [Classificazione degli esiti delle scritture conversazionali](../Requirements/FamilyConversation.md#classificazione-degli-esiti-delle-scritture-conversazionali)
---

### Prova delle transazioni brevi del turno

Bloccare in modo controllato una chiamata a un agente o connettore e la trasmissione progressiva di una risposta dopo l'ammissione del turno. Durante ciascun blocco osservare le transazioni dell'archivio e tentare una scrittura SQLite indipendente.

#### Details
La prova passa se nessuna transazione del turno resta aperta durante l'attesa della chiamata esterna o l'invio progressivo e la scrittura indipendente può completarsi. Fallisce se una transazione del turno copre l'attesa o lo streaming, oppure impedisce la scrittura indipendente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * verify: [Transazioni brevi dell'archivio conversazioni](../Requirements/FamilyConversation.md#transazioni-brevi-dellarchivio-conversazioni)
---

### Prova delle transizioni atomiche del turno

Forzare un errore dopo la prima scrittura dell'ammissione, della conclusione e dell'interruzione; ripetere senza errore e osservare turno, occupazione della conversazione interessata ed esito restituito. Nel percorso HTTP ritardare e poi far fallire il commit del completamento dopo l'ultimo frammento generato.

#### Details
La prova passa se un errore non lascia transizioni parziali e il chiamante non riceve un successo; nei casi riusciti turno e occupazione cambiano insieme dopo il commit. La conferma di successo UI è emessa soltanto dopo il commit riuscito, senza equiparare la conclusione del modello alla conservazione dell'esito. Con commit fallito non arriva la conferma e si applica l'indisponibilità degli ingressi prevista dal prodotto. Fallisce se l'occupazione viene liberata prematuramente, se resta uno stato parziale o se un callback SDK conferma un esito non conservato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della concorrenza dei turni](#verifica-della-concorrenza-dei-turni)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [sqlite-conversation-write.test.ts](../../packages/conversations/test/adapters/out/sqlite-conversation-write.test.ts)
  * verify: [Scritture atomiche dello stato dei turni](../Requirements/FamilyConversation.md#scritture-atomiche-dello-stato-dei-turni)
---

### Verifica della conversazione testuale

Raggruppa le verifiche della risposta testuale, dello storico degli scambi e della continuazione in chat delle conversazioni iniziate a voce.

#### Metadata
  * type: verification-objective
---

### Analisi della proprietà dei controlli conversazionali

Esaminare il percorso di un turno dall'adapter del canale conversazionale al caso d'uso Application, al Domain e all'archivio SQLite. Confrontare i controlli implementati con i contratti del turno vuoto, della conversazione richiesta, degli stati del turno e dell'ammissione concorrente; osservare anche dove il flusso si arresta dopo ciascun rifiuto.

#### Details
L'analisi passa se l'adapter ferma forma e decodifica non valide prima del caso d'uso senza contenere regole di stato, Application coordina le precondizioni contestuali e i rifiuti tramite porte senza dipendere dal protocollo, Domain resta l'autorità per stati e transizioni, e SQLite mantiene l'ammissione atomica anche quando esiste un controllo preliminare. Fallisce se un ingresso decide un invariante Domain, se il caso d'uso riceve input non decodificato, se un rifiuto permette effetti successivi, se Domain legge il protocollo o se un controllo preliminare sostituisce la garanzia atomica.

Non automatizzabile: attribuire ogni controllo al livello che ne è autorità richiede giudizio umano.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Precondizioni contestuali nel caso d'uso conversazionale](../Requirements/FamilyConversation.md#precondizioni-contestuali-nel-caso-duso-conversazionale)
  * verify: [Validazione del formato negli ingressi conversazionali](../Requirements/FamilyConversation.md#validazione-del-formato-negli-ingressi-conversazionali)
---

### Controllo dell'archivio SQLite e dell'accesso Kysely

Esaminare l'implementazione dell'archivio delle conversazioni e le dipendenze effettivamente usate per leggerlo e scriverlo.

#### Details
Il controllo passa se lo stato persistente delle conversazioni è in SQLite e le operazioni applicative di lettura e scrittura dell'archivio passano tramite Kysely. Fallisce se è usato un altro archivio per le conversazioni o se un percorso applicativo legge o scrive l'archivio senza Kysely.

Non automatizzabile: stabilire che ogni percorso applicativo dell'archivio passa da Kysely richiede di seguire le chiamate nel codice.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Disponibilità dello storico dopo riavvio](../Requirements/FamilyConversation.md#disponibilità-dello-storico-dopo-riavvio)
---

### Ispezione degli esempi inglesi degli agenti

Esaminare tutti gli esempi distribuiti di generic.ts, orchestrator.ts e agenti specializzati, incluse istruzioni e descrizioni.

#### Details
L'ispezione passa se i testi sono in inglese, generic.ts non prescrive una lingua fissa per la risposta e l'orchestratore è descritto soltanto come selettore dell'agente.

Non automatizzabile: giudicare la lingua dei testi e il ruolo descritto per l'orchestratore richiede la lettura umana.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Esempi degli agenti in inglese](../Requirements/FamilyConversation.md#esempi-degli-agenti-in-inglese)
---

### Prova degli identificativi del turno ammesso

Inviare un turno testuale che crea una conversazione, uno che la continua e un turno audio che crea una conversazione. Acquisire i messaggi nell'ordine di ricezione e confrontare gli identificativi con l'archivio. Ripetere con un rifiuto prima dell'ammissione.

#### Details
La prova passa se `turn.accepted` arriva prima di qualsiasi trasmissione della risposta e contiene `requestId`, `conversationId`, `turnId` e `text` coerenti con l'archivio, anche nella continuazione; per il turno audio `text` è la trascrizione conservata. Gli identificativi restano gli stessi nei messaggi successivi del turno. I rifiuti prima dell'ammissione non producono `turn.accepted` né nuove identità persistenti. Fallisce se l'identità è assente, cambia durante il turno, identifica un altro turno o arriva dopo la risposta. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [session-turns.test.ts](../../apps/server/test/runtime/session-turns.test.ts)
  * verify: [Comunicazione degli identificativi del turno ammesso](../Requirements/FamilyConversation.md#comunicazione-degli-identificativi-del-turno-ammesso)
---

### Prova degli schemi delle richieste HTTP conversazionali

Inviare alle rotte HTTP di elenco e storico richieste valide e rappresentazioni non valide per query e parametri di percorso. Osservare il risultato pubblico e le invocazioni dei casi d'uso.

#### Details
La prova passa se gli schemi TypeBox sono applicati da Fastify/Ajv prima dei gestori, gli oggetti dichiarati rifiutano campi sconosciuti e la validazione non converte tipi, inserisce valori predefiniti né rimuove proprietà. Richieste con dati di forma non validi o conversione impossibile non invocano il caso d'uso; richieste valide lo invocano una volta con i valori previsti. Le risposte di errore mantengono gli stati e i messaggi dei contratti HTTP delle rotte. La prova fallisce se una richiesta invalida viene accettata dopo una modifica implicita o se cambia il comportamento pubblico concordato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [http-history-route.test.ts](../../packages/conversations/test/adapters/in/http-history-route.test.ts)
  * satisfiedBy: [http-list-route.test.ts](../../packages/conversations/test/adapters/in/http-list-route.test.ts)
  * verify: [Validazione strutturale delle richieste conversazionali HTTP](../Requirements/FamilyConversation.md#validazione-strutturale-delle-richieste-conversazionali-http)
---

### Prova del completamento dopo la chiusura della sessione

Avviare un turno la cui risposta sia controllabile e produca almeno un frammento; dopo aver ricevuto il primo frammento, chiudere la sessione del client e lasciare completare l'elaborazione. Aprire una nuova sessione e leggere lo storico tramite HTTP. Ripetere con un guasto controllato che produca un errore dopo il primo frammento e con risposta in audio.

#### Details
La prova passa se, in tutti i casi, il backend prosegue l'elaborazione dopo la chiusura senza dipendere dalla consegna alla sessione chiusa e conserva un solo scambio per il turno ammesso nella conversazione corretta. Nel caso riuscito lo scambio contiene l'intera risposta; nel caso di errore contiene l'esito di errore e il messaggio pubblico, senza trattare i frammenti precedenti come risposta completa. I messaggi non consegnati non vengono ripetuti nella nuova sessione. Fallisce se il turno viene annullato per la sola chiusura, se l'esito manca o resta incompleto, se compare più di uno scambio o se un errore di consegna sostituisce l'esito del turno. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [session-lifecycle.test.ts](../../apps/server/test/runtime/session-lifecycle.test.ts)
  * verify: [Completamento del turno accettato dopo disconnessione](../Requirements/FamilyConversation.md#completamento-del-turno-accettato-dopo-disconnessione)
---

### Prova del fuso orario configurato

Caricare il modulo TypeScript del componente «Conversazioni» senza `timeZone`, con `timeZone` uguale a `Europe/Rome` e, in tentativi separati, con un numero, con una stringa vuota e con `Mars/Olympus`.

#### Details
La prova passa se senza il campo il fuso effettivo è `UTC`, con `Europe/Rome` è `Europe/Rome`, e ciascun valore invalido rende invalida la configurazione con il messaggio `Invalid conversation time zone`. Fallisce se un valore invalido viene accettato o se il fuso effettivo differisce da quello atteso.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversation-config.test.ts](../../packages/conversations/test/adapters/out/conversation-config.test.ts)
  * verify: [Configurazione del fuso orario della conversazione](../Requirements/FamilyConversation.md#configurazione-del-fuso-orario-della-conversazione)
---

### Prova del rifiuto del turno testuale vuoto

Inviare un turno testuale con testo vuoto e uno composto solo da spazi bianchi, sia per una nuova conversazione sia per una conversazione esistente. Ripetere con testo vuoto e un `conversationId` inesistente. Confrontare lo stato dell'archivio prima e dopo ogni turno.

#### Details
La prova passa se ogni turno riceve la trasmissione del messaggio pubblico e `turn.rejected` con `reason: "invalid"`, senza `turn.accepted`, senza creare una conversazione né aggiungere uno scambio. Il caso con identificativo inesistente riceve comunque `invalid` per la precedenza della verifica del testo. Fallisce se il turno viene ammesso, se il motivo è diverso o se l'archivio cambia. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [session-rejections.test.ts](../../apps/server/test/runtime/session-rejections.test.ts)
  * verify: [Rifiuto del turno testuale vuoto](../Requirements/FamilyConversation.md#rifiuto-del-turno-testuale-vuoto)
---

### Prova del tempo massimo della produzione della risposta

Con il caso d'uso del turno, una porta di temporizzazione controllata e un produttore controllato che consegna un frammento e poi resta in attesa senza mai concludersi né reagire all'annullamento, eseguire un turno e far scadere il tempo; ripetere con un produttore che reagisce alla richiesta di annullamento terminando con un errore, con uno che conclude prima della scadenza e con un turno interrotto prima della scadenza. Con l'adapter di sistema della temporizzazione, verificare scadenza e cancellazione con il timer reale. Con l'adapter AI SDK e modelli e client MCP controllati, verificare che la richiesta di annullamento raggiunga la richiesta dell'orchestratore, quella dell'agente e l'invocazione dello strumento MCP.

#### Details
La prova passa se il caso d'uso chiede alla porta una scadenza di 30 secondi; se, alla scadenza, la richiesta di annullamento consegnata al produttore risulta risolta, il caso d'uso conclude il turno senza attendere il produttore bloccato con l'esito di errore e il messaggio pubblico, porta una causa tecnica di superamento del tempo massimo e non conserva una risposta parziale, rilasciando la conversazione tramite il completamento con errore; se un produttore concluso prima della scadenza non vede la richiesta risolta e la scadenza viene cancellata; se il turno interrotto resta `interrotto`; se l'adapter di sistema compie la scadenza dopo la durata indicata e non la compie dopo la cancellazione; e se l'adapter AI SDK annulla le richieste dei modelli e l'invocazione MCP quando la richiesta si risolve. Fallisce se il turno resta in elaborazione, se la conversazione rimane occupata, se l'annullamento non viene propagato, se la risposta parziale viene conservata come risposta o se Domain o Application usano API non ECMAScript.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [ai-sdk-reply.test.ts](../../packages/conversations/test/adapters/out/ai-sdk-reply.test.ts)
  * satisfiedBy: [mcp-tool-client.test.ts](../../packages/conversations/test/adapters/out/mcp-tool-client.test.ts)
  * satisfiedBy: [turn-capabilities.test.ts](../../packages/conversations/test/adapters/out/turn-capabilities.test.ts)
  * satisfiedBy: [exchange-turn.test.ts](../../packages/conversations/test/application/exchange-turn.test.ts)
  * verify: [Tempo massimo della produzione della risposta](../Requirements/FamilyConversation.md#tempo-massimo-della-produzione-della-risposta)
---

### Prova dell'agente specializzato senza connettore MCP

Preparare la directory degli agenti con l'orchestratore, un agente con `mcp` e un agente `generic` con soli `description`, `instructions` e `llm`. Con un modello controllato, far scegliere all'orchestratore l'agente `generic` ed eseguire il turno; eseguire anche un turno sul canale conversazionale avviato con il solo agente senza MCP.

#### Details
La prova passa se l'agente senza MCP viene attivato senza aprire connessioni MCP, se la richiesta al suo modello usa le sue istruzioni con l'indicazione del formato della risposta e lo storico della conversazione senza offrire strumenti, e se il testo e `expectsReply` prodotti dall'agente sono la risposta del turno, comunicata e conservata. Fallisce se l'agente senza MCP non viene attivato, se vengono aperte connessioni o offerti strumenti, o se la risposta non proviene dal suo modello.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [agents.test.ts](../../apps/server/test/composition/agents.test.ts)
  * satisfiedBy: [config-bootstrap.test.ts](../../apps/server/test/runtime/config-bootstrap.test.ts)
  * satisfiedBy: [ai-sdk-reply.test.ts](../../packages/conversations/test/adapters/out/ai-sdk-reply.test.ts)
  * verify: [Agente specializzato senza connettore MCP](../Requirements/FamilyConversation.md#agente-specializzato-senza-connettore-mcp)
---

### Prova dell'arresto per input conversazionale non valido

Inviare al canale conversazionale un JSON malformato, un `input.start` ben formato con tipi errati o campi aggiuntivi e un `input.chunk` con `text` non stringa. Strumentare il caso d'uso e l'archivio per osservare eventuali chiamate ed effetti. Verificare che lo schema `protocol/ambrogio-v1.schema.json` descriva i messaggi di entrambe le direzioni.

#### Details
La prova passa se l'adapter rifiuta ciascun messaggio al proprio confine con `session.error` prima di invocare il caso d'uso, senza creare conversazioni o turni né tentare scritture, e se la validazione segue lo schema senza coercizione dei tipi, valori predefiniti o rimozione dei campi. I messaggi inviati dal server nelle prove del protocollo sono conformi allo schema. Fallisce se un input non decodificato arriva ad Application, se il rifiuto avviene soltanto nel Domain o nell'archivio, se resta un effetto persistente o se lo schema manca o non corrisponde ai messaggi scambiati. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [ambrogio-v1-schema.test.ts](../../apps/server/test/protocol/ambrogio-v1-schema.test.ts)
  * satisfiedBy: [session-opening.test.ts](../../apps/server/test/runtime/session-opening.test.ts)
  * verify: [Validazione del formato negli ingressi conversazionali](../Requirements/FamilyConversation.md#validazione-del-formato-negli-ingressi-conversazionali)
---

### Prova dell'errore dopo l'ammissione

Avviare un turno in una conversazione conservata con un produttore che emette un frammento e poi fallisce con dettagli diagnostici riconoscibili, prima con risposta in testo e poi in audio. Acquisire i messaggi della sessione e riaprire lo storico.

#### Details
La prova passa se il server chiude la trasmissione in corso con `output.end`, apre una nuova trasmissione con il messaggio pubblico sicuro nel tipo di contenuto richiesto e conclude con `turn.failed` con lo stesso `message`, senza `turn.completed`; lo storico contiene l'esito di errore con quel messaggio, senza conservare il frammento come risposta completata. Fallisce se manca la trasmissione del messaggio di errore, se viene inviata una conferma di completamento, se le due trasmissioni si sovrappongono, se sono esposti dettagli tecnici o se lo storico conserva una risposta riuscita. Il guasto di commit è verificato separatamente dalla prova delle transizioni atomiche. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [session-lifecycle.test.ts](../../apps/server/test/runtime/session-lifecycle.test.ts)
  * verify: [Conservazione dell'errore dopo risposta parziale](../Requirements/FamilyConversation.md#conservazione-dellerrore-dopo-risposta-parziale)
  * verify: [Segnalazione dell'errore dopo l'ammissione](../Requirements/FamilyConversation.md#segnalazione-dellerrore-dopo-lammissione)
---

### Prova dell'ingresso dei turni con agenti configurati

Avviare il processo con i moduli TypeScript HTTP, Conversazioni, orchestratore e almeno un agente specializzato validi, usando un provider e un connettore MCP controllati. Aprire una sessione su `/api/session`, inviare un turno e leggere trasmissioni, esito e storico; richiedere anche i due GET. Ripetere con un modulo agente invalido e con un connettore non disponibile prima dell'ascolto.

#### Details
La prova passa se l'avvio valido espone il canale conversazionale e i GET, il turno usa il produttore orchestratore e produce trasmissioni, esito e storico previsti; l'avvio invalido non apre il listener e chiude le risorse già preparate. Le risposte GET conservano gli header di sicurezza, `Cache-Control: no-store` e l'identificativo di correlazione. Fallisce se il canale manca, usa un produttore diverso, espone dettagli segreti o lascia risorse aperte. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [config-bootstrap.test.ts](../../apps/server/test/runtime/config-bootstrap.test.ts)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * verify: [Avvio dell'ingresso dei turni conversazionali](../Requirements/FamilyConversation.md#avvio-dellingresso-dei-turni-conversazionali)
---

### Prova della configurazione dell'adapter AI SDK

Avviare l'ingresso conversazionale con un agente il cui oggetto `llm` indica `provider: "mistral"`, modello e chiave API ma nessun URL. Provare opzioni assenti e opzioni `temperature` e `max_tokens` valide; ripetere con modello o chiave mancanti, opzione sconosciuta e valori invalidi. Con provider e stream controllati, osservare i parametri inviati e la conversione di frammenti testuali e indicazione `expectsReply` alla porta applicativa, per turni testuali e vocali. Ripetere la richiesta controllata per ciascun altro provider ammesso, `openai`, `anthropic`, `google` e `openai-compatible` con un `baseURL` d'esempio, osservando indirizzo, credenziale e corpo della richiesta.

#### Details
La prova passa se l'adapter usa il pacchetto AI SDK del provider indicato, l'endpoint predefinito del provider senza URL nella configurazione e, con `openai-compatible`, l'endpoint derivato da `baseURL` con lo schema JSON della risposta in `response_format` di tipo `json_schema`; se la chiave API raggiunge soltanto quell'endpoint nell'intestazione prevista dal provider; se trasmette solo le opzioni configurate e validate e fornisce, con un unico percorso di generazione, gli stessi frammenti e la stessa indicazione strutturata della replica attesa per qualsiasi tipo di contenuto del turno tramite `ProduceConversationReply`. Configurazioni invalide impediscono l'attivazione prima delle richieste; i tipi dell'SDK non attraversano la porta Application. Fallisce se una configurazione invalida raggiunge il provider, se le opzioni assenti vengono forzate, se una richiesta raggiunge un provider diverso da quello configurato o se esistono percorsi di generazione distinti per testo e voce. La prova usa risposte controllate: non dimostra che un modello reale di ciascun provider supporti tool calling e output strutturato.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [api-credentials.test.ts](../../apps/server/test/composition/api-credentials.test.ts)
  * satisfiedBy: [ai-sdk-reply.test.ts](../../packages/conversations/test/adapters/out/ai-sdk-reply.test.ts)
  * verify: [Risposta testuale nella conversazione](../Requirements/FamilyConversation.md#risposta-testuale-nella-conversazione)
  * verify: [Validazione preventiva della configurazione attiva](../Requirements/ServerFoundation.md#validazione-preventiva-della-configurazione-attiva)
---

### Prova della conservazione del testo originale

Inviare tramite chat un turno valido con spazi iniziali, finali e interni e, quando la voce è abilitata, simulare una trascrizione valida con gli stessi caratteri. Consultare poi lo storico di ciascuna conversazione. Verificare separatamente il rifiuto già previsto per un input composto solo da spazi nei rispettivi ingressi che lo definiscono.

#### Details
La prova passa se ogni turno accettato compare nello storico con il testo identico a quello ricevuto, inclusi spazi iniziali, finali e interni, mentre la verifica di vuotezza non altera il testo. Fallisce se il testo accettato viene tagliato o normalizzato implicitamente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversations.test.ts](../../apps/server/test/composition/conversations.test.ts)
  * verify: [Conservazione del testo originale del turno](../Requirements/FamilyConversation.md#conservazione-del-testo-originale-del-turno)
---

### Prova della continuazione con identificativo inesistente

Registrare le conversazioni conservate, poi inviare un turno testuale valido e un turno audio trascrivibile con un `conversationId` che non corrisponde ad alcuna di esse. Confrontare lo stato dell'archivio prima e dopo i tentativi.

#### Details
La prova passa se entrambi i turni ricevono la trasmissione del messaggio pubblico e `turn.rejected` con `reason: "conversation_not_found"`, senza `turn.accepted`, e se non viene creata alcuna nuova conversazione. Fallisce se viene creata una conversazione sostitutiva, se il motivo è diverso o se sono esposti dettagli tecnici. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [session-rejections.test.ts](../../apps/server/test/runtime/session-rejections.test.ts)
  * verify: [Precondizioni contestuali nel caso d'uso conversazionale](../Requirements/FamilyConversation.md#precondizioni-contestuali-nel-caso-duso-conversazionale)
  * verify: [Rifiuto della continuazione con conversazione inesistente](../Requirements/FamilyConversation.md#rifiuto-della-continuazione-con-conversazione-inesistente)
---

### Prova della continuazione delle conversazioni da qualunque client

Creare e conservare separatamente una conversazione con un turno testuale e una con un turno audio, ciascuna con scambi distintivi, da due client diversi. Continuare ciascuna conversazione sia con un turno testuale sia con un turno audio, inviando il solo identificativo della conversazione senza gli scambi precedenti. Osservare l'accesso del backend all'archivio e il contesto usato per elaborare il turno.

#### Details
La prova passa se, per ogni origine e per ogni tipo di contenuto, il backend recupera dall'archivio lo storico della conversazione identificata, lo usa per elaborare il nuovo turno e aggiunge lo scambio alla medesima conversazione mantenendo identificativo e ordine. Un turno senza identificativo crea invece una conversazione distinta. Fallisce se il backend dipende dallo storico inviato dal client, recupera lo storico di un'altra conversazione, crea una copia o una nuova conversazione per il turno aggiunto, o rifiuta la continuazione per il solo tipo di contenuto. Verifica definita per il protocollo `ambrogio.v1`.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [session-turns.test.ts](../../apps/server/test/runtime/session-turns.test.ts)
  * verify: [Continuazione di ogni conversazione da qualunque client](../Requirements/FamilyConversation.md#continuazione-di-ogni-conversazione-da-qualunque-client)
  * verify: [Recupero dello storico per il turno](../Requirements/FamilyConversation.md#recupero-dello-storico-per-il-turno)
---

### Prova della continuità dell'agente nella conversazione

Con un orchestratore controllato, eseguire in una conversazione un turno risposto dall'agente `home`, poi un secondo turno, e osservare il contesto ricevuto dall'orchestratore e dagli agenti nel secondo turno. Con il caso d'uso del turno e produttori controllati, consegnare l'identificativo dell'agente prima del testo e, in tentativi separati, ripeterlo, consegnarlo vuoto o dopo un frammento testuale. Con un archivio SQLite di prova, conservare e rileggere un turno con agente e uno senza, e aprire un archivio creato con le migrazioni precedenti contenente turni conclusi. Leggere lo storico tramite il caso d'uso di consultazione e il GET HTTP e osservare i messaggi del protocollo `ambrogio.v1` del turno.

#### Details
La prova passa se nel secondo turno la risposta precedente compare nel contesto dell'orchestratore preceduta da `[agent: home]` mentre gli agenti specializzati ricevono la stessa risposta senza indicazione; se l'identificativo consegnato correttamente è incluso nell'esito con risposta e conservato e riletto nel turno, mentre le consegne invalide producono un guasto della produzione; se la migrazione `007_turn_agent` aggiunge la colonna lasciando leggibili i turni preesistenti con agente sconosciuto, presentati all'orchestratore senza indicazione; se un agente non nullo su un turno non concluso con risposta è rifiutato come dato invalido; e se l'agente non compare nello storico Application di consultazione, nel GET HTTP né nei messaggi del protocollo. Fallisce se l'agente si perde, viene attribuito a un altro turno, raggiunge gli agenti specializzati o i client, o se i turni preesistenti diventano illeggibili.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [ai-sdk-reply.test.ts](../../packages/conversations/test/adapters/out/ai-sdk-reply.test.ts)
  * satisfiedBy: [sqlite-history.test.ts](../../packages/conversations/test/adapters/out/sqlite-history.test.ts)
  * satisfiedBy: [exchange-turn.test.ts](../../packages/conversations/test/application/exchange-turn.test.ts)
  * satisfiedBy: [turn.test.ts](../../packages/conversations/test/domain/turn.test.ts)
  * verify: [Continuità dell'agente nella conversazione](../Requirements/FamilyConversation.md#continuità-dellagente-nella-conversazione)
---

### Prova della continuità dopo un guasto di consegna

Ammettere un turno con risposta controllata in più frammenti e far fallire con un guasto tecnico la consegna della notifica di ammissione oppure di un frammento. Osservare la produzione della risposta, l'esito restituito dal caso d'uso e lo scambio conservato.

#### Details
La prova passa se in entrambi i casi la produzione prosegue fino al proprio esito, il turno conserva la risposta completa se la produzione riesce e il solo guasto di consegna non crea uno scambio di errore. Fallisce se il caso d'uso interrompe la produzione, perde un frammento nella risposta conservata o attribuisce al turno un errore causato soltanto dalla consegna.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
  * satisfiedBy: [exchange-turn.test.ts](../../packages/conversations/test/application/exchange-turn.test.ts)
  * verify: [Continuità del turno dopo un guasto di consegna](../Requirements/FamilyConversation.md#continuità-del-turno-dopo-un-guasto-di-consegna)
---

### Prova della data corrente per gli agenti

Con un orologio controllato fissato su un istante noto, preparare un agente specializzato con connettore MCP che ha un prompt del server, un agente senza connettore e un orchestratore, tutti con modelli controllati che registrano le istruzioni di sistema ricevute. Elaborare un turno per ciascun agente con fuso `Europe/Rome` e con fuso `UTC`, poi un secondo turno dopo aver spostato l'orologio di un giorno.

#### Details
La prova passa se entrambi gli agenti specializzati ricevono, subito dopo le proprie istruzioni e prima delle istruzioni del server e delle indicazioni sul formato, la riga `Current date and time: <data e ora> (<fuso>).` con giorno della settimana, data e ora corrette nel fuso indicato, per esempio con l'istante `2026-10-19T07:41:00Z` la riga `Current date and time: Monday, 19 October 2026 at 09:41 (Europe/Rome).` e con `UTC` l'ora `07:41`; il secondo turno riporta il giorno successivo; le istruzioni dell'orchestratore non contengono la riga. Fallisce se la data, il giorno della settimana, l'ora o il fuso sono errati, se la riga manca o è in un'altra posizione, o se resta quella del turno precedente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [agents.test.ts](../../apps/server/test/composition/agents.test.ts)
  * satisfiedBy: [ai-sdk-reply.test.ts](../../packages/conversations/test/adapters/out/ai-sdk-reply.test.ts)
  * verify: [Data e ora correnti per gli agenti specializzati](../Requirements/FamilyConversation.md#data-e-ora-correnti-per-gli-agenti-specializzati)
---

### Prova della descrizione degli agenti specializzati

Preparare l'orchestratore e due agenti specializzati con identificativi e `description` differenti; ripetere con `description` assente, vuota o non testuale in un file specializzato.

#### Details
La prova passa se l'orchestratore riceve per ciascun agente attivo solo identificativo e descrizione nell'elenco aggiunto alle sue istruzioni e gli identificativi come valori ammessi della risposta strutturata, senza istruzioni o credenziali dell'agente, e se un file specializzato senza descrizione valida impedisce l'attivazione. Fallisce se la scelta usa le istruzioni private, se manca un agente valido o se viene attivato un agente privo di descrizione valida.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [agents.test.ts](../../apps/server/test/composition/agents.test.ts)
  * satisfiedBy: [agent-config.test.ts](../../apps/server/test/runtime/agent-config.test.ts)
  * verify: [Descrizione degli agenti specializzati per l'orchestrazione](../Requirements/FamilyConversation.md#descrizione-degli-agenti-specializzati-per-lorchestrazione)
---

### Prova della diagnostica del guasto di consegna

Con l'ingresso conversazionale attivo, provocare separatamente una normale disconnessione del client e un guasto tecnico inatteso nella consegna di una notifica; acquisire gli eventi diagnostici del server e lo storico del turno.

#### Details
La prova passa se il guasto tecnico inatteso è registrato dal componente tecnico che lo gestisce nel canale diagnostico, senza dettagli tecnici nel messaggio pubblico e senza cambiare l'esito conversazionale conservato. La sola disconnessione non produce un log di errore per il turno. Fallisce se il guasto tecnico sparisce senza diagnostica, se il caso d'uso registra direttamente il log, se la disconnessione è trattata come errore del turno o se l'errore diagnostico entra nello storico.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
  * verify: [Diagnostica del guasto tecnico di consegna](../Requirements/FamilyConversation.md#diagnostica-del-guasto-tecnico-di-consegna)
---

### Prova della diagnostica del guasto nella risposta

Con un logger di prova, far fallire la produzione della risposta di un turno ammesso con un errore che contiene marcatori tecnici, poi con una risposta priva di `expectsReply` e con una lettura dello storico non riuscita; acquisire gli eventi diagnostici, i messaggi inviati al client e lo storico.

#### Details
La prova passa se per ogni guasto esiste un solo evento `conversation_reply_failed` emesso dall'adapter del canale, con `err` che conserva la causa originale e con i soli campi selezionati, mentre `turn.failed`, la trasmissione dell'errore e lo storico contengono soltanto il messaggio pubblico. Fallisce se il guasto resta senza diagnostica, se viene registrato più volte o dal caso d'uso, o se un marcatore tecnico raggiunge il client o lo storico.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversation-session.test.ts](../../packages/conversations/test/adapters/in/conversation-session.test.ts)
  * satisfiedBy: [exchange-turn.test.ts](../../packages/conversations/test/application/exchange-turn.test.ts)
  * verify: [Diagnostica del guasto nella produzione della risposta](../Requirements/FamilyConversation.md#diagnostica-del-guasto-nella-produzione-della-risposta)
---

### Prova della disponibilità dello storico dopo riavvio

Creare una conversazione con più scambi testuali, riavviare l'installazione e recuperare la stessa conversazione.

#### Details
La prova passa se, dopo il riavvio, la famiglia può recuperare la conversazione con lo stesso identificativo e tutti gli scambi precedenti nello stesso ordine, con testo del turno, tipo di esito e testo dell'esito invariati. Fallisce se la conversazione o uno scambio manca o cambia contenuto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * verify: [Disponibilità dello storico dopo riavvio](../Requirements/FamilyConversation.md#disponibilità-dello-storico-dopo-riavvio)
---

### Prova della lettura HTTP dello storico conversazionale

Leggere via GET una conversazione con turni conclusi con risposta ed errore, un turno in elaborazione e un turno interrotto. Ripetere la lettura dopo la conclusione del turno in elaborazione e verificare anche conversazione assente e guasto tecnico dell'archivio.

#### Details
La prova passa se la risposta `200` è JSON senza cache, conserva identità, testi, ordine e istanti ISO 8601 UTC e presenta solo i campi di esito pertinenti a ciascuno stato. La seconda lettura presenta l'esito persistente del turno prima in elaborazione senza duplicarlo; la lettura non usa SSE né recupera frammenti parziali. La conversazione assente restituisce `404` e il guasto tecnico `500`, entrambi con un messaggio pubblico sicuro tradotto e senza dettagli tecnici. Fallisce se uno stato o un testo è alterato, se un frammento parziale compare nello storico o se un guasto espone dettagli interni.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversations.test.ts](../../apps/server/test/composition/conversations.test.ts)
  * satisfiedBy: [http-history-route.test.ts](../../packages/conversations/test/adapters/in/http-history-route.test.ts)
  * verify: [Lettura HTTP dello storico conversazionale](../Requirements/FamilyConversation.md#lettura-http-dello-storico-conversazionale)
---

### Prova della lingua nelle istruzioni degli agenti

Con modelli controllati che registrano le richieste inviate al fornitore, preparare un agente specializzato senza MCP, uno con MCP e l'orchestratore; ripetere con lingua italiana e inglese e confrontare le istruzioni di sistema inviate a ciascun modello.

#### Details
La prova passa se ogni specialista, con e senza MCP, riceve la direttiva della lingua effettiva, «Answer in Italian.» oppure «Answer in English.», e se l'orchestratore non riceve alcuna direttiva di lingua e riceve istruzioni identiche nelle due lingue. Fallisce se uno specialista non riceve la direttiva della lingua configurata o ne riceve un'altra, oppure se le istruzioni dell'orchestratore contengono una direttiva di lingua o cambiano con la lingua.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [agents.test.ts](../../apps/server/test/composition/agents.test.ts)
  * verify: [Lingua configurata nelle risposte degli agenti](../Requirements/FamilyConversation.md#lingua-configurata-nelle-risposte-degli-agenti)
---

### Prova della ricerca delle configurazioni degli agenti

Preparare in `/etc/ambrogio/agents` `orchestrator.ts`, `memory.ts` e `home-assistant.ts` con valori distinguibili. Per la prova isolata usare un filesystem controllato che rappresenti lo stesso percorso visto dal processo. Osservare i file scoperti e le associazioni; verificare separatamente nomi di file con identificativo invalido, come `Home.ts` e `home_assistant.ts`, e l'assenza di `orchestrator.ts`.

#### Details
La prova passa se il server cerca nel percorso previsto, riconosce `orchestrator.ts` come orchestratore e ricava `memory` e `home-assistant` dai rispettivi file. Nomi che non rispettano `^[a-z][a-z0-9-]*$` non identificano agenti specializzati. Senza `orchestrator.ts` l'orchestratore non viene attivato e l'avvio interessato segnala l'errore secondo il contratto di configurazione. Fallisce se un file è associato all'agente sbagliato o se un nome invalido è accettato come identificativo.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [agent-config.test.ts](../../apps/server/test/runtime/agent-config.test.ts)
  * verify: [Scoperta delle configurazioni degli agenti](../Requirements/FamilyConversation.md#scoperta-delle-configurazioni-degli-agenti)
---

### Prova della risposta e dello storico testuale

Eseguire una conversazione con un turno che produce una risposta e uno che produce un errore controllato; riaprire lo storico.

#### Details
La prova passa se ogni turno riceve l'esito testuale nella conversazione corretta e lo storico conserva nell'ordine due scambi, ciascuno con testo del turno, tipo di esito e testo dell'esito. Fallisce se un testo manca, il tipo di esito è errato, l'ordine cambia o uno scambio compare in un'altra conversazione.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [sqlite-history.test.ts](../../packages/conversations/test/adapters/out/sqlite-history.test.ts)
  * verify: [Conservazione dello scambio testuale](../Requirements/FamilyConversation.md#conservazione-dello-scambio-testuale)
  * verify: [Risposta testuale nella conversazione](../Requirements/FamilyConversation.md#risposta-testuale-nella-conversazione)
---

### Prova della scelta dell'agente da parte dell'orchestratore

Con un orchestratore controllato e due agenti specializzati controllati, eseguire un turno in cui l'orchestratore sceglie uno dei due agenti tramite la risposta strutturata. Ripetere con un'uscita che contiene un identificativo sconosciuto, con un'uscita priva del campo `agent` e con un testo non JSON. Osservare la richiesta all'orchestratore, gli agenti attivati e le parti prodotte; con il canale conversazionale e un provider controllato, consultare anche lo storico del turno.

#### Details
La prova passa se la richiesta all'orchestratore non offre strumenti, dichiara come output strutturato un oggetto con il solo campo `agent` il cui `enum` contiene esattamente gli identificativi degli agenti attivi, contiene nelle istruzioni l'elenco di identificativi e descrizioni; se viene attivato soltanto l'agente scelto, che riceve lo storico con il testo originale del turno senza riformulazioni; se la risposta del turno, compresi `expectsReply` e l'identificativo dell'agente, proviene solo dall'agente scelto e viene comunicata e conservata nella conversazione del turno; e se ogni uscita invalida produce un guasto senza attivare alcun agente. Fallisce se l'orchestratore produce testo della risposta, se viene attivato un agente non scelto o più di un agente, se un'uscita invalida viene accettata o se l'agente riceve un compito riformulato al posto del testo originale.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [ai-sdk-reply.test.ts](../../packages/conversations/test/adapters/out/ai-sdk-reply.test.ts)
  * verify: [Orchestrazione della risposta conversazionale](../Requirements/FamilyConversation.md#orchestrazione-della-risposta-conversazionale)
---

### Prova della selezione del modello per agente

Preparare due modulo TypeScript di agenti attivi, uno per l'orchestratore e uno per un agente specializzato, con oggetti `llm` distinguibili, provider diversi e i campi `provider`, `model`, `apiKey` e `options`; ripetere con un agente `openai-compatible` che indica `baseURL`. Avviare il processo con adapter di prova e osservare i valori consegnati a ciascuno; ripetere con `llm` mancante, con uno dei suoi campi richiesti invalido, con un `provider` non ammesso, con `openai-compatible` senza `baseURL` o con un `baseURL` che non è un URL HTTP o HTTPS assoluto, con `baseURL` per un altro provider e con opzioni specifiche non valide.

#### Details
La prova passa se ciascun agente usa soltanto provider, modello, chiave, `baseURL` quando previsto e opzioni validate del proprio oggetto `llm`, ogni valore ammesso di `provider` viene accettato e il processo non attiva un agente con configurazione necessaria mancante o invalida. I moduli possono leggere le variabili d'ambiente. Fallisce se i valori si mescolano tra agenti, se un provider non ammesso o un `baseURL` mancante, invalido o superfluo vengono accettati o se una configurazione invalida raggiunge l'adapter.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [agents.test.ts](../../apps/server/test/composition/agents.test.ts)
  * satisfiedBy: [agent-config.test.ts](../../apps/server/test/runtime/agent-config.test.ts)
  * verify: [Configurazione del modello per agente](../Requirements/FamilyConversation.md#configurazione-del-modello-per-agente)
---

### Prova delle istruzioni per agente

Preparare due moduli TypeScript locali dell'utente con istruzioni riconoscibili e diverse, uno per l'orchestratore e uno per un agente specializzato. Attivare entrambi con modelli di prova e osservare le istruzioni consegnate a ciascuno durante un turno delegato; modificare poi le istruzioni di uno solo dei file e ripetere.

#### Details
La prova passa se ogni modello riceve le istruzioni del proprio file e la modifica di un file cambia soltanto le istruzioni dell'agente corrispondente. Fallisce se le istruzioni sono scambiate, condivise tra agenti o ignorate.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * verify: [Istruzioni dell'agente nel modulo TypeScript dell'utente](../Requirements/FamilyConversation.md#istruzioni-dellagente-nel-modulo-typescript-dellutente)
---

### Verifica della risorsa SQLite conversazionale

Raggruppa le verifiche sulla proprietà, preparazione e chiusura della risorsa SQLite/Kysely nei processi che usano l'archivio.

#### Metadata
  * type: verification-objective
---

### Controllo del proprietario della risorsa SQLite

Esaminare le composition root dei processi che usano l'archivio, gli adapter che vi accedono e le firme Domain e Application.

#### Details
Il controllo passa se ogni processo ha un solo proprietario della risorsa SQLite/Kysely per l'archivio delle conversazioni, gli adapter ricevono solo l'accesso necessario senza possedere la chiusura e Domain/Application non espongono handle SQLite o Kysely. Fallisce se ciascun adapter crea o chiude la propria risorsa, se più proprietari indipendenti sono creati per lo stesso archivio nello stesso processo o se il core dipende da handle tecnici.

Non automatizzabile: individuare il proprietario della risorsa e la responsabilità della chiusura richiede di leggere composition root e adapter.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della risorsa SQLite conversazionale](#verifica-della-risorsa-sqlite-conversazionale)
  * verify: [Proprietà della risorsa SQLite conversazionale](../Requirements/FamilyConversation.md#proprietà-della-risorsa-sqlite-conversazionale)
---

### Prova della chiusura della risorsa SQLite

Avviare il server con un archivio di prova, osservando l'apertura, le migrazioni e la chiusura della risorsa. Ripetere con un guasto controllato dopo la creazione della risorsa ma prima dell'attivazione degli ingressi e con un errore durante l’esecuzione del server.

#### Details
La prova passa se l'archivio è preparato prima degli ingressi, ogni risorsa creata viene chiusa una sola volta dal suo proprietario dopo le operazioni che la usano e la chiusura avviene anche dopo avvio fallito o errore durante l’esecuzione. Fallisce se il processo accetta turni prima della preparazione, lascia aperta una risorsa dopo un errore o la chiude mentre una transizione del turno ne ha ancora bisogno.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della risorsa SQLite conversazionale](#verifica-della-risorsa-sqlite-conversazionale)
  * satisfiedBy: [conversation-resource-lifecycle.test.ts](../../apps/server/test/runtime/conversation-resource-lifecycle.test.ts)
  * satisfiedBy: [sqlite-archive-startup.test.ts](../../packages/conversations/test/adapters/out/sqlite-archive-startup.test.ts)
  * verify: [Chiusura della risorsa SQLite conversazionale](../Requirements/FamilyConversation.md#chiusura-della-risorsa-sqlite-conversazionale)
---

### Verifica delle conversioni di persistenza

Raggruppa le verifiche del confine tra righe SQLite e valori Domain o proiezioni Application della conversazione.

#### Metadata
  * type: verification-objective
---

### Controllo del confine di conversione dell'archivio

Esaminare gli adapter SQLite/Kysely, i contratti Application di scrittura e lettura e i tipi esposti a Domain e Application.

#### Details
Il controllo passa se ogni percorso di scrittura e lettura traduce esplicitamente le rappresentazioni delle righe nei valori del contratto pertinente e nessuna firma Domain o Application espone righe, tipi o handle Kysely. Fallisce se righe del database sono usate direttamente come modelli Domain o proiezioni Application, oppure se la conversione è demandata a un ingresso HTTP.

Non automatizzabile: riconoscere dove le righe sono tradotte nei valori del contratto richiede di leggere gli adapter.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica delle conversioni di persistenza](#verifica-delle-conversioni-di-persistenza)
  * verify: [Conversione esplicita dei dati conversazionali persistenti](../Requirements/FamilyConversation.md#conversione-esplicita-dei-dati-conversazionali-persistenti)
---

### Prova della conversione temporale SQLite

Con un archivio SQLite reale, salvare e rileggere turni e ultime attività con istanti `Date` prima e dopo l'epoca Unix, compreso un valore con millisecondi non nulli. Ispezionare i valori grezzi delle colonne e ripetere la lettura con valori persistenti invalidi quando lo schema consente di prepararli.

#### Details
La prova passa se le colonne contengono interi pari ai rispettivi `getTime()`, la ricostruzione restituisce `Date` validi con gli stessi millisecondi e valori assenti, non interi, di tipo incompatibile o fuori dall'intervallo rappresentabile non diventano istanti validi né sono corretti silenziosamente. Fallisce se le conversioni arrotondano, applicano un fuso orario, usano l'ora corrente al caricamento o accettano dati temporali invalidi.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica delle conversioni di persistenza](#verifica-delle-conversioni-di-persistenza)
  * satisfiedBy: [sqlite-history.test.ts](../../packages/conversations/test/adapters/out/sqlite-history.test.ts)
  * satisfiedBy: [sqlite-turn-mapper.test.ts](../../packages/conversations/test/adapters/out/sqlite-turn-mapper.test.ts)
  * verify: [Persistenza degli istanti conversazionali in millisecondi Unix](../Requirements/FamilyConversation.md#persistenza-degli-istanti-conversazionali-in-millisecondi-unix)
---

### Prova della fedeltà delle conversioni dell'archivio

Con un archivio SQLite di prova, conservare turni con identificativi, ordine, testo con spazi significativi e stati o esiti distinti; recuperare la conversazione e le proiezioni di storico ed elenco. Ripetere con un dato persistente incompatibile con il contratto corrente, preparato direttamente nell'archivio di prova.

#### Details
La prova passa se i valori recuperati preservano identità, ordine, testo originale, stato ed esito attesi e se un dato incompatibile produce un guasto osservabile invece di una correzione silenziosa. Fallisce se una conversione perde o altera distinzioni semantiche oppure presenta dati incompatibili come validi.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica delle conversioni di persistenza](#verifica-delle-conversioni-di-persistenza)
  * satisfiedBy: [sqlite-history.test.ts](../../packages/conversations/test/adapters/out/sqlite-history.test.ts)
  * satisfiedBy: [sqlite-turn-mapper.test.ts](../../packages/conversations/test/adapters/out/sqlite-turn-mapper.test.ts)
  * verify: [Conversione esplicita dei dati conversazionali persistenti](../Requirements/FamilyConversation.md#conversione-esplicita-dei-dati-conversazionali-persistenti)
---

### Verifica delle identità conversazionali

Raggruppa le verifiche della generazione, persistenza e esposizione degli identificativi di conversazioni e turni.

#### Metadata
  * type: verification-objective
---

### Controllo della generazione degli identificativi

Esaminare i casi d'uso Application che creano conversazioni o turni, la porta di generazione, la composition root, Domain e l'adapter SQLite.

#### Details
Il controllo passa se Application ottiene i nuovi valori dal generatore fornito dalla composition root e li passa al Domain prima della creazione dello stato, mentre Domain e persistenza non generano nuovi identificativi. Fallisce se Domain invoca una fonte ambientale di UUID, se l'adapter assegna l'identità iniziale o se il caso d'uso crea lo stato prima di conoscere l'identificativo.

Non automatizzabile: seguire l'origine degli identificativi dal generatore al Domain richiede di leggere casi d'uso e adapter.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica delle identità conversazionali](#verifica-delle-identità-conversazionali)
  * verify: [Generazione degli identificativi prima del Domain](../Requirements/FamilyConversation.md#generazione-degli-identificativi-prima-del-domain)
---

### Prova degli UUID v4 conversazionali

Creare conversazioni e turni tramite gli ingressi disponibili del server; leggere i rispettivi identificativi nell'archivio, riavviare e rileggere le stesse conversazioni. Per la chat confrontare il conversationId comunicato dal server con quello conservato. Provare separatamente a persistere due nuovi oggetti con lo stesso identificativo tramite un generatore controllato.

#### Details
La prova passa se ogni nuovo identificativo è un UUID v4, gli identificativi creati sono distinti, rimangono invariati dopo il riavvio e il conversationId pubblico coincide con quello conservato. Un duplicato non sovrascrive l'oggetto esistente. Fallisce se il formato è diverso, un identificativo cambia durante il ciclo di vita, è sostituito dalla persistenza o un duplicato corrompe un oggetto esistente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica delle identità conversazionali](#verifica-delle-identità-conversazionali)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [sqlite-conversation-write.test.ts](../../packages/conversations/test/adapters/out/sqlite-conversation-write.test.ts)
  * verify: [Identificativi UUID v4 di conversazioni e turni](../Requirements/FamilyConversation.md#identificativi-uuid-v4-di-conversazioni-e-turni)
---

### Verifica dello storico e del riavvio

Raggruppa le prove sulla persistenza dei turni, il recupero dopo un'interruzione, le migrazioni dell'archivio e l'elenco paginato delle conversazioni.

#### Metadata
  * type: verification-objective
---

### Controllo dell'orologio applicativo

Esaminare i casi d'uso che assegnano o confrontano istanti conversazionali, la composition root e il codice Domain.

#### Details
Il controllo passa se tali casi d'uso ricevono un orologio dalla composition root e passano al Domain istanti espliciti, mentre Domain non legge l'ora di sistema. Fallisce se Domain invoca direttamente un orologio ambientale o se un adapter di persistenza sostituisce gli istanti decisi dal caso d'uso.

Non automatizzabile: seguire l'origine degli istanti dall'orologio al Domain richiede di leggere casi d'uso, composition root e adapter.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * verify: [Fornitura esplicita dell'ora corrente alla conversazione](../Requirements/FamilyConversation.md#fornitura-esplicita-dellora-corrente-alla-conversazione)
---

### Prova degli istanti di attività conversazionale

Usare un orologio controllato per accettare turni in due conversazioni in istanti noti e poi riaprire l'archivio con un orologio che restituisce un istante successivo. Consultare i turni e l'elenco delle conversazioni.

#### Details
La prova passa se ogni turno e l'ultima attività della sua conversazione usano l'istante fornito all'accettazione, la riapertura non cambia gli istanti storici e l'elenco segue la loro sequenza temporale anziché quella degli UUID. Fallisce se gli istanti sono ricalcolati al caricamento, sono discordanti entro la stessa accettazione o l'ordine deriva dagli identificativi.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * satisfiedBy: [sqlite-conversation-write.test.ts](../../packages/conversations/test/adapters/out/sqlite-conversation-write.test.ts)
  * verify: [Fornitura esplicita dell'ora corrente alla conversazione](../Requirements/FamilyConversation.md#fornitura-esplicita-dellora-corrente-alla-conversazione)
---

### Prova del guasto dello storico dopo ammissione

Ammettere un turno e provocare separatamente un errore di lettura dello storico e uno storico che non contiene il turno ammesso in elaborazione. In entrambi i casi verificare prima che la conclusione con errore riesca, poi che la scrittura dell'esito fallisca. Osservare produzione della risposta, stato persistente, occupazione e disponibilità degli ingressi; riavviare il server dopo il guasto di scrittura.

#### Details
La prova passa se la risposta non viene prodotta, una conclusione riuscita conserva una sola volta «Errore» con messaggio pubblico sicuro e libera l'occupazione, mentre una conclusione non conservata non viene presentata come riuscita e impedisce al server di accettare altri turni fino al riavvio. Ogni nuovo POST del turno testuale durante questo blocco restituisce `503` con JSON `error` contenente «Service temporarily unavailable.» in inglese oppure «Servizio temporaneamente non disponibile.» in italiano, senza ammettere o accodare il turno. Al riavvio un turno ancora «In elaborazione» diventa «Interrotto». Fallisce se il turno resta pendente mentre il server continua ad accettare ingressi, se compare una risposta riuscita o se il guasto viene riprovato automaticamente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * verify: [Gestione del turno ammesso senza storico utilizzabile](../Requirements/FamilyConversation.md#gestione-del-turno-ammesso-senza-storico-utilizzabile)
---

### Prova del turno interrotto dopo riavvio

Accettare turni con elaborazione controllata dalla chat testuale e dalla voce trascritta quando abilitata; terminare bruscamente il processo prima di conservarne l'esito e riavviare Ambrogio. Ripetere dopo un arresto ordinato che interrompe un turno attivo, con un turno concluso normalmente e con una semplice disconnessione del client. Predisporre inoltre più turni pendenti nell’archivio di prova e verificare che siano recuperati tutti prima di abilitare gli ingressi.

#### Details
La prova passa se ciascun turno accettato è persistito con il suo testo prima dell'elaborazione e, a ogni avvio, tutti i turni rimasti «In elaborazione» compaiono come «Interrotti» prima dell'attivazione degli ingressi, senza risposta o errore concluso e senza nuova elaborazione o chiamata ai connettori. Una conclusione tardiva non sostituisce «Interrotto». Un turno già concluso conserva il suo esito; la sola disconnessione del client lascia proseguire Ambrogio e non produce «Interrotto». Fallisce se un turno pendente sparisce, resta «In elaborazione», viene ripetuto o viene presentato falsamente come concluso.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [sqlite-archive-startup.test.ts](../../packages/conversations/test/adapters/out/sqlite-archive-startup.test.ts)
  * verify: [Nessuna ripetizione automatica del turno interrotto](../Requirements/FamilyConversation.md#nessuna-ripetizione-automatica-del-turno-interrotto)
  * verify: [Registrazione dei turni conversazionali accettati](../Requirements/FamilyConversation.md#registrazione-dei-turni-conversazionali-accettati)
  * verify: [Riconoscimento del turno interrotto dopo riavvio](../Requirements/FamilyConversation.md#riconoscimento-del-turno-interrotto-dopo-riavvio)
---

### Prova dell'archivio configurato all'avvio

Avviare l'ingresso conversazionale con moduli TypeScript HTTP e Conversazioni validi e con `archivePath` diretto a un archivio SQLite di prova che contiene un turno pendente; richiedere l'elenco e lo storico della conversazione, poi arrestare il processo. Ripetere con `archivePath` assente, non stringa e diretto a una directory inesistente.

#### Details
La prova passa se il processo ascolta all'indirizzo configurato, i due GET rispondono secondo i rispettivi contratti usando l'archivio configurato, il turno pendente è già «Interrotto» alla prima risposta, ogni avvio invalido non apre il listener né crea l'archivio e l'arresto chiude listener e archivio. Fallisce se legge un altro archivio, risponde prima del recupero o lascia risorse aperte.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * satisfiedBy: [config-bootstrap.test.ts](../../apps/server/test/runtime/config-bootstrap.test.ts)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * verify: [Selezione dell'archivio conversazionale all'avvio](../Requirements/FamilyConversation.md#selezione-dellarchivio-conversazionale-allavvio)
---

### Prova dell'elenco paginato per ultima attività

Creare più conversazioni di quante ne contenga una pagina, da chat testuale e voce quando abilitata; aggiungere un turno a una conversazione meno recente e consultare tutte le pagine senza mutare ulteriormente l'archivio. Includere almeno due conversazioni con la stessa ultima attività.

#### Details
La prova passa se l'elenco è diviso in pagine limitate, la conversazione aggiornata compare prima di quelle con attività più vecchia, l'ordine è deterministico anche a parità di ultima attività e la consultazione di tutte le pagine restituisce ciascuna conversazione una sola volta senza omissioni. Fallisce se l'intero elenco è restituito in una sola risposta, l'ordine dipende implicitamente dal database o una conversazione compare due volte o manca.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * satisfiedBy: [conversations.test.ts](../../apps/server/test/composition/conversations.test.ts)
  * satisfiedBy: [sqlite-list.test.ts](../../packages/conversations/test/adapters/out/sqlite-list.test.ts)
  * verify: [Elenco paginato delle conversazioni](../Requirements/FamilyConversation.md#elenco-paginato-delle-conversazioni)
  * verify: [Ordinamento delle conversazioni per ultima attività](../Requirements/FamilyConversation.md#ordinamento-delle-conversazioni-per-ultima-attività)
---

### Prova della configurazione della paginazione

Preparare modulo TypeScript del componente «Conversazioni» con i due campi assenti, poi con `listPageSize` e `maxListPageSize` espliciti e diversi dai valori predefiniti. Indicare il percorso del file con `AMBROGIO_CONVERSATIONS_CONFIG_PATH` e leggere l'elenco attraverso i valori caricati, verificando il numero di voci e il limite applicato dall'archivio. Ripetere con variabile o file mancante, modulo TypeScript non importabile, valori non interi o non positivi e dimensione della pagina superiore al massimo.

#### Details
La prova passa se la variabile d'ambiente seleziona il percorso del modulo e il modulo può leggere valori dall'ambiente, i campi assenti danno 20 e 100, i valori espliciti validi sono usati dal caso d'uso e dall'adapter, e ogni percorso, file o combinazione invalida impedisce la preparazione dell'ingresso prima di accettare richieste. Fallisce se un valore d'ambiente non validato viene usato direttamente, se un valore invalido viene corretto in silenzio, se il massimo resta fissato a 100 quando la configurazione ne sceglie un altro o se il caso d'uso legge il file direttamente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * satisfiedBy: [conversations.test.ts](../../apps/server/test/composition/conversations.test.ts)
  * satisfiedBy: [conversation-config.test.ts](../../packages/conversations/test/adapters/out/conversation-config.test.ts)
  * verify: [Configurazione della paginazione conversazionale](../Requirements/FamilyConversation.md#configurazione-della-paginazione-conversazionale)
---

### Prova della lettura HTTP dell'elenco conversazioni

Leggere via GET più pagine di un elenco con conversazioni di attività differente e a parità di attività, usando il cursore restituito, il limite predefinito e un `limit` esplicito entro il massimo configurato. Ripetere con elenco vuoto, cursore e limite invalidi e guasto tecnico dell'archivio.

#### Details
La prova passa se le risposte `200` JSON senza cache contengono solo `items` ordinati e `nextCursor`, con identificativi e istanti ISO 8601 UTC preservati; seguire il cursore attraversa l'archivio invariato senza omissioni o duplicati e termina con `nextCursor: null`. Il limite predefinito proviene dalla configurazione e un limite esplicito valido la rispetta; valori invalidi ricevono `400` JSON sicuro senza chiamare il caso d'uso. Un guasto dell'archivio riceve `500` JSON sicuro e viene registrato. Fallisce se l'ordine, i limiti o gli esiti HTTP non corrispondono al contratto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * satisfiedBy: [conversations.test.ts](../../apps/server/test/composition/conversations.test.ts)
  * satisfiedBy: [http-list-route.test.ts](../../packages/conversations/test/adapters/in/http-list-route.test.ts)
  * verify: [Lettura HTTP dell'elenco conversazioni](../Requirements/FamilyConversation.md#lettura-http-dellelenco-conversazioni)
---

### Prova della lingua del guasto conversazionale

Nel JSON di «Conversazioni» configurare separatamente `language: "en"` e `language: "it"`, poi omettere il campo, scegliere una lingua stringa non supportata e usare un valore non stringa. Nei casi validi ammettere un turno e provocare un guasto inatteso dopo l'ammissione. Osservare il messaggio restituito dal caso d'uso, quello conservato nell'archivio e quello comunicato al client quando l'ingresso è disponibile.

#### Details
La prova passa se l'inglese produce «I can't complete the response.», l'italiano produce «Non riesco a completare la risposta.», l'omissione e la lingua stringa non supportata producono la formulazione inglese, un valore non stringa impedisce la preparazione, nessun messaggio contiene dettagli tecnici e il testo coincide esattamente nell'esito conservato e nella comunicazione al client. Fallisce se la lingua configurata viene ignorata, se i due testi differiscono o se il messaggio espone il guasto tecnico.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * satisfiedBy: [conversations.test.ts](../../apps/server/test/composition/conversations.test.ts)
  * satisfiedBy: [conversation-config.test.ts](../../packages/conversations/test/adapters/out/conversation-config.test.ts)
  * verify: [Localizzazione dell'errore conversazionale inatteso](../Requirements/FamilyConversation.md#localizzazione-dellerrore-conversazionale-inatteso)
---

### Prova della validità e delle copie degli istanti

Creare e ricostruire oggetti Domain della conversazione con istanti `Date` validi e invalidi; dopo la creazione, modificare il `Date` passato in ingresso e quelli restituiti dagli accessori. Confrontare gli istanti interni prima e dopo le mutazioni tramite `getTime()`.

#### Details
La prova passa se gli istanti validi conservano il valore temporale fornito, quelli invalidi sono rifiutati e nessuna mutazione di un `Date` in ingresso o in uscita modifica lo stato Domain. Fallisce se un istante è accettato con `getTime()` non finito, se lo stato condivide un riferimento mutabile con il chiamante o se la ricostruzione sostituisce l'istante storico.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * satisfiedBy: [turn.test.ts](../../packages/conversations/test/domain/turn.test.ts)
  * verify: [Istanti validi e protetti della conversazione](../Requirements/FamilyConversation.md#istanti-validi-e-protetti-della-conversazione)
---

### Prova delle migrazioni automatiche dell'archivio

Avviare la versione nuova del server contro un archivio SQLite con schema della versione precedente e dati di conversazione distintivi; ripetere provocando un errore controllato in una migrazione.

#### Details
La prova passa se le migrazioni pendenti sono applicate automaticamente prima che gli ingressi accettino turni, lo storico preesistente resta consultabile e un errore di migrazione impedisce l'accettazione di turni e rende osservabile il guasto tecnico. Fallisce se occorre un comando manuale, gli ingressi si attivano prima della migrazione, i dati preesistenti sono persi o un errore lascia il server operativo.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dello storico e del riavvio](#verifica-dello-storico-e-del-riavvio)
  * satisfiedBy: [conversation-server.test.ts](../../apps/server/test/runtime/conversation-server.test.ts)
  * satisfiedBy: [sqlite-archive-startup.test.ts](../../packages/conversations/test/adapters/out/sqlite-archive-startup.test.ts)
  * verify: [Migrazione automatica dell'archivio delle conversazioni](../Requirements/FamilyConversation.md#migrazione-automatica-dellarchivio-delle-conversazioni)
---
