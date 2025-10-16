import { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import type { GachaPoolDef } from '../core/items';

export default function Gacha(){
  const { gacha } = useMemo(() => makeServices(), []);
  const [pool, setPool] = useState<GachaPoolDef|null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/packs/gacha_basic.json', { cache:'no-store' });
        if (res.ok) setPool(await res.json());
        else {
          // 폴백 풀(파일 없을 때)
          setPool({
            id:'gacha_basic',
            cost:{ coin:100 },
            entries:[
              { cosmeticId:'badge_star_01', weight:700, rarity:'N' },
              { cosmeticId:'frame_neon_01', weight:300, rarity:'R' },
            ]
          } as any);
        }
      } catch {
        /* 폴백은 위에서 처리 */
      }
    })();
  }, []);

  async function draw(n:number){
    if (!pool) return;
    const res = await gacha.open(pool, n, { idempotencyKey: crypto?.randomUUID?.() || String(Date.now()) });
    setLog(prev => [...res.results, ...prev].slice(0, 50));
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold">가챠</h2>
      <p className="opacity-80 mt-2">코스메틱 중심. 로컬 인벤토리에 즉시 반영됩니다.</p>
      <div className="mt-4 flex gap-3">
        <button onClick={() => draw(1)}>1회</button>
        <button onClick={() => draw(10)}>10회</button>
      </div>
      <ul className="mt-6 space-y-1">
        {log.map((x,i)=>(<li key={i} className="text-sm opacity-90">획득: {x}</li>))}
      </ul>
    </div>
  );
}
