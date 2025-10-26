// src/pages/CreateConfirm.tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { appPath } from '../shared/lib/urls';
import type { Stats } from '../core/char.types';
import { SUBJECTS, subjectLabel } from '../core/char.types';
import { PlayerOps, loadPlayer, grantSubjectXp } from '../core/player'; // 👈 추가
import { makeServices } from '../core/service.locator';

const QUIZ_XP_PER_POINT = 10; // ✅ 정답 1개당 XP (원하면 튜닝)

export default function CreateConfirm() {
  const nav = useNavigate();
  const {state} = useLocation() as any;
  const earned: Stats | undefined = state?.earned;
  const {inv} = useMemo(() => makeServices(), []);
  const [invState, setInvState] = useState<any>(null);

  useEffect(() => { (async () => setInvState(await inv.load()))(); }, [inv]);
  const previewEquipped = invState?.equipped || {};

  if (!earned) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold">캐릭터 생성</h1>
        <p className="opacity-80 mt-2">먼저 퀴즈를 완료하세요.</p>
        <button className="mt-4 px-4 py-2 rounded bg-indigo-600" onClick={() => nav(appPath('/create/quiz'))}>
          퀴즈 시작
        </button>
      </div>
    );
  }

  const e = earned as Stats;
  const totalPoints = Object.values(e).reduce((a, b) => a + b, 0);
  const totalXp = totalPoints * QUIZ_XP_PER_POINT;

  const label = subjectLabel;

  function confirm() {
    // 1) 캐릭터 데이터 기본 생성/초기화
    if (typeof PlayerOps.createCharacter === 'function') {
      PlayerOps.createCharacter({});
    }
    // 2) 방금 생성/초기 데이터 불러오기
    const p = loadPlayer();
    // 3) 과목별로 XP 지급
    for (const s of SUBJECTS) {
      const cnt = Math.max(0, e[s] | 0);
      const xp = cnt * QUIZ_XP_PER_POINT;
      if (xp > 0) grantSubjectXp(p, s as any, xp);
    }
    // 4) 저장
    (PlayerOps as any)?.save?.(p) ?? localStorage.setItem('qd:player', JSON.stringify(p));
    // 5) 플레이로
    nav(appPath('/play'), { replace: true });
  }

  function restart() {
    nav(appPath('/create/quiz'), {replace: true});
  }

  // ── 미니 레이더(Status.tsx의 Radar6를 축약 복사) ──
  function MiniRadar6({values, labels}: { values: number[]; labels: string[] }) {
    const max = Math.max(1, ...values);
    const norm = values.map(v => v / max);
    const angles = [...Array(6)].map((_, i) => (-90 + i * 60) * Math.PI / 180);
    const center = 60, R = 50;
    const pts = norm.map((t, i) => {
      const r = R * t;
      const x = center + r * Math.cos(angles[i]);
      const y = center + r * Math.sin(angles[i]);
      return `${x},${y}`;
    }).join(' ');
    const ring = (p: number) => [...Array(6)].map((_, i) => {
      const r = R * p;
      const x = center + r * Math.cos(angles[i]);
      const y = center + r * Math.sin(angles[i]);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={160} height={160} viewBox="0 0 120 120" className="mx-auto">
        {[0.33, 0.66, 1].map((p, idx) => (
          <polygon key={idx} points={ring(p)} fill="none" stroke="currentColor" opacity="0.2"/>))}
        {angles.map((a, i) => (
          <line key={i} x1={center} y1={center} x2={center + R * Math.cos(a)} y2={center + R * Math.sin(a)}
                stroke="currentColor" opacity="0.35"/>))}
        <polygon points={pts} fill="currentColor" opacity="0.4"/>
        {angles.map((a, i) => (
          <text key={i} x={center + (R + 8) * Math.cos(a)} y={center + (R + 8) * Math.sin(a)} textAnchor="middle"
                dominantBaseline="middle" fontSize="9">{labels[i]}</text>))}
      </svg>
    );
  }

  function MiniPreview({ equipped }:{ equipped: Record<string,string> }){
    // Wardrobe.tsx의 프리뷰 로직을 간소화하여 사용 (고정 캔버스)
    const Z: Record<string, number> = { Body:0, BodySuit:5, Pants:10, Shoes:15, Clothes:20, Sleeves:25, Bag:30, Necklace:40, Scarf:45, Bowtie:50, Face:55, Hair:60, Hat:70 };
    const SLOTS = ['Body','BodySuit','Pants','Shoes','Clothes','Sleeves','Bag','Necklace','Scarf','Bowtie','Face','Hair','Hat'];
    const __prefix = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const norm = (src?: string) => !src ? undefined : /^https?:\/\//.test(src) ? src : (src.startsWith("/") ? `${__prefix}${src}` : `${__prefix}/${src}`);
    // 간단 카탈로그(필요 시 service.locator로 치환 가능)
    const [catalog, setCatalog] = useState<Record<string, any>>({});
    useEffect(()=>{ (async()=>{
      try{
        const url = (import.meta as any).env?.VITE_PACKS_BASE
          ? `${(import.meta as any).env.VITE_PACKS_BASE.replace(/\/+$/,'')}/wearables.v1.json`
          : "/packs/wearables.v1.json";
        const res = await fetch(url, { cache:"no-store" });
        const raw = await res.json();
        const arr = Array.isArray(raw) ? raw : Object.values(raw||{});
        const map: Record<string, any> = {};
        for (const it of arr){ if (it?.id) map[String(it.id).toLowerCase()] = it; }
        setCatalog(map);
      }catch{}
    })() }, []);
    const pickSrc = (it:any) => norm(it?.src ?? it?.image ?? it?.img ?? (Array.isArray(it?.images)? it.images[0] : undefined));
    const layers = useMemo(()=> {
      const L: {slot:string; id:string; src:string; z:number}[] = [];
      for (const s of SLOTS){
        const id = equipped?.[s];
        if (!id) continue;
        const it = catalog[String(id).toLowerCase()];
        const src = pickSrc(it);
        if (src) L.push({ slot:s, id, src, z: Number.isFinite(it?.layer ?? it?.z) ? (it?.layer ?? it?.z) : (Z[s] ?? 0) });
      }
      return L.sort((a,b)=> a.z - b.z);
    }, [equipped, catalog]);
    return (
      <div className="w-[260px] h-[260px] rounded-lg bg-slate-900/50 border border-white/10 relative overflow-hidden mx-auto">
        {layers.map(L => (
          <img key={`${L.slot}:${L.id}`} src={L.src} alt="" className="absolute inset-0 object-contain max-w-full max-h-full pointer-events-none select-none" style={{ zIndex:L.z }} />
        ))}
      </div>
    );
  }
  
  return (
    <div className="max-w-5xl mx-auto p-6">
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold mb-2">캐릭터 미리보기</div>
            <MiniPreview equipped={previewEquipped}/>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <MiniRadar6
              values={[e.KOR, e.ENG, e.MATH, e.SCI, e.SOC, e.HIST]}
              labels={[label('KOR'), label('ENG'), label('MATH'), label('SCI'), label('SOC'), label('HIST')]}
            />
            <ul className="mt-4 text-sm grid grid-cols-2 gap-2">
              {SUBJECTS.map(s => (
              <li key={s} className="p-2 rounded bg-black/20 border border-white/10 flex items-center justify-between">
                <span>{label(s)}</span><b>+{e[s]}</b>
              </li>
            ))}
            </ul>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button className="px-4 py-2 rounded bg-slate-700" onClick={restart}>다시 만들기</button>
          <button className="px-4 py-2 rounded bg-emerald-600" onClick={confirm}>확정</button>
        </div>
      </div>
    );
  }

