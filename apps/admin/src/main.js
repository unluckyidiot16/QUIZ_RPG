import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Link, Navigate, useLocation, } from 'react-router-dom';
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
    if (!ready)
        return _jsx("div", { className: "p-6", children: "\uB85C\uB529\u2026" });
    return authed ? _jsx(AdminLayout, {}) : _jsx(Login, {});
}
function AdminLayout() {
    const loc = useLocation();
    async function logout() {
        await sb.auth.signOut();
        location.replace('/'); // 세션 종료 후 로그인 화면로
    }
    const navItem = (to, label) => {
        const active = loc.pathname === to;
        return (_jsx(Link, { to: to, className: 'px-3 py-2 rounded hover:bg-slate-700 ' +
                (active ? 'bg-slate-700 font-semibold' : ''), children: label }));
    };
    return (_jsxs("div", { className: "min-h-screen bg-slate-900 text-slate-100", children: [_jsxs("header", { className: "flex items-center justify-between px-4 py-3 border-b border-slate-800", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "font-bold", children: "\uC624\uB298\uC758 \uB358\uC804 \u00B7 Admin" }), _jsxs("nav", { className: "flex items-center gap-1", children: [navItem('/runs', 'Runs'), navItem('/tokens', 'QR 발급'), navItem('/access', '접속 제어')] })] }), _jsx("button", { onClick: logout, className: "px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700", children: "\uB85C\uADF8\uC544\uC6C3" })] }), _jsx("main", { className: "max-w-6xl mx-auto p-4", children: _jsx(Outlet, {}) })] }));
}
const router = createBrowserRouter([
    {
        path: '/',
        element: _jsx(RootGate, {}),
        children: [
            // 로그인 후 기본 랜딩: QR 발급
            { index: true, element: _jsx(Navigate, { to: DEFAULT_LANDING, replace: true }) },
            { path: 'runs', element: _jsx(Runs, {}) },
            { path: 'tokens', element: _jsx(AdminTokens, {}) },
            { path: 'access', element: _jsx(AccessControl, {}) },
        ],
    },
    // 직접 /login 들어오면 Gate가 다시 판단하지만, 명시 라우트도 열어둠
    { path: '/login', element: _jsx(Login, {}) },
]);
createRoot(document.getElementById('root')).render(_jsx(RouterProvider, { router: router }));
