// apps/student/src/pages/Play.tsx
// 전투 씬: QR 토큰 로그인 → 런 발급 → 팩 로드/정규화 → 진행/기록 → 결과 저장(로컬) → /result
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// ⚠️ Result.tsx가 '../api'를 쓰고 있으니 여기도 동일 경로로 맞춰 드롭 인
import * as api from '../api';
import { makeRng } from '../shared/lib/rng';
import { actByPattern, PatternKey, applyShieldToDamage } from '../game/combat/patterns';
import { MAX_HP, PLAYER_BASE_DMG, PLAYER_CRIT_CHANCE } from '../game/combat/constants';
import { pickEnemyByQuery } from '../game/combat/enemy';
import { enemyFrameUrl, stateFrameCount, hitTintStyle  } from '../game/combat/sprites';
import { useSpriteAnimator } from '../game/combat/useSpriteAnimator';
import type { EnemyState } from '../game/combat/sprites';
import type { EnemyAction } from '../game/combat/patterns';
import { subjectMultiplier, SUBJECT_TO_COLOR, SKILL_HEX } from '../game/combat/affinity';
import { loadPlayer, loadItemDB, deriveBattleStats, SUBJECTS, type Subject } from '../core/player';
import { applyDrops } from '../game/loot';
import { getStageFromQuery, selectSubjectsForTurn, getStageRuntime, recordStageClear, stageDropTable } from '../game/stage';
import { staticURL, appPath } from '../shared/lib/urls';


type Choice = { key: 'A'|'B'|'C'|'D'; text: string };
type Question = { id: string; stem: string; choices: Choice[]; answerKey: Choice['key']; explanation?: string };
type Turn = { id: string; pick: Choice['key']; correct: boolean };

type TurnLog = {
  id: string;
  pick: Choice['key'];
  correct: boolean;
  turn: number;
  pattern: 'Aggressive' | 'Shield' | 'Spiky';
  enemyAct: EnemyAction;
  playerDmgToEnemy: number;
  spikeDmgToPlayer: number;
  hpAfter: { player: number; enemy: number };
  subject?: Subject;
  enemySubject?: Subject;
};

function usePackParam() {
  const qs = new URLSearchParams(location.search);
  return qs.get('pack') || 'sample';
}

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

function resolvePackUrl(pack: string) {
  const base = import.meta.env.BASE_URL || '/';
  const url = new URL(base, window.location.origin);      // ex) https://site.com/app/
  url.pathname = url.pathname.replace(/\/$/, '') + `/packs/${pack}.json`; // .../packs/sample.v3.json
  return url.toString();
}


function normalizeQuestion(raw: any, i: number): Question | null {
  if (!raw) return null;

  // 1) 표준 {stem, choices[], answerKey}
  if (raw.stem && Array.isArray(raw.choices)) {
    const arr = raw.choices as any[];
    const normChoices: Choice[] = arr.slice(0, 4).map((t, idx) => ({
      key: (['A','B','C','D'] as const)[idx],
      text: typeof t === 'string' ? t : t?.text ?? String(t)
    }));
    const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
    if (!ans) return null;
    return { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans, explanation: raw.explanation };
  }

  // 2) {stem, options[]}
  if (raw.stem && Array.isArray(raw.options)) {
    const normChoices: Choice[] = (raw.options as any[]).slice(0, 4).map((t, idx) => ({
      key: (['A','B','C','D'] as const)[idx],
      text: typeof t === 'string' ? t : t?.text ?? String(t)
    }));
    const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
    if (!ans) return null;
    return { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans };
  }

  // 3) {stem, A/B/C/D}
  if (raw.stem && (raw.A || raw.B || raw.C || raw.D)) {
    const keys = ['A','B','C','D'] as const;
    const normChoices: Choice[] = keys.filter(k => raw[k] != null).map((k) => ({ key: k, text: String(raw[k]) }));
    const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
    if (!ans) return null;
    return { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans };
  }

  return null;
}

export default function Play() {
  const pack = usePackParam();
  const nav = useNavigate();

  const location = useLocation();
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const stage = useMemo(() => getStageFromQuery(search), [search]);
  const [enemyState, setEnemyState] = useState<EnemyState>('Move');
  const attackTimerRef = useRef<number | null>(null);
  const hitTimerRef = useRef<number | null>(null);

  const [shake, setShake] = useState(false);
  const [pops, setPops] = useState<Array<{ id: number; val: number }>>([]);
  const popIdRef = useRef(0);
  const [hitBorder, setHitBorder] = useState<null | 'inner' | 'outer'>(null);

  const [combatStats, setCombatStats] = useState<ReturnType<typeof deriveBattleStats> | null>(null);

  const triggerShake = (ms = 120) => {
    setShake(true);
    window.setTimeout(() => setShake(false), ms);
  };
  const pushDamage = (val: number) => {
    const id = ++popIdRef.current;
    setPops((a) => [...a, {id, val}]);
    window.setTimeout(() => setPops((a) => a.filter((p) => p.id !== id)), 650);
  };

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('로딩 중…');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const q = questions[idx] || null;

  const turnsRef = useRef<TurnLog[]>([]);
  const startedRef = useRef(false);
  const startAtRef = useRef<number>(0);
  const proofRef = useRef<any>(null); // 동적 import 대응

  const [playerHP, setPlayerHP] = useState(MAX_HP);
  const [enemyHP, setEnemyHP] = useState(MAX_HP);
  const [playerMaxHP, setPlayerMaxHP] = useState<number>(MAX_HP);
  const [enemyMaxHP, setEnemyMaxHP] = useState<number>(MAX_HP);
  const enemyDef = pickEnemyByQuery(search);            // ?enemy=E01/E02/E03...

  const [phase, setPhase] = useState<'pick'|'quiz'>('pick');
  const [options, setOptions] = useState<Subject[]>([]);
  const [subject, setSubject] = useState<Subject>('KOR');

  const FPS_BY_STATE: Record<EnemyState, number> = {
    Move: 8,
    Attack: 8,
    Die: 8,
    Hit: 2,
  };

  const spriteRef = useRef<HTMLImageElement | null>(null);
  const [spriteH, setSpriteH] = useState(0);
  
  useEffect(() => {
    const el = spriteRef.current;
    if (!el) return;
    const set = () => setSpriteH(el.clientHeight || 0);
    set(); // 초기 1회
    const ro = 'ResizeObserver' in window ? new ResizeObserver(set) : null;
    ro?.observe(el);
    window.addEventListener('resize', set);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', set);
    };
  }, [enemyDef]); // 적 교체 시 재계산


  useEffect(() => {
    // 적 교체 시 HP 재설정
    const m = Math.round(MAX_HP * (enemyDef.hpMul ?? 1));
    setEnemyMaxHP(m);
    setEnemyHP(m);
    // 스프라이트 프리로드
    (['Move', 'Attack', 'Die', 'Hit'] as const).forEach(state => {
      const max = stateFrameCount(enemyDef.sprite, state);
      for (let i = 1; i <= max; i++) {
        const img = new Image();
        img.src = enemyFrameUrl(enemyDef.sprite, state, i);
      }
    });
  }, [enemyDef]);

  const enemyImgUrl = useMemo(() => enemyFrameUrl(enemyDef.sprite, 'Move', 1), [enemyDef]);

  // 상태별 프레임 애니메이션 (Die는 루프 정지)
  const looping = enemyState === 'Move';
  const {frameUrl} = useSpriteAnimator(
    enemyDef.sprite,
    enemyState,
    FPS_BY_STATE[enemyState],
    looping
  );

  const patParam = search.get('pat') as string | null;
  const asPat = (p: any): p is PatternKey => (p === 'Aggressive' || p === 'Shield' || p === 'Spiky');
  const pattern: PatternKey = asPat(patParam) ? patParam
    : asPat((enemyDef as any).pattern) ? (enemyDef as any).pattern
      : 'Aggressive';

// 결정론 RNG: runToken(혹은 roomId+studentId 등)으로 시드 고정
  const runToken = useMemo(() => (localStorage.getItem('qd:runToken') ?? 'dev'), []);
  const rngRef = useRef(makeRng(runToken));
  const turnRef = useRef(1);

  // 간단 HP Bar(임시)
  const HPBar = ({value, max, label}: { value: number; max: number; label: string }) => {
    const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
    return (
      <div className="my-2">
        <div className="text-xs opacity-80">{label} HP {value}/{max}</div>
        <div className="w-full h-2 bg-slate-700 rounded">
          <div className="h-2 bg-emerald-500 rounded" style={{width: `${pct}%`}}/>
        </div>
      </div>
    );
  }


  // 1) QR 토큰 로그인 → 런 발급 → Proof 로깅 준비
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const qs = new URLSearchParams(location.search);
        const t = qs.get('t');
        if (t && typeof (api as any).guestLogin === 'function') {
          await (api as any).guestLogin(t);
        }

        const ensure = (api as any).ensureRunToken || (api as any).newRunToken || (api as any).enterDungeon;
        if (typeof ensure === 'function') await ensure();

        // Proof (있으면 사용, 없어도 진행)
        try {
          const mod: any = await import('../shared/lib/proof');
          const ProofCtor = mod?.Proof ?? mod?.default;
          const runId = localStorage.getItem('qd:runToken');
          proofRef.current = runId ? new ProofCtor(runId) : new ProofCtor();
          await proofRef.current?.log?.({type: 'session_start', pack});
        } catch {
        }

        // 새 세션 초기화
        turnsRef.current = [];
        startAtRef.current = Date.now();

        setMsg('준비 완료!');
      } catch (e: any) {
        console.warn('Play init failed', e);
        setMsg(e?.message ?? '접속 권한이 없거나 만료되었습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [pack]);

  // 2) 팩 로드(+정규화)
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const url = resolvePackUrl(pack);
        const res = await fetch(url, {cache: 'reload', signal: ac.signal});
        let rawList: any = [];
        if (res.ok) rawList = await res.json();
        else rawList = [{id: 'sample-1', stem: '샘플 문항입니다. A를 선택하세요.', choices: ['A', 'B', 'C', 'D'], answerKey: 'A'}];

        const arr = Array.isArray(rawList)
          ? rawList
          : (rawList?.questions ?? rawList?.items ?? rawList?.data?.questions ?? []);

        const clean: Question[] = [];
        const invalids: Array<{ i: number; raw: any }> = [];
        arr.forEach((raw: any, i: number) => {
          const nq = normalizeQuestion(raw, i);
          if (nq && nq.stem && Array.isArray(nq.choices) && nq.choices.length >= 2) clean.push(nq);
          else invalids.push({i, raw});
        });

        setQuestions(clean);
        setIdx(0);
        if (invalids.length) console.warn(`[PACK:${pack}] 무시된 비정상 문항 ${invalids.length}개`, invalids.slice(0, 5));
      } catch (e) {
        if (!ac.signal.aborted) {
          console.warn('pack load failed', e);
          setQuestions([]);
          setMsg('팩 로딩 실패');
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [pack]);

  // 3) 문항 표출 로그(선택)
  useEffect(() => {
    if (q && proofRef.current?.log) {
      proofRef.current.log({type: 'q_shown', id: q.id, idx}).catch?.(() => {
      });
    }
  }, [q, idx]);

  // 4) 키보드 입력(ABCD)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (k === 'A' || k === 'B' || k === 'C' || k === 'D') onPick(k as Choice['key']);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q]);

  useEffect(() => {
    return () => {
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
      if (hitTimerRef.current) clearTimeout(hitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const items = await loadItemDB(staticURL('items.v1.json'));
      const ps = deriveBattleStats(items, loadPlayer());
      if (alive) {
        setCombatStats(ps);
        setPlayerMaxHP(ps.hp);
        // 전투 도중 장비 변경 등으로 MaxHP가 줄어도 '힐'되진 않게 클램프
        setPlayerHP(prev => Math.min(prev, ps.hp));
      }
    })();
    return () => { alive = false };
  }, []);

  useEffect(()=> {
    const seed = localStorage.getItem('qd:runToken') ?? 'dev';
    const opts = selectSubjectsForTurn(stage, turnRef.current, seed);
    setOptions(opts);
    setPhase('pick');
  }, [stage, idx]); // 매 문제(or 라운드) 시작마다 갱신

  function chooseSubject(s: Subject){
    setSubject(s);
    // TODO: pickQuestionForSubject(s)로 과목별 문제를 골라 세팅(팩에 과목 태그가 들어가면 적용)
    setPhase('quiz');
  }
  
  // 5) 답안 처리
  async function onPick(pick: Choice['key']) {
    if (!q) return;
    const isCorrect = (pick === q.answerKey);
    const turn = turnRef.current;
    const rng = rngRef.current;

    // 1) 적 행동(오답 시 적용될 피해, 실드/스파이크)
    const enemyAct = actByPattern(pattern, {rng: () => rng.next(), turn});

    // 2) 플레이어 공격/스파이크 "먼저" 계산
    let playerDmgToEnemy = 0;
    let spikeDmgToPlayer = 0;
    if (isCorrect) {
      // 1) 과목별 공격력 선택
      const subj  = resolveSubject();
      const esubj = resolveEnemySubject();
      const atk   = combatStats?.subAtk?.[subj] ?? 1;
      
      // 2) 치명타(기존 로직 유지, 배수는 공격력 기준)
      const crit  = (rng.next() < PLAYER_CRIT_CHANCE) ? Math.ceil(atk * 0.5) : 0;
      const base  = atk + crit;
      
      // 3) 6각 순환 상성 배수 (kor→eng→math→sci→soc→hist→kor)
      const multS = subjectMultiplier(subj, esubj);
      const withAff = Math.ceil(base * multS);
      
      // 4) 실드/가시 처리 유지
      playerDmgToEnemy = applyShieldToDamage(withAff, enemyAct.shieldActive);
      if (enemyAct.spikeOnHit) spikeDmgToPlayer = enemyAct.spikeOnHit;
    }

    // 3) 피해를 계산한 "후에" HP 적용
    const nextEnemy = Math.max(0, enemyHP - playerDmgToEnemy);
    const nextPlayer = Math.max(0, playerHP - (isCorrect ? 0 : enemyAct.dmgToPlayer) - spikeDmgToPlayer);

    // 4) 애니메이션 상태 전환

    if (isCorrect && playerDmgToEnemy > 0) {
      pushDamage(playerDmgToEnemy);     // "-12" 팝업
      triggerShake(100);                // 짧은 흔들림
      if (nextEnemy > 0) {
        setEnemyState('Hit');
        if (hitTimerRef.current) clearTimeout(hitTimerRef.current);
        const hitFps = FPS_BY_STATE.Hit;
        const hitCycle = Math.ceil((1000 / hitFps) * Math.max(1, stateFrameCount(enemyDef.sprite, 'Hit')));
        const hitHold = Math.max(220, Math.min(360, hitCycle)); // 0.22~0.36s 사이
        hitTimerRef.current = window.setTimeout(() => {
          setEnemyState(prev => (prev === 'Die' ? 'Die' : 'Move'));
        }, hitHold);
      }
    }

    //   - 오답(적 공격): Attack 짧게 재생
    if (!isCorrect && nextPlayer > 0) {
      setEnemyState('Attack');
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
      const atkFps = FPS_BY_STATE.Attack;
      const atkCycle = Math.ceil((1000 / atkFps) * stateFrameCount(enemyDef.sprite, 'Attack')); // 한 바퀴
      const atkHold = Math.max(450, atkCycle); // 최소 450ms 이상
      attackTimerRef.current = window.setTimeout(() => {
        setHitBorder('outer');        // 또는 'inner'로 취향 선택
        setTimeout(() => setHitBorder(null), 200);
        triggerShake(120);
        setEnemyState(prev => (prev === 'Die' ? 'Die' : 'Move'));
      }, atkHold);
    }
    //   - 적 사망: Die 고정
    if (nextEnemy <= 0) {
      setEnemyState('Die');
    }

    // 5) HP 반영
    setEnemyHP(nextEnemy);
    setPlayerHP(nextPlayer);

    // 6) 전투 로그
    turnsRef.current.push({
      id: q.id, pick, correct: isCorrect, turn, 
      subject: resolveSubject(), enemySubject: resolveEnemySubject(),
      pattern, enemyAct,
      playerDmgToEnemy, spikeDmgToPlayer,
      hpAfter: {player: nextPlayer, enemy: nextEnemy},
    });

    // 7) 종료/진행 분기
    const isBattleEnd = (nextEnemy <= 0 || nextPlayer <= 0);
    const isLastQuestion = (idx + 1 >= questions.length);
    const battleOutcome = nextEnemy <= 0 ? true : (nextPlayer <= 0 ? false : undefined);
    turnRef.current = turn + 1;

    if (isBattleEnd || isLastQuestion) {
      setMsg(
        battleOutcome === true ? '승리! 결과 정리 중…' :
          battleOutcome === false ? '패배… 결과 정리 중…' :
            (isCorrect ? '정답! 결과 정리 중…' : '오답 💦 결과 정리 중…')
      );
      if (battleOutcome === true) {
        const dieFps = FPS_BY_STATE.Die;
        const dieMs = Math.max(520, Math.ceil((1000 / dieFps) * stateFrameCount(enemyDef.sprite, 'Die')));
        await new Promise((r) => setTimeout(r, dieMs));  // Die 끝까지
      } else if (battleOutcome === false) {
        const atkFps = FPS_BY_STATE.Attack;
        const atkCycle = Math.ceil((1000 / atkFps) * stateFrameCount(enemyDef.sprite, 'Attack'));
        const atkHold = Math.max(450, atkCycle) + 140;  // Attack + 점멸
        await new Promise((r) => setTimeout(r, atkHold));
      }
      try {
        await finalizeRun({ forcedClear: battleOutcome });  // ✅ 정상 경로
      } catch (e) {
        console.warn('[finalizeRun] failed, fallback to result', e);
      } finally {
        // 어떤 경우에도 결과 화면으로 이동 (보상 로딩 실패 등 보호)
        nav(appPath('result'), { replace: true });
      }
      return;
    }
    // 계속 진행
    setMsg(isCorrect ? '정답!' : '오답 💦');
    setIdx(idx + 1);
  }
  
  async function finalizeRun(opts?: { forcedClear?: boolean }) {
    setMsg('결과 정리 중…');
    const turns = turnsRef.current;
    const total = Math.max(1, questions.length);
    const score = turns.filter(t => t.correct).length;
    const durationSec = Math.max(1, Math.round((Date.now() - (startAtRef.current || Date.now())) / 1000));
    const passByScore = score >= Math.ceil(total * 0.6); // 통과 기준(60%)
    // 전투 즉시판정이 있으면 우선, 없으면 점수 기준
    const cleared = (typeof opts?.forcedClear === 'boolean') ? opts!.forcedClear : passByScore;

    const summary = {cleared, turns: total, durationSec};
    localStorage.setItem('qd:lastResult', JSON.stringify(summary));
    localStorage.setItem('qd:lastPack', pack);
    localStorage.setItem('qd:lastTurns', JSON.stringify(turns));

    try {
      const { clearCount } = getStageRuntime(stage.id);
      const rewards = await applyDrops(stageDropTable(stage), `${stage.id}:${clearCount}`);
      if (cleared) recordStageClear(stage.id);
      localStorage.setItem('qd:lastRewards', JSON.stringify(rewards ?? {}));
      localStorage.setItem('qd:lastStage', stage.id);
    } catch (e) {
      console.warn('[drops] failed, continue without rewards', e);
      localStorage.setItem('qd:lastRewards', JSON.stringify({})); // 결과 화면은 정상 표시
      localStorage.setItem('qd:lastStage', stage.id);
    }

    try {
      await proofRef.current?.summary?.({cleared, score, total} as any);
    } catch {
    }

    // NOTE: 최종 이동은 onPick 쪽 finally에서 수행 (여기서도 중복 이동해도 무해)
    nav('/result', {replace: true}); // ← 이동
  }

  // ───────────── 임시 상성 ─────────────
  
  function isSubject(x?: string | null): x is Subject {
    return !!x && SUBJECTS.includes(x.toUpperCase() as Subject);
  }

  function resolveSubject(): Subject {
    return subject; // 현재 선택된 과목
    }

  function resolveEnemySubject(): Subject {
    const s = (search.get('esubj') || '').toUpperCase();
    // enemyDef.subject가 있으면 우선 사용
    if (isSubject(s)) return s as Subject;
    return (enemyDef as any).subject ?? 'ENG';
  }
  

    // ───────────── 렌더 ─────────────
    if (loading) return <div className="p-6">로딩…</div>;
    if (!q) return <div className="p-6">문항이 없습니다. <span className="text-rose-400 ml-2">{msg}</span></div>;

    const total = Math.max(1, questions.length);
    const progress = Math.round(((Math.min(idx, total - 1) + 1) / total) * 100);

    return (
      <>
        {/* damage popup: rise+fade */}
        <style>{`
      @keyframes qd-pop-rise {
        from { transform: translate(-50%, 0); opacity: 1; }
        to   { transform: translate(-50%, -24px); opacity: 0; }
      }
    `}</style>
        <div className="p-6 max-w-xl mx-auto space-y-4">
          {/* 진행도 */}
          <div className="h-2 bg-slate-800 rounded overflow-hidden">
            <div className="h-full bg-emerald-500" style={{width: `${progress}%`}}/>
          </div>
          <div className="text-sm opacity-80">{idx + 1} / {total}</div>

          <div className="p-3 border rounded mb-2">
            <div className="text-sm font-medium">전투(주2 테스트)</div>
            {/* Enemy visual */}
            <div className="relative flex items-end justify-center my-2 min-h-[320px] md:min-h-[480px]"
                 style={{transform: shake ? 'translateX(3px)' : 'translateX(0)', transition: 'transform 80ms'}}>
              <img
                ref={spriteRef}
                src={frameUrl || enemyImgUrl}   // 애니메이터 우선, 실패 시 1프레임
                alt={enemyDef.name}
                width={460}
                height={460}
                style={{
                  imageRendering: 'pixelated',
                  maxWidth: 'min(60vw, 460px)',
                  maxHeight: 'min(60vw, 460px)',
                  ...(hitTintStyle(enemyState) || {}),
                } as React.CSSProperties}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = enemyImgUrl;
                }} // 폴백
              />

              {/* 🔴 피격 테두리(outer/inner) */}
              {hitBorder && (
                <>
                  {/* 바깥 테두리 */}
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      inset: '-8px',
                      border: hitBorder === 'outer' ? '4px solid rgba(239,68,68,0.9)' : 'none',
                      borderRadius: '12px',
                      boxShadow: '0 0 16px rgba(239,68,68,0.6)',
                      transition: 'opacity 120ms',
                    }}
                  />
                  {/* 안쪽 테두리(이미지 영역 기준) */}
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      width: 'min(60vw, 460px)',
                      height: 'min(60vw, 460px)',
                      border: hitBorder === 'inner' ? '4px solid rgba(239,68,68,0.85)' : 'none',
                      borderRadius: '12px',
                      transition: 'opacity 120ms',
                    }}
                  />
                </>
              )}

              {/* 데미지 팝업 */}
              {pops.map(p => (
                <div
                  key={p.id}
                  className="pointer-events-none absolute font-extrabold select-none"
                  style={{
                    left: '50%',
                    bottom: `${Math.max(0, Math.round((spriteH || 420) / 3))}px`, // 스프라이트 높이의 2/3 지점
                    transform: 'translateX(-50%)',
                    // 뷰포트 기반 반응형 크기
                    fontSize: 'clamp(16px, 3.6vw, 28px)',
                    lineHeight: 1,
                    color: 'rgb(239 68 68)', // tailwind red-500
                    textShadow: '0 1px 0 rgba(0,0,0,.25), 0 0 8px rgba(239,68,68,.6)',
                    animation: 'qd-pop-rise 650ms ease-out forwards',
                    willChange: 'transform, opacity',
                  }}
                >
                  -{p.val}
                </div>
              ))}
            </div>
            <div className="text-xs opacity-70">
              적:{enemyDef.name}
              {' · '}S:{resolveSubject()}({SUBJECT_TO_COLOR[resolveSubject()]})
              {' vs '}ES:{resolveEnemySubject()}({SUBJECT_TO_COLOR[resolveEnemySubject()]})
              {' / '}패턴:{pattern} / 턴:{turnRef.current}            </div>
            <HPBar value={playerHP} max={playerMaxHP} label="Player"/>
            <HPBar value={enemyHP} max={enemyMaxHP} label="Enemy"/>
          </div>

          {phase === 'pick' ? (
            // 과목 선택 화면
            <div className="p-4 rounded bg-slate-800">
              <div className="font-medium mb-3">과목을 선택하세요</div>
              <div className="grid grid-cols-2 gap-3">
                {options.map(s => (
                  <button key={s} onClick={() => chooseSubject(s)}
                          className="p-4 rounded-xl border border-white/10 bg-slate-900/60 text-left">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ background: SKILL_HEX[SUBJECT_TO_COLOR[s]] }} />
                            {s}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // 문제 풀이 화면
            <div className="p-4 rounded bg-slate-800">
              <div className="font-medium whitespace-pre-wrap">{q?.stem}</div>
              <div className="grid gap-2 mt-3">
                {(q?.choices ?? []).map((c) => (
                  <button key={c.key} className="text-left px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 transition" onClick={() => onPick(c.key)}>
                    <span className="font-bold mr-2">{c.key}.</span>{c.text}
                  </button>
                ))}
                {(!q?.choices || q.choices.length === 0) && (
                  <div className="text-sm text-rose-300">이 문항의 선택지 형식이 올바르지 않습니다.</div>
                )}
              </div>
            </div>
          )}
          <div className="text-emerald-400">{msg}</div>
        </div>
      </>);
}
