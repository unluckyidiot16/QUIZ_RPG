import { useState } from 'react';
import { sb } from '../sb';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function send() {
    await sb.auth.signInWithOtp({ email }); // Supabase Auth에서 Email OTP 활성화 필요
    setSent(true);
  }

  return (
    <div className="p-6 max-w-sm mx-auto space-y-3">
      <h1 className="text-xl font-bold">Admin 로그인</h1>
      <input className="w-full p-2 rounded bg-slate-800"
             placeholder="you@school.edu" value={email} onChange={e=>setEmail(e.target.value)} />
      <button onClick={send} className="px-3 py-2 rounded bg-emerald-600">메일로 로그인 링크 받기</button>
      {sent && <div className="text-sm opacity-80">메일을 확인하세요. (같은 브라우저로 열기)</div>}
    </div>
  );
}
