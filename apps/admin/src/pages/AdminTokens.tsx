import React, { useMemo, useState } from 'react';
import { sb } from '../core/sb';
import QRCode from 'qrcode';

type TokenRow = {
  id: string;
  status: 'issued'|'used'|'revoked';
  expires_at: string;
  url: string;
  label: string;
  qr: string; // dataURL
};

const STUDENT_BASE =
  (import.meta as any).env?.VITE_STUDENT_BASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export default function AdminTokens() {
  const [count, setCount] = useState(12);
  const [ttlMin, setTtlMin] = useState(120);     // 만료(분)
  const [prefix, setPrefix] = useState('3반-');  // 레이블 프리픽스
  const [rows, setRows] = useState<TokenRow[]>([]);
  const baseUrl = useMemo(() => {
    const base = (STUDENT_BASE || '').replace(/\/+$/, '');
    return `${base}/token`;
  }, []);
  
  const issue = async () => {
    const expires = new Date(Date.now() + ttlMin * 60_000).toISOString();
    const { data, error } = await sb.rpc('issue_qr_tokens', {
      p_class_id: null,
      p_count: count,
      p_expires_at: expires,
      p_note: prefix
    });
    if (error) { alert(error.message); return; }

    const out: TokenRow[] = [];
    for (let i = 0; i < data.length; i++) {
      const tok = data[i] as { id:string; status:'issued'|'used'|'revoked'; expires_at:string };
      const label = `${prefix}${String(i+1).padStart(2,'0')}`;
      const url = `${baseUrl}/${tok.id}`;   // ← 학생앱 도메인으로 고정됨
      const qr = await QRCode.toDataURL(url, { margin: 1, scale: 6 });
      out.push({ id: tok.id, status: tok.status, expires_at: tok.expires_at, url, label, qr });
    }
    setRows(out);
  };

  const revoke = async (id: string) => {
    const { error } = await sb.rpc('revoke_qr_token', { p_token_id: id });
    if (error) { alert(error.message); return; }
    setRows(r => r.map(x => x.id === id ? { ...x, status: 'revoked' } : x));
  };

  const downloadPng = (row: TokenRow) => {
    const a = document.createElement('a');
    a.href = row.qr;
    a.download = `${row.label}.png`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">QR 접속 토큰 발급</h1>

      <div className="flex gap-4 items-end">
        <label className="flex flex-col">
          <span className="text-sm">개수</span>
          <input type="number" min={1} max={2000} value={count}
                 onChange={e=>setCount(parseInt(e.target.value||'1'))}
                 className="border rounded px-2 py-1 w-28"/>
        </label>
        <label className="flex flex-col">
          <span className="text-sm">만료(분)</span>
          <input type="number" min={5} value={ttlMin}
                 onChange={e=>setTtlMin(parseInt(e.target.value||'5'))}
                 className="border rounded px-2 py-1 w-28"/>
        </label>
        <label className="flex flex-col">
          <span className="text-sm">레이블 접두사</span>
          <input value={prefix} onChange={e=>setPrefix(e.target.value)}
                 className="border rounded px-2 py-1 w-40"/>
        </label>
        <button onClick={issue}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          발급
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {rows.map(row => (
          <div key={row.id} className="border rounded-lg p-3 flex flex-col">
            <img src={row.qr} alt={row.label} className="w-full aspect-square object-contain bg-white rounded"/>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-medium">{row.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                row.status==='issued' ? 'bg-green-100 text-green-700'
                  : row.status==='used' ? 'bg-gray-100 text-gray-700'
                    : 'bg-red-100 text-red-700'
              }`}>{row.status}</span>
            </div>
            <a href={row.url} target="_blank" className="text-xs text-blue-700 underline break-all">{row.url}</a>
            <div className="text-xs text-gray-500 mt-1">
              만료: {new Date(row.expires_at).toLocaleString()}
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={()=>downloadPng(row)} className="px-2 py-1 border rounded">PNG 저장</button>
              <button onClick={()=>revoke(row.id)} disabled={row.status!=='issued'}
                      className="px-2 py-1 border rounded disabled:opacity-50">회수</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
