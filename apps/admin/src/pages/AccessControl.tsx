import React, { useState } from 'react';
import { sb } from '../core/sb';

export default function AccessControl() {
  const [maint, setMaint] = useState(false);
  const [msg, setMsg] = useState('서버 점검 중입니다.');
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState<'active'|'blocked'>('active');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('수업 시간 외 접속 제한');

  const applyMaintenance = async () => {
    const { error } = await sb.rpc('set_maintenance', { p_on: maint, p_message: msg, p_until: null });
    if (error) alert(error.message); else alert('적용됨');
  };

  const applyRule = async () => {
    const { error } = await sb.rpc('set_account_access_rule', {
      p_user_id: userId || null,
      p_status: status,
      p_window_start: start || null,
      p_window_end: end || null,
      p_reason: reason || null
    });
    if (error) alert(error.message); else alert('적용됨');
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">접속 제어</h1>
      <section className="border rounded p-4">
        <h2 className="font-semibold">점검 모드</h2>
        <label className="flex items-center gap-2 mt-2">
          <input type="checkbox" checked={maint} onChange={e=>setMaint(e.target.checked)}/>
          <span>점검 활성화</span>
        </label>
        <input className="border rounded px-2 py-1 mt-2 w-full" value={msg} onChange={e=>setMsg(e.target.value)}/>
        <button className="mt-3 bg-blue-600 text-white px-4 py-2 rounded" onClick={applyMaintenance}>적용</button>
      </section>
      <section className="border rounded p-4">
        <h2 className="font-semibold">학생별 차단/시간창</h2>
        <input className="border rounded px-2 py-1 w-full" placeholder="user_id(UUID)" value={userId} onChange={e=>setUserId(e.target.value)}/>
        <div className="mt-2 flex gap-3 items-center">
          <select className="border rounded px-2 py-1" value={status} onChange={e=>setStatus(e.target.value as any)}>
            <option value="active">허용</option>
            <option value="blocked">차단</option>
          </select>
          <input className="border rounded px-2 py-1" type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/>
          <span>~</span>
          <input className="border rounded px-2 py-1" type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/>
        </div>
        <input className="border rounded px-2 py-1 mt-2 w-full" placeholder="사유" value={reason} onChange={e=>setReason(e.target.value)}/>
        <button className="mt-3 bg-blue-600 text-white px-4 py-2 rounded" onClick={applyRule}>적용</button>
      </section>
    </div>
  );
}
