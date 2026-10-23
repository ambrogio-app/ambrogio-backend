# Istruzioni per gli agenti

## Ambito e decisioni del progetto

Queste istruzioni si applicano all'intero progetto.

- Questo repository contiene il backend e i suoi package business. Il client terminale vive nel repository separato `ambrogio-cli`; eventuali altri client avranno repository e modelli Reqvire propri dopo una decisione esplicita.
- Prima di usare Reqvire, identificare repository Git, branch e radice del workspace interessato. Non trattare modelli o copertura di repository diversi come un unico grafo. Il contratto HTTP pubblico è posseduto dal backend; il modello del client ne registra la versione compatibile e le proprie obbligazioni.
- Il modello ingegneristico risiede in `system-model/`.
- Il sito e la documentazione utente appartengono a repository separati. Non aggiungerli a questo repository senza una nuova decisione esplicita.
- Quando cambia un comportamento pubblico, valutare anche l'impatto su sito e documentazione utente e indicare gli aggiornamenti necessari. La validazione locale non dimostra la coerenza di quei repository esterni.
- Prima di introdurre una scelta tecnica o architetturale non già stabilita dal modello Reqvire o da una decisione esplicita della persona, presentare le alternative e le conseguenze, chiedere la decisione e concordarla con la persona. Registrare la decisione nel punto pertinente di `system-model/` prima di implementarla; codice, test e commit non sostituiscono questa registrazione. Non assumere che un incarico generale di implementazione autorizzi scelte tecniche nuove. Non chiedere di riconfermare decisioni già prese e pubblicate.

## Fonte autorevole

La documentazione ufficiale di Reqvire, <https://reqvire.org/>, è il riferimento autorevole per il metodo e l'uso dello strumento.

- Consultare la documentazione pertinente prima di introdurre convenzioni o usare funzionalità di cui non sono stati verificati i vincoli.
- Distinguere sempre ciò che è prescritto o supportato dalle fonti ufficiali dalle nostre proposte progettuali.
- Verificare la compatibilità delle istruzioni con la versione di Reqvire utilizzata: esempi delle skill, sito e ramo `main` possono non essere allineati. Non assumere che un comando trovato in un esempio sia ancora disponibile.

Riferimenti per il percorso di lavoro:

- [Coding Assistants — Recommended Workflow](https://reqvire.org/coding-assistants/).
- [Sorgente ufficiale della pagina Coding Assistants](https://github.com/reqvire-org/reqvire/blob/main/website/src/pages/CodingAssistants.tsx).
- [Adding New Capabilities & Requirements — MBSE Workflow](https://github.com/reqvire-org/reqvire/blob/main/codex-skills/reqvire-syseng/references/AddCapability.md#mbse-workflow).
- [Istruzioni di sviluppo Reqvire — MBSE Development Workflow](https://github.com/reqvire-org/reqvire/blob/main/CLAUDE.md#mbse-development-workflow).

## Ordine di lavoro

Seguire il percorso ufficiale per ogni nuova capability o modifica funzionale significativa:

1. **Capability:** chiarire quale capacità operativa deve offrire il prodotto, a chi serve e quale bisogno soddisfa. Esaminare le capability esistenti prima di crearne altre; scomporre solo quando emergono responsabilità o capacità distinte. Cartelle, schermate e moduli non definiscono automaticamente capability.
2. **Concetti e ontologie:** chiarire o riutilizzare la terminologia condivisa e il significato strutturale del dominio. Usare concetti per il vocabolario curato e ontologie per classi, proprietà e relazioni semantiche; introdurli quando utili al modello.
3. **Requisiti:** definire obblighi implementabili, atomici e verificabili, collegati alla capability mediante `specify` / `specifiedBy`. Esprimere chiaramente condizioni e comportamento atteso, usando i pattern EARS appropriati.
4. **Contratti:** precisare i requisiti, quando necessario, con fonti, specifiche, vincoli, comportamenti, stati e contratti di ingresso/uscita. Ogni contratto non semantico deve avere il proprio requisito proprietario. Rendere esplicite le dipendenze dai contratti condivisi.
5. **Contratti semantici:** quando necessari, definire profili SHACL riutilizzabili, collegarli alle ontologie tramite `use` / `usedBy` e ai requisiti tramite `constrain` / `constrainedBy`.
6. **Verifiche:** definire prima dell'implementazione come dimostrare i requisiti foglia, con criteri di successo espliciti. Organizzare le verifiche concrete sotto obiettivi di verifica. La copertura delle capability deriva dai requisiti che le specificano.
7. **Test, implementazione ed evidenze:** creare i test necessari secondo le verifiche definite, poi implementare il comportamento. I test possono essere affinati durante lo sviluppo. Collegare requisiti e verifiche compatibili a codice, test ed evidenze tramite `satisfiedBy`; non confondere la presenza di un collegamento con l'esito positivo di un test.
8. **Validazione e revisione:** verificare struttura e qualità del modello, copertura, tracciabilità e impatto delle modifiche. Usare le operazioni supportate dalla versione adottata per `validate`, `lint`, `coverage`, `traces` e `change-impact`; riesaminare gli elementi segnalati e svolgere le verifiche pertinenti prima di dichiarare concluso il lavoro.

## Strumenti e flusso operativo

Il progetto usa soltanto la CLI Reqvire, sia per leggere e modificare il modello sia per i controlli ripetibili e la CI; non usa server MCP Reqvire. CLI ed Explorer operano sullo stesso modello Markdown versionato in Git. Le skill sono istruzioni per l'agente, non un database, un server o un validatore.

| Strumento | Uso nel progetto |
|---|---|
| CLI Reqvire | Lettura, authoring, controlli ripetibili e CI. |
| Skill `reqvire-syseng` | Metodo per capability, requisiti, contratti, verifiche e modifiche del modello. |
| Skill `reqvire-concept-authoring` | Terminologia e thesaurus SKOS, quando necessari. |
| Skill `reqvire-ontology-authoring` | Ontologie OWL/Turtle e contratti semantici SHACL, quando necessari. |
| Skill `reqvire-audit` | Revisione di qualità, copertura e impatto. |
| Explorer | Consultazione visuale del modello, delle relazioni e dei report nel browser (`rv serve`, senza `--enable-mcp`). |

### Preparazione

Eseguire gli esempi dalla radice del repository. La funzione seguente è una comodità shell locale e fissa la versione usata anche in CI.

```bash
rv() {
  npm_config_loglevel=error npx -y @reqvire-org/reqvire@1.3.2 --workspace "$PWD" "$@"
}
rv --version
rv --help
```

Verificare i sottocomandi con `rv <comando> --help`; non copiare ciecamente esempi di un'altra versione. Al cambio di versione di Reqvire aggiornare insieme sviluppo e CI.

### Strumenti per ciascuna fase

Mantenere gli otto passi dell'ordine di lavoro anche nelle spiegazioni e nei piani operativi. Gli strumenti si associano a quei passi; non costituiscono una sequenza alternativa.

| Fasi | Operazioni |
|---|---|
| 1. Capability | Esplorare con `rv search`, `rv submodels` e `rv collect`; creare elementi con `rv add` e collegarli con `rv link`. |
| 2. Concetti e ontologie | Usare le skill specialistiche; leggere il contesto con `rv collect`, `rv concepts` e `rv semantic`; creare gli elementi con `rv add`. |
| 3. Requisiti | Con la skill `reqvire-syseng`, raccogliere il contesto con `rv collect`, creare requisiti con `rv add` e collegarli alle capability con `rv link`. |
| 4. Contratti | Con la skill `reqvire-syseng`, creare i contratti con `rv add`; usare `rv link` per proprietà e Contract References. |
| 5. Contratti semantici | Con la skill `reqvire-ontology-authoring`, creare i profili SHACL e collegarli a ontologie e requisiti con `rv link`. |
| 6. Verifiche | Creare obiettivi e verifiche concrete, collegarli ai requisiti e controllare la copertura con `rv coverage`. |
| 7. Implementazione | Scrivere codice e test con gli strumenti di sviluppo del progetto; eseguire i test con il relativo runner. Registrare i collegamenti alle evidenze con `rv link`. Reqvire non sostituisce il runner dei test. |
| 8. Revisione | Usare la skill di audit e i controlli seguenti; interpretare i risultati e risolvere le lacune pertinenti. |

Quando la CLI non offre l'operazione, per esempio la modifica del testo di un elemento esistente, si modifica direttamente il file Markdown del modello; poi si eseguono `rv format`, `rv validate` e `rv lint`.

Controlli:

```bash
rv submodels --json
rv search --filter-type capability --short
rv collect "Nome della capability"
rv validate
rv lint
rv coverage
rv traces
rv change-impact --git-commit HEAD
```

`HEAD` confronta lo stato corrente con l'ultimo commit; prima della revisione di una PR scegliere la revisione base appropriata, presente localmente, invece di assumere che `HEAD` rappresenti tutte le modifiche della PR. Il report di copertura non certifica che i test siano passati e le verifiche segnalate da change-impact richiedono revisione, non sono automaticamente test falliti.

Fonti: [User Guide](https://reqvire.org/user-guide/).

## Applicazione nel progetto

- Procedere in modo incrementale per capability: non è necessario completare l'intero modello del prodotto prima di implementarne una parte.
- Validare anche durante la costruzione del modello, dopo modifiche significative; la revisione finale non sostituisce questi controlli.
- Prima di cambiare codice funzionale, leggere i requisiti, i contratti e le verifiche pertinenti e aggiornarli se cambia l'obbligo del sistema. Riutilizzare il modello esistente quando descrive già correttamente il comportamento.
- Non creare requisiti o test artificiali per ogni modifica cosmetica o amministrativa: mantenere la tracciabilità al livello degli obblighi ingegneristici significativi.
- Usare l'analisi di impatto per guidare la revisione; l'AI deve interpretare le dipendenze esplicite del modello e segnalare quelle mancanti.
- Eseguire Reqvire dalla radice canonica o indicarla esplicitamente con `--workspace`. Prima dell'uso, assicurarsi che esista un repository Git valido; la sola presenza della directory `.git` non lo garantisce.
- Al termine, riportare cosa è cambiato, quali controlli sono stati eseguiti e quali eventuali lacune o attività esterne restano aperte.
- Segreti: il repository usa gitleaks 8.30.1 in CI su tutta la storia (`.github/workflows/secret-scan.yml`, richiesto anche dalla pubblicazione dell'immagine) e in locale con l'hook `.githooks/pre-commit`, da attivare in ogni clone con `git config core.hooksPath .githooks` e con `gitleaks` nel `PATH`. Non aggirare l'hook con `--no-verify`; un ritrovamento si risolve rimuovendo il segreto, e ruotandolo se è già stato committato. Esempi e test usano solo valori segnaposto.
- Dati di installazione: il modello Reqvire registra obblighi e decisioni del prodotto, non dati di una specifica installazione. Non riportare in modelli, codice, test, commit o documentazione indirizzi IP, nomi host, domini, percorsi personali, credenziali, identificativi di dispositivi o entità, nomi di stanze, né la configurazione effettiva di chi usa il prodotto. Le evidenze di prove su installazioni reali descrivono l'ambiente in termini generici: per esempio «l'installazione di riferimento», l'architettura, l'hardware o la versione usata. Gli esempi usano valori segnaposto o indirizzi di esempio.
