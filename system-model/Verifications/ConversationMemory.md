# Elements

### Verifica della memoria delle conversazioni

Raggruppa le prove della ricerca nello storico, del server MCP della memoria e dell'agente Memory d'esempio.

#### Metadata
  * type: verification-objective
---

### Prova della ricerca nella memoria

Su un database PostgreSQL di prova preparato con le migrazioni di produzione e la lingua `it`, conservare in più conversazioni turni conclusi con risposta, un turno concluso con errore, uno interrotto e uno in elaborazione, con parole in forme diverse, una frase ripetuta in due turni, istanti in giorni diversi a cavallo della mezzanotte del fuso orario della famiglia, risposte con agente e azioni e una risposta più lunga di 1000 caratteri. Invocare la porta di lettura e lo strumento con parole al singolare e al plurale, una frase fra virgolette, una parola esclusa, un intervallo di date, un limite, una ricerca senza corrispondenze, una fatta di sole parole vuote e argomenti invalidi; ripetere una ricerca con la lingua `en`. Ispezionare il piano della ricerca con `EXPLAIN`.

#### Details
La prova passa se ogni forma della parola trova i turni che ne contengono un'altra forma; se soltanto i turni conclusi con risposta compaiono, nell'ordine del contratto, entro il limite e con 5 risultati quando il limite manca; se l'intervallo di date comprende gli estremi nel fuso orario della famiglia; se ogni risultato porta conversazione, turno, istante con lo scostamento del fuso, testo della famiglia e risposta troncata a 1000 caratteri, senza agente né azioni; se le ricerche senza corrispondenze danno `results` vuoto; se gli argomenti invalidi danno `isError` con l'argomento nominato senza interrogare l'archivio; se la lingua `en` usa la configurazione `english`; e se il piano usa l'indice della lingua. Fallisce se compare un turno non concluso con risposta, se una forma della parola non è trovata, se un risultato esce dall'intervallo o se il piano scorre tutta la tabella dei turni.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della memoria delle conversazioni](#verifica-della-memoria-delle-conversazioni)
  * verify: [Ricerca testuale nello storico delle conversazioni](../Requirements/ConversationMemory.md#ricerca-testuale-nello-storico-delle-conversazioni)
  * verify: [Intervallo di date della ricerca nella memoria](../Requirements/ConversationMemory.md#intervallo-di-date-della-ricerca-nella-memoria)
---

### Prova dei turni ricercabili alla conclusione

Su un database PostgreSQL di prova, ammettere un turno e cercarne una parola; concluderlo con risposta tramite il repository del turno e cercare di nuovo; ripetere con una conclusione la cui transazione fallisce dopo l'aggiornamento del turno.

#### Details
La prova passa se il turno in elaborazione non è trovato, il turno concluso è trovato subito dopo la conferma della conclusione e la conclusione fallita non lo rende ricercabile. Fallisce se la ricerca richiede un'elaborazione separata o vede una conclusione non confermata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della memoria delle conversazioni](#verifica-della-memoria-delle-conversazioni)
  * verify: [Turni ricercabili dalla loro conclusione](../Requirements/ConversationMemory.md#turni-ricercabili-dalla-loro-conclusione)
---

### Prova del server MCP della memoria

Avviare il server conversazionale reale su un database PostgreSQL di prova con turni conservati e collegarsi a `/mcp/memory` con il client MCP comune del backend; elencare gli strumenti e invocare `search_conversations`. Inviare poi a `/mcp/memory` una richiesta con l'intestazione `Origin`, richieste `GET` e `DELETE` e una richiesta a `/api/mcp/memory`. Avviare infine il processo server con l'agente Memory configurato verso il proprio backend e affidargli un turno con un modello controllato che chiama lo strumento.

#### Details
La prova passa se il server si presenta come `ambrogio-memory`, dichiara soltanto la capacità `tools` e il solo strumento `search_conversations` con schemi di argomenti e risultato del contratto; se l'invocazione restituisce i turni attesi; se la richiesta con `Origin` riceve `403`, `GET` e `DELETE` ricevono `405` e il percorso sotto `/api` non raggiunge il server MCP; e se l'agente Memory si collega dopo l'apertura dell'ascolto e il suo turno riceve i risultati della ricerca. Fallisce se il server espone altri strumenti o capacità, se accetta una richiesta con `Origin` o se l'agente non riesce a collegarsi al proprio backend.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della memoria delle conversazioni](#verifica-della-memoria-delle-conversazioni)
  * verify: [Server MCP della memoria nel backend](../Requirements/ConversationMemory.md#server-mcp-della-memoria-nel-backend)
---

### Prova dell'agente Memory d'esempio

Leggere `examples/agents/memory.json` con il caricatore dei file degli agenti e confrontarne i campi con il contratto; leggerne le istruzioni.

#### Details
La prova passa se il file è valido per il caricatore, ha la descrizione, l'URL `http://127.0.0.1:3000/mcp/memory`, `mcp.tools` con il solo `search_conversations` e `maxToolCalls` pari a 4, nomina la variabile della credenziale del modello senza valori segreti e le istruzioni chiedono di cercare prima di rispondere, di riprovare con sinonimi, di dire quando non trova nulla e di indicare le date. Fallisce se manca uno di questi elementi o se il file contiene un valore segreto.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della memoria delle conversazioni](#verifica-della-memoria-delle-conversazioni)
  * verify: [Agente Memory d'esempio](../Requirements/ConversationMemory.md#agente-memory-desempio)
---
