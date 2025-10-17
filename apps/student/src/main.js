import { jsx as _jsx } from "react/jsx-runtime";
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import './sw-register';
import Main from './pages/Main';
import Lobby from './pages/Lobby';
import Play from './pages/Play';
import Result from './pages/Result';
import Gacha from './pages/Gacha';
import Inventory from './pages/Inventory';
import Wardrobe from './pages/Wardrobe';
import Codex from './pages/Codex';
import { bootstrapFirstRun } from './core/bootstrap';
import TokenGatePage from './pages/TokenGatePage';
const router = createBrowserRouter([
    { path: '/', element: _jsx(Main, {}) },
    { path: '/lobby', element: _jsx(Lobby, {}) },
    { path: '/play', element: _jsx(Play, {}) },
    { path: '/result', element: _jsx(Result, {}) },
    { path: '/gacha', element: _jsx(Gacha, {}) },
    { path: '/inventory', element: _jsx(Inventory, {}) },
    { path: '/wardrobe', element: _jsx(Wardrobe, {}) },
    { path: '/codex', element: _jsx(Codex, {}) },
    { path: '/token/:id', element: _jsx(TokenGatePage, {}) },
]);
bootstrapFirstRun().catch(() => { }); // 렌더를 막진 않고 백그라운드 시드
createRoot(document.getElementById('root')).render(_jsx(RouterProvider, { router: router }));
