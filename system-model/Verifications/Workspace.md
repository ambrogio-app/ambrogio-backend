# Elements

### Verifica del workspace pnpm

Raggruppa le verifiche della configurazione del workspace comune e dell'installazione delle dipendenze con pnpm.

#### Metadata
  * type: verification-objective
---

### Prova dell'installazione nel workspace pnpm

In un checkout pulito, individuare i pacchetti del workspace dalla radice e installare le dipendenze con pnpm.

#### Details
La prova passa se il workspace radice include i pacchetti applicativi del server e del client e se `pnpm install` dalla radice completa l'installazione delle loro dipendenze senza errori. Fallisce se uno dei pacchetti non appartiene al workspace o richiede un'installazione separata fuori dal workspace.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del workspace pnpm](#verifica-del-workspace-pnpm)
  * verify: [Gestione pnpm del workspace](../Requirements/Workspace.md#gestione-pnpm-del-workspace)
---

### Verifica della struttura del monorepo

Raggruppa i controlli sulla collocazione delle applicazioni eseguibili e dei moduli business nel workspace.

#### Metadata
  * type: verification-objective
---

### Analisi degli import dei test Domain e Application

Analizzare il grafo degli import dei test Domain e Application di ogni modulo business, compresi `import type` e riesportazioni, distinguendo il codice di produzione dalle dipendenze di test e dai fake locali.

#### Details
L'analisi passa se i test Domain importano codice di produzione solo dal Domain del proprio modulo e i test Application solo dall'Application o dal Domain dello stesso modulo. Fallisce se un test importa codice di produzione da un altro layer o modulo, anche tramite un import di soli tipi. Runner, assertion e fake locali non sono classificati come codice di produzione.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Import del codice di produzione nei test Application](../Requirements/Workspace.md#import-del-codice-di-produzione-nei-test-application)
  * verify: [Import del codice di produzione nei test Domain](../Requirements/Workspace.md#import-del-codice-di-produzione-nei-test-domain)
---

### Analisi degli import dei test degli adapter

Analizzare il grafo degli import dei test degli adapter inbound e outbound di ogni modulo business, compresi `import type` e riesportazioni, distinguendo il codice di produzione da runner, assertion, tecnologie degli adapter e fake locali.

#### Details
L'analisi passa se i test inbound importano codice di produzione solo dal proprio adapter inbound e dall'Application del modulo, senza Domain, e i test outbound solo dal proprio adapter outbound, dall'Application e dal Domain del modulo, senza adapter inbound. Fallisce se un test raggiunge altro codice di produzione, anche tramite un import di soli tipi. Runner, assertion, tecnologie degli adapter e fake locali non sono classificati come codice di produzione del modulo.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Import del codice di produzione nei test degli adapter inbound](../Requirements/Workspace.md#import-del-codice-di-produzione-nei-test-degli-adapter-inbound)
  * verify: [Import del codice di produzione nei test degli adapter outbound](../Requirements/Workspace.md#import-del-codice-di-produzione-nei-test-degli-adapter-outbound)
---

### Analisi degli import delle API pubbliche nelle applicazioni

Analizzare gli import e le riesportazioni dei file TypeScript delle applicazioni che puntano ai package business del monorepo, inclusi i test e gli `import type`.

#### Details
L'analisi passa se ciascun riferimento a un package business usa il nome del package e un subpath dichiarato nel relativo campo `exports`. Fallisce se un'applicazione raggiunge file interni mediante percorsi relativi, alias o subpath non dichiarati.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Import delle API pubbliche dei package business](../Requirements/Workspace.md#import-delle-api-pubbliche-dei-package-business)
---

### Analisi degli import tra package business e applicazioni

Analizzare il grafo degli import di tutti i file TypeScript dei package business, compresi test, `import type` e riesportazioni.

#### Details
L'analisi passa se nessun import originato da un package business punta al codice di un altro package business o di un'applicazione. Fallisce se compare anche un solo collegamento vietato, inclusi quelli che importano soltanto tipi.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Isolamento degli import dei package business](../Requirements/Workspace.md#isolamento-degli-import-dei-package-business)
---

### Analisi degli import verso package tecnici condivisi

Analizzare il grafo degli import di tutti i file TypeScript dei package business, compresi test, `import type` e riesportazioni, e individuare i package tecnici condivisi del workspace.

#### Details
L'analisi passa se nessun import originato da un package business punta al codice di un package tecnico condiviso del workspace. Fallisce se compare anche un solo collegamento vietato, inclusi quelli che importano soltanto tipi.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Isolamento dei package business dai package tecnici condivisi](../Requirements/Workspace.md#isolamento-dei-package-business-dai-package-tecnici-condivisi)
---

### Controllo degli adapter tra moduli business

Quando esiste un adapter che collega due moduli business del server, individuare il modulo consumatore, il modulo fornitore e l'applicazione che li assembla.

#### Details
Il controllo passa se ciascun adapter di questo tipo risiede nell'applicazione che assembla i due moduli, sotto `src/adapters/out/<consumer>-to-<provider>/`, con i nomi coerenti con i ruoli effettivi. Fallisce se risiede in uno dei package business, in un'altra app o in un percorso che non rappresenta la direzione del collegamento. Se non esiste ancora un adapter tra moduli business, il controllo resta da eseguire al primo caso pertinente.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Adapter tra moduli business nell'applicazione](../Requirements/Workspace.md#adapter-tra-moduli-business-nellapplicazione)
---

### Controllo degli export dei package business

Esaminare il campo `exports` di `package.json` di ogni package business del monorepo e le destinazioni dei subpath dichiarati.

#### Details
Il controllo passa se tutti gli export sono subpath espliciti destinati all'Application o a famiglie di adapter necessarie alle applicazioni e se non sono esportati la radice del package, wildcard o file del Domain. Fallisce se compare un export non conforme o un package business non dichiara la propria superficie pubblica.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Superficie pubblica dei package business](../Requirements/Workspace.md#superficie-pubblica-dei-package-business)
---

### Controllo dei package generici

Esaminare i package del monorepo e le decisioni architetturali registrate nel modello Reqvire.

#### Details
Il controllo passa se non esistono package generici di condivisione oppure se ogni package di questo tipo è coperto da una decisione architetturale esplicita nel modello che ne definisce responsabilità e confini. Fallisce se esiste un package generico, anche con un nome diverso da `shared`, `common`, `utils` o `domain-kit`, senza tale decisione.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Introduzione controllata dei package generici](../Requirements/Workspace.md#introduzione-controllata-dei-package-generici)
---

### Controllo della collocazione dei test business

Classificare i test che esercitano un singolo modulo business e le prove che esercitano la collaborazione di più moduli business; confrontare la loro collocazione con i package e le applicazioni che assemblano i moduli.

#### Details
Il controllo passa se ogni test di un singolo modulo business risiede nel package di quel modulo e ogni prova di collaborazione tra moduli risiede nell'applicazione che li assembla. Fallisce se un test di modulo è esterno al proprio package o una prova tra moduli è collocata in un package business o in un'applicazione diversa da quella che li assembla. Le prove tra moduli si controllano quando esiste un caso pertinente.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Prove tra moduli nelle applicazioni](../Requirements/Workspace.md#prove-tra-moduli-nelle-applicazioni)
  * verify: [Test dei moduli business nei rispettivi package](../Requirements/Workspace.md#test-dei-moduli-business-nei-rispettivi-package)
---

### Controllo della collocazione di app e moduli business

Esaminare la struttura del monorepo e classificare le unità applicative eseguibili e i moduli business riutilizzabili.

#### Details
Il controllo passa se ogni applicazione eseguibile si trova sotto `apps/` e ogni modulo business riutilizzabile sotto `packages/`. Fallisce se una unità di uno dei due tipi risiede fuori dalla propria directory prevista.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Collocazione delle applicazioni e dei moduli business](../Requirements/Workspace.md#collocazione-delle-applicazioni-e-dei-moduli-business)
---

### Controllo della separazione tra runtime, composition ed entrypoint

Esaminare la struttura e le responsabilità del codice di ciascuna applicazione eseguibile del monorepo, seguendo l'avvio dagli entrypoint ai componenti assemblati.

#### Details
Il controllo passa se i meccanismi tecnici specifici del processo risiedono in `src/runtime/`, le scelte di assemblaggio dei componenti in `src/composition/` e gli entrypoint coordinano l'esecuzione dei componenti assemblati. Fallisce se una di queste responsabilità è assente o collocata in un componente diverso da quello previsto.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Assemblaggio dei componenti nelle app](../Requirements/Workspace.md#assemblaggio-dei-componenti-nelle-app)
  * verify: [Coordinamento dell'esecuzione negli entrypoint](../Requirements/Workspace.md#coordinamento-dellesecuzione-negli-entrypoint)
  * verify: [Meccanismi tecnici del processo nelle app](../Requirements/Workspace.md#meccanismi-tecnici-del-processo-nelle-app)
---
