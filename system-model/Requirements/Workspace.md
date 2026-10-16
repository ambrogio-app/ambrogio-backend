# Elements

### Adapter tra moduli business nell'applicazione

Quando un adapter collega due moduli business del server, l'applicazione che li assembla deve collocarlo in `src/adapters/out/<consumer>-to-<provider>/`, dove `<consumer>` identifica il modulo che usa la capacità e `<provider>` quello che la fornisce.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Assemblaggio dei componenti nelle app

Le applicazioni eseguibili del monorepo devono collocare le scelte di assemblaggio dei componenti in `src/composition/`.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Collocazione delle applicazioni e dei moduli business

Il monorepo deve collocare le applicazioni eseguibili sotto `apps/` e i moduli business riutilizzabili sotto `packages/`.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Confine del repository backend

Il backend Ambrogio deve essere sviluppato e versionato in `ambrogio-backend`, con workspace Reqvire canonico alla radice del repository; i client, incluso il client terminale `ambrogio-cli`, devono avere repository e modelli autonomi e integrare il backend tramite il contratto HTTP pubblico.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Coordinamento dell'esecuzione negli entrypoint

Gli entrypoint delle applicazioni eseguibili del monorepo devono coordinare l'esecuzione dei componenti assemblati.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Gestione pnpm del workspace

Il repository backend deve dichiarare alla radice un workspace pnpm che comprenda l'applicazione server e i suoi package business e consenta di installarne le dipendenze tramite pnpm.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Import del codice di produzione nei test Application

I test Application di un modulo business devono importare codice di produzione soltanto dall'Application e dal Domain dello stesso modulo, inclusi gli import di soli tipi.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Import del codice di produzione nei test Domain

I test Domain di un modulo business devono importare codice di produzione soltanto dal Domain dello stesso modulo, inclusi gli import di soli tipi.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Import del codice di produzione nei test degli adapter inbound

I test di un adapter inbound di un modulo business devono importare codice di produzione soltanto dal proprio adapter inbound e dall'Application dello stesso modulo, senza importare il Domain, inclusi gli import di soli tipi.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Import del codice di produzione nei test degli adapter outbound

I test di un adapter outbound di un modulo business devono importare codice di produzione soltanto dal proprio adapter outbound, dall'Application e dal Domain dello stesso modulo, senza importare adapter inbound, inclusi gli import di soli tipi.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Import delle API pubbliche dei package business

Quando un'applicazione importa un package business, deve usare il nome del package e uno dei subpath dichiarati nel suo campo `exports`, senza raggiungere direttamente i file interni del package.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Introduzione controllata dei package generici

Il monorepo non deve introdurre package generici di condivisione, come `shared`, `common`, `utils` o `domain-kit`, senza una nuova decisione architetturale esplicita registrata nel modello Reqvire.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Isolamento degli import dei package business

I file di ciascun package business del monorepo non devono importare codice di altri package business né delle applicazioni, anche quando l'importazione riguarda solo tipi.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Isolamento dei package business dai package tecnici condivisi

I file di ciascun package business del monorepo non devono importare codice dei package tecnici condivisi del workspace, anche quando l'importazione riguarda solo tipi.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Meccanismi tecnici del processo nelle app

Le applicazioni eseguibili del monorepo devono collocare i meccanismi tecnici specifici del processo in `src/runtime/`.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Prove tra moduli nelle applicazioni

Quando una prova esercita la collaborazione di più moduli business, deve risiedere nell'applicazione che li assembla.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Superficie pubblica dei package business

Ciascun package business del monorepo deve dichiarare nel campo `exports` di `package.json` soltanto subpath pubblici espliciti per Application e per le famiglie di adapter necessarie alle applicazioni, senza esportare la radice del package, wildcard o il Domain.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [package.json](../../packages/conversations/package.json)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Test dei moduli business nei rispettivi package

I test di ciascun modulo business del monorepo devono risiedere nel package del modulo a cui si riferiscono.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---
