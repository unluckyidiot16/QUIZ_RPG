// Play.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// 프로젝트에 따라 '../api' 또는 '../core/api' 중 맞는 쪽을 사용하세요.
import { guestLogin, newRunToken } from '../api';
import { Proof } from '../shared/lib/proof';

type Choice = { key: 'A'|'B'|'C'|'D'; text: string };
type Question = { id: string; stem: string; choices: Choice[]; answerKey: Choice['key']; explanation?: string };

function usePack() {
  const qs = new URLSearchParams(location.search);
  return qs.get('pack') || 'sample';
}

export default function Play() {
  const pack = usePack();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>('로딩 중…');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const q = questions[idx] || null;

  const [proof, setProof] = useState<Proof | null>(null);
  const startedRef = useRef(false); // StrictMode 중복 방지

  // 1) QR 토큰 로그인 → 런 발급 → Proof 초기화
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const qs = new URLSearchParams(location.search);
        const t = qs.get('t');
        if (t) await guestLogin(t);     // ① QR 토큰 로그인
        await newRunToken();            // ② 서버에서 run_id 발급 후 로컬 저장

        // ③ Proof 생성/세션 시작 로그
        const p = new Proof();          // 필요 시 runId를 생성자에 넣는 버전이라면 localStorage에서 꺼내 전달
        await p.log({ type: 'session_start', pack });
        setProof(p);

        setMsg('준비 완료!');
      } catch (e: any) {
        setMsg(e?.message ?? '접속 권한이 없거나 만료되었습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [pack]);

  // 2) 팩 로드 (다문항)
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const url = new URL(`packs/${pack}.json`, location.origin).toString();
        const res = await fetch(url, { cache: 'no-store', signal: ac.signal });
        if (!res.ok) throw new Error(`pack fetch ${res.status}`);
        const arr: Question[] = await res.json();
        // 안전장치: 유효 문항만 필터
        const clean = (arr || []).filter(v => v && v.id && v.stem && Array.isArray(v.choices) && v.choices.length >= 2);
        setQuestions(clean);
        setIdx(0);
      } catch (e) {
        if (!ac.signal.aborted) {
          console.error(e);
          setMsg('팩 로딩 실패');
          setQuestions([]);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [pack]);

  // 3) 문항 표출 로그
  useEffect(() => {
    if (q && proof) { proof.log({ type: 'q_shown', id: q.id, idx }); }
  }, [q, idx, proof]);

  // 4) 답안 처리
  async function onAnswer(key: Choice['key']) {
    if (!q || !proof) return;
    const correct = q.answerKey === key;
    await proof.log({ type: 'answer', id: q.id, pick: key, correct });

    // 다음 문항으로
    const isLast = idx >= questions.length - 1;
    if (!isLast) {
      setIdx(i => i + 1);
      setMsg(correct ? '정답! 다음 문제로...' : '오답 💦 다음 문제로...');
      return;
    }

    // 마지막 문항이면 요약 저장 후 결과 페이지로
    setMsg(correct ? '정답! 결과 정리 중...' : '오답 💦 결과 정리 중...');
    try {
      // 기존 Proof API와의 호환을 위해 summary(correct) 서명을 그대로 유지
      const s = await proof.summary(correct as any);
      localStorage.setItem('qd:lastResult', JSON.stringify(s));
    } catch {
      // 요약 실패해도 진행은 가능
    } finally {
      nav('/result');
    }
  }

  // 5) 키보드 지원(옵션)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (['A','B','C','D'].includes(k)) onAnswer(k as Choice['key']);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, proof]); // q/proof 바뀔 때마다 최신 핸들러

  if (loading) return <div className="p-6">로딩...</div>;
  if (!q) return <div className="p-6">문항이 없습니다. <span className="text-rose-400 ml-2">{msg}</span></div>;

  const total = questions.length || 1;
  const progress = Math.round(((idx + 1) / total) * 100);

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
          {q.choices.map(c => (
            <button
              key={c.key}
              className="text-left px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 transition"
              onClick={() => onAnswer(c.key)}
            >
              <span className="font-bold mr-2">{c.key}.</span>{c.text}
            </button>
          ))}
        </div>
      </div>

      <div className="text-emerald-400">{msg}</div>
    </div>
  );
}
