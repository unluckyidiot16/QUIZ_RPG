// Play.tsx — 전투 씬 완성본 (QR 로그인 → 런 발급 → 팩 로드/정규화 → 진행/기록 → 결과)
// - API 경로가 프로젝트마다 다를 수 있어요. core/api 경로가 다르면 아래 import만 조정하세요.
// - Proof 모듈은 동적 import로 불러와 시그니처 차이(Proof | default)를 흡수합니다.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// API는 프로젝트 구현에 맞춰 자동 탐지: ensureRunToken → newRunToken → enterDungeon
import * as api from '../core/api';

// ──────────────────────────────────────────────────────────────────────────────
// 타입 & 정규화 유틸
// ──────────────────────────────────────────────────────────────────────────────
export type Choice = { key: 'A'|'B'|'C'|'D'; text: string };
export type Question = {
  id: string;
  stem: string;
  choices: Choice[];
  answerKey: Choice['key'];
  explanation?: string;
};

function normalizeAnswerKey(answerKey?: any, answer?: any, correctIndex?: any): Question['answerKey'] | null {
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

  // 1) 이미 표준 형태
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

  // 2) options/answers 배열 형태
  if (raw.stem && Array.isArray(raw.options)) {
    const normChoices: Choice[] = (raw.options as any[]).slice(0, 4).map((t, idx) => ({
      key: (['A','B','C','D'] as const)[idx],
      text: typeof t === 'string' ? t : t?.text ?? String(t)
    }));
    const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
    if (!ans) return null;
    return { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans };
  }

  // 3) A/B/C/D 키 형태
  if (raw.stem && (raw.A || raw.B || raw.C || raw.D)) {
    const keys = ['A','B','C','D'] as const;
    const normChoices: Choice[] = keys
      .filter(k => raw[k] != null)
      .map((k) => ({ key: k, text: String(raw[k]) }));
    const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
    if (!ans) return null;
    return { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans };
  }

  return null;
}

function usePackParam() {
  const qs = new URLSearchParams(location.search);
  return qs.get('pack') || 'sample';
}

// ──────────────────────────────────────────────────────────────────────────────
// 컴포넌트
// ──────────────────────────────────────────────────────────────────────────────
export default function Play() {
  const pack = usePackParam();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>('로딩 중…');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const q = questions[idx] || null;

  const [proof, setProof] = useState<any | null>(null); // Proof 타입은 동적 import로 주입
  const startedRef = useRef(false); // StrictMode 중복 방지

  // 1) QR 토큰 로그인 → 런 발급 → Proof 초기화
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

        // 런 토큰 보장(ensure→new→enter 순으로 시도)
        const ensure = (api as any).ensureRunToken || (api as any).newRunToken || (api as any).enterDungeon;
        if (typeof ensure === 'function') {
          await ensure();
        }

        // Proof 동적 import (Proof | default 모두 수용)
        const mod: any = await import('../shared/lib/proof');
        const ProofCtor = mod?.Proof ?? mod?.default;
        const runId = localStorage.getItem('qd:runToken');
        const p = runId ? new ProofCtor(runId) : new ProofCtor();
        await p.log?.({ type: 'session_start', pack });
        setProof(p);

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
        if (res.ok) {
          rawList = await res.json();
        } else {
          // 폴백: sample 1문항
          rawList = [
            { id: 'sample-1', stem: '샘플 문항입니다. A를 선택하세요.', choices: ['A', 'B', 'C', 'D'], answerKey: 'A' }
          ];
        }

        const arr = Array.isArray(rawList)
          ? rawList
          : (rawList?.questions ?? rawList?.items ?? rawList?.data?.questions ?? []);

        const clean: Question[] = [];
        const invalids: Array<{ i: number; raw: any }> = [];
        arr.forEach((raw: any, i: number) => {
          const nq = normalizeQuestion(raw, i);
          if (nq && nq.stem && Array.isArray(nq.choices) && nq.choices.length >= 2) clean.push(nq);
          else invalids.push({ i, raw });
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

  // 3) 문항 표출 로그
  useEffect(() => {
    if (q && proof?.log) {
      proof.log({ type: 'q_shown', id: q.id, idx }).catch?.(() => {});
    }
  }, [q, idx, proof]);

  // 4) 답안 처리
  async function onAnswer(key: Choice['key']) {
    if (!q) return;
    const correct = q.answerKey === key;
    try {
      await proof?.log?.({ type: 'answer', id: q.id, pick: key, correct });
    } catch {}

    const isLast = idx >= (questions.length - 1);
    if (!isLast) {
      setIdx(i => i + 1);
      setMsg(correct ? '정답! 다음 문제로…' : '오답 💦 다음 문제로…');
      return;
    }

    // 마지막 문항 → 요약 후 결과 페이지 이동
    setMsg(correct ? '정답! 결과 정리 중…' : '오답 💦 결과 정리 중…');
    try {
      const summary = await proof?.summary?.(correct as any);
      if (summary) localStorage.setItem('qd:lastResult', JSON.stringify(summary));
    } catch (e) {
      console.warn('proof.summary failed', e);
    } finally {
      nav('/result');
    }
  }

  // 5) 키보드 입력(ABCD)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (k === 'A' || k === 'B' || k === 'C' || k === 'D') onAnswer(k as Choice['key']);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, proof]);

  // ──────────────────────────────────────────────────────────────────────────
  // 렌더
  // ──────────────────────────────────────────────────────────────────────────
  if (loading) return <div className="p-6">로딩…</div>;
  if (!q) return <div className="p-6">문항이 없습니다. <span className="text-rose-400 ml-2">{msg}</span></div>;

  const total = Math.max(1, questions.length);
  const progress = Math.round(((Math.min(idx, total - 1) + 1) / total) * 100);

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      {/* 진행도 */}
      <div className="h-2 bg-slate-800 rounded overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="text-sm opacity-80">{idx + 1} / {total}</div>

      <h2 className="text-xl font-bold">전투(퀴즈)</h2>
      <div className="p-4 rounded bg-slate-800">
        <div className="font-medium whitespace-pre-wrap">{q.stem}</div>
        <div className="grid gap-2 mt-3">
          {(q?.choices ?? []).map((c) => (
            <button
              key={c.key}
              className="text-left px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 transition"
              onClick={() => onAnswer(c.key)}
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
  );
}
