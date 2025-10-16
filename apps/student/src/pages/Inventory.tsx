import { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import type { InventoryState } from '../core/items';

export default function Inventory(){
  const { inv } = useMemo(() => makeServices(), []);
  const [s, setS] = useState<InventoryState|null>(null);

  useEffect(()=>{ inv.load().then(setS); }, []);
  if (!s) return <div className="p-6">로딩...</div>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold">인벤토리</h2>
      <div className="mt-3">코인: <b>{s.coins}</b></div>
      <h3 className="mt-4 font-semibold">아이템</h3>
      <ul className="mt-2 space-y-1">
        {Object.entries(s.items).map(([id,c])=>(
          <li key={id} className="text-sm">{id}: {c}</li>
        ))}
        {Object.keys(s.items).length===0 && <li className="text-sm opacity-70">없음</li>}
      </ul>
      <h3 className="mt-4 font-semibold">코스메틱(보유)</h3>
      <ul className="mt-2 space-y-1">
        {Object.keys(s.cosmeticsOwned).map(id=>(
          <li key={id} className="text-sm">{id}</li>
        ))}
        {Object.keys(s.cosmeticsOwned).length===0 && <li className="text-sm opacity-70">없음</li>}
      </ul>
    </div>
  );
}
