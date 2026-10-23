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

### Controllo automatico dell'integrità del modello

Quando la CI del repository esegue la validazione e il lint del modello Reqvire, deve eseguire anche lo script di integrità del modello e deve fallire se lo script segnala una violazione o non riesce a eseguire.

#### Details
Il controllo copre le regole di integrità verificabili sul testo e sui file; `validate` e `lint` di Reqvire non le controllano.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [ci.yml](../../.github/workflows/ci.yml)
  * satisfiedBy: [check-model.mjs](../../scripts/check-model.mjs)
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Coordinamento dell'esecuzione negli entrypoint

Gli entrypoint delle applicazioni eseguibili del monorepo devono coordinare l'esecuzione dei componenti assemblati.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Decisioni sostituite rimosse nella stessa modifica

Quando una decisione ne sostituisce un'altra, la modifica che registra la nuova decisione deve aggiornare o rimuovere ogni requisito, contratto e verifica che afferma la decisione sostituita, e i testi di requisiti, contratti e verifiche non devono riportare date, storia delle decisioni o esiti di esecuzioni.

#### Details
Il modello descrive gli obblighi validi oggi e come verificarli; la storia è conservata da Git. Decisioni datate accumulate nei contratti convivono con elementi che affermano ancora le decisioni sostituite. Gli esiti dei test sono dati dalla CI; l'esito di una verifica manuale si registra nel messaggio del commit o nella pull request che la esegue, non nel modello.

#### Metadata
  * type: requirement

#### Contract References
  * [Script di integrità del modello](../Contracts/ServerFoundation.md#script-di-integrità-del-modello)

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Dipendenze fra contratti dichiarate come riferimenti

Quando il contenuto di un contratto dipende da un contratto posseduto da un altro requisito, il requisito proprietario del contratto dipendente deve dichiarare una Contract Reference al contratto da cui dipende, e il contratto dipendente non deve ripetere il contenuto di quel contratto.

#### Details
Le Contract References propagano l'analisi di impatto: una modifica del contratto riferito segnala il contratto dipendente per la revisione. Un contratto che ripete un fatto posseduto da un altro requisito resta invariato quando quel fatto cambia, e il modello finisce per contraddirsi senza che l'analisi di impatto lo segnali.

#### Metadata
  * type: requirement

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### File di governo collegati al modello

Ogni workflow di CI, hook Git, file di build del container, esempio Compose, file di esclusione, configurazione del gestore di pacchetti, del compilatore o del runner di test e script del repository deve essere riferito da almeno un requisito o una verifica del modello.

#### Details
Un file che codifica decisioni ingegneristiche senza un collegamento al modello cambia senza che alcun obbligo lo segnali, e le decisioni presenti solo nei file divergono fra file simili, per esempio fra i workflow di controllo e quello di pubblicazione.

#### Metadata
  * type: requirement

#### Contract References
  * [Script di integrità del modello](../Contracts/ServerFoundation.md#script-di-integrità-del-modello)

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Formulazione normativa degli obblighi

Gli enunciati dei requisiti e i testi dei contratti devono esprimere gli obblighi con «deve» o «devono» e non devono usare `può`, `possono`, `potrebbe`, `potrebbero`, `dovrebbe`, `dovrebbero` o `eventualmente`; un'opzione lasciata a una parte deve essere espressa nominando la parte che sceglie.

#### Details
Il testo in code span, i messaggi citati e i nomi di elementi tra «» non sono formulazione dell'obbligo. Le sezioni Details dei requisiti sono indicazioni e non vengono controllate. Una formula permissiva rende ambiguo se il comportamento è obbligatorio, facoltativo o scelto da qualcuno, e il codice e il modello finiscono per darne letture diverse.

#### Metadata
  * type: requirement

#### Contract References
  * [Script di integrità del modello](../Contracts/ServerFoundation.md#script-di-integrità-del-modello)

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---

### Gestione pnpm del workspace

Il repository backend deve dichiarare alla radice un workspace pnpm che comprenda l'applicazione server e i suoi package business e consenta di installarne le dipendenze tramite pnpm.

#### Metadata
  * type: requirement

#### Relations
  * satisfiedBy: [pnpm-workspace.yaml](../../pnpm-workspace.yaml)
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

### Verifiche manuali giustificate

Ogni verifica di ispezione, analisi o dimostrazione deve indicare il motivo per cui non è automatizzabile, in una frase che inizia con «Non automatizzabile:».

#### Details
Una verifica automatizzabile è una verifica di test. Reqvire registra che una verifica esiste, non che sia stata eseguita: una verifica manuale non ripetuta dopo una modifica lascia passare una violazione del requisito.

#### Metadata
  * type: requirement

#### Contract References
  * [Script di integrità del modello](../Contracts/ServerFoundation.md#script-di-integrità-del-modello)

#### Relations
  * specify: [Assistenza personale domestica](../Capabilities/FamilyAssistance.md#assistenza-personale-domestica)
---
