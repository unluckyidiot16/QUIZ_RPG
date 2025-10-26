// src/pages/CreateQuiz.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appPath } from '../shared/lib/urls';
import type { Stats, Subject } from '../core/char.types';
import { SUBJECTS, subjectLabel } from '../core/char.types';

import { makeServices } from '../core/service.locator';

const QUIZ_XP_PER_POINT = 10; // ✅ Confirm과 동일 값 유지

// 문제팩 URL 생성 (Play.tsx와 동일 로직 축약)
function resolvePackUrl(pack: string) {
    const base = import.meta.env.BASE_URL || '/';
    const url = new URL(base, window.location.origin);
    url.pathname = url.pathname.replace(/\/$/, '') + `/packs/${pack}.json`;
    return url.toString();
  }

type Choice = { key: 'A'|'B'|'C'|'D'; text: string };
type Question = { id: string; stem: string; choices: Choice[]; answerKey: Choice['key']; explanation?: string };

  function normalizeAnswerKey(answerKey?: any, answer?: any, correctIndex?: any): Choice['key'] | null {
      if (typeof answerKey === 'string' && /^[ABCD]$/.test(answerKey)) return answerKey as any;
      if (typeof answer === 'string' && /^[ABCD]$/.test(answer)) return answer as any;
      const idx = (typeof correctIndex === 'number' ? correctIndex
          : typeof answer === 'number' ? answer
          : typeof answerKey === 'number' ? answerKey
          : -1);
      if (idx >= 0 && idx <= 3) return (['A','B','C','D'] as const)[idx];
      return null;
    }
function normalizeQuestion(raw: any, i: number): Question | null {
    if (!raw) return null;
    const keys = ['A','B','C','D'] as const;
    if (raw.stem && Array.isArray(raw.choices)) {
        const normChoices: Choice[] = (raw.choices as any[]).slice(0,4).map((t,idx)=>({ key: keys[idx], text: typeof t==='string'?t:(t?.text??String(t)) }));
        const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
        return ans ? { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans, explanation: raw.explanation } : null;
      }
    if (raw.stem && Array.isArray(raw.options)) {
        const normChoices: Choice[] = (raw.options as any[]).slice(0,4).map((t,idx)=>({ key: keys[idx], text: typeof t==='string'?t:(t?.text??String(t)) }));
        const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
        return ans ? { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans } : null;
      }
    if (raw.stem && (raw.A || raw.B || raw.C || raw.D)) {
        const normChoices: Choice[] = keys.filter(k=>raw[k]!=null).map(k=>({ key: k, text: String(raw[k]) }));
        const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
        return ans ? { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans } : null;
      }
    return null;
  }
export default function CreateQuiz(){
  const nav = useNavigate();
  const [idx, setIdx] = useState(0);
  const [earned, setEarned] = useState<Stats>({KOR:0,ENG:0,MATH:0,SCI:0,SOC:0,HIST:0});
  const progress = Math.round((idx/10)*100);
  const [phase, setPhase] = useState<'pick'|'quiz'>('pick');
  const [currentSubj, setCurrentSubj] = useState<Subject | null>(null);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>('');
  const pack = 'sample';

  const { inv } = useMemo(() => makeServices(), []);
  const [invState, setInvState] = useState<any>(null);
  useEffect(()=>{ (async()=> setInvState(await inv.load()))(); }, [inv]);
  const previewEquipped = invState?.equipped || {};

  // ── 문제팩 로드 & 과목별 큐 구성 ──
  const [bySubj, setBySubj] = useState<Record<Subject, Question[]>>({KOR:[],ENG:[],MATH:[],SCI:[],SOC:[],HIST:[]});
  const [pool, setPool] = useState<Question[]>([]);
  const [used, setUsed] = useState<Set<string>>(new Set());
  useEffect(()=> {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(resolvePackUrl(pack), { cache:'reload', signal: ac.signal });
        let rawList: any = [];
        if (res.ok) rawList = await res.json(); else rawList = [{ id:'init', stem:'샘플: A를 고르세요', choices:['A','B','C','D'], answerKey:'A' }];
        const arr = Array.isArray(rawList) ? rawList : (rawList?.questions ?? rawList?.items ?? rawList?.data?.questions ?? []);
        const clean: Question[] = [];
        arr.forEach((raw:any, i:number) => { const nq = normalizeQuestion(raw, i); if (nq) clean.push(nq); });
        // 과목 추출(가능하면), 없으면 분류하지 않고 풀(pool)에 남김
        const map: Record<Subject, Question[]> = {KOR:[],ENG:[],MATH:[],SCI:[],SOC:[],HIST:[]};
        const korMap: Record<string, Subject> = { '국어':'KOR','영어':'ENG','수학':'MATH','과학':'SCI','사회':'SOC','역사':'HIST' };
        for (const q of clean){
          const sRaw = (arr[q.id as any]?.subject ?? arr[q.id as any]?.subj ?? arr[q.id as any]?.category ?? arr[q.id as any]?.tag ?? arr[q.id as any]?.tags) as any;
          const toCode = (v:string): Subject | null => {
            const up = (v||'').toString().toUpperCase();
            if ((SUBJECTS as readonly string[]).includes(up)) return up as Subject;
            const ko = korMap[v as string]; return ko ?? null;
          };
          let code: Subject | null = null;
          if (typeof sRaw === 'string') code = toCode(sRaw);
          else if (Array.isArray(sRaw)) code = (sRaw.map(x=>toCode(x)).find(Boolean) as Subject | undefined) ?? null;
          if (code) map[code].push(q);
        }
        setBySubj(map);
        setPool(clean);
        setUsed(new Set());
      } catch (e:any){
        setMsg(e?.message ?? '팩 로드 실패');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
    }, []);
  
  // 과목 클릭 → 해당 과목 문제 선택
  function chooseSubject(s: Subject){
    setCurrentSubj(s);
    // 미사용 문제 우선, 없으면 전체 풀에서 미사용 1개
    const list = bySubj[s];
    const cand = (list?.find(q => !used.has(q.id))) || (pool.find(q => !used.has(q.id)));
    if (!cand) { setMsg('더 이상 선택할 문항이 없습니다.'); return; }
    setCurrentQ(cand);
    setPhase('quiz');
  }
  
  function onAnswer(pick: Choice['key']){
    if (!currentQ || !currentSubj) return;
    const correct = (pick === currentQ.answerKey);
    const nextEarned = correct ? { ...earned, [currentSubj]: earned[currentSubj] + 1 } : earned;
    const next = idx + 1;
    setEarned(nextEarned);
    setUsed(prev => new Set(prev).add(currentQ.id));
    setCurrentQ(null);
    setCurrentSubj(null);
    setPhase('pick');
    if (next >= 10) {
      nav(appPath('/create/confirm'), { replace:true, state:{ earned: nextEarned } });
    } else {
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

  if (loading) return <div className="p-6">로딩 중…</div>;
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold">캐릭터 생성: 과목 퀴즈 (10문항)</h1>

      <div className="mt-4">
        <div className="h-2 rounded bg-white/10 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 text-sm opacity-80">{idx+1}/10</div>
      </div>

      {/* 현재 과목 표시는 퀴즈 단계에서만 */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm opacity-70">현재 과목:</span>
        <span className="px-2 py-1 rounded bg-indigo-600/30 border border-indigo-400/50">
          {phase === 'quiz' && currentSubj ? label(currentSubj) : '과목 선택'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold mb-2">캐릭터 미리보기</div>
          <MiniPreview equipped={previewEquipped} />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-2 gap-4 items-center">
            <MiniRadar6
              values={[earned.KOR,earned.ENG,earned.MATH,earned.SCI,earned.SOC,earned.HIST]}
              labels={[label('KOR'),label('ENG'),label('MATH'),label('SCI'),label('HIST'),label('SOC')]}
            />
            <ul className="text-sm grid grid-cols-2 gap-2">
              {SUBJECTS.map(s => (
                <li key={s} className="p-2 rounded bg-black/20 border border-white/10 flex items-center justify-between">
                  <span>{label(s)}</span>
                  <b>+{earned[s]} pt / +{earned[s]*QUIZ_XP_PER_POINT} XP</b>
                </li>
              ))}
            </ul>
          </div>
          {/* 과목 선택/문제 영역 */}
          {phase === 'pick' ? (
            <div className="mt-4 p-4 rounded-lg bg-slate-900/50">
              <div className="font-medium mb-2">과목을 선택하세요</div>
              <div className="grid grid-cols-2 gap-2">
                {SUBJECTS.map(s => (
                  <button key={s} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 transition"
                          onClick={()=>chooseSubject(s)}>
                    {label(s)}
                  </button>
                ))}
              </div>
              {!!msg && <div className="text-rose-300 text-sm mt-2">{msg}</div>}
            </div>
          ) : (
            <div className="mt-4 p-4 rounded-lg bg-slate-900/50">
              <div className="text-sm opacity-80 mb-2">현재 과목: <b>{currentSubj ? label(currentSubj) : '-'}</b></div>
              {currentQ ? (
                <>
                <div className="font-medium whitespace-pre-wrap">{currentQ.stem}</div>
                <div className="grid gap-2 mt-3">
                  {currentQ.choices.map((c: Choice) => (
                    <button key={c.key}
                            className="text-left px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 transition"
                            onClick={()=>onAnswer(c.key)}>
                      <span className="font-bold mr-2">{c.key}.</span>{c.text}
                    </button>
                  ))}
                </div>
                </>
              ) : (
                <div className="text-sm text-rose-300">문항을 찾을 수 없습니다.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
