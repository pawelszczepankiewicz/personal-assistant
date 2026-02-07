from __future__ import annotations

import io
import struct
import json
from pathlib import Path
import numpy as np
import torch
import requests
from piper import PiperVoice
from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from snac import SNAC

# --- Config ---
LM_STUDIO_URL = "http://127.0.0.1:1234/v1/completions"
ORPHEUS_MODEL = "orpheus-3b-0.1-ft"
SAMPLE_RATE = 24000
DEFAULT_VOICE = "tara"

# Voice registry: id -> { engine, lang, label, piper_model? }
VOICES = {
    # English - Orpheus (local LM Studio)
    "tara":  {"engine": "orpheus", "lang": "en", "label": "Tara (EN)"},
    "leah":  {"engine": "orpheus", "lang": "en", "label": "Leah (EN)"},
    "jess":  {"engine": "orpheus", "lang": "en", "label": "Jess (EN)"},
    "leo":   {"engine": "orpheus", "lang": "en", "label": "Leo (EN)"},
    "dan":   {"engine": "orpheus", "lang": "en", "label": "Dan (EN)"},
    "mia":   {"engine": "orpheus", "lang": "en", "label": "Mia (EN)"},
    "zac":   {"engine": "orpheus", "lang": "en", "label": "Zac (EN)"},
    "zoe":   {"engine": "orpheus", "lang": "en", "label": "Zoe (EN)"},
    # Polish - Piper (local ONNX)
    "gosia":   {"engine": "piper", "piper_model": "pl_PL-gosia-medium", "lang": "pl", "label": "Gosia (PL)"},
    "darkman": {"engine": "piper", "piper_model": "pl_PL-darkman-medium", "lang": "pl", "label": "Darkman (PL)"},
}

# --- Load SNAC model ---
snac_device = (
    "cuda" if torch.cuda.is_available()
    else "mps" if torch.backends.mps.is_available()
    else "cpu"
)
print(f"Loading SNAC model on {snac_device}...")
snac_model = SNAC.from_pretrained("hubertsiuzdak/snac_24khz").eval().to(snac_device)
print("SNAC model ready.")

# --- Load Piper voices ---
MODELS_DIR = Path(__file__).parent / "models"
piper_voices: dict[str, PiperVoice] = {}
for vid, info in VOICES.items():
    if info["engine"] == "piper":
        model_path = MODELS_DIR / f"{info['piper_model']}.onnx"
        if model_path.exists():
            print(f"Loading Piper voice: {vid} ({model_path.name})...")
            piper_voices[vid] = PiperVoice.load(str(model_path))
            print(f"Piper voice {vid} ready.")
        else:
            print(f"WARNING: Piper model not found: {model_path}. Run 'npm run setup' to download.")

app = FastAPI()


# ==================== Orpheus TTS ====================

def format_prompt(text: str, voice: str) -> str:
    return f"<|audio|>{voice}: {text}<|eot_id|>"


def turn_token_into_id(token_string: str, index: int) -> int | None:
    token_string = token_string.strip()
    last_start = token_string.rfind("<custom_token_")
    if last_start == -1:
        return None
    last_token = token_string[last_start:]
    if last_token.startswith("<custom_token_") and last_token.endswith(">"):
        try:
            number = int(last_token[14:-1])
            return number - 10 - ((index % 7) * 4096)
        except ValueError:
            return None
    return None


def convert_to_audio(multiframe: list[int]) -> bytes | None:
    if len(multiframe) < 7:
        return None

    num_frames = len(multiframe) // 7
    frame = multiframe[:num_frames * 7]

    codes_0, codes_1, codes_2 = [], [], []

    for j in range(num_frames):
        i = 7 * j
        codes_0.append(frame[i])
        codes_1.extend([frame[i + 1], frame[i + 4]])
        codes_2.extend([frame[i + 2], frame[i + 3], frame[i + 5], frame[i + 6]])

    codes = [
        torch.tensor([codes_0], device=snac_device, dtype=torch.int32),
        torch.tensor([codes_1], device=snac_device, dtype=torch.int32),
        torch.tensor([codes_2], device=snac_device, dtype=torch.int32),
    ]

    for c in codes:
        if torch.any(c < 0) or torch.any(c > 4096):
            return None

    with torch.inference_mode():
        audio_hat = snac_model.decode(codes)

    audio_slice = audio_hat[:, :, 2048:4096]
    audio_np = audio_slice.detach().cpu().numpy()
    audio_int16 = (audio_np * 32767).astype(np.int16)
    return audio_int16.tobytes()


def stream_tokens_from_lm_studio(prompt: str, max_tokens: int = 1200,
                                  temperature: float = 0.6, top_p: float = 0.9,
                                  repetition_penalty: float = 1.35):
    payload = {
        "model": ORPHEUS_MODEL,
        "prompt": prompt,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": top_p,
        "repeat_penalty": repetition_penalty,
        "stream": True,
    }

    response = requests.post(
        LM_STUDIO_URL,
        headers={"Content-Type": "application/json"},
        json=payload,
        stream=True,
    )
    response.raise_for_status()

    for line in response.iter_lines():
        if not line:
            continue
        decoded = line.decode("utf-8")
        if not decoded.startswith("data: "):
            continue
        data_str = decoded[6:]
        if data_str.strip() == "[DONE]":
            break
        try:
            data = json.loads(data_str)
            token_text = data.get("choices", [{}])[0].get("text", "")
            if token_text:
                yield token_text
        except json.JSONDecodeError:
            continue


def generate_orpheus_pcm(text: str, voice: str, max_tokens: int,
                         temperature: float, top_p: float,
                         repetition_penalty: float):
    prompt = format_prompt(text, voice)
    token_gen = stream_tokens_from_lm_studio(
        prompt, max_tokens, temperature, top_p, repetition_penalty
    )

    buffer = []
    count = 0

    for token_text in token_gen:
        token_id = turn_token_into_id(token_text, count)
        if token_id is None or token_id <= 0:
            continue

        buffer.append(token_id)
        count += 1

        if count % 7 == 0 and count > 20:
            chunk = convert_to_audio(buffer[-21:])
            if chunk:
                yield chunk


# ==================== Piper TTS ====================

PIPER_SAMPLE_RATE = 22050

def resample_pcm(pcm_bytes: bytes, from_rate: int, to_rate: int) -> bytes:
    """Resample 16-bit mono PCM using numpy linear interpolation."""
    if from_rate == to_rate:
        return pcm_bytes
    samples = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32)
    new_length = int(len(samples) * to_rate / from_rate)
    indices = np.linspace(0, len(samples) - 1, new_length)
    resampled = np.interp(indices, np.arange(len(samples)), samples)
    return resampled.astype(np.int16).tobytes()


def generate_piper_pcm(text: str, voice_id: str):
    """Generate 24kHz 16-bit mono PCM from Piper TTS (fully offline)."""
    piper_voice = piper_voices.get(voice_id)
    if not piper_voice:
        raise RuntimeError(f"Piper voice '{voice_id}' not loaded")

    from_rate = piper_voice.config.sample_rate
    chunk_size = 2048 * 2  # match Orpheus chunk size
    buffer = b""

    for audio_chunk in piper_voice.synthesize(text):
        resampled = resample_pcm(audio_chunk.audio_int16_bytes, from_rate, SAMPLE_RATE)
        buffer += resampled
        while len(buffer) >= chunk_size:
            yield buffer[:chunk_size]
            buffer = buffer[chunk_size:]

    if buffer:
        yield buffer


# ==================== Shared helpers ====================

def make_wav_header(data_size: int) -> bytes:
    header = io.BytesIO()
    num_channels = 1
    bits_per_sample = 16
    byte_rate = SAMPLE_RATE * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8

    header.write(b"RIFF")
    header.write(struct.pack("<I", 36 + data_size))
    header.write(b"WAVE")
    header.write(b"fmt ")
    header.write(struct.pack("<I", 16))
    header.write(struct.pack("<H", 1))  # PCM
    header.write(struct.pack("<H", num_channels))
    header.write(struct.pack("<I", SAMPLE_RATE))
    header.write(struct.pack("<I", byte_rate))
    header.write(struct.pack("<H", block_align))
    header.write(struct.pack("<H", bits_per_sample))
    header.write(b"data")
    header.write(struct.pack("<I", data_size))
    return header.getvalue()


def get_pcm_generator(text: str, voice: str, max_tokens: int,
                      temperature: float, top_p: float,
                      repetition_penalty: float):
    """Route to the correct TTS engine based on voice."""
    voice_info = VOICES.get(voice)
    if not voice_info:
        voice_info = VOICES[DEFAULT_VOICE]
        voice = DEFAULT_VOICE

    if voice_info["engine"] == "piper":
        return generate_piper_pcm(text, voice)
    else:
        return generate_orpheus_pcm(text, voice, max_tokens, temperature,
                                    top_p, repetition_penalty)


# ==================== Endpoints ====================

@app.get("/api/tts")
def tts(
    text: str = Query(..., description="Text to synthesize"),
    voice: str = Query(DEFAULT_VOICE, description="Voice name"),
    max_tokens: int = Query(1200),
    temperature: float = Query(0.6),
    top_p: float = Query(0.9),
    repetition_penalty: float = Query(1.35),
):
    """Generate speech from text. Returns WAV audio."""
    all_pcm = b""
    for chunk in get_pcm_generator(text, voice, max_tokens, temperature,
                                   top_p, repetition_penalty):
        all_pcm += chunk

    wav_header = make_wav_header(len(all_pcm))
    wav_data = wav_header + all_pcm

    return StreamingResponse(
        io.BytesIO(wav_data),
        media_type="audio/wav",
        headers={"Content-Length": str(len(wav_data))},
    )


@app.get("/api/tts/stream")
def tts_stream(
    text: str = Query(..., description="Text to synthesize"),
    voice: str = Query(DEFAULT_VOICE, description="Voice name"),
    max_tokens: int = Query(1200),
    temperature: float = Query(0.6),
    top_p: float = Query(0.9),
    repetition_penalty: float = Query(1.35),
):
    """Stream raw PCM audio chunks (24kHz 16-bit mono)."""
    def pcm_stream():
        for chunk in get_pcm_generator(text, voice, max_tokens, temperature,
                                       top_p, repetition_penalty):
            yield chunk

    return StreamingResponse(
        pcm_stream(),
        media_type="audio/pcm",
        headers={
            "X-Sample-Rate": str(SAMPLE_RATE),
            "X-Channels": "1",
            "X-Bit-Depth": "16",
        },
    )


@app.get("/api/voices")
def list_voices():
    return {
        "voices": [
            {"id": vid, "label": info["label"], "lang": info["lang"], "engine": info["engine"]}
            for vid, info in VOICES.items()
        ]
    }


@app.get("/health")
def health():
    return {"status": "ok", "device": snac_device}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8008)
