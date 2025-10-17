export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 파일 확장자가 없으면 SPA 경로로 간주하고 index.html로 리라이트
    if (!/\.[a-zA-Z0-9]+$/.test(url.pathname)) {
      return env.ASSETS.fetch(new Request(url.origin + '/index.html', request));
    }
    // 정적 자산은 그대로
    return env.ASSETS.fetch(request);
  }
};
