
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import Main from './views/Main';
import Lobby from './views/Lobby';
import Play from './views/Play';
import Result from './views/Result';

const router = createBrowserRouter([
  { path: '/', element: <Main/> },
  { path: '/lobby', element: <Lobby/> },
  { path: '/play', element: <Play/> },
  { path: '/result', element: <Result/> }
]);

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
