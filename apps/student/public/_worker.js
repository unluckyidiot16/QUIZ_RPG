function isHtmlNavigation(req) {
  if (req.method !== 'GET') return false;
  const accept = req.headers.get('Accept') || '';
  return accept.includes('text/html');
}
function hasFileExt(pathname) {
  return /\.[a-zA-Z0-9]+$/.test(pathname); // /app.js, /img.png, /index.html 등
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1) 정적 자산 먼저 시도
    let res = await env.ASSETS.fetch(request);

    // 2) 404이고, HTML 탐색이고, 확장자 없는 경로일 때만 SPA 폴백
    if (res.status === 404 && isHtmlNavigation(request) && !hasFileExt(url.pathname)) {
      // index.html을 직접 제공
      return env.ASSETS.fetch(new Request(`${url.origin}/index.html`, request));
    }

    return res;
  }
};
