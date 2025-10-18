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
  {
    element: <AppShell />,                 // ✅ 여기서 헤더를 모든 하위 라우트에 공통 적용
    children: [
      { index: true, element: <Main/> },
      { path: '/lobby', element: <Lobby/> },
      { path: '/play', element: <Play/> },           // 전투 씬도 헤더 포함!
      { path: '/result', element: <Result/> },
      { path: '/gacha', element: <Gacha/> },
      { path: '/inventory', element: <Inventory/> },
      { path: '/wardrobe', element: <Wardrobe/> },
      { path: '/codex', element: <Codex/> },
      { path: '/token/:id', element: <TokenGatePage/> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

function AppGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        await bootstrapApp();     // 렌더 전 1회: 기본 세팅/동기화
      } catch (e) {
        console.error('bootstrap failed', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);
  if (!ready) {
    return (
      <div style={{
        padding: 24, display: 'flex', alignItems: 'center',
        justifyContent: 'center', height: '100vh'
      }}>
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
