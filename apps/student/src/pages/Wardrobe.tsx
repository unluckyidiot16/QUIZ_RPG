import React, { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import type { InventoryState } from '../core/items';
import type { Slot, WearableItem } from '../core/wearable.types';
import { loadWearablesCatalog } from '../core/wearable.catalog';
import { equippedToLayers } from '../core/wearable.adapter';
import { AvatarRenderer } from '../shared/ui/AvatarRenderer';
import { notifyInventoryChanged } from '../core/inv.bus';

const SLOTS: Slot[] = [
  'Body','Face','BodySuit','Pants','Shoes','Clothes',
  'Sleeves','Necklace','Bag','Scarf','Bowtie','Hair','Hat'
];

const SLOT_LABEL: Record<Slot, string> = {
  Body:'바디', Face:'얼굴', BodySuit:'바디수트', Pants:'바지', Shoes:'신발', Clothes:'상의',
  Sleeves:'소매', Necklace:'목걸이', Bag:'가방', Scarf:'스카프', Bowtie:'보타이', Hair:'헤어', Hat:'모자'
};

export default function Wardrobe(){
  const { inv } = useMemo(() => makeServices(), []);
  const [invState, setInvState] = useState<InventoryState | null>(null);
  const [catalog, setCatalog] = useState<Record<string, WearableItem>>({});
  const [activeSlot, setActiveSlot] = useState<Slot>('Hair'); // 초기 탭
  const [q, setQ] = useState('');

  // 최초 로드
  useEffect(() => {
    (async () => {
      const [s, cat] = await Promise.all([inv.load(), loadWearablesCatalog()]);
      setInvState(s);
      setCatalog(cat);
    })();
  }, [inv]);

  const equipped = (invState?.equipped || {}) as Partial<Record<Slot, string>>;
  const layers = useMemo(() => equippedToLayers(equipped as any, catalog), [equipped, catalog]);

  const itemsBySlot = (slot: Slot) =>
    Object.values(catalog)
      .filter(i => i.slot === slot)
      .filter(i => (q ? `${i.name} ${i.id}`.toLowerCase().includes(q.toLowerCase()) : true));

  async function equip(slot: Slot, itemId?: string) {
    if (!invState) return;
    const nextEquip = { ...(invState.equipped || {}) } as Record<string, string | undefined>;
    if (itemId) nextEquip[slot] = itemId;         // 착용
    else delete nextEquip[slot];                  // 해제 → 기본으로 폴백
    const next = await inv.apply({ equip: nextEquip as any });
    setInvState(next);
    notifyInventoryChanged();                     // 헤더 갱신 신호
  }

  const list = itemsBySlot(activeSlot);
  const equippedId = equipped[activeSlot];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 미리보기 */}
      <div className="flex items-center gap-6">
        <AvatarRenderer layers={layers} size={220} corsMode="none" />
        <div className="flex-1">
          <div className="text-xl font-semibold mb-2">
            {SLOT_LABEL[activeSlot]} {equippedId ? '착용 중' : '(기본)'}
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500"
              disabled={!equippedId}
              onClick={() => equip(activeSlot, undefined)}
              title="해제하고 기본 상태로"
            >
              {SLOT_LABEL[activeSlot]} 해제
            </button>
            <input
              className="px-3 py-2 rounded bg-slate-800 flex-1"
              placeholder="아이템 검색 (이름/ID)"
              value={q}
              onChange={(e)=>setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 슬롯 탭 */}
      <div className="flex flex-wrap gap-2">
        {SLOTS.map((slot) => {
          const count = Object.values(catalog).filter(i => i.slot === slot).length;
          const isActive = slot === activeSlot;
          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`px-3 py-2 rounded border 
                ${isActive ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-slate-800 border-slate-700'}`}
              title={`${SLOT_LABEL[slot]} (${count})`}
            >
              {SLOT_LABEL[slot]}
              <span className="opacity-60 ml-1 text-xs">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 아이템 그리드 */}
      <section>
        {list.length === 0 ? (
          <div className="opacity-70">아이템 없음</div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {list.map((i) => {
              const selected = i.id === equippedId;
              return (
                <button
                  key={i.id}
                  onClick={() => equip(activeSlot, i.id)}
                  className={`group text-left rounded p-2 bg-slate-800 hover:bg-slate-700 border 
                    ${selected ? 'border-emerald-500 ring-2 ring-emerald-400' : 'border-slate-700'}`}
                  title={i.name}
                >
                  <div className="w-full aspect-square rounded bg-slate-900 flex items-center justify-center overflow-hidden">
                    <img
                      src={i.src}
                      alt={i.name}
                      className="max-w-full max-h-full object-contain pointer-events-none"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-2 text-sm truncate">{i.name}</div>
                  <div className="text-xs opacity-60 truncate">{i.id}</div>
                  {selected && <div className="mt-1 text-xs text-emerald-400">착용 중</div>}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
