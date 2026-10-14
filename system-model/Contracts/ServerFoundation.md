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

### Profilo controllato di serializzazione di err

La rappresentazione JSON di `err` usa una vista composta soltanto da campi ammessi esplicitamente dal serializzatore. Per un `Error` costruito dal progetto, la vista include il suo stack diagnostico. Per un errore proveniente da driver, SDK o provider e per un valore lanciato sconosciuto, la vista usa una descrizione costante sicura, indipendente dal valore ricevuto, e non copia il messaggio, lo stack o le proprietà aggiuntive di origine.

#### Metadata
  * type: input-output

#### Relations
  * define: [Rappresentazione di err nel log JSON](../Requirements/ServerFoundation.md#rappresentazione-di-err-nel-log-json)
---

### Profilo di uscita dei log tecnici

Ogni evento diagnostico tecnico emesso da Pino è una singola riga JSON strutturata. Il processo HTTP scrive per impostazione predefinita le righe su `stdout`; la CLI le scrive per impostazione predefinita su `stderr`, lasciando `stdout` disponibile per le risposte e l'output rivolto al suo utente. La configurazione del deployment determina la destinazione finale dei flussi, senza fissarla nel formato degli eventi.

#### Metadata
  * type: input-output

#### Relations
  * define: [Formato e flussi dei log tecnici](../Requirements/ServerFoundation.md#formato-e-flussi-dei-log-tecnici)
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
