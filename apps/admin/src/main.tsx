import { createRoot } from 'react-dom/client';
import React, { useEffect, useState } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Link,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { sb } from './core/sb';

import Login from './pages/Login';
import Runs from './pages/Runs';
import AdminTokens from './pages/AdminTokens';
import AccessControl from './pages/AccessControl';

// 기본 랜딩: QR 발급 페이지
const DEFAULT_LANDING = '/tokens';

function RootGate() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="p-6">로딩…</div>;
  return authed ? <AdminLayout /> : <Login />;
}

function AdminLayout() {
  const loc = useLocation();
  async function logout() {
    await sb.auth.signOut();
    location.replace('/'); // 세션 종료 후 로그인 화면로
  }
  const navItem = (to: string, label: string) => {
    const active = loc.pathname === to;
    return (
      <Link
        to={to}
        className={
          'px-3 py-2 rounded hover:bg-slate-700 ' +
          (active ? 'bg-slate-700 font-semibold' : '')
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="font-bold">오늘의 던전 · Admin</span>
          <nav className="flex items-center gap-1">
            {navItem('/runs', 'Runs')}
            {navItem('/tokens', 'QR 발급')}
            {navItem('/access', '접속 제어')}
          </nav>
        </div>
        <button
          onClick={logout}
          className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootGate />,
    children: [
      // 로그인 후 기본 랜딩: QR 발급
      { index: true, element: <Navigate to={DEFAULT_LANDING} replace /> },
      { path: 'runs', element: <Runs /> },
      { path: 'tokens', element: <AdminTokens /> },
      { path: 'access', element: <AccessControl /> },
    ],
  },
  // 직접 /login 들어오면 Gate가 다시 판단하지만, 명시 라우트도 열어둠
  { path: '/login', element: <Login /> },
]);

createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
);
