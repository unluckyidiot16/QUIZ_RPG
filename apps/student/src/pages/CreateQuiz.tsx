// src/pages/CreateQuiz.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appPath } from '../shared/lib/urls';
import type { Stats, Subject } from '../core/char.types';
import { SUBJECTS, subjectLabel } from '../core/char.types';
import { makeServices } from '../core/service.locator';
import { makeRng } from '../shared/lib/rng';

const QUIZ_XP_PER_POINT = 10; // Confirm과 동일 값 유지
const TOTAL = 10;             // 총 10문항

// 과목 → 팩 파일명 매핑 (실제 생성된 파일명에 맞춰 필요 시 수정)
const SUBJECT_PACK: Record<Subject, string> = {
  KOR: 'KorPack',
  ENG: 'EngPack',
  MATH: 'MathPack',
  SCI: 'SciPack',
  SOC: 'SocPack',
  HIST: 'HistPack',
};

// ---------- 공통 정규화 유틸 ----------
type Choice = { key: 'A'|'B'|'C'|'D'; text: string };
type Question = {
  id: string;
  stem: string;
  choices: Choice[];
  answerKey: Choice['key'];
  explanation?: string;
  subject?: Subject | 'GEN';
  difficulty?: number;
  timeLimitSec?: number;
  tags?: string[];
};

function normalizeAnswerKey(answerKey?: any, answer?: any, correctIndex?: any): Choice['key'] | null {
  if (typeof answerKey === 'string' && /^[ABCD]$/.test(answerKey)) return answerKey as any;
  if (typeof answer === 'string' && /^[ABCD]$/.test(answer)) return answer as any;
  const idx = (typeof correctIndex === 'number' ? correctIndex
    : typeof answer === 'number' ? answer
      : typeof answerKey === 'number' ? answerKey
        : -1);
  if (idx >= 0 && idx <= 3) return (['A','B','C','D'] as const)[idx];
  if (idx >= 1 && idx <= 4) return (['A','B','C','D'] as const)[idx-1];
  return null;
}

function normalizeQuestion(raw: any, i: number): Question | null {
  if (!raw) return null;
  const keys = ['A','B','C','D'] as const;

  // 1) { stem, choices[] }
  if (raw.stem && Array.isArray(raw.choices)) {
    const normChoices: Choice[] = (raw.choices as any[]).slice(0,4).map((t,idx)=>({
      key: keys[idx],
      text: typeof t==='string' ? t : (t?.text ?? String(t))
    }));
    const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
    if (!ans) return null;
    return {
      id: String(raw.id ?? i),
      stem: String(raw.stem),
      choices: normChoices,
      answerKey: ans,
      explanation: typeof raw.explanation === 'string' ? raw.explanation : undefined,
      subject: typeof raw.subject === 'string' ? (raw.subject.toUpperCase() as Subject) : undefined,
      difficulty: Number.isFinite(+raw.difficulty) ? +raw.difficulty : undefined,
      timeLimitSec: Number.isFinite(+raw.timeLimitSec) ? +raw.timeLimitSec : undefined,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
    };
  }

  // 2) { stem, options[] }
  if (raw.stem && Array.isArray(raw.options)) {
    const normChoices: Choice[] = (raw.options as any[]).slice(0,4).map((t,idx)=>({
      key: keys[idx],
      text: typeof t==='string' ? t : (t?.text ?? String(t))
    }));
    const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
    if (!ans) return null;
    return { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans };
  }

  // 3) { stem, A/B/C/D }
  if (raw.stem && (raw.A || raw.B || raw.C || raw.D)) {
    const normChoices: Choice[] = keys.filter(k=>raw[k]!=null).map(k=>({ key: k, text: String(raw[k]) }));
    const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
    if (!ans) return null;
    return { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans };
  }

  return null;
}

// ---------- 페이지 컴포넌트 ----------
export default function CreateQuiz(){
  const nav = useNavigate();

  // 재현성 불필요: 시간 기반 RNG
  const rngRef = useRef(makeRng(String(Date.now())));
  const nextRand = () => rngRef.current?.next?.() ?? Math.random();
  
  // 진행/점수
  const [idx, setIdx] = useState(0);
  const [earned, setEarned] = useState<Stats>({KOR:0,ENG:0,MATH:0,SCI:0,SOC:0,HIST:0});
  const progress = Math.round((idx / TOTAL) * 100);

  // 상태
  const [phase, setPhase] = useState<'pick'|'quiz'>('pick');
  const [currentSubj, setCurrentSubj] = useState<Subject | null>(null);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');

  // 인벤토리 프리뷰
  const { inv } = useMemo(() => makeServices(), []);
  const [invState, setInvState] = useState<any>(null);
  useEffect(()=>{ (async()=> setInvState(await inv.load()))(); }, [inv]);
  const previewEquipped = invState?.equipped || {};

  // 과목별 뱅크 캐시/중복관리
  const subjectBankRef = useRef<Partial<Record<Subject, Question[]>>>({});
  const [subjectBank, setSubjectBank] = useState<Partial<Record<Subject, Question[]>>>({});
  const usedBySubjectRef = useRef<Partial<Record<Subject, Set<string>>>>({});
  const [usedGlobal, setUsedGlobal] = useState<Set<string>>(new Set());

  // 과목 단일 JSON 로더 (최초 1회만 fetch → 캐시)
  async function ensureSubjectLoaded(s: Subject) {
    if (subjectBankRef.current[s]?.length) return subjectBankRef.current[s]!;
    setLoading(true);
    try {
      const packId = SUBJECT_PACK[s];
      const url = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') + `/packs/${packId}.json`;
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) throw new Error(`load failed: ${url} (${res.status})`);
      const raw = await res.json();
      const arr = Array.isArray(raw) ? raw : (raw?.questions ?? raw?.items ?? raw?.data?.questions ?? []);
      const clean: Question[] = [];
      arr.forEach((r: any, i: number) => {
        const q = normalizeQuestion(r, i);
        if (q && q.choices?.length >= 2) clean.push(q);
      });

      // 안전: 과목 필터(파일이 해당 과목 전용이더라도 필터를 한 번 거침)
      const onlyThis = clean.filter(q => String(q.subject ?? '').toUpperCase() === s || !q.subject);
      subjectBankRef.current[s] = onlyThis;
      setSubjectBank(prev => ({ ...prev, [s]: onlyThis }));
      return onlyThis;
    } finally {
      setLoading(false);
    }
  }

  // 과목 선택 → 문제 1개 랜덤 픽(중복 회피)
  async function chooseSubject(s: Subject){
    setMsg('');
    setCurrentSubj(s);
    setPhase('pick'); // 안전: 잠깐 유지
    try {
      const bank = await ensureSubjectLoaded(s);
      if (!bank.length) { setMsg('해당 과목에 사용 가능한 문항이 없습니다.'); return; }

      // 중복 회피: 과목 내 우선, 전부 사용했으면 과목 내 재사용 허용(글로벌 중복만 회피)
      const usedS = (usedBySubjectRef.current[s] ||= new Set<string>());
      let pool = bank.filter(q => !usedS.has(q.id) && !usedGlobal.has(q.id));
      if (!pool.length) pool = bank.filter(q => !usedGlobal.has(q.id));
      if (!pool.length) pool = bank.slice(); // 정말 없으면 과목 내 재사용

      // 셔플 후 픽
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(nextRand() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const picked = pool[Math.floor(nextRand() * pool.length)] || null;

      if (!picked) { setMsg('문항을 찾지 못했습니다.'); return; }

      setCurrentQ(picked);
      setPhase('quiz');
    } catch (e: any) {
      setMsg(e?.message ?? '팩 로드 실패');
    }
  }

  // 답변 처리
  function onAnswer(pick: Choice['key']){
    if (!currentQ || !currentSubj) return;
    const correct = (pick === currentQ.answerKey);

    // 점수 반영
    if (correct) {
      setEarned(prev => ({ ...prev, [currentSubj]: prev[currentSubj] + 1 }));
    }

    // 사용 처리(과목/글로벌)
    setUsedGlobal(prev => {
      const next = new Set(prev); next.add(currentQ.id); return next;
    });
    (usedBySubjectRef.current[currentSubj] ||= new Set<string>()).add(currentQ.id);

    // 다음 턴 세팅
    const next = idx + 1;
    setCurrentQ(null);
    setCurrentSubj(null);

    if (next >= TOTAL) {
      // 완료 → 확인 화면
      nav(appPath('/create/confirm'), { replace: true, state: { earned: { ...earned, [currentSubj]: (correct ? earned[currentSubj]+1 : earned[currentSubj]) } } });
      return;
    }

    setIdx(next);
    setPhase('pick'); // 다음 과목 선택으로 복귀
  }

  const label = subjectLabel;

  // ── 미니 레이더 ──
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
        {angles.map((a,i)=> (<text key={i} x={center+(R+8)**Math.cos(a)} y={center+(R+8)*Math.sin(a)} textAnchor="middle" dominantBaseline="middle" fontSize="9">{labels[i]}</text>))}
      </svg>
    );
  }

  // ── 미니 캐릭터 프리뷰 ──
  function MiniPreview({ equipped }:{ equipped: Record<string,string> }){
    const Z: Record<string, number> = { Body:0, BodySuit:5, Pants:10, Shoes:15, Clothes:20, Sleeves:25, Bag:30, Necklace:40, Scarf:45, Bowtie:50, Face:55, Hair:60, Hat:70 };
    const SLOTS = ['Body','BodySuit','Pants','Shoes','Clothes','Sleeves','Bag','Necklace','Scarf','Bowtie','Face','Hair','Hat'];
    const __prefix = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const norm = (src?: string) => !src ? undefined : /^https?:\/\//.test(src) ? src : (src.startsWith("/") ? `${__prefix}${src}` : `${__prefix}/${src}`);

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
        <div className="mt-2 text-sm opacity-80">{idx+1}/{TOTAL}</div>
      </div>

      {/* 현재 과목 표시는 퀴즈 단계에서만 */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm opacity-70">현재 과목:</span>
        <span className="px-2 py-1 rounded bg-indigo-600/30 border border-indigo-400/50">
          {phase === 'quiz' && currentSubj ? subjectLabel(currentSubj) : '과목 선택'}
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
              labels={[subjectLabel('KOR'),subjectLabel('ENG'),subjectLabel('MATH'),subjectLabel('SCI'),subjectLabel('SOC'),subjectLabel('HIST')]}
            />
            <ul className="text-sm grid grid-cols-2 gap-2">
              {SUBJECTS.map(s => (
                <li key={s} className="p-2 rounded bg-black/20 border border-white/10 flex items-center justify-between">
                  <span>{subjectLabel(s)}</span>
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
                    {subjectLabel(s)}
                  </button>
                ))}
              </div>
              {!!msg && <div className="text-rose-300 text-sm mt-2">{msg}</div>}
            </div>
          ) : (
            <div className="mt-4 p-4 rounded-lg bg-slate-900/50">
              <div className="text-sm opacity-80 mb-2">현재 과목: <b>{currentSubj ? subjectLabel(currentSubj) : '-'}</b></div>
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
