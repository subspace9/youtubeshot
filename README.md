# YouTube AI Screenshot (Free, No Keys)

Adds a button to the YouTube player toolbar to:
- Capture the current video frame
- Summarize the image (on-device via transformers.js; first run downloads weights)
- OCR any text and translate to English (no API keys)

## Build a zip

macOS/Linux:
```bash
bash scripts/package.sh
```

Windows (PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File scripts/package.ps1
```

This downloads libs and free icons, then creates `youtube-ai-screenshot.zip` in the project root.

## Load in Chrome

- chrome://extensions → Enable Developer mode → Load unpacked → select this folder

## What’s free and keyless?

- Image captioning: [transformers.js by Xenova](https://github.com/xenova/transformers.js) with `Xenova/blip-image-captioning-base`. Weights are fetched from Hugging Face and cached locally.
- OCR: [Tesseract.js](https://github.com/naptha/tesseract.js). Language data is fetched once from `tessdata.projectnaptha.com`.
- Translation: Public [LibreTranslate](https://libretranslate.com) instances (no API keys). You can change endpoints in `contentScript.js`.

## Permissions rationale

- `activeTab`, `tabs`: fallback capture via `chrome.tabs.captureVisibleTab` and cropping to the video bounds.
- Host permissions:
  - `*.youtube.com`: where the extension runs.
  - `huggingface.co`, `cdn-lfs.huggingface.co`: BLIP model files.
  - `cdn.jsdelivr.net`: library hosting.
  - `tessdata.projectnaptha.com`: OCR traineddata files.
  - `libretranslate.com`, `translate.argosopentech.com`: free translation.

## Icons license and attribution

- Icons: Twemoji camera emoji (📷). Source: https://github.com/twitter/twemoji
- License: CC-BY 4.0 — © Twitter, Inc and other contributors. Attribution provided here.

## Troubleshooting

- If you see “transformers.js not found”, ensure `libs/transformers.min.js` exists (the packaging script downloads it).
- If the button doesn’t appear, wait a moment (YouTube SPA). The script re-injects the button on DOM changes.
- First run can be slower while models/data download; subsequent runs are faster.
