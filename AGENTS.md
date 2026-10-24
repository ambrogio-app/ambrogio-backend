# Istruzioni per gli agenti

## Ambito e decisioni del progetto

Queste istruzioni si applicano al lavoro in questo repository. Le regole comuni a tutti i repository di Ambrogio (un solo modello, Reqvire solo da CLI, il modello comanda, baseline Reqvire, dati di installazione, CI, scansione dei segreti) sono in `ambrogio-model/AGENTS.md`, nel repository `ambrogio-model` affiancato a questo nella cartella di lavoro; qui si aggiungono soltanto le indicazioni proprie del backend.

- Questo repository contiene il backend e i suoi package business. I client conversazionali vivono nei propri repository e usano soltanto le interfacce pubbliche del backend: il protocollo conversazionale e le API HTTP pubbliche, oltre all'ingresso di prova pubblico per le loro prove di integrazione.
- La parte del modello Reqvire che appartiene al backend risiede in `system-model/`; insieme a `ambrogio-model` e agli altri repository affiancati forma un solo modello. I requisiti del backend specificano le capability di `ambrogio-model` e raffinano con `derivedFrom` le decisioni comuni; il backend non si collega mai ai repository dei client.
- Il backend possiede il protocollo e le API HTTP pubbliche. I client non fissano una revisione del backend: un cambio incompatibile di un'interfaccia pubblica introduce una nuova versione maggiore, mantenendo la precedente come elemento distinto del modello del backend finché un client la usa.
- La documentazione utente appartiene a `ambrogio-docs`. Quando cambia un comportamento pubblico, una configurazione, un limite, un messaggio o una versione d'interfaccia del backend, aggiornare nello stesso lavoro le pagine interessate, come prescrive `ambrogio-model/AGENTS.md`.
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

Il modello si legge e si valida dalla cartella di lavoro che contiene `ambrogio-model`, questo repository e gli altri repository affiancati; eseguire gli esempi da quella cartella. La funzione seguente è una comodità shell locale e usa la versione di Reqvire scritta in `ambrogio-model/.reqvire-version`, la stessa della CI.

```bash
rv() {
  npm_config_loglevel=error npx -y "@reqvire-org/reqvire@$(cat ambrogio-model/.reqvire-version)" --workspace "$PWD" "$@"
}
rv --version
rv --help
```

Verificare i sottocomandi con `rv <comando> --help`; non copiare ciecamente esempi di un'altra versione. Il cambio di versione di Reqvire è una modifica di `ambrogio-model`.

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

Controlli, dalla cartella di lavoro:

```bash
rv submodels --json
rv search --filter-type capability --short
rv collect "Nome della capability"
ambrogio-model/scripts/model-checks
rv coverage
rv traces
ambrogio-model/scripts/change-impact-composite
```

`ambrogio-model/scripts/model-checks` esegue validazione, lint senza rilievi, integrità del modello e controllo del grafo fra repository, come la CI. `ambrogio-model/scripts/change-impact-composite` confronta ogni repository con la propria base rispetto a `main` e copre così tutte le modifiche di un branch, anche su più repository. Il report di copertura non certifica che i test siano passati e le verifiche segnalate da change-impact richiedono revisione, non sono automaticamente test falliti.

Fonti: [User Guide](https://reqvire.org/user-guide/).

## Applicazione nel progetto

- Procedere in modo incrementale per capability: non è necessario completare l'intero modello del prodotto prima di implementarne una parte.
- Validare anche durante la costruzione del modello, dopo modifiche significative; la revisione finale non sostituisce questi controlli.
- Prima di cambiare codice funzionale, leggere i requisiti, i contratti e le verifiche pertinenti e aggiornarli se cambia l'obbligo del sistema. Riutilizzare il modello esistente quando descrive già correttamente il comportamento.
- Non creare requisiti o test artificiali per ogni modifica cosmetica o amministrativa: mantenere la tracciabilità al livello degli obblighi ingegneristici significativi.
- Usare l'analisi di impatto per guidare la revisione; l'AI deve interpretare le dipendenze esplicite del modello e segnalare quelle mancanti.
- Eseguire Reqvire dalla cartella di lavoro o indicarla esplicitamente con `--workspace`. Prima dell'uso, assicurarsi che ogni repository affiancato sia un repository Git valido sul branch previsto; la sola presenza della directory `.git` non lo garantisce. Un cambiamento che tocca più repository usa lo stesso nome di branch in ciascuno.
- Al termine, riportare cosa è cambiato, quali controlli sono stati eseguiti e quali eventuali lacune o attività esterne restano aperte.
- CI del backend: `.github/workflows/ci.yml` esegue il checkout di questo repository in `workspace/ambrogio-backend`, scarica affiancati `ambrogio-model` e gli altri repository con `ambrogio-model/scripts/checkout-workspace`, esegue `ambrogio-model/scripts/model-checks` e poi typecheck, build e test del backend.
- Segreti: il repository segue le regole comuni di `ambrogio-model/AGENTS.md`; la scansione in CI (`.github/workflows/secret-scan.yml`) è richiesta anche dalla pubblicazione dell'immagine, e l'hook `.githooks/pre-commit` si attiva in ogni clone con `git config core.hooksPath .githooks`, con `gitleaks` nel `PATH`. Esempi e test usano solo valori segnaposto.
- Dati di installazione: valgono le regole comuni di `ambrogio-model/AGENTS.md`; le configurazioni d'esempio degli agenti e dei componenti del backend usano soltanto valori segnaposto o indirizzi di esempio.
