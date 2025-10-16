// apps/student/src/pages/Wardrobe.tsx
import { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import { loadCosmeticsPack, CosmeticDef } from '../core/packs';
import type { InventoryState } from '../core/items';

export default function Wardrobe(){
  const { inv } = useMemo(() => makeServices(), []);
  const [s, setS] = useState<InventoryState|null>(null);
  const [defs, setDefs] = useState<CosmeticDef[]>([]);

  useEffect(()=>{ inv.load().then(setS); loadCosmeticsPack().then(p=>setDefs(p.cosmetics)); }, []);
  if (!s) return <div className="p-6">로딩…</div>;

  const owned = defs.filter(d => s.cosmeticsOwned[d.id]);
  const frames = owned.filter(d=>d.type==='frame');
  const badges = owned.filter(d=>d.type==='badge');
  const hats   = owned.filter(d=>d.type==='hat');

  async function equip(part:'frame'|'badge'|'hat', id:string){
    const next = await inv.apply({ equip: { [part]: id } });
    setS(next);
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold">옷장</h2>
      <div className="mt-2 text-sm opacity-80">
        현재: frame=<b>{s.equipped.frame ?? '-'}</b> · badge=<b>{s.equipped.badge ?? '-'}</b> · hat=<b>{s.equipped.hat ?? '-'}</b>
      </div>

      <section className="mt-4">
        <h3 className="font-semibold">프레임</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {frames.length === 0 && <div className="opacity-70">보유 없음</div>}
          {frames.map(c=>(
            <button key={c.id} onClick={()=>equip('frame', c.id)} className="px-3 py-2 bg-slate-700 rounded">
              {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold">배지</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {badges.length === 0 && <div className="opacity-70">보유 없음</div>}
          {badges.map(c=>(
            <button key={c.id} onClick={()=>equip('badge', c.id)} className="px-3 py-2 bg-slate-700 rounded">
              {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold">모자</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {hats.length === 0 && <div className="opacity-70">보유 없음</div>}
          {hats.map(c=>(
            <button key={c.id} onClick={()=>equip('hat', c.id)} className="px-3 py-2 bg-slate-700 rounded">
              {c.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
