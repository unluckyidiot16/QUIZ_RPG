
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Proof } from '../lib/proof';

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
  const [proof, setProof] = useState<Proof | null>(null);

  useEffect(() => { (async () => setProof(await Proof.create()))(); }, []);

  useEffect(() => {
    // 문제 로딩 후 한 번 기록
    if (q && proof){ proof.log({ type: 'q_shown', id: q.id }); }
  }, [q, proof]);

  async function onAnswer(key: Choice['key']){
    if(!q || !proof) return;
    const correct = q.answerKey === key;
    await proof.log({ type: 'answer', id: q.id, pick: key, correct });
    setTurns(t => t+1);
    setMsg(correct ? '정답!' : '오답 💦');
    setTimeout(async () => {
      const s = await proof.summary(correct);
      localStorage.setItem('qd:lastResult', JSON.stringify(s));
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
