// apps/student/src/pages/Play.tsx
// 전투 씬: QR 토큰 로그인 → 런 발급 → 팩 로드/정규화 → 진행/기록 → 결과 저장(로컬) → /result
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as api from '../api';
import { makeRng } from '../shared/lib/rng';
import { actByPattern, PatternKey, applyShieldToDamage } from '../game/combat/patterns';
import { pickEnemyByQuery } from '../core/enemy';
import { enemyFrameUrl, stateFrameCount, hitTintStyle  } from '../core/sprites';
import { useSpriteAnimator } from '../core/useSpriteAnimator';
import type { EnemyState } from '../core/sprites';
import type { EnemyAction } from '../game/combat/patterns';
import { subjectMultiplier, calcDamage, SUBJECT_TO_COLOR, SKILL_HEX } from '../core/affinity';
import { loadPlayer, loadItemDB, deriveBattleStats, grantSubjectXp, savePlayer } from '../core/player';
import { SUBJECTS, type Subject } from '../core/char.types';
import type { QuizItem } from '../game/quiz/picker';
import { applyDrops } from '../game/loot';
import { getStageFromQuery, selectSubjectsForTurn, getStageRuntime, recordStageClear, stageDropTable } from '../game/stage';
import { staticURL, appPath } from '../shared/lib/urls';
import { RunSummary } from '../core/run.types'
import {MAX_HP, PLAYER_CRIT_CHANCE, PLAY_XP_PER_CORRECT, XP_ON_WRONG, STREAK_BONUS_ENABLED, STREAK_BONUS_TABLE, TIME_BONUS_ENABLED, TIME_BONUS_THRESH_MS, TIME_BONUS_XP} from '../game/combat/constants';

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

// 과목별 뱅크(캐시)
const subjectBankRef = useRef<Partial<Record<Subject, QuizItem[]>>>({});
const [subjectBank, setSubjectBank] = useState<Partial<Record<Subject, QuizItem[]>>>({});
const [usedIds, setUsedIds] = useState<Set<string>>(new Set()); // 중복 회피


const SUBJECT_PACK: Record<Subject, string> = {
  KOR: 'KorPack',
  ENG: 'EngPack',
  MATH: 'MathPack',
  SCI: 'SciPack',
  SOC: 'SocPack',
  HIST: 'HistPack',
};

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

function resolvePackId(search: URLSearchParams) {
  // 1) URL 쿼리 우선
  const p = search.get('pack');
  if (p) return p;
  // 2) 스테이지 기본값
  const st = getStageFromQuery(search);
  return st.packId || 'sample';
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

// 메타 보존 유틸: subject/difficulty/timeLimitSec/tags를 안전하게 주입
function applyMeta<T extends Question>(q: T, raw: any): T {
  const subjRaw = String(raw?.subject ?? '').trim().toUpperCase();
  const subjOk = (SUBJECTS as readonly string[]).includes(subjRaw)
    ? (subjRaw as Subject)
    : (subjRaw === 'GEN' || subjRaw === 'GENERAL' || subjRaw === 'COMMON' || subjRaw === 'ALL' ? 'GEN' : undefined);
  const diff = Number.isFinite(+raw?.difficulty) ? +raw.difficulty : undefined;
  const tsec = Number.isFinite(+raw?.timeLimitSec) ? +raw.timeLimitSec : undefined;
  const tags = Array.isArray(raw?.tags) ? raw.tags.map(String) : undefined;
  const explanation = (typeof raw?.explanation === 'string' && raw.explanation) ? String(raw.explanation) : q.explanation;
  return { ...q, subject: subjOk, difficulty: diff, timeLimitSec: tsec, tags, explanation };
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
    const base: Question = {
      id: String(raw.id ?? i),
      stem: String(raw.stem),
      choices: normChoices,
      answerKey: ans,
      explanation: typeof raw.explanation === 'string' ? raw.explanation : undefined,
    };
    return applyMeta(base, raw);
  }

  // 2) {stem, options[]}
  if (raw.stem && Array.isArray(raw.options)) {
    const normChoices: Choice[] = (raw.options as any[]).slice(0, 4).map((t, idx) => ({
      key: (['A','B','C','D'] as const)[idx],
      text: typeof t === 'string' ? t : t?.text ?? String(t)
    }));
    const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
    if (!ans) return null;
    const base: Question = { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans };
    return applyMeta(base, raw);
  }

  // 3) {stem, A/B/C/D}
  if (raw.stem && (raw.A || raw.B || raw.C || raw.D)) {
    const keys = ['A','B','C','D'] as const;
    const normChoices: Choice[] = keys.filter(k => raw[k] != null).map((k) => ({ key: k, text: String(raw[k]) }));
    const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
    if (!ans) return null;
    const base: Question = { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans };
    return applyMeta(base, raw);
  }

  return null;
}

export default function Play() {
  const nav = useNavigate();

  const location = useLocation();
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const pack   = useMemo(() => resolvePackId(search), [search]);
  const stage  = useMemo(() => getStageFromQuery(search), [search]);
  const [enemyState, setEnemyState] = useState<EnemyState>('Move');
  const attackTimerRef = useRef<number | null>(null);
  const hitTimerRef = useRef<number | null>(null);

  const [shake, setShake] = useState(false);
  const [pops, setPops] = useState<Array<{ id: number; val: number }>>([]);
  const popIdRef = useRef(0);
  type TagLabel = 'WEAK!' | 'RESIST!' | 'SHIELD';
  const [tag, setTag] = useState<TagLabel | null>(null);
  const tagTimerRef = useRef<number | undefined>(undefined);
  const [hitBorder, setHitBorder] = useState<null | 'inner' | 'outer'>(null);

  const [combatStats, setCombatStats] = useState<ReturnType<typeof deriveBattleStats> | null>(null);

  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);

  const [questions, setQuestions] = useState<QuizItem[]>([]);
  const [qpools, setQpools] = useState<ReturnType<typeof buildQuestionPools> | null>(null);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set()); // 중복 회피

  const triggerShake = (ms = 120) => {
    setShake(true);
    window.setTimeout(() => setShake(false), ms);
  };
  const pushDamage = (val: number) => {
    const id = ++popIdRef.current;
    setPops((a) => [...a, {id, val}]);
    window.setTimeout(() => setPops((a) => a.filter((p) => p.id !== id)), 650);
  };

  function showTag(label: TagLabel){
    if (tagTimerRef.current) window.clearTimeout(tagTimerRef.current);
    setTag(label);
    tagTimerRef.current = window.setTimeout(() => setTag(null), 520) as unknown as number;
  }

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('로딩 중…');

  const [idx, setIdx] = useState(0);
  const q = questions[idx] || null;

  const turnsRef = useRef<TurnLog[]>([]);
  const qShownAtRef = useRef<number | null>(null); // 문항 표출 시각
  const streakRef = useRef(0);
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

  const tagLatchRef = useRef<number>(0);

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

  async function ensureSubjectLoaded(s: Subject) {
    if (subjectBankRef.current[s]?.length) return subjectBankRef.current[s]!;
    const packId = SUBJECT_PACK[s];
    const url = staticURL(`/packs/${packId}.json`);
    const res = await fetch(url, { cache: 'reload' });
    if (!res.ok) throw new Error(`load failed: ${url} (${res.status})`);

    const raw = await res.json();
    const arr = Array.isArray(raw) ? raw : (raw?.questions ?? raw?.items ?? raw?.data?.questions ?? []);
    const clean: QuizItem[] = [];
    arr.forEach((r: any, i: number) => {
      const q = normalizeQuestion(r, i);
      if (q && q.choices?.length >= 2) clean.push(q as unknown as QuizItem);
    });

    // 안전: subject 필터(섞여 들어와도 해당 과목만)
    const onlyThis = clean.filter(q => String(q.subject ?? '').toUpperCase() === s);

    subjectBankRef.current[s] = onlyThis;
    setSubjectBank(prev => ({ ...prev, [s]: onlyThis }));
    return onlyThis;
  }


  // 3) 문항 표출: 시간 기록 + (옵션)카운트다운 시작
  useEffect(() => {
    if (!q) return;
    qShownAtRef.current = Date.now();
    try { proofRef.current?.log?.({ type: 'q_shown', id: q.id, idx }); } catch {}
    if (!TIME_BONUS_ENABLED || phase !== 'quiz') return;
    const totalMs = (q.timeLimitSec && q.timeLimitSec>0)
      ? q.timeLimitSec * 1000
      : TIME_BONUS_THRESH_MS;
    setTimeLeftMs(totalMs);
    const tick = () => {
      const shown = qShownAtRef.current || Date.now();
      const left = Math.max(0, totalMs - (Date.now() - shown));
      setTimeLeftMs(left);
    };
    tick();
    const h = window.setInterval(tick, 100);
    return () => window.clearInterval(h);
  }, [q, idx, phase]);

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
      const items = await loadItemDB('/packs/items.v1.json');
      const ps = deriveBattleStats(items, loadPlayer());
      if (alive) {
        setCombatStats(ps);
        setPlayerMaxHP(ps.hp);
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

  async function chooseSubject(s: Subject){
    setSubject(s);

    try {
      const bank = await ensureSubjectLoaded(s);
      const rng = rngRef.current;

      // 중복 회피
      const pool = bank.filter(q => !usedIds.has(q.id));
      const cand = pool.length ? pool : bank; // 전부 썼으면 재사용 허용

      // 셔플 한 번 후 픽
      for (let i = cand.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [cand[i], cand[j]] = [cand[j], cand[i]];
      }
      const picked = cand[Math.floor(rng.next() * cand.length)] || null;

      if (picked) {
        setUsedIds(prev => {
          const next = new Set(prev);
          next.add(picked.id);
          return next;
        });
        setQuestions(prev => {
          const next = [...prev];
          next[idx] = picked;           // 현재 슬롯에 주입
          return next;
        });
        setPhase('quiz');
        return;
      }

      setMsg('해당 과목 문제를 찾을 수 없습니다.');
      setPhase('pick');
    } catch (e) {
      console.warn('[chooseSubject] load failed', e);
      setMsg('팩 로딩 실패');
      setPhase('pick');
    }
  }


  // 5) 답안 처리
  async function onPick(pick: Choice['key']) {
    if (!q) return;
    const isCorrect = (pick === q.answerKey);
    const subj  = resolveSubject();
    const turn = turnRef.current;
    const rng = rngRef.current;

    const enemyAct = actByPattern(pattern, {rng: () => rng.next(), turn});

    let playerDmgToEnemy = 0;
    let spikeDmgToPlayer = 0;
    if (isCorrect) {
      const subj  = resolveSubject();
      const esubj = resolveEnemySubject();
      const atk = combatStats?.subAtk?.[subj] ?? 1;
      const crit  = (rng.next() < PLAYER_CRIT_CHANCE) ? Math.ceil(atk * 0.5) : 0;
      const base  = atk + crit;
      const multS = subjectMultiplier(subj, esubj);
      const baseATK = base;
      const raw     = calcDamage(baseATK, multS);

      tagLatchRef.current++;
      const thisLatch = tagLatchRef.current;

      playerDmgToEnemy = applyShieldToDamage(raw, enemyAct.shieldActive);
      if (enemyAct.spikeOnHit) spikeDmgToPlayer = enemyAct.spikeOnHit;

      let tagLabel: 'WEAK!' | 'RESIST!' | 'SHIELD' | null = null;
      if (enemyAct.shieldActive) {
        tagLabel = 'SHIELD';
      } else {
        if (baseATK > 0) {
          const eff = raw / baseATK;
          if (eff > 1.01) tagLabel = 'WEAK!';
          else if (eff < 0.99) tagLabel = 'RESIST!';
        } else {
          if (multS > 1) tagLabel = 'WEAK!';
          else if (multS < 1) tagLabel = 'RESIST!';
        }
      }
      if (tagLabel && thisLatch === tagLatchRef.current) showTag(tagLabel);

      // 정답 XP = 기본 + (옵션)연속 + (옵션)시간
      const p = loadPlayer();
      let delta = PLAY_XP_PER_CORRECT;
      if (STREAK_BONUS_ENABLED) {
        streakRef.current += 1;
        delta += STREAK_BONUS_TABLE[Math.min(streakRef.current, STREAK_BONUS_TABLE.length - 1)];
      } else {
        streakRef.current = 0;
      }
      if (TIME_BONUS_ENABLED && qShownAtRef.current != null) {
        const totalMs = (q?.timeLimitSec && q.timeLimitSec > 0) ? q.timeLimitSec * 1000 : TIME_BONUS_THRESH_MS;
        const elapsed = Date.now() - qShownAtRef.current;
        if (elapsed <= totalMs) delta += TIME_BONUS_XP;
      }

      if (delta !== 0) {
        grantSubjectXp(p, subj, delta);
        savePlayer(p);
        try {
          const items = await loadItemDB('/packs/items.v1.json');
          setCombatStats(deriveBattleStats(items, loadPlayer()));
        } catch {}
      }
    } else {
      // 오답: 연속 보너스 리셋 + (옵션)감점
      streakRef.current = 0;
      if (XP_ON_WRONG) {
        const p = loadPlayer();
        grantSubjectXp(p, subj, XP_ON_WRONG);
        savePlayer(p);
      }
    }

    const nextEnemy = Math.max(0, enemyHP - playerDmgToEnemy);
    const nextPlayer = Math.max(0, playerHP - (isCorrect ? 0 : enemyAct.dmgToPlayer) - spikeDmgToPlayer);

    if (isCorrect) {
      pushDamage(playerDmgToEnemy);
      triggerShake(playerDmgToEnemy > 0 ? 100 : 60);
      if (nextEnemy > 0) {
        if (playerDmgToEnemy > 0) {
          setEnemyState('Hit');
          if (hitTimerRef.current) clearTimeout(hitTimerRef.current);
          const hitFps = FPS_BY_STATE.Hit;
          const hitCycle = Math.ceil((1000 / hitFps) * Math.max(1, stateFrameCount(enemyDef.sprite, 'Hit')));
          const hitHold = Math.max(220, Math.min(360, hitCycle));
          hitTimerRef.current = window.setTimeout(() => {
            setEnemyState(prev => (prev === 'Die' ? 'Die' : 'Move'));
          }, hitHold);
        } else {
          setHitBorder('inner');
          window.setTimeout(() => setHitBorder(null), 160);
        }
      }
    }

    if (!isCorrect && nextPlayer > 0) {
      setEnemyState('Attack');
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
      const atkFps = FPS_BY_STATE.Attack;
      const atkCycle = Math.ceil((1000 / atkFps) * stateFrameCount(enemyDef.sprite, 'Attack'));
      const atkHold = Math.max(450, atkCycle);
      attackTimerRef.current = window.setTimeout(() => {
        setHitBorder('outer');
        setTimeout(() => setHitBorder(null), 200);
        triggerShake(120);
        setEnemyState(prev => (prev === 'Die' ? 'Die' : 'Move'));
      }, atkHold);
    }
    if (nextEnemy <= 0) {
      setEnemyState('Die');
    }

    setEnemyHP(nextEnemy);
    setPlayerHP(nextPlayer);

    turnsRef.current.push({
      id: q.id, pick, correct: isCorrect, turn,
      subject: resolveSubject(), enemySubject: resolveEnemySubject(),
      pattern, enemyAct,
      playerDmgToEnemy, spikeDmgToPlayer,
      hpAfter: {player: nextPlayer, enemy: nextEnemy},
    });

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
        await new Promise((r) => setTimeout(r, dieMs));
      } else if (battleOutcome === false) {
        const atkFps = FPS_BY_STATE.Attack;
        const atkCycle = Math.ceil((1000 / atkFps) * stateFrameCount(enemyDef.sprite, 'Attack'));
        const atkHold = Math.max(450, atkCycle) + 140;
        await new Promise((r) => setTimeout(r, atkHold));
      }
      try {
        await finalizeRun({ forcedClear: battleOutcome });
      } catch (e) {
        console.warn('[finalizeRun] failed, fallback to result', e);
      } finally {
        nav(appPath('/result'), { replace: true });
      }
      return;
    }
    setMsg(isCorrect ? '정답!' : '오답 💦');
    setIdx(idx + 1);
  }

  async function finalizeRun(opts?: { forcedClear?: boolean }) {
    setMsg('결과 정리 중…');
    const turns = turnsRef.current;
    const total = Math.max(1, questions.length);
    const correct = turns.filter(t => t.correct).length;
    const wrong   = total - correct;
    const turnsCount = turns.length;
    const durationSec = Math.max(1, Math.round((Date.now() - (startAtRef.current || Date.now())) / 1000));
    const passByScore = correct >= Math.ceil(total * 0.6);
    const cleared = (typeof opts?.forcedClear === 'boolean') ? opts!.forcedClear : passByScore;

    const summary: RunSummary = {
      cleared,
      turns: turnsCount,
      durationSec,
      correct,
      wrong,
      time: new Date().toISOString()
    };
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
      localStorage.setItem('qd:lastRewards', JSON.stringify({}));
      localStorage.setItem('qd:lastStage', stage.id);
    }

    try {
      await proofRef.current?.summary?.({
        cleared,
        score: correct,
        total,
        turns: turnsCount,
        durationSec
      } as any);
    } catch {}
    await Promise.resolve();
  }

  // ───────────── 임시 상성 ─────────────
  function isSubject(x?: string | null): x is Subject {
    return !!x && SUBJECTS.includes(x.toUpperCase() as Subject);
  }
  function resolveSubject(): Subject {
    return subject;
  }
  function resolveEnemySubject(): Subject {
    const s = (search.get('esubj') || '').toUpperCase();
    if (isSubject(s)) return s as Subject;
    return (enemyDef as any).subject ?? 'ENG';
  }

  function TimerBar({ ms, totalMs }: { ms: number; totalMs: number }) {
    const pct = Math.max(0, Math.min(100, Math.round((ms / Math.max(1, totalMs)) * 100)));
    return (
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs opacity-80">
          <span>시간 제한</span>
          <span>{(ms / 1000).toFixed(1)}s</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded overflow-hidden">
          <div className="h-full bg-amber-400 transition-[width] duration-100" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  // ───────────── 렌더 ─────────────
  if (loading) return <div className="p-6">로딩…</div>;
  if (phase === 'quiz' && !q) {
    return <div className="p-6">문항이 없습니다. <span className="text-rose-400 ml-2">{msg}</span></div>;
  }
  const total = Math.max(1, questions.length);
  const progress = Math.round(((Math.min(idx, total - 1) + 1) / total) * 100);

  return (
    <>
      <style>{`
        @keyframes qd-pop-rise {
          from { transform: translate(-50%, 0); opacity: 1; }
          to   { transform: translate(-50%, -24px); opacity: 0; }
        }
        @keyframes qd-tag-pop {
          from { transform: translate(-50%, 0); opacity: 0.9; }
          to   { transform: translate(-50%, -10px); opacity: 0; }
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
              src={frameUrl || enemyImgUrl}
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
              }}
            />

            {/* 🔴 피격 테두리 */}
            {hitBorder && (
              <>
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
                  bottom: `${Math.max(0, Math.round((spriteH || 420) / 3))}px`,
                  transform: 'translateX(-50%)',
                  fontSize: 'clamp(16px, 3.6vw, 28px)',
                  lineHeight: 1,
                  color: 'rgb(239 68 68)',
                  textShadow: '0 1px 0 rgba(0,0,0,.25), 0 0 8px rgba(239,68,68,.6)',
                  animation: 'qd-pop-rise 650ms ease-out forwards',
                  willChange: 'transform, opacity',
                }}
              >
                -{p.val}
              </div>
            ))}
            {/* 태그 팝업: WEAK!/RESIST!/SHIELD */}
            {tag && (
              <div
                className="pointer-events-none absolute font-extrabold select-none"
                style={{
                  left: '50%',
                  bottom: `${Math.max(0, Math.round((spriteH || 420) * 0.72))}px`,
                  transform: 'translateX(-50%)',
                  fontSize: 'clamp(12px, 2.6vw, 18px)',
                  lineHeight: 1,
                  color: tag==='WEAK!' ? 'rgb(250 204 21)' : tag==='RESIST!' ? 'rgb(148 163 184)' : 'rgb(125 211 252)',
                  textShadow: '0 1px 0 rgba(0,0,0,.25), 0 0 8px rgba(0,0,0,.25)',
                  animation: 'qd-tag-pop 520ms ease-out forwards',
                  willChange: 'transform, opacity',
                }}>
                {tag}
              </div>
            )}
          </div>
          <div className="text-xs opacity-70">
            적:{enemyDef.name}
            {(() => {
              const s: Subject  = resolveSubject();
              const es: Subject = resolveEnemySubject();
              return <> · S:{s}({SUBJECT_TO_COLOR[s]}) vs ES:{es}({SUBJECT_TO_COLOR[es]})</>;
            })()}
            {' / '}패턴:{pattern} / 턴:{turnRef.current}
          </div>
          <HPBar value={playerHP} max={playerMaxHP} label="Player"/>
          <HPBar value={enemyHP} max={enemyMaxHP} label="Enemy"/>
        </div>

        {phase === 'pick' ? (
          // 과목 선택 화면
          <div className="p-4 rounded bg-slate-800">
            <div className="font-medium mb-3">과목을 선택하세요</div>
            <div className="grid grid-cols-2 gap-3">
              {options.map((s: Subject) => (
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
            {(TIME_BONUS_ENABLED || (q?.timeLimitSec && q.timeLimitSec>0)) && (
              <TimerBar ms={timeLeftMs} totalMs={(q?.timeLimitSec ? q.timeLimitSec*1000 : TIME_BONUS_THRESH_MS)} />
            )}
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
    </>
  );
}
