# Elements

### Assistenza personale domestica

Un'installazione di Ambrogio nel proprio homelab assiste i membri della famiglia attraverso conversazioni e capacità rese disponibili dai connettori configurati. Nella prima versione i membri condividono un'unica identità, «famiglia».

#### Concept References
  * [Famiglia](../Thesaurus/Lessico.md#famiglia)

#### Metadata
  * type: capability
---

### Conversazione familiare

La famiglia pone domande generali e riceve risposte tramite testo o voce quando l'interazione vocale è abilitata nell'installazione. Gli ingressi testuali restano disponibili senza i componenti vocali. Ambrogio rappresenta e conserva ogni conversazione come testo; trascrive i turni vocali e pronuncia le risposte ai turni vocali. Ogni conversazione conservata, qualunque sia l'ingresso in cui è iniziata, può essere riaperta e continuata da un client della chat testuale. Ogni nuova esecuzione CLI e ogni nuova interazione vocale apre una nuova conversazione; soltanto le repliche immediate possono proseguire l'interazione vocale ancora attiva.

#### Concept References
  * [Famiglia](../Thesaurus/Lessico.md#famiglia)
  * [Conversazione](../Thesaurus/Lessico.md#conversazione)
  * [Turno](../Thesaurus/Lessico.md#turno)
  * [Scambio](../Thesaurus/Lessico.md#scambio)

#### Metadata
  * type: capability

#### Relations
  * derivedFrom: [Assistenza personale domestica](#assistenza-personale-domestica)
---

### Estensione tramite connettori MCP

Chi installa Ambrogio può rendere disponibili nuove capacità alla famiglia aggiungendo connettori a server MCP tramite configurazione. Il progetto può fornire configurazioni pronte per i connettori di base.

#### Concept References
  * [Connettore MCP](../Thesaurus/Lessico.md#connettore-mcp)

#### Metadata
  * type: capability

#### Relations
  * derivedFrom: [Assistenza personale domestica](#assistenza-personale-domestica)
---

### Interazione domestica tramite Home Assistant

La famiglia può consultare informazioni e richiedere azioni sui dispositivi disponibili in Home Assistant durante le conversazioni con Ambrogio. Home Assistant è uno dei due connettori di base della prima versione.

#### Concept References
  * [Famiglia](../Thesaurus/Lessico.md#famiglia)
  * [Connettore MCP](../Thesaurus/Lessico.md#connettore-mcp)

#### Metadata
  * type: capability

#### Relations
  * derivedFrom: [Estensione tramite connettori MCP](#estensione-tramite-connettori-mcp)
---

### Memoria delle conversazioni

La famiglia può porre domande che richiedono informazioni contenute nelle conversazioni precedenti. Il connettore Memory, disponibile dalla prima versione, recupera tramite RAG contenuti pertinenti dallo storico comune delle conversazioni testuali, comprese quelle svolte a voce e trascritte. Ambrogio fornisce sia il client sia il server MCP di questo connettore.

#### Concept References
  * [Conversazione](../Thesaurus/Lessico.md#conversazione)
  * [Connettore MCP](../Thesaurus/Lessico.md#connettore-mcp)

#### Metadata
  * type: capability

#### Relations
  * derivedFrom: [Estensione tramite connettori MCP](#estensione-tramite-connettori-mcp)
---
