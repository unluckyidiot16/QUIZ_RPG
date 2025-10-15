// apps/student/src/views/Play.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Proof } from '../lib/proof';

type Choice = { key: 'A'|'B'|'C'|'D'; text: string };
type Question = { id: string; stem: string; choices: Choice[]; answerKey: Choice['key']; explanation?: string };

function usePack(){
  const qs = new URLSearchParams(location.search);
  return qs.get('pack') || 'sample';
}

export default function Play(){
  const pack = usePack();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState<Question | null>(null);
  const [msg, setMsg] = useState('');
  const [proof, setProof] = useState<Proof | null>(null);

  // 1) Proof 초기화
  useEffect(() => {
    (async () => setProof(await Proof.create()))();
  }, []);

  // 2) 팩 로딩 (절대경로 + 에러 처리 + 언마운트 안전)
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const url = new URL(`packs/${pack}.json`, location.origin).toString();
        const res = await fetch(url, { cache: 'no-store', signal: ac.signal });
        if (!res.ok) throw new Error(`pack fetch ${res.status}`);
        const arr: Question[] = await res.json();
        setQ(arr[0] ?? null);
      } catch (e) {
        if (!ac.signal.aborted) {
          console.error(e);
          setMsg('팩 로딩 실패');
          setQ(null);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [pack]);

  // 3) 문제 표시 이벤트 로깅
  useEffect(() => {
    if (q && proof) { proof.log({ type: 'q_shown', id: q.id }); }
  }, [q, proof]);

  // 4) 답안 처리
  async function onAnswer(key: Choice['key']){
    if(!q || !proof) return;
    const correct = q.answerKey === key;
    await proof.log({ type: 'answer', id: q.id, pick: key, correct });
    setMsg(correct ? '정답!' : '오답 💦');
    setTimeout(async () => {
      const s = await proof.summary(correct);
      localStorage.setItem('qd:lastResult', JSON.stringify(s));
      nav('/result');
    }, 600);
  }

  if (loading) return <div className="p-6">로딩...</div>;
  if (!q) return <div className="p-6">문항이 없습니다. {msg && <span className="text-rose-400 ml-2">{msg}</span>}</div>;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">전투(퀴즈)</h2>
      <div className="p-4 rounded bg-slate-800">
        <div className="font-medium">{q.stem}</div>
        <div className="grid gap-2 mt-3">
          {q.choices.map(c => (
            <button key={c.key} className="text-left" onClick={()=>onAnswer(c.key)}>
              <span className="font-bold mr-2">{c.key}.</span>{c.text}
            </button>
          ))}
        </div>
      </div>
      <div className="text-emerald-400">{msg}</div>
    </div>
  );
}
