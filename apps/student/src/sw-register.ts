
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[sw] registered', reg.scope))
      .catch(err => console.warn('[sw] registration failed', err));
  });
}
