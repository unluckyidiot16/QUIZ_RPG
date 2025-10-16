import { useMemo, useState, useEffect } from 'react';
import { makeServices } from '../core/service.locator';
import type { InventoryState } from '../core/items';

export default function Codex(){
  const { inv } = useMemo(() => makeServices(), []);
  const [s, setS] = useState<InventoryState|null>(null);
  useEffect(()=>{ inv.load().then(setS); }, []);
  if (!s) return <div className="p-6">로딩...</div>;
  // MVP: 보유=해금으로 간주(추후 seen/unlocked 분리 가능)
  const ids = Object.keys(s.cosmeticsOwned);
  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold">도감</h2>
      <ul className="mt-4 space-y-1">
        {ids.map(id => <li key={id} className="text-sm">{id}</li>)}
        {ids.length===0 && <li className="opacity-70">아직 발견한 코스메틱이 없습니다.</li>}
      </ul>
    </div>
  );
}
