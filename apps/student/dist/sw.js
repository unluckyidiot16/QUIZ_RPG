
const ORIGIN = self.location.origin;

async function fetchManifest() {
  const res = await fetch(`${ORIGIN}/manifest.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error('manifest fetch failed');
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('manifest parse failed'); }
  const versionBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const versionHex = [...new Uint8Array(versionBuf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  const files = (json.files || json).map(r => (typeof r === 'string' ? { path: r, sha256: null } : r));
  const map = new Map(files.map(r => [r.path.replace(/^\//,''), r.sha256 || null]));
  return { version: versionHex, files, map };
}

function toBase64(u8) { let s=''; u8.forEach(b=>s+=String.fromCharCode(b)); return btoa(s); }
async function sha256Base64(buf) { const h=await crypto.subtle.digest('SHA-256', buf); return 'sha256-'+toBase64(new Uint8Array(h)); }

async function verifyResponse(resp, expected) {
  if (!expected) return true;
  const buf = await resp.clone().arrayBuffer();
  const got = await sha256Base64(buf);
  return got === expected;
}

function integrityFor(pathname, map) {
  for (const k of map.keys()) {
    if (pathname.endsWith('/'+k) || pathname === '/'+k || pathname.endsWith(k)) return map.get(k);
  }
  return null;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const { version, files, map } = await fetchManifest();
    self.__CACHE_NAME = `qd-${version}`;
    const cache = await caches.open(self.__CACHE_NAME);
    const urls = new Set(['/index.html']); for (const f of files) urls.add('/'+f.path.replace(/^\//,''));
    await cache.addAll([...urls].map(u => new Request(u, { cache: 'no-store' })));
    for (const u of urls) {
      const res = await cache.match(u); if (!res) throw new Error('cache miss '+u);
      const ok = await verifyResponse(res, integrityFor(u, map)); if (!ok) throw new Error('integrity mismatch '+u);
    }
    await self.skipWaiting();
    console.log('[sw] installed', self.__CACHE_NAME);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = self.__CACHE_NAME;
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith('qd-') && k !== keep) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
    console.log('[sw] active', keep);
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== ORIGIN) return;

  event.respondWith((async () => {
    const url = new URL(req.url);
    const { map } = await fetchManifest().catch(() => ({ map: new Map() }));
    const cache = await caches.open(self.__CACHE_NAME || (await caches.keys()).find(k => k.startsWith('qd-')) || 'qd');

    if (req.mode === 'navigate') {
      const cached = await cache.match('/index.html');
      if (cached) return cached;
      return fetch(req);
    }

    const isAsset = url.pathname.startsWith('/assets/') || /\.(js|css|png|webp|svg|woff2?)$/.test(url.pathname);
    if (isAsset) {
      const cached = await cache.match(url.pathname);
      if (cached) {
        event.waitUntil((async () => {
          try {
            const net = await fetch(req, { cache: 'no-store' });
            if (net.ok && await verifyResponse(net, integrityFor(url.pathname, map))) {
              await cache.put(url.pathname, net.clone());
            }
          } catch {}
        })());
        return cached;
      }
    }

    try {
      const net = await fetch(req, { cache: 'no-store' });
      if (isAsset && net.ok && await verifyResponse(net, integrityFor(url.pathname, map))) {
        await cache.put(url.pathname, net.clone());
      }
      return net;
    } catch (e) {
      const cached = await cache.match(url.pathname) || await cache.match('/index.html');
      if (cached) return cached;
      throw e;
    }
  })());
});
