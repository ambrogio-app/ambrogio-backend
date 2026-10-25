# Speech models bundled in the backend image

The Docker image includes recognition and synthesis models for Italian and English.
The build downloads the following fixed archives and checks their SHA-256 hashes in
`scripts/fetch-speech-models.mjs` before extraction. The models are separate from
the Ambrogio source code and retain their own licenses.

| Model | Source | SHA-256 |
|---|---|---|
| `sherpa-onnx-whisper-base.tar.bz2` | [sherpa-onnx ASR models](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models) | `911b2083efd7c0dca2ac3b358b75222660dc09fb716d64fbfc417ba6c99ff3de` |
| `vits-piper-it_IT-riccardo-x_low.tar.bz2` | [sherpa-onnx TTS models](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models) | `8ad0791558ae2b3e96054fc5756ae3ae2f6457fb1765bc01f43bbab85e0a7021` |
| `vits-piper-it_IT-paola-medium.tar.bz2` | [sherpa-onnx TTS models](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models) | `7541f75778afa164e44e34baaef63befad7698595df26a95ca944b63ef1a16b4` |
| `vits-piper-en_US-kristin-medium.tar.bz2` | [sherpa-onnx TTS models](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models) | `c2206f572df2956c50b1ae3367eebce3853c663e890cba8048cd62b1e4dbe6c7` |
| `kokoro-multi-lang-v1_0.tar.bz2` | [sherpa-onnx TTS models](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models) | `c5f7e2d2caf082bc1d20fb70334a61d99d20b484500aad32e7cf84c128ea3298` |

The Whisper archive holds OpenAI's multilingual Whisper base model converted for sherpa-onnx, under the
[MIT license of Whisper](https://github.com/openai/whisper/blob/main/LICENSE); the image keeps only
`base-encoder.int8.onnx`, `base-decoder.int8.onnx` and `base-tokens.txt`.
The Piper voice folders contain their `MODEL_CARD` files; the source voices
come from the [Piper catalogue](https://huggingface.co/rhasspy/piper-voices)
under MIT. The bundled Kokoro archive contains its Apache-2.0 `LICENSE` file.

The image paths are `/opt/ambrogio/models/sherpa-onnx-whisper-base`,
`/opt/ambrogio/voices/<piper-voice>`, and
`/opt/ambrogio/kokoro/kokoro-multi-lang-v1_0`. A read-only mount can
replace a bundled directory to use other models. Piper is the practical
default on modest CPUs. Kokoro is loaded only when the installation selects
it; on a 4-core Celeron N5095 it produces audio more slowly than playback.
