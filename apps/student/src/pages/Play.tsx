// apps/student/src/pages/Play.tsx
// 전투 씬: QR 토큰 로그인 → 런 발급 → 팩 로드/정규화 → 진행/기록 → 결과 저장(로컬) → /result
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// ⚠️ Result.tsx가 '../api'를 쓰고 있으니 여기도 동일 경로로 맞춰 드롭 인
import * as api from '../api';
import { makeRng } from '../shared/lib/rng';
import { resolveElemsFromQuery, mult } from '../game/combat/affinity';
import { actByPattern, PatternKey, applyShieldToDamage } from '../game/combat/patterns';
import { MAX_HP, PLAYER_BASE_DMG, PLAYER_CRIT_CHANCE } from '../game/combat/constants';
import type { EnemyAction } from '../game/combat/patterns';
import type { Elem } from '../game/combat/affinity';


type Choice = { key: 'A'|'B'|'C'|'D'; text: string };
type Question = { id: string; stem: string; choices: Choice[]; answerKey: Choice['key']; explanation?: string };
type Turn = { id: string; pick: Choice['key']; correct: boolean };

type TurnLog = {
  id: string;
  pick: Choice['key'];
  correct: boolean;
  turn: number;
  playerElem: Elem;
  enemyElem: Elem;
  pattern: 'Aggressive' | 'Shield' | 'Spiky';
  enemyAct: EnemyAction;
  playerDmgToEnemy: number;
  spikeDmgToPlayer: number;
  hpAfter: { player: number; enemy: number };
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

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('로딩 중…');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const q = questions[idx] || null;

  const turnsRef = useRef<Turn[]>([]);
  const startedRef = useRef(false);
  const startAtRef = useRef<number>(0);
  const proofRef = useRef<any>(null); // 동적 import 대응

  // …컴포넌트 내부
  const [playerHP, setPlayerHP] = useState(MAX_HP);
  const [enemyHP,  setEnemyHP]  = useState(MAX_HP);

// URL 파라미터로 속성/패턴 스텁(없으면 기본)
  const search = new URLSearchParams(window.location.search);
  const { player: playerElem, enemy: enemyElem } = resolveElemsFromQuery(search);
  const pattern: PatternKey = (search.get('pat') as PatternKey) ?? 'Aggressive';

// 결정론 RNG: runToken(혹은 roomId+studentId 등)으로 시드 고정
  const runToken = useMemo(() => /* 기존 런 식별자 사용 */ (localStorage.getItem('runToken') ?? 'dev'), []);
  const rngRef = useRef(makeRng(runToken));
  const turnRef = useRef(1);

  // 간단 HP Bar(임시)
  const HPBar = ({ value, label }: { value:number; label:string }) => {
    const pct = Math.max(0, Math.min(100, (value / MAX_HP) * 100));
    return (
    <div className="my-2">
      <div className="text-xs opacity-80">{label} HP {value}/{MAX_HP}</div>
      <div className="w-full h-2 bg-slate-700 rounded">
        <div className="h-2 bg-emerald-500 rounded" style={{ width: `${pct}%` }} />
      </div>
    </div>
    );}
  
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
          await proofRef.current?.log?.({ type: 'session_start', pack });
        } catch {}

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
        const url = new URL(`packs/${pack}.json`, location.origin).toString();
        const res = await fetch(url, { cache: 'no-store', signal: ac.signal });
        let rawList: any = [];
        if (res.ok) rawList = await res.json();
        else rawList = [{ id: 'sample-1', stem: '샘플 문항입니다. A를 선택하세요.', choices: ['A','B','C','D'], answerKey: 'A' }];

        const arr = Array.isArray(rawList)
          ? rawList
          : (rawList?.questions ?? rawList?.items ?? rawList?.data?.questions ?? []);

        const clean: Question[] = [];
        const invalids: Array<{ i:number; raw:any }> = [];
        arr.forEach((raw:any, i:number) => {
          const nq = normalizeQuestion(raw, i);
          if (nq && nq.stem && Array.isArray(nq.choices) && nq.choices.length >= 2) clean.push(nq);
          else invalids.push({ i, raw });
        });

        setQuestions(clean);
        setIdx(0);
        if (invalids.length) console.warn(`[PACK:${pack}] 무시된 비정상 문항 ${invalids.length}개`, invalids.slice(0,5));
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
      proofRef.current.log({ type: 'q_shown', id: q.id, idx }).catch?.(() => {});
    }
  }, [q, idx]);

  // 4) 답안 처리

  // 4) 답안 처리
  async function onPick(pick: Choice['key']) {
    if (!q) return;
    const isCorrect = (pick === q.answerKey);
    const turn = turnRef.current;
    const rng  = rngRef.current;

    // 1) 적 행동(오답 시 적용될 피해, 실드/스파이크 플래그)
    const enemyAct = actByPattern(pattern, { rng: () => rng.next(), turn });
    
    // 2) 플레이어 공격(정답일 때만)
    let playerDmgToEnemy = 0;
    let spikeDmgToPlayer = 0;

    if (isCorrect) {
      const playerCrit = (rng.next() < PLAYER_CRIT_CHANCE) ? Math.ceil(PLAYER_BASE_DMG * 0.5) : 0;
      const raw = PLAYER_BASE_DMG + playerCrit;
      const withAff = Math.ceil(raw * mult(playerElem, enemyElem));
      playerDmgToEnemy = applyShieldToDamage(withAff, enemyAct.shieldActive);
      if (enemyAct.spikeOnHit) spikeDmgToPlayer = enemyAct.spikeOnHit;
    }

    // 3) 피해 적용
    const nextEnemy  = Math.max(0, enemyHP  - playerDmgToEnemy);
    const nextPlayer = Math.max(0, playerHP - (isCorrect ? 0 : enemyAct.dmgToPlayer) - spikeDmgToPlayer);

    setEnemyHP(nextEnemy);
    setPlayerHP(nextPlayer);
    
    // 4) 전투 로그
    const turnsRef = useRef<TurnLog[]>([]);
    
    turnsRef.current.push({
      id: q.id,
      pick,
      correct: isCorrect,
      turn, // 현재 턴 번호
      playerElem,
      enemyElem,
      pattern,
      enemyAct,
      playerDmgToEnemy,
      spikeDmgToPlayer,
      hpAfter: { player: nextPlayer, enemy: nextEnemy },
    });


    // 5) 진행/종료
    const isBattleEnd    = (nextEnemy <= 0 || nextPlayer <= 0);
    const isLastQuestion = (idx + 1 >= questions.length);
    // 전투 즉시판정: 적 0 → 승리, 플레이어 0 → 패배
    const battleOutcome = nextEnemy <= 0 ? true : (nextPlayer <= 0 ? false : undefined);
    turnRef.current = turn + 1;

    if (isBattleEnd || isLastQuestion) {
      setMsg(
        battleOutcome === true  ? '승리! 결과 정리 중…' :
          battleOutcome === false ? '패배… 결과 정리 중…' :
            (isCorrect ? '정답! 결과 정리 중…' : '오답 💦 결과 정리 중…')
      );
      await finalizeRun({ forcedClear: battleOutcome });
      return;
    }

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
    
    const summary = { cleared, turns: total, durationSec };
    localStorage.setItem('qd:lastResult', JSON.stringify(summary));
    localStorage.setItem('qd:lastPack', pack);
    localStorage.setItem('qd:lastTurns', JSON.stringify(turns));

    try { await proofRef.current?.summary?.({ cleared, score, total } as any); } catch {}
    nav('/result');
  }

// 5) 키보드 입력(ABCD)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (k === 'A' || k === 'B' || k === 'C' || k === 'D') onPick(k as Choice['key']);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q]);


  // ───────────── 렌더 ─────────────
  if (loading) return <div className="p-6">로딩…</div>;
  if (!q) return <div className="p-6">문항이 없습니다. <span className="text-rose-400 ml-2">{msg}</span></div>;

  const total = Math.max(1, questions.length);
  const progress = Math.round(((Math.min(idx, total - 1) + 1) / total) * 100);

  return (
    <>
    <div className="p-6 max-w-xl mx-auto space-y-4">
      {/* 진행도 */}
      <div className="h-2 bg-slate-800 rounded overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="text-sm opacity-80">{idx + 1} / {total}</div>

      <div className="p-3 border rounded mb-2">
        <div className="text-sm font-medium">전투(주2 테스트)</div>
        <div className="text-xs opacity-70">P:{playerElem} vs E:{enemyElem} / 패턴:{pattern} / 턴:{turnRef.current}</div>
        <HPBar value={playerHP} label="Player" />
        <HPBar value={enemyHP}  label="Enemy" />
      </div>

      <div className="p-4 rounded bg-slate-800">
        <div className="font-medium whitespace-pre-wrap">{q.stem}</div>
        <div className="grid gap-2 mt-3">
          {(q?.choices ?? []).map((c) => (
            <button
              key={c.key}
              className="text-left px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 transition"
              onClick={() => onPick(c.key)}
            >
              <span className="font-bold mr-2">{c.key}.</span>{c.text}
            </button>
          ))}
          {(!q?.choices || q.choices.length === 0) && (
            <div className="text-sm text-rose-300">이 문항의 선택지 형식이 올바르지 않습니다.</div>
          )}
        </div>
      </div>

      <div className="text-emerald-400">{msg}</div>
      </div>
    </>
  );
}
