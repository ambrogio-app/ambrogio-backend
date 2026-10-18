# Italian voices for sherpa-onnx

The Docker image contains the Piper voices **Riccardo x_low** and **Paola medium** in the format used by [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), the library that synthesises speech inside the backend process. Each voice is a folder with the `.onnx` model, the voice's original JSON, `tokens.txt`, the pronunciation data `espeak-ng-data/` and the `MODEL_CARD`.

The build downloads the archives `vits-piper-it_IT-riccardo-x_low.tar.bz2` and `vits-piper-it_IT-paola-medium.tar.bz2` from the k2-fsa/sherpa-onnx [`tts-models`](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models) release and checks their SHA-256 hashes in `scripts/fetch-voices.mjs`:

| Archive | SHA-256 |
|---|---|
| `vits-piper-it_IT-riccardo-x_low.tar.bz2` | `8ad0791558ae2b3e96054fc5756ae3ae2f6457fb1765bc01f43bbab85e0a7021` |
| `vits-piper-it_IT-paola-medium.tar.bz2` | `7541f75778afa164e44e34baaef63befad7698595df26a95ca944b63ef1a16b4` |

The voices come from the [Piper Voices catalogue](https://huggingface.co/rhasspy/piper-voices), which releases them under the MIT license; k2-fsa converted them for sherpa-onnx, adding the model metadata, `tokens.txt` and `espeak-ng-data`. The model cards name the training datasets (M-AILABS for Riccardo and Voice-Dataset-Italian for Paola). These models are separate from the Ambrogio code.

In the image the voices are in `/opt/ambrogio/voices`. The backend's voice file selects a voice with `voiceEngine: "piper"` and `voiceModelDir`, for example `/opt/ambrogio/voices/vits-piper-it_IT-paola-medium` or `/opt/ambrogio/voices/vits-piper-it_IT-riccardo-x_low`. The folder must contain exactly one `.onnx` file, `tokens.txt` and `espeak-ng-data/`. The voice is loaded once at startup: the choice applies to every connected satellite and needs a backend restart. To use other voices, for example in another language, mount a read-only folder on `/opt/ambrogio/voices`; the mount replaces the bundled folders and must contain the selected folder with the same structure. The Vosk model for speech recognition stays on a separate volume.

Kokoro models, selected with `voiceEngine: "kokoro"`, `voiceSpeaker` (the number of the voice in the model) and `voiceLanguage` (an espeak-ng language code), are not included in the image: download them from the same release and mount them on a path other than `/opt/ambrogio/voices`, so that the bundled voices are not replaced. For `kokoro-multi-lang-v1_0` the SHA-256 of the archive is `c5f7e2d2caf082bc1d20fb70334a61d99d20b484500aad32e7cf84c128ea3298`.
