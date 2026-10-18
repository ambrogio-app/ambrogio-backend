# Voci italiane per sherpa-onnx

L'immagine Docker contiene le voci Piper **Riccardo x_low** e **Paola medium** nel formato usato da [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), la libreria che sintetizza la voce nel processo del backend. Ogni voce è una directory con il modello `.onnx`, il JSON originale della voce, `tokens.txt`, i dati di pronuncia `espeak-ng-data/` e la scheda `MODEL_CARD`.

Il build scarica gli archivi `vits-piper-it_IT-riccardo-x_low.tar.bz2` e `vits-piper-it_IT-paola-medium.tar.bz2` dalla release [`tts-models`](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models) di k2-fsa/sherpa-onnx e ne verifica gli hash SHA-256 in `scripts/fetch-voices.mjs`:

| Archivio | SHA-256 |
|---|---|
| `vits-piper-it_IT-riccardo-x_low.tar.bz2` | `8ad0791558ae2b3e96054fc5756ae3ae2f6457fb1765bc01f43bbab85e0a7021` |
| `vits-piper-it_IT-paola-medium.tar.bz2` | `7541f75778afa164e44e34baaef63befad7698595df26a95ca944b63ef1a16b4` |

Le voci provengono dal [catalogo Piper Voices](https://huggingface.co/rhasspy/piper-voices), che le rilascia con licenza MIT; k2-fsa le ha convertite per sherpa-onnx aggiungendo i metadati del modello, `tokens.txt` ed `espeak-ng-data`. Le schede identificano i dataset di addestramento (M-AILABS per Riccardo e Voice-Dataset-Italian per Paola). Questi modelli sono distinti dal codice Ambrogio.

Nell'immagine le voci sono in `/opt/ambrogio/voices`. Il file vocale del backend sceglie una voce tramite `voiceEngine: "piper"` e `voiceModelDir`, ad esempio `/opt/ambrogio/voices/vits-piper-it_IT-paola-medium` (la scelta dell'installazione di riferimento) oppure `/opt/ambrogio/voices/vits-piper-it_IT-riccardo-x_low`. La directory deve contenere esattamente un file `.onnx`, `tokens.txt` ed `espeak-ng-data/`. La voce è caricata una sola volta all'avvio: la scelta vale per tutti i satelliti collegati e richiede un riavvio del backend. Per usare altre voci, montare una directory in sola lettura su `/opt/ambrogio/voices`; il mount sostituisce le directory incluse e deve contenere la directory selezionata con la stessa struttura. Il modello Vosk per la trascrizione resta su un volume separato.

I modelli Kokoro, selezionati con `voiceEngine: "kokoro"`, `voiceSpeaker` (numero della voce nel modello) e `voiceLanguage` (codice di lingua espeak-ng), non sono inclusi nell'immagine: vanno scaricati dalla stessa release e montati in un percorso distinto da `/opt/ambrogio/voices`, per non sostituire le voci incluse. Per `kokoro-multi-lang-v1_0` l'impronta SHA-256 dell'archivio è `c5f7e2d2caf082bc1d20fb70334a61d99d20b484500aad32e7cf84c128ea3298`.
