// src/pages/CreateQuiz.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appPath } from '../shared/lib/urls';
import type { Stats, Subject } from '../core/char.types';
import { SUBJECTS, SUBJECT_ORDER_10, subjectLabel } from '../core/char.types';

import { makeServices } from '../core/service.locator';

const ORDER: Subject[] = SUBJECT_ORDER_10;

export default function CreateQuiz(){
  const nav = useNavigate();
  const [idx, setIdx] = useState(0);
  const [earned, setEarned] = useState<Stats>({KOR:0,ENG:0,MATH:0,SCI:0,SOC:0,HIST:0});
  const subj = ORDER[idx];
  const progress = Math.round(((idx)/10)*100);


  // ── 미니 캐릭터 프리뷰 상태(옷장 미리보기 축약) ──
  const { inv } = useMemo(() => makeServices(), []);
  const [invState, setInvState] = useState<any>(null);
  useEffect(()=>{ (async()=> setInvState(await inv.load()))(); }, [inv]);
  const previewEquipped = invState?.equipped || {};
  
  function onAnswer(correct: boolean){
    const nextEarned = correct ? { ...earned, [subj]: earned[subj] + 1 } : earned; // ← stale 방지
    const next = idx + 1;
    if (next >= 10) {
      nav(appPath('/create/confirm'), { replace: true, state: { earned: nextEarned } });
    } else {
      setEarned(nextEarned);
      setIdx(next);
    }
  }

  const label = subjectLabel;

  // ── 미니 레이더(Status.tsx의 Radar6를 축약 복사) ──
  function MiniRadar6({ values, labels }:{ values:number[]; labels:string[] }){
    const max = Math.max(1, ...values);
    const norm = values.map(v=> v/max);
    const angles = [...Array(6)].map((_,i)=> (-90 + i*60) * Math.PI/180);
    const center = 60, R = 50;
    const pts = norm.map((t,i)=> {
      const r = R * t;
      const x = center + r * Math.cos(angles[i]);
      const y = center + r * Math.sin(angles[i]);
      return `${x},${y}`;
    }).join(' ');
    const ring = (p:number)=> [...Array(6)].map((_,i)=>{
      const r = R * p;
      const x = center + r * Math.cos(angles[i]);
      const y = center + r * Math.sin(angles[i]);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={160} height={160} viewBox="0 0 120 120" className="mx-auto">
        {[0.33,0.66,1].map((p,idx)=> (<polygon key={idx} points={ring(p)} fill="none" stroke="currentColor" opacity="0.2" />))}
        {angles.map((a,i)=> (<line key={i} x1={center} y1={center} x2={center+R*Math.cos(a)} y2={center+R*Math.sin(a)} stroke="currentColor" opacity="0.35" />))}
        <polygon points={pts} fill="currentColor" opacity="0.4" />
        {angles.map((a,i)=> (<text key={i} x={center+(R+8)*Math.cos(a)} y={center+(R+8)*Math.sin(a)} textAnchor="middle" dominantBaseline="middle" fontSize="9">{labels[i]}</text>))}
      </svg>
    );
  }
  // ── 미니 캐릭터 프리뷰(옷장 Wardrobe.tsx 프리뷰를 경량화) ──
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
      <h1 className="text-2xl font-bold">캐릭터 생성: 과목 퀴즈 (10문항)</h1>

      <div className="mt-4">
        <div className="h-2 rounded bg-white/10 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 text-sm opacity-80">{idx+1}/10</div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm opacity-70">현재 과목:</span>
        <span className="px-2 py-1 rounded bg-indigo-600/30 border border-indigo-400/50">
          {label(subj)}
        </span>
      </div>

      {/* 본문: 좌 = 캐릭터 미리보기, 우 = 레이더/요약 + 문제 */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* 왼쪽: Wardrobe 미리보기 축약판 */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold mb-2">캐릭터 미리보기</div>
          <MiniPreview equipped={previewEquipped} />
        </div>
        {/* 오른쪽: 레이더 + 현재 과목 문제 */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-2 gap-4 items-center">
            <MiniRadar6
              values={[earned.KOR,earned.ENG,earned.MATH,earned.SCI,earned.SOC,earned.HIST]}
              labels={[label('KOR'),label('ENG'),label('MATH'),label('SCI'),label('SOC'),label('HIST')]}
            />
            <ul className="text-sm grid grid-cols-2 gap-2">
              {SUBJECTS.map(s => (
                <li key={s} className="p-2 rounded bg-black/20 border border-white/10 flex items-center justify-between">
                  <span>{label(s)}</span><b>+{earned[s]}</b>
                </li>
              ))}
            </ul>
          </div>
          {/* TODO: 실제 문항 렌더러로 교체 */}
          <div className="mt-4 p-4 rounded-lg bg-slate-900/50">
            <p className="opacity-80">여기에 <b>{label(subj)}</b> 문제를 렌더링하세요.</p>
            <div className="mt-4 flex gap-2">
              <button className="px-4 py-2 rounded bg-emerald-600" onClick={()=>onAnswer(true)}>정답</button>
              <button className="px-4 py-2 rounded bg-slate-700" onClick={()=>onAnswer(false)}>오답</button>
            </div>
               </div>
        </div>
      </div>
    </div>
  );
}
