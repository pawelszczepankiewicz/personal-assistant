# Personal Assistant

A local voice and chat assistant. It runs on your machine: the LLM, text-to-speech, and the web UI never call cloud APIs while you chat.

- **Chat** with any model loaded in [LM Studio](https://lmstudio.ai/), with streamed responses and Markdown rendering
- **Model picker** and an editable **system prompt**
- **Voice input** via the browser's Speech Recognition API, auto-sending after a short silence
- **Spoken replies** with streamed PCM playback
  - English: [Orpheus](https://huggingface.co/canopylabs/orpheus-3b-0.1-ft) running in LM Studio, decoded with [SNAC](https://github.com/hubertsiuzdak/snac)
  - Polish: [Piper](https://github.com/rhasspy/piper) with local ONNX voices
- **Conversation mode**: a hands-free listen → think → speak loop

## Architecture

```
Browser (Nuxt SPA)
  │
  ▼
Nuxt server routes  (localhost:3000)
  ├── /api/chat, /api/models ──► LM Studio        (127.0.0.1:1234)
  └── /api/tts, /api/voices  ──► Python TTS server (127.0.0.1:8008)
                                   ├── Orpheus ──► LM Studio (completions)
                                   └── Piper   ──► tts-server/models/*.onnx
```

| Path | Purpose |
| --- | --- |
| `app/` | Nuxt 4 frontend: chat page, components, `useChat` and `useSpeech` composables |
| `server/api/` | Thin proxies to LM Studio and the TTS server |
| `tts-server/server.py` | FastAPI server that routes each voice to Orpheus or Piper and streams 24 kHz 16-bit mono PCM |
| `tts-server/download-models.sh` | Downloads the Piper Polish voices |

## Requirements

- Node.js 20+
- Python 3.10+
- [LM Studio](https://lmstudio.ai/) with its local server enabled on port `1234`, and these models loaded:
  - a chat model of your choice
  - `orpheus-3b-0.1-ft` (only needed for English speech)
- A GPU helps: SNAC runs on CUDA, Apple Silicon (MPS) or CPU

## Setup

One-time setup. This step needs internet access to fetch dependencies and models.

```bash
npm run setup
```

This installs npm packages, installs the Python requirements, and downloads the Piper voices into `tts-server/models/`.

The SNAC decoder (`hubertsiuzdak/snac_24khz`) is downloaded from Hugging Face the first time the TTS server starts, then cached locally.

## Running

Start LM Studio's server, then:

```bash
npm run dev:all
```

This starts the Nuxt app on <http://localhost:3000> and the TTS server on `127.0.0.1:8008`. To run them separately, use `npm run dev` and `npm run dev:tts`.

The app works without the TTS server; the voice controls are then hidden.

## Voices

| Voice | Language | Engine |
| --- | --- | --- |
| tara, leah, jess, leo, dan, mia, zac, zoe | English | Orpheus |
| gosia, darkman | Polish | Piper |

The selected voice also sets the speech-recognition language (`en-US` or `pl-PL`). To add voices, edit the `VOICES` registry in `tts-server/server.py`.

## Configuration

The service URLs are set in `nuxt.config.ts` under `runtimeConfig`, and can be overridden with environment variables:

| Variable | Default |
| --- | --- |
| `NUXT_LM_STUDIO_BASE_URL` | `http://127.0.0.1:1234` |
| `NUXT_TTS_SERVER_URL` | `http://127.0.0.1:8008` |

## Privacy notes

- LLM inference and TTS run fully locally.
- Voice input uses the browser's built-in `SpeechRecognition`. In Chrome this sends audio to Google's speech service. Use typed input if you need everything to stay on your machine.

## TTS server API

| Endpoint | Description |
| --- | --- |
| `GET /api/voices` | List available voices |
| `GET /api/tts?text=…&voice=…` | Full WAV file |
| `GET /api/tts/stream?text=…&voice=…` | Raw PCM stream (24 kHz, 16-bit, mono) |
| `GET /health` | Status and the SNAC device in use |
