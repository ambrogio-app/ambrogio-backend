# Elements

### Contratto di normalizzazione diagnostica

Il confine tecnico usa il valore catturato come `err` senza crearne un altro quando è già un `Error`: l'identità dell'istanza resta invariata. Se il valore catturato non è un `Error`, crea un nuovo `Error` con un messaggio diagnostico fisso, indipendente dal valore, e con `cause` pari per identità al valore catturato. La normalizzazione non converte il valore catturato in stringa e non lo modifica.

#### Metadata
  * type: input-output

#### Relations
  * define: [Normalizzazione diagnostica nel confine definitivo](../Requirements/ServerFoundation.md#normalizzazione-diagnostica-nel-confine-definitivo)
---

### Forma del tipo Result

La definizione TypeScript locale a un modulo business è `type Result<T, E> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>`; il ramo `ok: true` contiene `value`, il ramo `ok: false` contiene `error`. Entrambi i rami sono immutabili tramite `Readonly`.

#### Metadata
  * type: specification

#### Relations
  * define: [Struttura del tipo Result](../Requirements/ServerFoundation.md#struttura-del-tipo-result)
---

### Politica CORS del componente HTTP

L'elenco delle origini autorizzate è un'impostazione esplicita del JSON locale del componente HTTP; se è assente o vuoto, la politica non aggiunge header CORS di autorizzazione. Per una richiesta con `Origin`, la risposta ordinaria e l'eventuale risposta alla preflight autorizzano soltanto una corrispondenza esatta con un'origine dell'elenco. Non si usa `*` e non si riflette un'origine non autorizzata. CORS non sostituisce le restrizioni di rete e reverse proxy previste per l'accesso all'installazione.

#### Metadata
  * type: specification

#### Relations
  * define: [Origini CORS esplicite dell'API HTTP](../Requirements/ServerFoundation.md#origini-cors-esplicite-dellapi-http)
---

### Politica HSTS dell'origine pubblica

Il JSON locale validato del componente HTTP dichiara se l'origine pubblica è esposta esclusivamente tramite HTTPS, anche quando la terminazione TLS avviene nel reverse proxy. Il componente non deduce questa condizione da `X-Forwarded-Proto` o dal protocollo della singola connessione interna. Se la condizione è falsa o non dichiarata, disabilita l'HSTS predefinito di Helmet. Se è vera, abilita HSTS con una durata positiva dichiarata; `includeSubDomains` e `preload` non sono attivati implicitamente, perché riguardano anche altri servizi del dominio. La configurazione del deployment coordina l'eventuale emissione dello stesso header da parte del reverse proxy.

#### Metadata
  * type: specification

#### Relations
  * define: [HSTS legato all'HTTPS pubblico](../Requirements/ServerFoundation.md#hsts-legato-allhttps-pubblico)
---

### Politica di cache delle risposte conversazionali HTTP

L'header `Cache-Control: no-store` accompagna le risposte HTTP che trasportano dati conversazionali, incluse pagine dell'elenco, storico, risposta SSE al turno e flussi di aggiornamento. Il comportamento si applica alle risposte pertinenti anche quando il flusso termina con un errore dopo l'invio degli header. Non modifica la politica di cache delle risorse statiche prive di dati conversazionali.

#### Metadata
  * type: specification

#### Relations
  * define: [Esclusione dalla cache delle risposte conversazionali HTTP](../Requirements/ServerFoundation.md#esclusione-dalla-cache-delle-risposte-conversazionali-http)
---

### Politica di interruzione nell'arresto ordinato

Alla richiesta di arresto il server smette di accettare nuovi turni, richiede subito l'interruzione di quelli attivi e non attende che le loro risposte terminino. Per ogni turno accettato rimasto senza esito, conserva lo stato `interrotto` prima di chiudere l'archivio e le altre risorse necessarie a tale registrazione; un completamento tardivo non può sostituire tale stato con una risposta riuscita. Un esito già conservato prima dell'arresto resta concluso. Se il processo termina prima che lo stato `interrotto` sia conservato, il recupero al riavvio riconosce il turno senza esito come interrotto. Nessun turno viene accodato o ripetuto automaticamente.

#### Metadata
  * type: specification

#### Relations
  * define: [Interruzione dei turni durante l'arresto](../Requirements/ServerFoundation.md#interruzione-dei-turni-durante-larresto)
---

### Profilo JSON dell'ascolto HTTP

Il percorso del file JSON del componente HTTP è indicato da `AMBROGIO_HTTP_CONFIG_PATH`, che seleziona soltanto il file. Il file richiede `host`, stringa non vuota, e `port`, numero intero da 1 a 65535. Non esistono valori predefiniti per questi due campi. Il listener usa esattamente i valori validati. File mancante, JSON invalido o valori non validi impediscono l'avvio.

Il file ammette `allowedOrigins`, elenco di origini HTTP(S) esplicite, predefinito vuoto; `publicHttps`, booleano predefinito `false`; e `hstsMaxAgeSeconds`, intero positivo obbligatorio quando `publicHttps` è `true`. Il componente applica la politica CORS già definita tramite il plugin ufficiale `@fastify/cors` e configura `@fastify/helmet` secondo la politica HSTS già definita. Una voce CORS non può essere `*`; la corrispondenza dell'origine è esatta.

#### Metadata
  * type: specification

#### Relations
  * define: [Configurazione esplicita dell'ascolto HTTP](../Requirements/ServerFoundation.md#configurazione-esplicita-dellascolto-http)
---

### Profilo controllato di serializzazione di err

La rappresentazione JSON di `err` usa una vista composta soltanto da campi ammessi esplicitamente dal serializzatore. Per un `Error` costruito dal progetto, la vista include il suo stack diagnostico. Per un errore proveniente da driver, SDK o provider e per un valore lanciato sconosciuto, la vista usa una descrizione costante sicura, indipendente dal valore ricevuto, e non copia il messaggio, lo stack o le proprietà aggiuntive di origine.

#### Metadata
  * type: input-output

#### Relations
  * define: [Rappresentazione di err nel log JSON](../Requirements/ServerFoundation.md#rappresentazione-di-err-nel-log-json)
---

### Profilo del limite dei corpi HTTP

Il componente HTTP configura un limite di dimensione positivo per i corpi ricevuti dalle rotte che ne accettano uno; un'eventuale eccezione per rotta dichiara un proprio limite esplicito. Il controllo riguarda la dimensione effettivamente ricevuta, anche quando il corpo arriva in più parti. Il rifiuto `413` usa la forma JSON pubblica degli errori HTTP e non passa il corpo al caso d'uso né crea un turno. La rotta del turno testuale usa 64 KiB, come definito nel contratto della sua richiesta; i valori delle altre rotte saranno fissati nei rispettivi contratti.

#### Metadata
  * type: specification

#### Relations
  * define: [Limite dei corpi delle richieste HTTP](../Requirements/ServerFoundation.md#limite-dei-corpi-delle-richieste-http)
---

### Profilo di bootstrap dei JSON dei componenti

Per il processo server, la composition root determina i componenti dell'ingresso da avviare e carica una sola volta i rispettivi file JSON locali prima di costruirne le risorse. Le configurazioni dei componenti non vengono sovrascritte da variabili d'ambiente; un eventuale meccanismo per scegliere il percorso dei file non modifica i valori letti dai file. Ogni componente dichiara quali campi sono richiesti e quali valori predefiniti sono ammessi. Il caricamento verifica struttura e valori, converte i dati nei tipi previsti e blocca l'attivazione se un file necessario manca o è invalido. I file dei componenti non attivi, compresi quelli vocali quando la voce è disabilitata, non sono richiesti. La composition root consegna a ogni componente solo la propria sezione validata; Domain e casi d'uso Application non leggono file, variabili d'ambiente o segreti dal processo. Messaggi di errore, log ed esempi non riproducono valori segreti. Il contratto non prescrive nomi di file, una libreria di schema o il meccanismo di immutabilità dei valori consegnati.

Il percorso del file JSON di un componente attivo può essere indicato da una variabile d'ambiente dedicata. Tale variabile contiene solo il percorso: nessun campo del JSON viene sostituito con un valore d'ambiente.

#### Metadata
  * type: specification

#### Relations
  * define: [Caricamento iniziale dei JSON di configurazione](../Requirements/ServerFoundation.md#caricamento-iniziale-dei-json-di-configurazione)
---

### Profilo di uscita dei log tecnici

Ogni evento diagnostico tecnico emesso da Pino è una singola riga JSON strutturata. Il processo server scrive per impostazione predefinita le righe su `stdout`. La configurazione del deployment determina la destinazione finale dei flussi, senza fissarla nel formato degli eventi.

#### Metadata
  * type: input-output

#### Relations
  * define: [Formato e flussi dei log tecnici](../Requirements/ServerFoundation.md#formato-e-flussi-dei-log-tecnici)
---

### Profilo globale degli header di sicurezza HTTP

Il componente HTTP registra `@fastify/helmet` sulla radice dell'istanza Fastify affinché il profilo raggiunga tutte le rotte gestite, comprese risposte ordinarie, errori e `404`. Mantiene le impostazioni predefinite della versione adottata, salvo HSTS condizionato dal deployment e differenze esplicitamente motivate per singola rotta o superficie. Una futura rotta che serve HTML eseguibile definisce la propria CSP senza indebolire globalmente il profilo delle altre risposte. Gli header specifici per cache conversazionale e CORS restano governati dai rispettivi contratti.

#### Metadata
  * type: specification

#### Relations
  * define: [Header di sicurezza sulle risposte HTTP](../Requirements/ServerFoundation.md#header-di-sicurezza-sulle-risposte-http)
---

### Profilo iniziale di osservabilità

Il segnale diagnostico della prima versione è costituito dai log JSON strutturati del runtime HTTP, con i `correlationId` per collegare gli eventi di una richiesta. Un `correlationId` non è una traccia distribuita e i log non costituiscono un registro di audit garantito. Non sono attivati raccoglitori o API applicative separati per metriche, tracing o audit. Eventuali estensioni richiedono un bisogno concreto, un contratto proprio per dati e protezioni, una collocazione nei confini tecnici e verifiche dedicate; non ereditano automaticamente le garanzie dei log. La diagnostica tecnica non acquisisce automaticamente contenuti delle conversazioni o credenziali secondo i requisiti già definiti.

#### Metadata
  * type: specification

#### Relations
  * define: [Perimetro iniziale dei segnali di osservabilità](../Requirements/ServerFoundation.md#perimetro-iniziale-dei-segnali-di-osservabilità)
---

### Stack TypeScript ESM e Node.js del server

Il codice sorgente del server è scritto in TypeScript. La build del server usa `tsc` e produce JavaScript ESM. L'artefatto è eseguito con Node.js 24 o successivo.

#### Metadata
  * type: specification

#### Relations
  * define: [Preparazione del server TypeScript ESM](../Requirements/ServerFoundation.md#preparazione-del-server-typescript-esm)
---

### Vincolo sui campi dei rifiuti previsti

Una variante può contenere solo `kind` oppure aggiungere campi propri, tipizzati, che appartengono al significato stabile del rifiuto e servono al chiamante. Non esiste uno schema comune che richieda in ogni variante campi generici quali `message`, `cause`, `metadata`, `statusCode` o codici di uscita. La presenza di uno di questi nomi in una variante specifica non è vietata quando soddisfa il criterio dei campi propri.

#### Metadata
  * type: constraint

#### Relations
  * define: [Campi specifici dei rifiuti previsti](../Requirements/ServerFoundation.md#campi-specifici-dei-rifiuti-previsti)
---
