# Changelog

All notable changes to this project will be documented in this file.

## v1.1.1 — 2025-10-26

Initial release of a free, keyless Chrome MV3 extension that adds an "AI Screenshot" button to the YouTube player.

Features:
- One-click screenshot button in the YouTube player toolbar
- Frame capture with robust fallback:
  - Primary: canvas drawImage(video) → PNG
  - Fallback: capture visible tab → crop to video bounds
- On-device image captioning via transformers.js (BLIP), no API keys
- OCR via Tesseract.js with automatic script/language selection
- Translation to English via public LibreTranslate endpoints
- Lightweight overlay panel with:
  - Screenshot preview
  - Summary, OCR text, and translation
  - Copy buttons and "Download Image"

Tooling:
- Packaging scripts for macOS/Linux (bash) and Windows (PowerShell)
- GitHub Actions workflow to build and attach the ZIP asset on release publish
