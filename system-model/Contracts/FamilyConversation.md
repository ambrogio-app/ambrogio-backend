# Elements

### Esclusione dell'audio persistente

L'audio acquisito dalla famiglia e quello generato per la risposta possono essere trattati durante l'interazione, ma non fanno parte dello stato persistente della conversazione. Nessuna registrazione audio del turno o della risposta viene conservata.

#### Metadata
  * type: constraint

#### Relations
  * define: [Conservazione solo testuale della conversazione](../Requirements/FamilyConversation.md#conservazione-solo-testuale-della-conversazione)
---

### Esito della trascrizione vocale

Una trascrizione è utilizzabile quando il testo restituito, eliminati gli spazi iniziali e finali, contiene almeno un carattere. Un errore del servizio di trascrizione o un testo vuoto dopo tale normalizzazione costituisce trascrizione non riuscita. Il tentativo non genera uno scambio nello storico.

#### Metadata
  * type: behavior

#### Relations
  * define: [Trascrizione vocale non riuscita](../Requirements/FamilyConversation.md#trascrizione-vocale-non-riuscita)
---

### Stati dell'interazione vocale

L'interazione vocale ha gli stati `chiusa` e `attiva`. Nello stato `attiva` è associata a una sola conversazione. Un avvio esplicito crea una nuova conversazione e la rende attiva anche se un'altra interazione era ancora attiva. Una replica arrivata prima della scadenza dell'intervallo di inattività appartiene alla conversazione attiva. L'intervallo decorre dalla fine della risposta vocale e ricomincia dopo ogni risposta vocale. Alla scadenza, l'interazione passa a `chiusa`; un successivo turno vocale richiede un nuovo avvio e una nuova conversazione. Il valore iniziale dell'intervallo è 15 secondi ed è configurabile con un valore positivo.

#### Metadata
  * type: state

#### Relations
  * define: [Chiusura per inattività vocale](../Requirements/FamilyConversation.md#chiusura-per-inattività-vocale)
---

### Struttura testuale dello scambio

Lo storico di una conversazione è una sequenza ordinata di scambi. Ogni scambio contiene il testo del turno della famiglia, il tipo di esito comunicato da Ambrogio (risposta oppure errore) e il testo di tale esito. Uno scambio appartiene a una sola conversazione. Per un turno vocale, il testo del turno è la trascrizione.

#### Metadata
  * type: input-output

#### Relations
  * define: [Conservazione dello scambio testuale](../Requirements/FamilyConversation.md#conservazione-dello-scambio-testuale)
---

