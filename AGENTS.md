# Istruzioni per gli agenti

## Ambito e decisioni del progetto

Queste istruzioni si applicano all'intero progetto.

- Questo repository contiene il backend e i suoi package business. Il client terminale vive nel repository separato `ambrogio-cli`; eventuali altri client avranno repository e modelli Reqvire propri dopo una decisione esplicita.
- Prima di usare Reqvire, identificare repository Git, branch e radice del workspace interessato. Non trattare modelli, copertura o sessioni MCP di repository diversi come un unico grafo. Il contratto HTTP pubblico è posseduto dal backend; il modello del client ne registra la versione compatibile e le proprie obbligazioni.
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

CLI, MCP ed Explorer operano sullo stesso modello Markdown versionato in Git. Le skill sono istruzioni per l'agente, non un database, un server o un validatore. Installare una skill non avvia né collega un server MCP.

| Strumento | Uso nel progetto |
|---|---|
| CLI Reqvire | Avvio dei servizi, interrogazioni da terminale, controlli ripetibili e CI. |
| Server MCP Reqvire | Strumenti strutturati con cui l'agente legge e modifica il modello; il client AI deve essere collegato all'endpoint. |
| Skill `reqvire-syseng` | Metodo per capability, requisiti, contratti, verifiche e modifiche del modello. |
| Skill `reqvire-concept-authoring` | Terminologia e thesaurus SKOS, quando necessari. |
| Skill `reqvire-ontology-authoring` | Ontologie OWL/Turtle e contratti semantici SHACL, quando necessari. |
| Skill `reqvire-audit` | Revisione di qualità, copertura e impatto. |
| Explorer | Consultazione visuale del modello, delle relazioni e dei report nel browser. |

Convenzione del progetto: preferire MCP per l'authoring assistito e CLI per i controlli ripetibili. Questa è una scelta operativa del progetto, non una dichiarazione che tutte le versioni di Reqvire vietino l'authoring CLI.

### Preparazione e avvio

Eseguire gli esempi dalla radice del repository. La funzione seguente è una comodità shell locale: usa il runner npm previsto dalle skill e consente di fissare una versione tramite `REQVIRE_NPX_PACKAGE`.

```bash
rv() {
  npx -y "${REQVIRE_NPX_PACKAGE:-@reqvire-org/reqvire@latest}" --workspace "$PWD" "$@"
}
rv --version
rv --help
```

Prima di rendere il flusso riproducibile in CI, scegliere e fissare la stessa versione per sviluppo e CI. Verificare i sottocomandi con `rv <comando> --help` e gli strumenti MCP tramite `tools/list`; non copiare ciecamente esempi di un'altra versione. Al controllo del 14 ottobre 2026, la release pubblicata è [v1.3.2](https://github.com/reqvire-org/reqvire/releases/tag/v1.3.2) e la [PR #83](https://github.com/reqvire-org/reqvire/pull/83), che propone di spostare l'authoring su MCP, è ancora aperta. Ricontrollare questi dati al setup o a un aggiornamento.

L'avvio MCP richiede un modello valido. Per la modalità con modifiche abilitate, predisporre un solo worktree Git pulito su un branch con almeno un commit, identità autore configurata e nessun altro server che ne possieda la sessione. Il bootstrap iniziale del modello va completato e validato prima dell'avvio, usando le modalità supportate dalla versione scelta.

```bash
rv validate
# Scegliere una modalità di avvio:
rv mcp --enable-mutations
# Oppure Explorer e MCP nello stesso processo:
rv serve --enable-mcp --enable-mutations
```

Sono alternative da eseguire in primo piano in un terminale dedicato. Collegare il client AI all'URL MCP comunicato dal server; per il server MCP standalone, il default documentato è `http://127.0.0.1:8081/mcp`. I comandi di avvio non configurano automaticamente il client. Senza `--enable-mutations` il servizio MCP espone le operazioni di sola lettura.

Non modificare i file del modello con editor, patch o comandi CLI di scrittura mentre una sessione MCP con mutazioni ne possiede lo snapshot. Fermare prima la sessione e gestire le modifiche pendenti; il successivo avvio richiede nuovamente un worktree pulito. I commit automatici sono disabilitati salvo esplicito `--enable-commits`; avviare MCP non autorizza push o pubblicazioni.

### Strumenti per ciascuna fase

Mantenere gli otto passi dell'ordine di lavoro anche nelle spiegazioni e nei piani operativi. Gli strumenti si associano a quei passi; non costituiscono una sequenza alternativa. Preparazione dell'ambiente e consultazione dell'Explorer sono attività di supporto.

I nomi `reqvire.*` sono strumenti MCP chiamati dall'agente con argomenti strutturati, non comandi shell. Leggere gli schemi esposti dal server prima di usarli.

| Fasi | Operazioni |
|---|---|
| 1. Capability | Esplorare con `reqvire.search`, `reqvire.submodels` e `reqvire.collect`; creare o collegare elementi con `reqvire.add_element` e `reqvire.link`. |
| 2. Concetti e ontologie | Usare le skill specialistiche; leggere il contesto con gli strumenti `reqvire.semantic.*` e creare gli elementi tramite gli strumenti di authoring. |
| 3. Requisiti | Con la skill `reqvire-syseng`, raccogliere il contesto con `reqvire.collect`, creare requisiti con `reqvire.add_element` e collegarli alle capability con `reqvire.link`. |
| 4. Contratti | Con la skill `reqvire-syseng`, creare i contratti necessari con `reqvire.add_element`; usare `reqvire.link` per proprietà e dipendenze esplicite, secondo lo schema esposto dal server. |
| 5. Contratti semantici | Con la skill `reqvire-ontology-authoring`, esaminare il vocabolario tramite `reqvire.semantic.*`, creare i profili SHACL e collegarli a ontologie e requisiti tramite gli strumenti di authoring MCP. |
| 6. Verifiche | Creare obiettivi e verifiche concrete, collegarli ai requisiti e controllare la copertura. |
| 7. Implementazione | Scrivere codice e test con gli strumenti di sviluppo del progetto; eseguire i test con il relativo runner. Registrare i collegamenti alle evidenze tramite MCP. Reqvire non sostituisce il runner dei test. |
| 8. Revisione | Usare la skill di audit e i controlli CLI seguenti; interpretare i risultati e risolvere le lacune pertinenti. |

Esempi CLI di lettura e controllo, senza dipendere da una connessione MCP:

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

Fonti: [MCP Server](https://reqvire.org/mcp-server/), [User Guide](https://reqvire.org/user-guide/), [sorgente della guida MCP](https://github.com/reqvire-org/reqvire/blob/main/website/src/pages/McpServer.tsx).

## Applicazione nel progetto

- Procedere in modo incrementale per capability: non è necessario completare l'intero modello del prodotto prima di implementarne una parte.
- Validare anche durante la costruzione del modello, dopo modifiche significative; la revisione finale non sostituisce questi controlli.
- Prima di cambiare codice funzionale, leggere i requisiti, i contratti e le verifiche pertinenti e aggiornarli se cambia l'obbligo del sistema. Riutilizzare il modello esistente quando descrive già correttamente il comportamento.
- Non creare requisiti o test artificiali per ogni modifica cosmetica o amministrativa: mantenere la tracciabilità al livello degli obblighi ingegneristici significativi.
- Usare l'analisi di impatto per guidare la revisione; l'AI deve interpretare le dipendenze esplicite del modello e segnalare quelle mancanti.
- Eseguire Reqvire dalla radice canonica o indicarla esplicitamente con `--workspace`. Prima dell'uso, assicurarsi che esista un repository Git valido; la sola presenza della directory `.git` non lo garantisce.
- Al termine, riportare cosa è cambiato, quali controlli sono stati eseguiti e quali eventuali lacune o attività esterne restano aperte.
- Segreti: il repository usa gitleaks 8.30.1 in CI su tutta la storia (`.github/workflows/secret-scan.yml`, richiesto anche dalla pubblicazione dell'immagine) e in locale con l'hook `.githooks/pre-commit`, da attivare in ogni clone con `git config core.hooksPath .githooks` e con `gitleaks` nel `PATH`. Non aggirare l'hook con `--no-verify`; un ritrovamento si risolve rimuovendo il segreto, e ruotandolo se è già stato committato. I commit eseguiti con `reqvire.git.commit` via MCP non eseguono gli hook Git: per essi vale soltanto la scansione in CI. Esempi e test usano solo valori segnaposto.
