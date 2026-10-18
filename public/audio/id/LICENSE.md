# Indonesian recordings — license

The `.mp3` files in this folder are synthetic speech generated with **Piper TTS** using the voice
`id_ID-news_tts-medium` from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main/id/id_ID/news_tts/medium)
(fine-tuned from the US English "lessac" voice).

- The voice's model card does not state a license and points to its training dataset. The dataset link
  in the card is wrong (it points to a Malayalam notebook); the voice name matches the Indonesian
  news TTS corpus listed in NusaCrowd as **INDspeech_NEWS_TTS**, licensed **CC BY-NC-SA 4.0**.
- These recordings are therefore distributed under **CC BY-NC-SA 4.0**
  (https://creativecommons.org/licenses/by-nc-sa/4.0/): attribution, **non-commercial use only**,
  derivatives under the same license.

Learn Faster is a non-commercial project. Do not reuse these files commercially. To regenerate them
with another voice, change `PIPER_VOICES` in `src/services/piperCore.ts` and run `npm run audio -- --force`.

The Piper engine (MIT), onnxruntime-web (MIT) and the phonemizer build `@diffusionstudio/piper-wasm`
(MIT, embeds eSpeak NG data) are downloaded at runtime and are not part of this folder.
