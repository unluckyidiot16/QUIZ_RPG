// apps/student/src/pages/Codex.tsx
import { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import { loadCosmeticsPack, CosmeticDef } from '../core/packs';
import type { InventoryState } from '../core/items';

export default function Codex(){
  const { inv } = useMemo(() => makeServices(), []);
  const [s, setS] = useState<InventoryState|null>(null);
  const [defs, setDefs] = useState<CosmeticDef[]>([]);
  useEffect(()=>{ inv.load().then(setS); loadCosmeticsPack().then(p=>setDefs(p.cosmetics)); }, []);
  if (!s) return <div className="p-6">로딩…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold">도감</h2>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {defs.map(c=>{
          const owned = !!s.cosmeticsOwned[c.id];
          return (
            <div key={c.id} className={`p-3 rounded border ${owned ? 'opacity-100' : 'opacity-50'}`}>
              <div className="text-sm">{c.name}</div>
              <div className="text-xs opacity-80">{c.type}</div>
              <div className="text-xs mt-1">{owned ? '보유' : '미보유'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
