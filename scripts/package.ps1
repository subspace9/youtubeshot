$ErrorActionPreference = "Stop"

# Clean
if (Test-Path "youtube-ai-screenshot.zip") { Remove-Item "youtube-ai-screenshot.zip" }

# Ensure dirs
New-Item -ItemType Directory -Force -Path libs | Out-Null
New-Item -ItemType Directory -Force -Path icons | Out-Null
New-Item -ItemType Directory -Force -Path scripts | Out-Null

# Fetch libs
Write-Host "Downloading transformers.js (UMD)…"
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js" -OutFile "libs/transformers.min.js"
Write-Host "Downloading Tesseract.js…"
Invoke-WebRequest -Uri "https://unpkg.com/tesseract.js@5.0.0/dist/tesseract.min.js" -OutFile "libs/tesseract.min.js"

# Fetch free icons (Twemoji camera 📷)
Write-Host "Fetching camera icon from Twemoji…"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f4f7.png" -OutFile "icons\camera-72.png"
Copy-Item "icons\camera-72.png" "icons\icon16.png" -Force
Copy-Item "icons\camera-72.png" "icons\icon32.png" -Force
Copy-Item "icons\camera-72.png" "icons\icon48.png" -Force
Copy-Item "icons\camera-72.png" "icons\icon128.png" -Force

# Verify
$required = @(
  "manifest.json",
  "background.js",
  "contentScript.js",
  "styles.css",
  "libs\transformers.min.js",
  "libs\tesseract.min.js",
  "icons\icon16.png",
  "icons\icon32.png",
  "icons\icon48.png",
  "icons\icon128.png"
)
foreach ($f in $required) {
  if (-not (Test-Path $f)) { throw "Missing $f" }
}

# Zip
Compress-Archive -Path * -DestinationPath "youtube-ai-screenshot.zip" -Force
Write-Host "Created youtube-ai-screenshot.zip"
