// apps/student/src/pages/Gacha.tsx
import { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import { loadGachaPool } from '../core/packs';
import type { GachaPoolDef } from '../core/items';
import { newIdempotencyKey } from '../shared/lib/idempotency';

export default function Gacha(){
  const { inv, gacha } = useMemo(() => makeServices(), []);
  const [pool, setPool] = useState<GachaPoolDef| null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await inv.load();
      setCoins(s.coins);
      try { setPool(await loadGachaPool()); }
      catch { /* 폴백 풀도 가능하지만 지금은 로딩 실패만 무시 */ }
    })();
  }, []);

  async function draw(n:number){
    if (!pool) return;
    setErr(null);
    try {
      const res = await gacha.open(pool, n, { idempotencyKey: newIdempotencyKey('gacha') });
      const s = await inv.load();
      setCoins(s.coins);
      setLog(prev => [...res.results, ...prev].slice(0, 50));
    } catch (e:any) {
      setErr(e?.message ?? '가챠 실패');
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold">가챠</h2>
      <div className="mt-2 text-sm opacity-80">보유 코인: <b>{coins}</b></div>
      {err && <div className="mt-2 text-red-400 text-sm">{err}</div>}
      <div className="mt-4 flex gap-3">
        <button className="px-3 py-2 bg-slate-700 rounded" onClick={()=>draw(1)}>1회</button>
        <button className="px-3 py-2 bg-slate-700 rounded" onClick={()=>draw(10)}>10회</button>
      </div>
      <ul className="mt-6 space-y-1">
        {log.map((x,i)=>(<li key={i} className="text-sm opacity-90">획득: {x}</li>))}
      </ul>
      // src/pages/Gacha.tsx 일부
      <div className="mt-4 flex gap-3">
        <button className="px-3 py-2 bg-slate-700 rounded" onClick={()=>draw(1)}>1회</button>
        <button className="px-3 py-2 bg-slate-700 rounded" onClick={()=>draw(10)}>10회</button>
        {/* DEV: 테스트 코인 */}
        <button
          className="ml-auto px-3 py-2 bg-emerald-700 rounded"
          onClick={async ()=>{
            await inv.apply({ coinDelta: +100, reason: 'dev:grant' });
            setCoins((await inv.load()).coins);
          }}>
          +100 코인(DEV)
        </button>
      </div>
    </div>
  );
}
