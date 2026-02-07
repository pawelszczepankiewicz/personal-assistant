# Project Rules

## No Internet at Runtime

Any internet connection during chat usage is strictly forbidden. All TTS, LLM inference, and other services must run locally. External network calls (cloud APIs, CDNs, telemetry) are not allowed in runtime code.

- English TTS: Orpheus via local LM Studio (`127.0.0.1:1234`)
- Polish TTS: Piper with local ONNX models (`tts-server/models/`)
- LLM: Local LM Studio

Internet is only permitted during one-time setup (`npm run setup`) to download dependencies and models.
