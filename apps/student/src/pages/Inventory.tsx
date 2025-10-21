// apps/student/src/pages/Inventory.tsx (드롭-인 교체안)
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadItemDB, PlayerOps, loadPlayer, deriveBattleStats, type ItemDef } from '../core/player';

type Slot = 'Weapon'|'Armor'|'Accessory';
const SLOT_LABEL: Record<Slot,string> = { Weapon:'무기', Armor:'갑옷', Accessory:'악세' };

export default function Inventory(){
  const [items, setItems] = useState<Record<string,ItemDef>>({});
  const [bag, setBag] = useState<Record<string,number>>({});
  const [slot, setSlot] = useState<Slot>('Weapon');
  const [player, setPlayer] = useState(loadPlayer());

  useEffect(()=>{ (async()=>{
    const db = await loadItemDB(import.meta.env.BASE_URL + 'items.v1.json');
    setItems(db); setBag(loadPlayer().bag);
  })() }, []);

  const owned = useMemo(()=> Object.entries(bag)
      .map(([id,c])=> ({ id, count:c, def: items[id] }))
      .filter(x=> x.def && (x.def.slot as any) === slot)
    , [bag, items, slot]);

  function equip(id?: string){
    PlayerOps.equip(slot, id);
    const p = loadPlayer(); setPlayer(p); setBag(p.bag);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm opacity-80 hover:opacity-100">← 메인</Link>
        <h2 className="text-2xl font-bold">인벤토리</h2><div />
      </div>

      {/* 슬롯 탭 */}
      <div className="mt-4 flex gap-2">
        {(['Weapon','Armor','Accessory'] as Slot[]).map(s=> (
          <button key={s} onClick={()=>setSlot(s)}
                  className={`px-3 py-2 rounded-lg border ${slot===s ? "border-emerald-500 bg-emerald-500/10":"border-white/10 bg-white/5"}`}>
            {SLOT_LABEL[s]}
          </button>
        ))}
      </div>

      {/* 그리드 */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {owned.map(x => {
          const it = x.def!;
          const equippedId = player.equipment[slot];
          const selected = equippedId === it.id;
          return (
            <button key={it.id} onClick={()=> equip(selected ? undefined : it.id)}
                    className={`group text-left border rounded-xl p-2 transition ${selected ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}>
              <div className="text-sm font-medium">{it.name}</div>
              <div className="text-xs opacity-70">{SLOT_LABEL[it.slot as Slot]} · {it.rarity}</div>
              <div className="mt-1 text-xs opacity-80">
                {fmtStats(it)}
              </div>
              <div className="mt-2 text-[10px] opacity-60">보유: {x.count}</div>
              {selected && <div className="mt-2 text-[10px] inline-block px-1.5 py-0.5 rounded bg-emerald-600/80 text-white">장착중</div>}
            </button>
          );
        })}
        {owned.length===0 && <div className="opacity-60 text-sm">해당 슬롯 장비 없음</div>}
      </div>
    </div>
  );
}

function fmtStats(it: ItemDef){
  const s = it.stats ?? {}; const arr:string[] = [];
  if (s.hp)  arr.push(`HP +${s.hp}`);
  if (s.def) arr.push(`DEF +${s.def}`);
  if (s.subAtk){
    for (const [k,v] of Object.entries(s.subAtk)) arr.push(`${k} +${v}`);
  }
  return arr.join(' · ');
}
