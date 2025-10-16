
import React from 'react';
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

const router = createBrowserRouter([
  { path: '/', element: <Main/> },
  { path: '/lobby', element: <Lobby/> },
  { path: '/play', element: <Play/> },
  { path: '/result', element: <Result/> },
  { path: '/gacha', element: <Gacha/> },
  { path: '/inventory', element: <Inventory/> },
  { path: '/wardrobe', element: <Wardrobe/> },
  { path: '/codex', element: <Codex/> },
]);

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
