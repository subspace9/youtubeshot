// MV3 background service worker
// Fallback capture if direct canvas draw is blocked by CORS.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === 'CAPTURE_TAB') {
        const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
        sendResponse({ ok: true, dataUrl });
      }
    } catch (err) {
      console.error('CAPTURE_TAB error:', err);
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true;
});
