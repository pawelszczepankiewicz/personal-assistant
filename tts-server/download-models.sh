#!/usr/bin/env bash
# Download Piper TTS voice models (one-time setup)
set -e

MODELS_DIR="$(dirname "$0")/models"
BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL"

mkdir -p "$MODELS_DIR"

download() {
  local name="$1" path="$2"
  local dest="$MODELS_DIR/$name"
  if [ -f "$dest" ]; then
    echo "Already downloaded: $name"
  else
    echo "Downloading $name..."
    curl -L -o "$dest" "$BASE_URL/$path"
  fi
}

download "pl_PL-gosia-medium.onnx"      "gosia/medium/pl_PL-gosia-medium.onnx"
download "pl_PL-gosia-medium.onnx.json"  "gosia/medium/pl_PL-gosia-medium.onnx.json"
download "pl_PL-darkman-medium.onnx"     "darkman/medium/pl_PL-darkman-medium.onnx"
download "pl_PL-darkman-medium.onnx.json" "darkman/medium/pl_PL-darkman-medium.onnx.json"

echo "Piper models ready."
