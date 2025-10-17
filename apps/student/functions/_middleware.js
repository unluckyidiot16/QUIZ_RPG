function isHtmlNavigation(req) {
  return req.method === 'GET' && (req.headers.get('Accept') || '').includes('text/html');
}
function hasFileExt(pathname) {
  return /\.[a-zA-Z0-9]{2,}$/.test(pathname);
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // 1) 정적/기존 라우트 먼저 처리
  const res = await next();
  if (res.status !== 404) return res;

  // 2) 404이고, HTML 네비게이션이며, 확장자 없는 경로일 때만 SPA 폴백
  if (isHtmlNavigation(request) && !hasFileExt(url.pathname) &&
    url.pathname !== '/' && url.pathname !== '/index.html') {
    const indexUrl = new URL('/index.html', url).toString();
    return env.ASSETS.fetch(new Request(indexUrl, request));
  }

  // 3) 그 외는 원래 404
  return res;
}
