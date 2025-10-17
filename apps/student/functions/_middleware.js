export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);

  // ✅ '/home'은 그냥 루트로 보내기 (앱 라우터가 '/home'을 모를 가능성 큼)
  if (url.pathname === '/home') {
    return Response.redirect(new URL('/', url), 301); // 302로 바꿔도 됨
  }

  // 정적/기존 라우트 먼저
  const res = await next();
  if (res.status !== 404) return res;

  // 404인 GET만 SPA 폴백, 파일 확장자 요청은 제외
  if (request.method !== 'GET') return res;
  if (/\.[^/]+$/.test(url.pathname)) return res;

  const indexUrl = new URL('/index.html', url).toString();
  return env.ASSETS.fetch(new Request(indexUrl, request));
}
