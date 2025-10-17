function isHtmlNavigation(req) {
  if (req.method !== 'GET') return false;
  const accept = req.headers.get('Accept') || '';
  return accept.includes('text/html');
}
function hasFileExt(pathname) {
  return /\.[a-zA-Z0-9]{2,}$/.test(pathname);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1) 정적 자산 먼저 서빙
  const res = await env.ASSETS.fetch(request);
  if (res.status !== 404) return res;

  // 2) 404이고, HTML 네비게이션이며, 확장자 없는 경로만 index.html로 폴백
  if (isHtmlNavigation(request) && !hasFileExt(url.pathname) &&
    url.pathname !== '/' && url.pathname !== '/index.html') {
    const indexUrl = new URL('/index.html', url).toString();
    return env.ASSETS.fetch(new Request(indexUrl, request));
  }

  // 3) 그 외는 원래 404 유지
  return res;
}
