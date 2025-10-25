import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, redirect } from 'react-router-dom';
import { loadPlayer, getBaseStats } from './core/player';
import './sw-register';
import './index.css';  // ← Tailwind 엔트리 (필수)

import AppShell from './app/AppShell';

import Main from './pages/Main';
import Lobby from './pages/Lobby';
import Status from './pages/Status';
import Play from './pages/Play';
import Result from './pages/Result';
import Gacha from './pages/Gacha';
import Inventory from './pages/Inventory';
import Wardrobe from './pages/Wardrobe';
import Codex from './pages/Codex';
import TokenGatePage from './pages/TokenGatePage';
import NotFound from './pages/NotFound';
import CreateQuiz from './pages/CreateQuiz';
import CreateConfirm from './pages/CreateConfirm';
import Profile from './pages/Profile';



import { bootstrapApp } from './core/bootstrap';

const requireCharacter = () => {
  const p = loadPlayer();
  if (!getBaseStats(p)) throw redirect('/create/quiz');
  return null;
};

// 닉네임 로더
  const getNickname = () => {
    try {
        const p = JSON.parse(localStorage.getItem('qd:profile') || 'null');
        const n = p?.nickname?.trim?.();
        return typeof n === 'string' ? n : '';
      } catch { return ''; }
  };
  const requireNickname = () => {
    const n = getNickname();
    if (!n) throw redirect('/profile');
    return null;
  };

  // 최종 가드(닉네임 → 캐릭터 순)
    const requireSetup = () => {
    const n = getNickname();
    if (!n) throw redirect('/profile');
    const p = loadPlayer();
    if (!getBaseStats(p)) throw redirect('/create/quiz');
    return null;
  };

const router = createBrowserRouter([
  {
    element: <AppShell />,                 // ✅ 헤더는 여기서만
    children: [
      { index: true, loader: requireSetup, element: <Main/> },
      { path: '/status', loader: requireSetup, element: <Status/> },
      { path: '/lobby', element: <Lobby/> },
      { path: '/play', loader: requireSetup, element: <Play/> },
      { path: '/result', loader: requireSetup, element: <Result/> },
      { path: '/gacha', element: <Gacha/> },
      { path: '/inventory', loader: requireSetup, element: <Inventory/> },
      { path: '/wardrobe', loader: requireSetup, element: <Wardrobe/> },
      { path: '/codex', element: <Codex/> },
      { path: '/profile', element: <Profile/> },
      { path: '/create/quiz', loader: requireNickname, element: <CreateQuiz/> },
      { path: '/create/confirm', loader: requireNickname, element: <CreateConfirm/> },

    ],
  },
  // ✅ 차단/토큰 화면은 헤더 없이
  { path: '/token/:id', element: <TokenGatePage/> },
  { path: '*', element: <NotFound /> },
], {
    basename: import.meta.env.BASE_URL, // 서브경로 배포 시 정적/라우트 모두 일치
  });

function AppGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      try { await bootstrapApp(); }
      finally { setReady(true); }
    })();
  }, []);
  if (!ready) return <div className="grid place-items-center min-h-dvh">초기 동기화 중…</div>;
  return <>{children}</>;
}

createRoot(document.getElementById('root')!)
  .render(<AppGate><RouterProvider router={router} /></AppGate>);
