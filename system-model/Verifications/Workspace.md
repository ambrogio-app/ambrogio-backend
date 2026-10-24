# Elements

### Ispezione delle istruzioni per gli agenti del backend

Durante la revisione di ogni modifica di `AGENTS.md` del backend o di `ambrogio-model/AGENTS.md`, leggere le istruzioni del backend e confrontarle con quelle di `ambrogio-model` e con i requisiti della capability «Sviluppo governato dal modello».

#### Details
L'ispezione passa se le istruzioni del backend rimandano a `ambrogio-model/AGENTS.md` per le regole comuni, descrivono un solo modello letto e validato dalla cartella di lavoro con la versione di Reqvire di `ambrogio-model/.reqvire-version` e i controlli di `ambrogio-model/scripts/model-checks`, non contraddicono alcun requisito e aggiungono soltanto indicazioni proprie del backend. Fallisce se le istruzioni descrivono un modello autonomo del backend, fissano una versione di Reqvire propria, nominano revisioni fissate fra repository o contraddicono un requisito. Non automatizzabile: stabilire che istruzioni in prosa applicano o contraddicono un requisito richiede di leggerle.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica del governo del modello](../../../ambrogio-model/system-model/Verifications/ModelDrivenDevelopment.md#verifica-del-governo-del-modello)
  * verify: [Istruzioni per gli agenti del backend](../Requirements/Workspace.md#istruzioni-per-gli-agenti-del-backend)
---

### Verifica del workspace pnpm

Raggruppa le verifiche della configurazione del workspace comune e dell'installazione delle dipendenze con pnpm.

#### Metadata
  * type: verification-objective
---

### Prova dell'installazione nel workspace pnpm

In un checkout pulito, individuare i pacchetti del workspace dalla radice e installare le dipendenze con pnpm.

#### Details
La prova passa se il workspace radice include l'applicazione server e i suoi package business e se `pnpm install` dalla radice completa l'installazione delle loro dipendenze senza errori. Fallisce se uno dei pacchetti non appartiene al workspace o richiede un'installazione separata fuori dal workspace. La prova è eseguita dalla CI del backend a ogni push sul branch principale e a ogni pull request: il job parte da un checkout pulito ed esegue `pnpm install --frozen-lockfile` dalla radice del repository, `workspace/ambrogio-backend` nella cartella di lavoro della CI, prima di compilare e testare tutti i pacchetti.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica del workspace pnpm](#verifica-del-workspace-pnpm)
  * satisfiedBy: [ci.yml](../../.github/workflows/ci.yml)
  * verify: [Gestione pnpm del workspace](../Requirements/Workspace.md#gestione-pnpm-del-workspace)
---

### Verifica della struttura del monorepo

Raggruppa i controlli sulla collocazione delle applicazioni eseguibili e dei moduli business nel workspace.

#### Metadata
  * type: verification-objective
---

### Analisi degli import dei test degli adapter

Analizzare il grafo degli import dei test degli adapter inbound e outbound di ogni modulo business, compresi `import type` e riesportazioni, distinguendo il codice di produzione da runner, assertion, tecnologie degli adapter e fake locali.

#### Details
L'analisi passa se i test inbound importano codice di produzione solo dal proprio adapter inbound e dall'Application del modulo, senza Domain, e i test outbound solo dal proprio adapter outbound, dall'Application e dal Domain del modulo, senza adapter inbound. Fallisce se un test raggiunge altro codice di produzione, anche tramite un import di soli tipi. Runner, assertion, tecnologie degli adapter e fake locali non sono classificati come codice di produzione del modulo.

Non automatizzabile: diversi test degli adapter importano `src/project-error.ts`, che si trova fuori dalle cartelle dei layer; è una deviazione nota in attesa di una decisione sulla collocazione di `ProjectError`, e finché quella decisione manca un controllo automatico fallirebbe su quegli import.

#### Metadata
  * type: analysis-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Import del codice di produzione nei test degli adapter inbound](../Requirements/Workspace.md#import-del-codice-di-produzione-nei-test-degli-adapter-inbound)
  * verify: [Import del codice di produzione nei test degli adapter outbound](../Requirements/Workspace.md#import-del-codice-di-produzione-nei-test-degli-adapter-outbound)
---

### Controllo degli adapter tra moduli business

Quando esiste un adapter che collega due moduli business del server, individuare il modulo consumatore, il modulo fornitore e l'applicazione che li assembla.

#### Details
Il controllo passa se ciascun adapter di questo tipo risiede nell'applicazione che assembla i due moduli, sotto `src/adapters/out/<consumer>-to-<provider>/`, con i nomi coerenti con i ruoli effettivi. Fallisce se risiede in uno dei package business, in un'altra app o in un percorso che non rappresenta la direzione del collegamento.

Non automatizzabile: individuare un adapter che collega due moduli business e la direzione del collegamento richiede di leggerne la responsabilità.

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

Non automatizzabile: giudicare se un subpath esportato è necessario alle applicazioni richiede giudizio umano.

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

Non automatizzabile: riconoscere un package generico di condivisione indipendentemente dal nome richiede giudizio umano.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Introduzione controllata dei package generici](../Requirements/Workspace.md#introduzione-controllata-dei-package-generici)
---

### Controllo della collocazione dei test business

Classificare i test che esercitano un singolo modulo business e le prove che esercitano la collaborazione di più moduli business; confrontare la loro collocazione con i package e le applicazioni che assemblano i moduli.

#### Details
Il controllo passa se ogni test di un singolo modulo business risiede nel package di quel modulo e ogni prova di collaborazione tra moduli risiede nell'applicazione che li assembla. Fallisce se un test di modulo è esterno al proprio package o una prova tra moduli è collocata in un package business o in un'applicazione diversa da quella che li assembla.

Non automatizzabile: classificare un test come prova di un singolo modulo o della collaborazione tra moduli richiede di leggerlo.

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

Non automatizzabile: classificare un'unità come applicazione eseguibile o modulo business riutilizzabile richiede giudizio umano.

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

Non automatizzabile: attribuire le responsabilità del codice a runtime, composition o entrypoint richiede di leggerlo.

#### Metadata
  * type: inspection-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * verify: [Assemblaggio dei componenti nelle app](../Requirements/Workspace.md#assemblaggio-dei-componenti-nelle-app)
  * verify: [Coordinamento dell'esecuzione negli entrypoint](../Requirements/Workspace.md#coordinamento-dellesecuzione-negli-entrypoint)
  * verify: [Meccanismi tecnici del processo nelle app](../Requirements/Workspace.md#meccanismi-tecnici-del-processo-nelle-app)
---

### Prova degli import dei test Domain e Application

Leggendo come testo i sorgenti, tolti i commenti, estrarre con un'espressione regolare gli specificatori di `import … from`, `export … from`, degli import di soli effetti `import '…'` e degli import dinamici letterali `import('…')`, compresi `import type` ed `export type`, dei file di prova `*.spec.ts` accanto ai file di `src/domain/` e di `src/application/` di ogni package sotto `packages/`, seguendo anche gli import verso i moduli di supporto della cartella `test/` del package. Sono codice di produzione i file sotto `src/` di un package o di un'applicazione, esclusi i file `*.spec.ts`, e i package del workspace importati per nome.

#### Details
La prova passa se i test Domain raggiungono codice di produzione soltanto in `src/domain/` del proprio package e i test Application soltanto in `src/application/` o `src/domain/` del proprio package. Fallisce se un test, direttamente o tramite un modulo di supporto dei test, raggiunge altro codice di produzione, anche tramite un import di soli tipi, oppure se un file di prova di un package si chiama `*.test.ts`, non risiede in `src/domain/`, `src/application/`, `src/adapters/in/` o `src/adapters/out/` o non ha accanto il file che verifica, e quindi non è classificabile. Runner, assertion, moduli Node.js, dipendenze npm e moduli di supporto dei test non sono codice di produzione. Fallisce anche se l'estrazione non riconosce, in un file d'esempio, import di valori, `import type`, import su più righe, import di soli effetti, riesportazioni e import dinamici, o se riconosce come import un testo in un commento o in una stringa.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * satisfiedBy: [import-boundaries.spec.ts](../../test/repository/import-boundaries.spec.ts)
  * verify: [Import del codice di produzione nei test Application](../Requirements/Workspace.md#import-del-codice-di-produzione-nei-test-application)
  * verify: [Import del codice di produzione nei test Domain](../Requirements/Workspace.md#import-del-codice-di-produzione-nei-test-domain)
---

### Prova degli import delle API pubbliche nelle applicazioni

Leggendo come testo i sorgenti, tolti i commenti, estrarre con un'espressione regolare gli specificatori di `import … from`, `export … from`, degli import di soli effetti `import '…'` e degli import dinamici letterali `import('…')`, compresi `import type` ed `export type`, di tutti i file TypeScript sotto `apps/`, inclusi i test, e confrontarli con il nome e il campo `exports` del `package.json` di ogni package sotto `packages/`.

#### Details
La prova passa se ogni import che nomina un package business usa il nome del package seguito da un subpath dichiarato nel suo campo `exports` e se ogni import relativo resta nella directory della propria applicazione. Fallisce se un'applicazione raggiunge un file di un package mediante un percorso relativo, usa un subpath non dichiarato o la radice del package, usa un alias di import con `#` oppure se un `tsconfig*.json` del repository dichiara `paths`. Fallisce anche se l'estrazione non riconosce, in un file d'esempio, import di valori, `import type`, import su più righe, import di soli effetti, riesportazioni e import dinamici, o se riconosce come import un testo in un commento o in una stringa.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * satisfiedBy: [import-boundaries.spec.ts](../../test/repository/import-boundaries.spec.ts)
  * verify: [Import delle API pubbliche dei package business](../Requirements/Workspace.md#import-delle-api-pubbliche-dei-package-business)
---

### Prova degli import tra package business e applicazioni

Leggendo come testo i sorgenti, tolti i commenti, estrarre con un'espressione regolare gli specificatori di `import … from`, `export … from`, degli import di soli effetti `import '…'` e degli import dinamici letterali `import('…')`, compresi `import type` ed `export type`, di tutti i file TypeScript dei package sotto `packages/`, compresi i test ed esclusi `dist/` e `node_modules/`.

#### Details
La prova passa se ogni import relativo di un package resta nella directory del package e nessun import nomina un altro package del workspace. Fallisce se compare anche un solo import verso un altro package o un'applicazione, compresi quelli che importano soltanto tipi. Fallisce anche se l'estrazione non riconosce, in un file d'esempio, import di valori, `import type`, import su più righe, import di soli effetti, riesportazioni e import dinamici, o se riconosce come import un testo in un commento o in una stringa.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * satisfiedBy: [import-boundaries.spec.ts](../../test/repository/import-boundaries.spec.ts)
  * verify: [Isolamento degli import dei package business](../Requirements/Workspace.md#isolamento-degli-import-dei-package-business)
---

### Prova degli import verso package tecnici condivisi

Con la stessa lettura degli import della prova degli import tra package business e applicazioni, considerare come destinazione vietata ogni package del workspace diverso da quello che importa, senza distinguere fra package business e package tecnici.

#### Details
La prova passa se nessun import originato da un package sotto `packages/` nomina un altro package del workspace o raggiunge con un percorso relativo un'altra directory del workspace; così nessun package tecnico condiviso è raggiungibile, qualunque sia il suo nome. Fallisce se compare anche un solo collegamento di questo tipo, inclusi quelli che importano soltanto tipi. Fallisce anche se l'estrazione non riconosce, in un file d'esempio, import di valori, `import type`, import su più righe, import di soli effetti, riesportazioni e import dinamici, o se riconosce come import un testo in un commento o in una stringa.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * satisfiedBy: [import-boundaries.spec.ts](../../test/repository/import-boundaries.spec.ts)
  * verify: [Isolamento dei package business dai package tecnici condivisi](../Requirements/Workspace.md#isolamento-dei-package-business-dai-package-tecnici-condivisi)
---

### Prova delle regole di architettura centrali del backend

Eseguire ogni regola di `test/repository/architecture-rules.ts` sull'intero grafo degli import del repository e sulle fixture negative in memoria di `test/repository/import-boundaries.spec.ts`; leggere l'elenco `exceptions`.

#### Details
La prova passa se l'estrazione degli import riconosce anche gli import di soli tipi, gli import dinamici e le riesportazioni; se l'analisi copre sorgenti e test di ogni applicazione e package; se nessuna regola segnala violazioni sul repository; se ogni regola del contratto «Regole di architettura del backend» ha almeno una fixture negativa e ogni fixture produce violazioni soltanto con il nome della regola attesa; se ogni eccezione nomina una regola esistente, il file, l'import e un motivo non vuoto; e se un'eccezione ammette soltanto l'import che nomina. Fallisce se una regola non ha fixture, se una fixture non fallisce o fallisce per un'altra regola, se l'analisi esclude una parte del grafo o se un'eccezione è incompleta o ammette altri import.

#### Metadata
  * type: test-verification

#### Relations
  * derivedFrom: [Verifica della struttura del monorepo](#verifica-della-struttura-del-monorepo)
  * satisfiedBy: [import-boundaries.spec.ts](../../test/repository/import-boundaries.spec.ts)
  * verify: [Regole di architettura centrali del backend](../Requirements/Workspace.md#regole-di-architettura-centrali-del-backend)
---
