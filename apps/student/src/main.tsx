// apps/student/src/main.tsx
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import './sw-register';

import AppShell from './app/AppShell';

import Main from './pages/Main';
import Lobby from './pages/Lobby';
import Play from './pages/Play';
import Result from './pages/Result';
import Gacha from './pages/Gacha';
import Inventory from './pages/Inventory';
import Wardrobe from './pages/Wardrobe';
import Codex from './pages/Codex';
import TokenGatePage from './pages/TokenGatePage';
import NotFound from './pages/NotFound';

import { bootstrapApp } from './core/bootstrap';

const router = createBrowserRouter([
  // ✅ 공통 헤더가 필요한 라우트 묶음
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Main/> },
      { path: '/lobby', element: <Lobby/> },
      { path: '/play', element: <Play/> },
      { path: '/result', element: <Result/> },
      { path: '/gacha', element: <Gacha/> },
      { path: '/inventory', element: <Inventory/> },
      { path: '/wardrobe', element: <Wardrobe/> },
      { path: '/codex', element: <Codex/> },
    ],
  },
  // ✅ 토큰/접속 차단 등 "헤더 없이" 보여줄 라우트는 **바깥**에 둠
  { path: '/token/:id', element: <TokenGatePage/> },

  // 404는 취향대로: 헤더 없이
  { path: '*', element: <NotFound /> },
]);

function AppGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      try { await bootstrapApp(); }
      finally { setReady(true); }
    })();
  }, []);
  if (!ready) {
    return (
      <div className="grid place-items-center min-h-dvh">
        초기 동기화 중…
      </div>
    );
  }
  return <>{children}</>;
}

createRoot(document.getElementById('root')!)
  .render(
    <AppGate>
      <RouterProvider router={router} />
    </AppGate>
  );
