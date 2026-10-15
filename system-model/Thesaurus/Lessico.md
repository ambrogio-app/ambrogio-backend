# Elements

### Lessico Ambrogio

Termini condivisi per descrivere la famiglia, le conversazioni e i connettori di Ambrogio.

#### Metadata
  * type: concept-scheme
  * concept_base: https://github.com/adrianofoschi/ambrogio-app/concepts
  * concept_prefix: ambrogio
---

### Agente

Componente conversazionale di Ambrogio che usa un modello linguistico e istruzioni per elaborare una richiesta. Può rispondere direttamente oppure avvalersi delle capacità a sua disposizione; l'orchestratore e gli agenti collegati ai server MCP sono ruoli di agente.

#### Metadata
  * type: concept

#### Relations
  * derivedFrom: [Lessico Ambrogio](#lessico-ambrogio)
---

### Agente orchestratore

Agente che riceve la richiesta conversazionale della famiglia e sceglie se formulare direttamente una risposta o affidare il compito a un agente specializzato, usando l'esito per comporre la risposta alla famiglia.

#### Metadata
  * type: concept

#### Relations
  * derivedFrom: [Lessico Ambrogio](#lessico-ambrogio)
  * broader: [Agente](#agente)
---

### Connettore MCP

Agente specializzato di Ambrogio configurato con un modello linguistico e un collegamento client a un server MCP. Usa i tool di quel server per svolgere compiti affidati dall'orchestratore durante la conversazione. Memory e Home Assistant sono i connettori di base della prima versione.

#### Metadata
  * type: concept

#### Relations
  * derivedFrom: [Lessico Ambrogio](#lessico-ambrogio)
  * broader: [Agente](#agente)
---

### Conversazione

Sequenza persistente di scambi testuali tra la famiglia e Ambrogio. Un turno pronunciato è rappresentato dalla sua trascrizione; il mezzo usato per comunicare non crea una specie diversa di conversazione.

#### Metadata
  * type: concept

#### Relations
  * derivedFrom: [Lessico Ambrogio](#lessico-ambrogio)
---

### Famiglia

Insieme dei membri che usano una stessa installazione domestica di Ambrogio. Nella prima versione condividono un'unica identità denominata «famiglia».

#### Metadata
  * type: concept

#### Relations
  * derivedFrom: [Lessico Ambrogio](#lessico-ambrogio)
---

### Scambio

Unità della storia di una conversazione composta da un turno della famiglia e dall'esito comunicato da Ambrogio: una risposta oppure un messaggio di errore.

#### Metadata
  * type: concept

#### Relations
  * derivedFrom: [Lessico Ambrogio](#lessico-ambrogio)
---

### Turno

Singola richiesta formulata dalla famiglia in una conversazione. È rappresentata come testo, scritto direttamente o ottenuto dalla trascrizione della voce.

#### Metadata
  * type: concept

#### Relations
  * derivedFrom: [Lessico Ambrogio](#lessico-ambrogio)
---
