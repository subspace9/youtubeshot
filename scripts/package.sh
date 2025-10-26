#!/usr/bin/env bash
set -euo pipefail

# Clean
rm -f youtube-ai-screenshot.zip || true

# Fetch dependencies
bash scripts/get-libs.sh
bash scripts/fetch-icons.sh

# Verify required files
REQUIRED=(
  "manifest.json"
  "background.js"
  "contentScript.js"
  "styles.css"
  "libs/transformers.min.js"
  "libs/tesseract.min.js"
  "icons/icon16.png"
  "icons/icon32.png"
  "icons/icon48.png"
  "icons/icon128.png"
)
for f in "${REQUIRED[@]}"; do
  [[ -f "$f" ]] || { echo "Missing $f"; exit 1; }
done

# Zip everything (excluding the zip itself)
zip -r youtube-ai-screenshot.zip . -x "youtube-ai-screenshot.zip"

echo "Created youtube-ai-screenshot.zip"
