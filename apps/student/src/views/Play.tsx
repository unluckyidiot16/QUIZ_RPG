
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Choice = { key: 'A'|'B'|'C'|'D'; text: string };
type Question = { id: string; stem: string; choices: Choice[]; answerKey: Choice['key']; explanation?: string };

function usePack(){
  const qs = new URLSearchParams(location.search);
  const pack = qs.get('pack') || 'sample';
  return pack;
}

export default function Play(){
  const pack = usePack();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState<Question | null>(null);
  const [msg, setMsg] = useState<string>('');
  const [turns, setTurns] = useState(0);
  const [start] = useState(performance.now());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/packs/${pack}.json`);
        const arr: Question[] = await res.json();
        setQ(arr[0] ?? null);
      } catch(e){
        setMsg('팩 로딩 실패');
      } finally {
        setLoading(false);
      }
    })();
  }, [pack]);

  function onAnswer(key: Choice['key']){
    if(!q) return;
    const correct = q.answerKey === key;
    setTurns(t => t+1);
    setMsg(correct ? '정답!' : '오답 💦');
    setTimeout(() => {
      const durationSec = Math.round((performance.now() - start)/1000);
      localStorage.setItem('qd:lastResult', JSON.stringify({ cleared: correct, turns: turns+1, durationSec }));
      nav('/result');
    }, 600);
  }

  if(loading) return <div className="p-6">로딩...</div>;
  if(!q) return <div className="p-6">문항이 없습니다.</div>;

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
