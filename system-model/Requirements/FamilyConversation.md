# Elements

### Chiusura per inattività vocale

Quando trascorre l'intervallo di inattività configurato senza repliche vocali, Ambrogio deve terminare l'interazione vocale attiva.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conservazione dello scambio testuale

Quando Ambrogio comunica l'esito di un turno rappresentato come testo, deve conservare nello stesso scambio il testo del turno e il testo della risposta o del messaggio di errore.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Conservazione solo testuale della conversazione

Quando Ambrogio conserva una conversazione, deve conservarne la rappresentazione testuale senza conservare registrazioni audio.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Continuazione in chat della conversazione vocale

Quando la famiglia riapre in chat una conversazione iniziata a voce e invia un turno testuale, Ambrogio deve aggiungere il nuovo scambio alla stessa conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Struttura testuale dello scambio](../Contracts/FamilyConversation.md#struttura-testuale-dello-scambio)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Nuovo avvio dell'interazione vocale

Quando la famiglia avvia esplicitamente una nuova interazione vocale, Ambrogio deve creare una nuova conversazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati dell'interazione vocale](../Contracts/FamilyConversation.md#stati-dellinterazione-vocale)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Pronuncia della risposta vocale

Quando Ambrogio produce una risposta a un turno vocale, deve pronunciare la risposta alla famiglia.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Esclusione dell'audio persistente](../Contracts/FamilyConversation.md#esclusione-dellaudio-persistente)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Replica vocale nella conversazione attiva

Mentre un'interazione vocale è attiva, quando la famiglia formula una replica immediata, Ambrogio deve aggiungere il turno alla conversazione vocale attiva.

#### Metadata
  * type: requirement

#### Contract References
  * [Stati dell'interazione vocale](../Contracts/FamilyConversation.md#stati-dellinterazione-vocale)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Risposta testuale nella conversazione

Quando la famiglia invia un turno testuale, Ambrogio deve comunicare una risposta testuale o un messaggio di errore nella conversazione a cui appartiene il turno.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Trascrizione del turno vocale

Quando la famiglia pronuncia un turno vocale trascrivibile, Ambrogio deve rappresentare quel turno nella conversazione mediante la sua trascrizione testuale.

#### Metadata
  * type: requirement

#### Contract Bindings
  * [Esclusione dell'audio persistente](../Contracts/FamilyConversation.md#esclusione-dellaudio-persistente)

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

### Trascrizione vocale non riuscita

Se Ambrogio non ottiene una trascrizione utilizzabile di un turno vocale, non deve creare uno scambio per quel turno.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Conversazione familiare](../Capabilities/FamilyAssistance.md#conversazione-familiare)
---

