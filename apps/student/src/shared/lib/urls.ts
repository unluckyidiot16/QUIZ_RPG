// apps/student/src/shared/lib/urls.ts
export function appBaseURL(): URL {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const base = (import.meta.env.BASE_URL ?? '/');
  return new URL(base, origin); // ex) https://site.com/app/
}

export function appPath(path: string) {
  const base = import.meta.env.BASE_URL || '/';
  const p1 = base.replace(/\/+$/, '');     // '/app' or ''
  const p2 = String(path || '').replace(/^\/+/, ''); // 'result'
  const s = `${p1}/${p2}`.replace(/\/{2,}/g, '/');
  return s || '/';
}

/** 상대/루트/절대 어떤 값이 와도 절대 URL로 변환 */
export function toAbsoluteUrl(urlLike: string): string {
  if (/^https?:\/\//i.test(urlLike)) return urlLike;
  // "/x.json" 같은 루트 경로도 안전 처리
  const path = urlLike.replace(/^\//, '');
  return new URL(path, appBaseURL()).toString();
}

/** 정적 파일 기본 경로: BASE_URL + path */
export function staticURL(path: string): string {
  return toAbsoluteUrl(path);
}

/** JSON 스마트 로더: 실패 시 1회 폴백 */
export async function fetchJsonSmart(primary: string, fallback?: string) {
  const p = staticURL(primary);
  try {
    const r = await fetch(p, { cache: 'no-store' });
    if (r.ok) return await r.json();
  } catch {}
  if (fallback) {
    try {
      const f = staticURL(fallback);
      const r2 = await fetch(f, { cache: 'no-store' });
      if (r2.ok) return await r2.json();
    } catch {}
  }
  throw new Error(`JSON load failed: ${primary}${fallback ? ` (fallback: ${fallback})` : ''}`);
}

function appPath(path: string) {
  const base = import.meta.env.BASE_URL || '/';
  const p1 = base.replace(/\/+$/, '');      // '/app' or ''
  const p2 = path.replace(/^\/+/, '');      // 'result'
  return `${p1}/${p2}`.replace(/\/{2,}/g, '/');
}
