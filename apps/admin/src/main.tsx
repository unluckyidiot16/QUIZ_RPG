import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Login from './pages/Login';
import Runs from './pages/Runs';
import { sb } from './sb';

function Gate() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setAuthed(!!data.session); setReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (!ready) return <div className="p-6">로딩…</div>;
  return authed ? <Runs/> : <Login/>;
}

const router = createBrowserRouter([{ path: '/', element: <Gate/> }]);
createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
