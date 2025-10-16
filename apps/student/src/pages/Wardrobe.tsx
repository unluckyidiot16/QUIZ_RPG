import { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import type { InventoryState } from '../core/items';

export default function Wardrobe(){
  const { inv } = useMemo(() => makeServices(), []);
  const [s, setS] = useState<InventoryState|null>(null);
  useEffect(()=>{ inv.load().then(setS); }, []);
  if (!s) return <div className="p-6">로딩...</div>;

  async function equipFrame(id:string){
    const next = await inv.apply({ equip:{ frame:id } });
    setS(next);
  }

  const frames = Object.keys(s.cosmeticsOwned).filter(id => id.startsWith('frame_'));
  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold">옷장</h2>
      <div className="mt-2 opacity-80">현재 프레임: <b>{s.equipped.frame ?? '없음'}</b></div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {frames.map(id=>(
          <button key={id} onClick={()=>equipFrame(id)} className="bg-slate-700">
            장착: {id}
          </button>
        ))}
        {frames.length===0 && <div className="opacity-70">보유한 프레임이 없습니다.</div>}
      </div>
    </div>
  );
}
