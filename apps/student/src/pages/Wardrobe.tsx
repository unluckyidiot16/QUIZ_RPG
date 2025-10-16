// apps/student/src/pages/Wardrobe.tsx
import { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import type { InventoryState } from '../core/items';
import type { Slot, WearableItem } from '../core/wearable.types';
import { loadWearablesCatalog } from '../core/wearable.catalog';
import { equippedToLayers } from '../core/wearable.adapter';
import { AvatarRenderer } from '../shared/ui/AvatarRenderer';

export default function Wardrobe(){
  const { inv } = useMemo(() => makeServices(), []);
  const [invState, setInvState] = useState<InventoryState|null>(null);
  const [catalog, setCatalog] = useState<Record<string, WearableItem>>({});

  useEffect(() => {
    (async () => {
      const [s, cat] = await Promise.all([
        inv.load(),
        loadWearablesCatalog(),
      ]);
      setInvState(s);
      setCatalog(cat);
    })();
  }, [inv]);

  if (!invState) return <div className="p-6">로딩…</div>;

  const equipped = (invState.equipped || {}) as any;
  const layers = equippedToLayers(equipped, catalog);

  const itemsBySlot = (slot: Slot) =>
    Object.values(catalog).filter(i => i.slot === slot);

  async function equip(slot: Slot, itemId: string){
    const next = await inv.apply({ equip: { ...(invState.equipped||{}), [slot]: itemId } as any });
    setInvState(next);
  }

  const hair = itemsBySlot('Hair');
  const hat  = itemsBySlot('Hat');

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
          {hat.length === 0 && <div className="opacity-70">아이템 없음</div>}
          {hat.map(i=>(
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
