import { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import type { InventoryState } from '../core/items';
import { WEARABLES } from '../core/wearable.catalog';
import type { Slot } from '../core/wearable.types';
import { equippedToLayers } from '../core/wearable.adapter';
import { AvatarRenderer } from '../shared/ui/AvatarRenderer';

export default function Wardrobe(){
  const { inv } = useMemo(() => makeServices(), []);
  const [s, setS] = useState<InventoryState|null>(null);
  useEffect(()=>{ inv.load().then(setS); }, []);
  if (!s) return <div className="p-6">로딩…</div>;

  // 예시: 모자/헤어만 보여주기 (전체 12개는 UI 탭으로 나눠도 좋아요)
  const hats = Object.values(WEARABLES).filter(w => w.slot === 'Hat');
  const hair = Object.values(WEARABLES).filter(w => w.slot === 'Hair');

  async function equip(slot: Slot, itemId: string){
    const next = await inv.apply({ equip: { ...(s.equipped||{}), [slot]: itemId } as any });
    setS(next);
  }

  const layers = equippedToLayers(s.equipped as any);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <AvatarRenderer layers={layers} size={220} corsMode="none" />

      <section>
        <h3 className="font-semibold mb-2">헤어</h3>
        <div className="grid grid-cols-2 gap-2">
          {hair.length === 0 && <div className="opacity-70">아이템 없음</div>}
          {hair.map(i=>(
            <button key={i.id} className="px-3 py-2 bg-slate-700 rounded"
                    onClick={()=>equip('Hair', i.id)}>
              {i.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-2">모자</h3>
        <div className="grid grid-cols-2 gap-2">
          {hats.length === 0 && <div className="opacity-70">아이템 없음</div>}
          {hats.map(i=>(
            <button key={i.id} className="px-3 py-2 bg-slate-700 rounded"
                    onClick={()=>equip('Hat', i.id)}>
              {i.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
