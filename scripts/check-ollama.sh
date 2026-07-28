#!/usr/bin/env bash
set -euo pipefail

MODEL="${OLLAMA_MODEL:-qwen2.5:1.5b-instruct-q4_K_M}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed." >&2
  exit 1
fi

echo "Ollama version:"
ollama --version

echo "Available models:"
ollama list

if ! ollama list | awk 'NR > 1 {print $1}' | grep -Fxq "$MODEL"; then
  echo "Pulling $MODEL..."
  ollama pull "$MODEL"
fi

echo "Testing a simple prompt..."
ollama run "$MODEL" "Reply with one word: ready" | head -n 5
