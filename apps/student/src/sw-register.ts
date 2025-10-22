import { appPath } from './shared/lib/urls';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(appPath('/sw.js'), { scope: appPath('/') })
      .then(reg => console.log('[sw] registered', reg.scope))
      .catch(err => console.warn('[sw] registration failed', err));
  });
}
