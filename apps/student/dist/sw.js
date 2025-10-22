// ⬇️ 전역 SRI 컨텍스트 보관
let SRI = { version: '', map: new Map() };
const ORIGIN = self.location.origin;

async function fetchManifestNetwork() {
  const res = await fetch(`${ORIGIN}/manifest.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error('manifest fetch failed');
  const text = await res.text();
  const json = JSON.parse(text);
  const files = (json.files || json).map(r => (typeof r === 'string' ? { path: r, sha256: null } : r));
  const map = new Map(files.map(r => [r.path.replace(/^\//,''), r.sha256 || null]));
  // 간단 버전: 텍스트 해시로 버전
  const buf = new TextEncoder().encode(text);
  const v = await crypto.subtle.digest('SHA-256', buf);
  const hex = [...new Uint8Array(v)].map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
  return { version: hex, map, files };
}

async function loadSRIFromCache() {
  const cached = await caches.match('/manifest.json');
  if (!cached) return { version: '', map: new Map() };
  const text = await cached.text();
  const json = JSON.parse(text);
  const files = (json.files || json);
  return { version: 'cached', map: new Map(files.map(r => [r.path.replace(/^\//,''), r.sha256 || null])) };
}

function pickIntegrity(pathname, map) {
  for (const k of map.keys()) {
    if (pathname.endsWith('/'+k) || pathname === '/'+k || pathname.endsWith(k)) return map.get(k);
  }
  return null;
}
function toBase64(u8){ let s=''; u8.forEach(b=>s+=String.fromCharCode(b)); return btoa(s); }
async function sha256Base64(buf){ const h=await crypto.subtle.digest('SHA-256', buf); return 'sha256-'+toBase64(new Uint8Array(h)); }
async function verify(resp, expected){ if(!expected) return true; const b=await resp.clone().arrayBuffer(); return (await sha256Base64(b)) === expected; }

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // ✅ 네트워크로 1회만 manifest 로딩
    const { version, map, files } = await fetchManifestNetwork();
    SRI = { version, map };

    const cache = await caches.open(`qd-${version}`);
    // ✅ manifest도 함께 캐시
    const urls = new Set(['/index.html', '/manifest.json']);
    for (const f of files) urls.add('/'+f.path.replace(/^\//,''));
    await cache.addAll([...urls].map(u => new Request(u, { cache: 'no-store' })));

    // 첫 설치 검증(옵션)
    for (const u of urls) {
      const res = await cache.match(u);
      if (!res) throw new Error('cache miss '+u);
      const ok = await verify(res, pickIntegrity(u, map));
      if (!ok) throw new Error('integrity mismatch '+u);
    }
    self.__CACHE_NAME = `qd-${version}`;
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = self.__CACHE_NAME || (await caches.keys()).sort().pop();
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith('qd-') && k !== keep) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== ORIGIN) return;

  // ✅ manifest 자체는 SW가 건드리지 않음(루프 방지)
  if (url.pathname === '/manifest.json') return;

  const handle = (async () => {
    // 필요 시 캐시에서만 SRI 맵 보충
    if (!SRI.map || !SRI.map.size) {
      const { map } = await loadSRIFromCache();
      SRI.map = map;
    }
    const isAsset = url.pathname.startsWith('/assets/') || /\.(js|css|woff2?|svg|png|webp)$/.test(url.pathname);
    const cache = await caches.open(self.__CACHE_NAME || (await caches.keys()).find(k=>k.startsWith('qd-')) || 'qd');

    if (req.mode === 'navigate') {
      // SW 스코프 기준 index.html 경로를 계산
      const indexPath = new URL('index.html', self.registration.scope).pathname;
      const cached =
        (await cache.match(indexPath)) ||
        (await cache.match('/index.html')); // 루트 호환
      return cached || fetch(req);
    }

    if (isAsset) {
      const cached = await cache.match(url.pathname);
      if (cached) {
        // 백그라운드 재검증(선택) — 여기서 manifest를 네트워크로 다시 받지 않음
        event.waitUntil((async () => {
          try {
            const net = await fetch(req, { cache: 'no-store' });
            if (net.ok && await verify(net, pickIntegrity(url.pathname, SRI.map))) {
              await cache.put(url.pathname, net.clone());
            }
          } catch {}
        })());
        return cached;
      }
    }

    try {
      const net = await fetch(req, { cache: 'no-store' });
      if (isAsset && net.ok && await verify(net, pickIntegrity(url.pathname, SRI.map))) {
        await cache.put(url.pathname, net.clone());
      }
      return net;
    } catch (e) {
      const fallback = await cache.match(url.pathname) || await cache.match('/index.html');
      if (fallback) return fallback;
      throw e;
    }
  })();

  event.respondWith(handle);
});
