
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function Home(){
  return (
    <div className="p-6" style={{fontFamily:'system-ui'}}>
      <h1 style={{fontWeight:800,fontSize:24}}>오늘의 던전 — Admin</h1>
      <ul>
        <li><Link to="/runs">Runs</Link></li>
        <li><Link to="/gacha">Gacha Pools</Link></li>
      </ul>
    </div>
  );
}
function Runs(){ return <div className="p-6" style={{fontFamily:'system-ui'}}>Runs Placeholder</div>; }
function Gacha(){ return <div className="p-6" style={{fontFamily:'system-ui'}}>Gacha Placeholder</div>; }

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home/>} />
      <Route path="/runs" element={<Runs/>} />
      <Route path="/gacha" element={<Gacha/>} />
    </Routes>
  </BrowserRouter>
);
