// 정적 자산 우선 → 404인 경우에만 SPA 폴백 (루프 방지)
export async function onRequest(context: { request: Request; env: any }) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1) 정적 자산 먼저 시도
  const res = await env.ASSETS.fetch(request);
  if (res.status !== 404) return res;

  // 2) HTML 네비게이션 + 확장자 없는 경로에만 index.html 폴백
  const accept = request.headers.get('Accept') || '';
  const isHtml = request.method === 'GET' && accept.includes('text/html');
  const hasExt = /\.[a-zA-Z0-9]{2,}$/.test(url.pathname);
  const isIndex = url.pathname === '/' || url.pathname === '/index.html';

  if (isHtml && !hasExt && !isIndex) {
    return env.ASSETS.fetch(new Request(new URL('/index.html', url).toString(), request));
  }

  // 3) 그 외는 원래 404 유지
  return res;
}
