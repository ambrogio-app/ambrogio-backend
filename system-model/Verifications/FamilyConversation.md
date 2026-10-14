# Elements

### Verifica dell'interazione vocale

Raggruppa le verifiche della trascrizione, della risposta parlata, della conservazione solo testuale e del ciclo di vita delle interazioni vocali.

#### Metadata
  * type: verification-objective
---

### Prova del ciclo dell'interazione vocale

Avviare esplicitamente due interazioni vocali; nella seconda inviare una replica prima della scadenza e un turno dopo la scadenza dell'intervallo configurato.

#### Details
La prova passa se ogni avvio esplicito usa una nuova conversazione, la replica tempestiva usa quella attiva, allo scadere dell'intervallo l'interazione diventa chiusa e il turno successivo richiede un nuovo avvio con una nuova conversazione. Verificare il valore iniziale di 15 secondi e ripetere con un valore positivo configurato diverso. Fallisce se una replica attraversa il confine di scadenza o se un avvio esplicito riusa una conversazione precedente.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * verify: [Chiusura per inattività vocale](../Requirements/FamilyConversation.md#chiusura-per-inattività-vocale)
  * verify: [Nuovo avvio dell'interazione vocale](../Requirements/FamilyConversation.md#nuovo-avvio-dellinterazione-vocale)
  * verify: [Replica vocale nella conversazione attiva](../Requirements/FamilyConversation.md#replica-vocale-nella-conversazione-attiva)
---

### Prova dell'assenza di audio persistente

Eseguire un turno vocale con risposta parlata, riavviare Ambrogio e ispezionare lo stato persistente prodotto dalla prova.

#### Details
La prova passa se lo storico conserva solo testo e dati non audio e se nessuna registrazione dell'input o dell'output vocale è presente tra i dati persistenti della prova. Fallisce se un file o un campo persistente contiene audio del turno o della risposta.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * verify: [Conservazione solo testuale della conversazione](../Requirements/FamilyConversation.md#conservazione-solo-testuale-della-conversazione)
---

### Prova della trascrizione e della risposta parlata

Inviare un campione vocale trascrivibile con testo atteso e ottenere una risposta controllata.

#### Details
La prova passa se il turno conservato contiene la trascrizione testuale attesa, la risposta è emessa in voce e il suo testo compare nello scambio. Fallisce se viene creato un tipo diverso di conversazione, se manca la trascrizione o se la risposta non viene pronunciata.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * verify: [Pronuncia della risposta vocale](../Requirements/FamilyConversation.md#pronuncia-della-risposta-vocale)
  * verify: [Trascrizione del turno vocale](../Requirements/FamilyConversation.md#trascrizione-del-turno-vocale)
---

### Prova della trascrizione non riuscita

Simulare un errore del servizio di trascrizione e una trascrizione composta solo da spazi.

#### Details
La prova passa se nessuno dei due tentativi genera uno scambio nello storico. Fallisce se compare un turno o un esito persistente per tali tentativi.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica dell'interazione vocale](#verifica-dellinterazione-vocale)
  * verify: [Trascrizione vocale non riuscita](../Requirements/FamilyConversation.md#trascrizione-vocale-non-riuscita)
---

### Verifica della conversazione testuale

Raggruppa le verifiche della risposta testuale, dello storico degli scambi e della continuazione in chat delle conversazioni iniziate a voce.

#### Metadata
  * type: verification-objective
---

### Prova della continuazione vocale in chat

Avviare una conversazione a voce, completare uno scambio, riaprirla in chat e inviare un turno testuale.

#### Details
La prova passa se lo scambio testuale è aggiunto alla medesima conversazione dopo quello vocale, mantenendo lo stesso identificativo e l'ordine degli scambi. Fallisce se viene creata una copia o una nuova conversazione per il turno della chat.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Continuazione in chat della conversazione vocale](../Requirements/FamilyConversation.md#continuazione-in-chat-della-conversazione-vocale)
---

### Prova della risposta e dello storico testuale

Eseguire una conversazione con un turno che produce una risposta e uno che produce un errore controllato; riaprire lo storico.

#### Details
La prova passa se ogni turno riceve l'esito testuale nella conversazione corretta e lo storico conserva nell'ordine due scambi, ciascuno con testo del turno, tipo di esito e testo dell'esito. Fallisce se un testo manca, il tipo di esito è errato, l'ordine cambia o uno scambio compare in un'altra conversazione.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della conversazione testuale](#verifica-della-conversazione-testuale)
  * verify: [Conservazione dello scambio testuale](../Requirements/FamilyConversation.md#conservazione-dello-scambio-testuale)
  * verify: [Risposta testuale nella conversazione](../Requirements/FamilyConversation.md#risposta-testuale-nella-conversazione)
---

