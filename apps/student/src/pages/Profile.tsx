// src/pages/Profile.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appPath } from '../shared/lib/urls';

function readProfile() {
  try { return JSON.parse(localStorage.getItem('qd:profile') || 'null') || {}; }
  catch { return {}; }
}
function writeProfile(p: any) {
  localStorage.setItem('qd:profile', JSON.stringify(p));
  // 헤더(AppHeader)에서 듣는 이벤트
  window.dispatchEvent(new Event('profile:changed'));
}

export default function Profile(){
  const nav = useNavigate();
  const [nickname, setNickname] = useState<string>('');
  const [tint, setTint] = useState<number>(0);

  useEffect(() => {
    const cur = readProfile();
    if (typeof cur.nickname === 'string') setNickname(cur.nickname);
    if (Number.isFinite(cur.tint)) setTint(cur.tint);
  }, []);

  const canSave = nickname.trim().length >= 1;

  async function onSave(e: React.FormEvent){
    e.preventDefault();
    const next = { ...readProfile(), nickname: nickname.trim(), tint: Number(tint) || 0 };
    writeProfile(next);
    nav(appPath('/create/quiz'), { replace: true });
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold">프로필 설정</h1>
      <p className="text-sm opacity-80 mt-1">닉네임은 헤더와 랭킹(도입 시)에 표시돼요.</p>

      <form onSubmit={onSave} className="mt-4 space-y-4">
        <label className="block">
          <div className="text-sm mb-1">닉네임</div>
          <input
            value={nickname}
            onChange={(e)=>setNickname(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-900 border border-white/10"
            placeholder="예) 모험가123"
            maxLength={20}
            autoFocus
          />
        </label>

        <label className="block">
          <div className="text-sm mb-1">틴트(선택)</div>
          <input
            type="range" min={0} max={359} step={1}
            value={tint}
            onChange={(e)=>setTint(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="text-xs opacity-70 mt-1">{tint}°</div>
        </label>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={!canSave}
            className="px-4 py-2 rounded bg-emerald-600 disabled:opacity-50"
          >계속하기</button>
          <button
            type="button"
            onClick={()=>nav(appPath('/'), { replace:true })}
            className="px-4 py-2 rounded bg-slate-700"
          >취소</button>
        </div>
      </form>
    </div>
  );
}
