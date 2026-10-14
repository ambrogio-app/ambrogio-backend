# ambrogio-app

Monorepo di Ambrogio con un modello ingegneristico Reqvire condiviso. Ambrogio è pensato come assistente domestico open source con [licenza MIT](LICENSE), installabile nel proprio homelab. L'organizzazione del codice applicativo sarà definita in base alle capability del prodotto.

## Struttura

- `system-model/`: modello Reqvire comune; contiene la prima [proposta di capability](system-model/Capabilities/FamilyAssistance.md) concordata.
- `AGENTS.md`: istruzioni per gli agenti, metodo e strumenti di lavoro.

Il sito e la documentazione utente appartengono a repository separati.

## Stato iniziale

Il monorepo è iniziale: le capability della prima versione sono definite; requisiti, organizzazione del codice e stack tecnologico devono ancora essere definiti.

Seguire [AGENTS.md](AGENTS.md) per la sequenza di lavoro e usare la [documentazione ufficiale Reqvire](https://reqvire.org/) come riferimento autorevole.

## Reqvire locale

La versione usata per il modello iniziale è Reqvire `1.3.2`. Dalla radice del repository:

```bash
npx -y @reqvire-org/reqvire@1.3.2 --workspace "$PWD" validate
npx -y @reqvire-org/reqvire@1.3.2 --workspace "$PWD" mcp --port 8082 --enable-mutations
```

Il secondo comando avvia in primo piano il server MCP. La [configurazione Codex del progetto](.codex/config.toml) punta a `http://127.0.0.1:8082/mcp`. Per le mutazioni Reqvire richiede un branch con almeno un commit e un worktree pulito. Dopo aver avviato il server, aprire una nuova sessione Codex per rendere disponibili i suoi strumenti; fermare il server prima di modificare il modello con editor o CLI.

Per aprire l'Explorer web in un altro terminale:

```bash
npx -y @reqvire-org/reqvire@1.3.2 --workspace "$PWD" serve --port 8080
```

La UI è disponibile su `http://127.0.0.1:8080`. Il comando avvia solo l'Explorer; il server MCP configurato per Codex rimane sulla porta 8082.
