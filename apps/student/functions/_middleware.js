export async function onRequest({ request, env, next }) {
  // 정적/기존 라우트 먼저 처리
  const res = await next();
  if (res.status !== 404) return res;

  // 404인데 GET 요청만 폴백 (이미지/JS/CSS 등 확장자 있으면 제외)
  if (request.method !== 'GET') return res;
  const { pathname } = new URL(request.url);
  if (/\.[^/]+$/.test(pathname)) return res; // 예: /main.js, /style.css, /favicon.ico

  // SPA 폴백: index.html 제공
  const indexUrl = new URL('/index.html', request.url).toString();
  return env.ASSETS.fetch(new Request(indexUrl, request));
}
