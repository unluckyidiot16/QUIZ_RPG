import React, { useMemo, useState } from 'react';
import { accessService, TempToken } from '../shared/lib/accessService';
import QRCode from 'qrcode'; // npm i qrcode

const toQR = async (text: string) => await QRCode.toDataURL(text, { margin: 1, scale: 6 });

export default function AdminTokens() {
  const [count, setCount] = useState(10);
  const [ttl, setTtl] = useState(90);
  const [prefix, setPrefix] = useState('3반-');
  const [rows, setRows] = useState<(TempToken & { url: string; qr: string; label: string })[]>([]);
  const baseUrl = useMemo(() => (typeof window !== 'undefined' ? `${location.origin}/play` : 'https://example.com/play'), []);

  const issue = async () => {
    const out: (TempToken & { url: string; qr: string; label: string })[] = [];
    for (let i = 0; i < count; i++) {
      const tok = await accessService.issueTempId({ nickname: `${prefix}${i + 1}`, ttlMin: ttl });
      const url = `${baseUrl}?t=${tok.token}`;
      const qr = await toQR(url);
      out.push({ ...tok, url, qr, label: `${prefix}${i + 1}` });
    }
    setRows(out);
  };

  const revoke = async (token: string) => {
    await accessService.revoke(token);
    setRows(r => r.map(x => x.token === token ? { ...x, revoked: true } : x));
  };
  const extend = async (token: string, min = 30) => {
    await accessService.extend(token, min);
    setRows(r => r.map(x => x.token === token ? { ...x, validUntil: new Date(new Date(x.validUntil).getTime() + min * 60000).toISOString() } : x));
  };

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>임시 아이디 발급</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <label>수량 <input type="number" min={1} value={count} onChange={e => setCount(+e.target.value)} /></label>
        <label>유효(분) <input type="number" min={1} value={ttl} onChange={e => setTtl(+e.target.value)} /></label>
        <label>라벨 prefix <input value={prefix} onChange={e => setPrefix(e.target.value)} /></label>
        <button onClick={issue}>발급</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 220px)', gap: 16 }}>
        {rows.map(r => (
          <div key={r.token} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
            <img src={r.qr} alt="qr" style={{ width: '100%', height: 'auto' }} />
            <div style={{ fontWeight: 600, marginTop: 8 }}>{r.label}</div>
            <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{r.url}</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {new Date(r.validFrom).toLocaleTimeString()}–{new Date(r.validUntil).toLocaleTimeString()}
              {r.revoked ? ' (차단됨)' : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => navigator.clipboard.writeText(r.url)}>링크복사</button>
              <button onClick={() => extend(r.token, 30)}>+30분</button>
              <button onClick={() => revoke(r.token)} disabled={!!r.revoked}>차단</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
