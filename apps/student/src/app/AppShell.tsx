// src/app/AppShell.tsx
import { Outlet, useLocation } from "react-router-dom";
import AppHeader from "../widgets/AppHeader";

function shouldShowHeader(pathname: string) {
  // 헤더를 숨길 경로 패턴들
  const HIDE = [
    /^\/token(\/|$)/,    // 토큰/게이트
    /^\/auth(\/|$)/,     // 인증/로그인
    /^\/error(\/|$)/,    // 에러 전용 화면
  ];
  return !HIDE.some(re => re.test(pathname));
}

export default function AppShell() {
  const { pathname } = useLocation();
  const showHeader = shouldShowHeader(pathname);

  return (
    <div className="min-h-dvh grid grid-rows-[auto_1fr] bg-slate-950 text-white">
      {showHeader && <AppHeader />}
      <main className="overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
