# Elements

### Adapter tra moduli business nell'applicazione

Quando un adapter collega due moduli business del server, l'applicazione che li assembla deve collocarlo in `src/adapters/out/<consumer>-to-<provider>/`, dove `<consumer>` identifica il modulo che usa la capacità e `<provider>` quello che la fornisce.

#### Details
Origine: baseline Reqvire «Cross-module adapters in the assembling application», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Assemblaggio dei componenti nelle app

Le applicazioni eseguibili del monorepo devono collocare le scelte di assemblaggio dei componenti in `src/composition/`.

#### Details
Origine: baseline Reqvire «Component assembly in the composition directory», adottata.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Capacità dell'ambiente fornite dalla composition root](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#capacità-dellambiente-fornite-dalla-composition-root)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Collocazione delle applicazioni e dei moduli business

Il monorepo deve collocare le applicazioni eseguibili sotto `apps/` e i moduli business riutilizzabili sotto `packages/`.

#### Details
Origine: baseline Reqvire «Separate directories for applications and business modules», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Coordinamento dell'esecuzione negli entrypoint

Gli entrypoint delle applicazioni eseguibili del monorepo devono coordinare l'esecuzione dei componenti assemblati.

#### Details
Origine: baseline Reqvire «Execution coordination in entrypoints», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Gestione pnpm del workspace

Il repository backend deve dichiarare alla radice un workspace pnpm che comprenda l'applicazione server e i suoi package business e consenta di installarne le dipendenze tramite pnpm.

#### Details
Origine: baseline Reqvire «Single root workspace», adottata; «pnpm as package manager», adattata: pnpm è installato alla versione esatta con `npm install --global` invece che con Corepack.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [pnpm-workspace.yaml](../../pnpm-workspace.yaml)
  * specify: [Sviluppo governato dal modello](../../../ambrogio-model/system-model/Capabilities/Engineering.md#sviluppo-governato-dal-modello)
---

### Import del codice di produzione nei test Application

I test Application di un modulo business devono importare codice di produzione soltanto dall'Application e dal Domain dello stesso modulo, inclusi gli import di soli tipi.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Import del codice di produzione nei test per layer](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#import-del-codice-di-produzione-nei-test-per-layer)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Import del codice di produzione nei test Domain

I test Domain di un modulo business devono importare codice di produzione soltanto dal Domain dello stesso modulo, inclusi gli import di soli tipi.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Import del codice di produzione nei test per layer](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#import-del-codice-di-produzione-nei-test-per-layer)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Import del codice di produzione nei test degli adapter inbound

I test di un adapter inbound di un modulo business devono importare codice di produzione soltanto dal proprio adapter inbound e dall'Application dello stesso modulo, senza importare il Domain, inclusi gli import di soli tipi.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Import del codice di produzione nei test per layer](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#import-del-codice-di-produzione-nei-test-per-layer)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Import del codice di produzione nei test degli adapter outbound

I test di un adapter outbound di un modulo business devono importare codice di produzione soltanto dal proprio adapter outbound, dall'Application e dal Domain dello stesso modulo, senza importare adapter inbound, inclusi gli import di soli tipi.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Import del codice di produzione nei test per layer](../../../ambrogio-model/system-model/Requirements/CodeArchitecture.md#import-del-codice-di-produzione-nei-test-per-layer)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Import delle API pubbliche dei package business

Quando un'applicazione importa un package business, deve usare il nome del package e uno dei subpath dichiarati nel suo campo `exports`, senza raggiungere direttamente i file interni del package.

#### Details
Origine: baseline Reqvire «Business package imports through public entry points», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Introduzione controllata dei package generici

Il monorepo non deve introdurre package generici di condivisione, come `shared`, `common`, `utils` o `domain-kit`, senza una nuova decisione architetturale esplicita registrata nel modello Reqvire.

#### Details
Origine: baseline Reqvire «No generic sharing packages without a recorded decision», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Isolamento degli import dei package business

I file di ciascun package business del monorepo non devono importare codice di altri package business né delle applicazioni, anche quando l'importazione riguarda solo tipi.

#### Details
Origine: baseline Reqvire «Import isolation of business packages», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Isolamento dei package business dai package tecnici condivisi

I file di ciascun package business del monorepo non devono importare codice dei package tecnici condivisi del workspace, anche quando l'importazione riguarda solo tipi.

#### Details
Origine: baseline Reqvire «Business packages independent of shared technical packages», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Istruzioni per gli agenti del backend

Le istruzioni per gli agenti del repository backend devono applicare al lavoro nel repository le regole di processo di `ambrogio-model`, rimandando a `ambrogio-model/AGENTS.md` per le regole comuni e aggiungendo soltanto le indicazioni proprie del backend.

#### Metadata
  * type: requirement

#### Relations
  * derivedFrom: [Ordine di lavoro guidato dal modello](../../../ambrogio-model/system-model/Requirements/ModelDrivenDevelopment.md#ordine-di-lavoro-guidato-dal-modello)
  * satisfiedBy: [AGENTS.md](../../AGENTS.md)
  * specify: [Sviluppo governato dal modello](../../../ambrogio-model/system-model/Capabilities/Engineering.md#sviluppo-governato-dal-modello)
---

### Meccanismi tecnici del processo nelle app

Le applicazioni eseguibili del monorepo devono collocare i meccanismi tecnici specifici del processo in `src/runtime/`.

#### Details
Origine: baseline Reqvire «Process mechanisms in the runtime directory», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Prove tra moduli nelle applicazioni

Quando una prova esercita la collaborazione di più moduli business, deve risiedere nell'applicazione che li assembla.

#### Details
Origine: baseline Reqvire «Cross-module tests in the assembling application», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Superficie pubblica dei package business

Ciascun package business del monorepo deve dichiarare nel campo `exports` di `package.json` soltanto subpath pubblici espliciti per Application e per le famiglie di adapter necessarie alle applicazioni, senza esportare la radice del package, wildcard o il Domain.

#### Details
Origine: baseline Reqvire «Explicit public surface of business packages», adottata.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [package.json](../../packages/conversations/package.json)
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---

### Test dei moduli business nei rispettivi package

I test di ciascun modulo business del monorepo devono risiedere nel package del modulo a cui si riferiscono.

#### Details
Origine: baseline Reqvire «Module tests inside the module package», adottata.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Architettura del codice](../../../ambrogio-model/system-model/Capabilities/Engineering.md#architettura-del-codice)
---
