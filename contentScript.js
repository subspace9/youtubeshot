/* 
  YouTube AI Screenshot (Free, No Keys)

  - Injects a button into YouTube's player toolbar (.ytp-right-controls).
  - Captures current frame (canvas). If CORS taints the canvas, falls back to chrome.tabs.captureVisibleTab + crop.
  - Summarizes the image using transformers.js BLIP (on-device, free, weights downloaded from Hugging Face on first use).
  - OCR with Tesseract.js. Detects script, selects language packs. Downloads traineddata on first use (free).
  - Translates OCR text to English via LibreTranslate public instance (no key).
*/
const LIBRE_TRANSLATE_ENDPOINTS = [
  'https://libretranslate.com/translate',
  'https://translate.argosopentech.com/translate'
];
const IMAGE_CAPTION_MODEL = 'Xenova/blip-image-captioning-base';
const SCRIPT_TO_LANGS = {
  Latin: ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'nld'],
  Cyrillic: ['rus', 'ukr', 'bul', 'srp'],
  Arabic: ['ara'],
  Devanagari: ['hin', 'mar', 'nep'],
  HanS: ['chi_sim'],
  HanT: ['chi_tra'],
  Japanese: ['jpn'],
  Korean: ['kor'],
  Thai: ['tha'],
  Hebrew: ['heb'],
  Greek: ['ell'],
  Bengali: ['ben']
};

let injected = false;
let captionPipeline = null;
let busy = false;

function waitForSelector(selector, { timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const first = document.querySelector(selector);
    if (first) return resolve(first);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}

function injectButton() {
  if (injected) return;
  const controls = document.querySelector('.ytp-right-controls');
  if (!controls) return;

  if (document.getElementById('ytp-ai-screenshot-btn')) {
    injected = true;
    return;
  }

  const btn = document.createElement('button');
  btn.id = 'ytp-ai-screenshot-btn';
  btn.className = 'ytp-button';
  btn.title = 'AI Screenshot: summarize + OCR + translate';
  btn.setAttribute('aria-label', 'AI Screenshot');

  // Inline SVG icon (camera + sparkle) to blend with YouTube UI
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true">
      <path d="M9 3L7.5 5H5a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-2.5L15 3H9zM12 17a5 5 0 110-10 5 5 0 010 10z"></path>
      <path d="M12 8l.8 1.6L14.5 10l-1.2 1.2.3 1.8-1.6-.8-1.6.8.3-1.8L9.5 10l1.7-.4L12 8z"></path>
    </svg>
  `;

  btn.addEventListener('click', handleClick);
  controls.appendChild(btn); // append to avoid disturbing existing controls
  injected = true;
}

async function handleClick() {
  if (busy) return;
  busy = true;
  try {
    const video = document.querySelector('video.html5-main-video');
    if (!video || !video.videoWidth || !video.videoHeight) {
      return showToast('Video not ready yet. Try again when the video is playing.');
    }

    showPanel({ status: 'loading', message: 'Capturing frame…' });

    let blob = null;
    try {
      blob = await captureViaCanvas(video);
    } catch (err) {
      console.warn('Direct canvas capture failed; fallback to tab capture:', err);
    }

    if (!blob) {
      const cropBlob = await captureByCroppingVisibleTab(video);
      if (!cropBlob) {
        hidePanel();
        return showToast('Failed to capture screenshot.');
      }
      blob = cropBlob;
    }

    updatePanel({ status: 'loading', message: 'Analyzing image (first run may download models)…' });

    const [summary, ocrText] = await Promise.all([
      imageCaption(blob),
      ocrWithAutoLang(blob)
    ]);

    let translated = '';
    if (ocrText && /\S/.test(ocrText)) {
      updatePanel({ status: 'loading', message: 'Translating detected text to English…' });
      translated = await translateToEnglish(ocrText);
    }

    showPanel({
      status: 'result',
      imageBlob: blob,
      summary,
      ocr: ocrText,
      translated
    });
  } catch (err) {
    console.error(err);
    hidePanel();
    showToast('Something went wrong. See console for details.');
  } finally {
    busy = false;
  }
}

function captureViaCanvas(video) {
  return new Promise((resolve, reject) => {
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob returned null'));
      }, 'image/png', 0.95);
    } catch (e) {
      reject(e);
    }
  });
}

async function captureByCroppingVisibleTab(video) {
  try {
    const rect = video.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const res = await chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' });
    if (!res?.ok || !res.dataUrl) throw new Error(res?.error || 'captureVisibleTab failed');

    const img = await loadImage(res.dataUrl);

    const sx = Math.max(0, Math.floor(rect.left * dpr));
    const sy = Math.max(0, Math.floor(rect.top * dpr));
    const sw = Math.max(1, Math.floor(rect.width * dpr));
    const sh = Math.max(1, Math.floor(rect.height * dpr));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
    return blob || null;
  } catch (err) {
    console.error('captureByCroppingVisibleTab error:', err);
    return null;
  }
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

async function imageCaption(blob) {
  try {
    if (!window.transformers) throw new Error('transformers.js not found. libs/transformers.min.js must load before contentScript.js');
    if (!captionPipeline) {
      const { pipeline } = window.transformers;
      captionPipeline = await pipeline('image-to-text', IMAGE_CAPTION_MODEL);
    }
    const out = await captionPipeline(blob);
    const text = Array.isArray(out) ? (out[0]?.generated_text || out[0]?.text || '') : (out?.generated_text || out?.text || '');
    return (text || '').trim();
  } catch (err) {
    console.warn('imageCaption error:', err);
    return '';
  }
}

async function ocrWithAutoLang(blob) {
  if (!window.Tesseract) {
    console.warn('Tesseract.js not found. libs/tesseract.min.js must load before contentScript.js');
    return '';
  }
  try {
    let script = 'Latin';
    try {
      const det = await window.Tesseract.detect(blob);
      if (det?.data?.script) {
        script = det.data.script;
      }
    } catch (e) {
      console.warn('Tesseract.detect failed, defaulting to Latin:', e);
    }

    const langs = SCRIPT_TO_LANGS[script] || ['eng'];
    const uniqueLangs = Array.from(new Set(['eng', ...langs]));
    const langStr = uniqueLangs.join('+');

    const { data } = await window.Tesseract.recognize(blob, langStr, {});
    const text = (data?.text || '').trim();
    return text;
  } catch (err) {
    console.warn('OCR failed:', err);
    return '';
  }
}

async function translateToEnglish(text) {
  const payload = { q: text, source: 'auto', target: 'en', format: 'text' };
  for (const url of LIBRE_TRANSLATE_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.translatedText) return json.translatedText;
    } catch (e) {
      console.warn('Translate failed at', url, e);
    }
  }
  return text; // fallback
}

// Minimal overlay UI and toasts
let panelEl = null;
function ensurePanel() {
  if (panelEl) return panelEl;
  panelEl = document.createElement('div');
  panelEl.className = 'ai-shot-panel';
  panelEl.innerHTML = `
    <div class="ai-shot-card">
      <div class="ai-shot-header">
        <div class="ai-shot-title">AI Screenshot</div>
        <button class="ai-shot-close" title="Close" aria-label="Close">&times;</button>
      </div>
      <div class="ai-shot-body">
        <div class="ai-shot-status"></div>
        <div class="ai-shot-result" style="display:none">
          <div class="ai-shot-columns">
            <div class="ai-shot-col ai-shot-image-col">
              <img class="ai-shot-image" alt="Screenshot preview"/>
              <div class="ai-shot-row">
                <button class="ai-shot-btn" data-copy="image">Download Image</button>
              </div>
            </div>
            <div class="ai-shot-col ai-shot-text-col">
              <div class="ai-shot-section">
                <div class="ai-shot-section-title">Summary</div>
                <pre class="ai-shot-summary"></pre>
                <button class="ai-shot-btn" data-copy="summary">Copy Summary</button>
              </div>
              <div class="ai-shot-section">
                <div class="ai-shot-section-title">Detected Text (OCR)</div>
                <pre class="ai-shot-ocr"></pre>
                <button class="ai-shot-btn" data-copy="ocr">Copy OCR</button>
              </div>
              <div class="ai-shot-section">
                <div class="ai-shot-section-title">Translation (to English)</div>
                <pre class="ai-shot-translation"></pre>
                <button class="ai-shot-btn" data-copy="translation">Copy Translation</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  panelEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('ai-shot-close') || e.target === panelEl) {
      hidePanel();
    }
    const btn = e.target.closest('button.ai-shot-btn');
    if (btn) handleCopy(btn);
  });
  document.documentElement.appendChild(panelEl);
  return panelEl;
}

function showPanel(data) {
  const el = ensurePanel();
  el.style.display = 'flex';

  const status = el.querySelector('.ai-shot-status');
  const result = el.querySelector('.ai-shot-result');
  if (data.status === 'loading') {
    status.textContent = data.message || 'Loading…';
    status.style.display = 'block';
    result.style.display = 'none';
  } else if (data.status === 'result') {
    status.style.display = 'none';
    result.style.display = 'block';

    const imgEl = el.querySelector('.ai-shot-image');
    if (data.imageBlob) {
      const url = URL.createObjectURL(data.imageBlob);
      imgEl.src = url;
      imgEl.dataset.blobUrl = url;
    }

    el.querySelector('.ai-shot-summary').textContent = (data.summary || '').trim() || '(no summary)';
    el.querySelector('.ai-shot-ocr').textContent = (data.ocr || '').trim() || '(no text detected)';
    el.querySelector('.ai-shot-translation').textContent = (data.translated || '').trim() || '(no translation)';
  }
}

function updatePanel(data) {
  if (!panelEl) return;
  if (data.status === 'loading') {
    const status = panelEl.querySelector('.ai-shot-status');
    const result = panelEl.querySelector('.ai-shot-result');
    status.textContent = data.message || 'Loading…';
    status.style.display = 'block';
    result.style.display = 'none';
  }
}

function hidePanel() {
  if (panelEl) {
    const imgEl = panelEl.querySelector('.ai-shot-image');
    if (imgEl && imgEl.dataset.blobUrl) {
      try { URL.revokeObjectURL(imgEl.dataset.blobUrl); } catch {}
      delete imgEl.dataset.blobUrl;
    }
    panelEl.style.display = 'none';
  }
}

async function handleCopy(btn) {
  const card = btn.closest('.ai-shot-card');
  if (!card) return;
  const kind = btn.getAttribute('data-copy');
  try {
    if (kind === 'summary') {
      const v = card.querySelector('.ai-shot-summary')?.textContent || '';
      await navigator.clipboard.writeText(v);
      showToast('Summary copied');
    } else if (kind === 'ocr') {
      const v = card.querySelector('.ai-shot-ocr')?.textContent || '';
      await navigator.clipboard.writeText(v);
      showToast('OCR text copied');
    } else if (kind === 'translation') {
      const v = card.querySelector('.ai-shot-translation')?.textContent || '';
      await navigator.clipboard.writeText(v);
      showToast('Translation copied');
    } else if (kind === 'image') {
      const imgEl = card.querySelector('.ai-shot-image');
      if (imgEl?.src) {
        const a = document.createElement('a');
        a.href = imgEl.src;
        a.download = 'youtube-frame.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    }
  } catch (e) {
    showToast('Copy failed');
  }
}

let toastEl = null;
function showToast(text) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'ai-shot-toast';
    document.documentElement.appendChild(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.add('show');
  setTimeout(() => toastEl && toastEl.classList.remove('show'), 2000);
}

(async function init() {
  try {
    await waitForSelector('.ytp-right-controls').catch(() => {});
    injectButton();

    const obs = new MutationObserver(() => {
      if (!document.getElementById('ytp-ai-screenshot-btn')) {
        injected = false;
        injectButton();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    console.warn('Init error:', e);
  }
})()
