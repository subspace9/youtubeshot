#!/usr/bin/env bash
set -euo pipefail

# Free icons (Twemoji camera emoji 📷). License: CC-BY 4.0 — © Twitter, Inc and contributors.
mkdir -p icons

SRC_URL="https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f4f7.png"

echo "Fetching camera icon from Twemoji…"
curl -L -o icons/camera-72.png "$SRC_URL"

# Use same source for all sizes (Chrome will scale). For crisp scaling, install ImageMagick and use convert (commented).
cp icons/camera-72.png icons/icon16.png
cp icons/camera-72.png icons/icon32.png
cp icons/camera-72.png icons/icon48.png
cp icons/camera-72.png icons/icon128.png

# If you have ImageMagick, uncomment:
# convert icons/camera-72.png -resize 16x16 icons/icon16.png
# convert icons/camera-72.png -resize 32x32 icons/icon32.png
# convert icons/camera-72.png -resize 48x48 icons/icon48.png
# convert icons/camera-72.png -resize 128x128 icons/icon128.png

echo "Icons ready."
ls -lh icons || true
