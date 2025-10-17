// Catch-all 함수: 정적 자산 404일 때만 index.html로 폴백 (루프 방지)
export async function onRequest(ctx: { request: Request; env: any }) {
  const { request, env } = ctx;
  const url = new URL(request.url);

  // 정적 자산 먼저 시도
  let res = await env.ASSETS.fetch(request);
  if (res.status !== 404) return res;

  // HTML 탐색이고, 확장자 없고, 루트/인덱스가 아닐 때만 폴백
  const isGet = request.method === 'GET';
  const accept = request.headers.get('Accept') || '';
  const isHtml = accept.includes('text/html');
  const hasExt = /\.[a-zA-Z0-9]{2,}$/.test(url.pathname);
  const isIndex = url.pathname === '/' || url.pathname === '/index.html';

  if (isGet && isHtml && !hasExt && !isIndex) {
    return env.ASSETS.fetch(new Request(new URL('/index.html', url).toString(), request));
  }

  // 그 외는 원래 404 반환
  return res;
}
