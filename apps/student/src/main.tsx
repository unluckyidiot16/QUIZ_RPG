
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import './sw-register';
import Main from './pages/Main';
import Lobby from './pages/Lobby';
import Play from './pages/Play';
import Result from './pages/Result';

const router = createBrowserRouter([
  { path: '/', element: <Main/> },
  { path: '/lobby', element: <Lobby/> },
  { path: '/play', element: <Play/> },
  { path: '/result', element: <Result/> }
]);

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
