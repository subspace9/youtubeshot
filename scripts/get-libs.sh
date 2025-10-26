#!/usr/bin/env bash
set -euo pipefail

mkdir -p libs

echo "Downloading transformers.js (UMD)…"
curl -L -o libs/transformers.min.js \
  https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js

echo "Downloading Tesseract.js…"
curl -L -o libs/tesseract.min.js \
  https://unpkg.com/tesseract.js@5.0.0/dist/tesseract.min.js

echo "Done."
ls -lh libs || true
