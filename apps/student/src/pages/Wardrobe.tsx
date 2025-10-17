import React, { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import type { InventoryState } from '../core/items';
import type { Slot, WearableItem, Rarity } from '../core/wearable.types';
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

const RARITY_LABEL: Record<Rarity, string> = {
  common:'일반', uncommon:'고급', rare:'희귀', epic:'영웅', legendary:'전설', mythic:'신화'
};

const RARITY_STYLE: Record<Rarity, {bg:string; border:string; ring:string; chip:string; text:string}> = {
  common:    { bg:'bg-slate-800',  border:'border-slate-700',  ring:'ring-slate-400/40',  chip:'bg-slate-700',   text:'text-slate-200' },
  uncommon:  { bg:'bg-emerald-900/40', border:'border-emerald-600', ring:'ring-emerald-400/50', chip:'bg-emerald-700', text:'text-emerald-200' },
  rare:      { bg:'bg-indigo-900/40',  border:'border-indigo-600',  ring:'ring-indigo-400/50',  chip:'bg-indigo-700',  text:'text-indigo-200' },
  epic:      { bg:'bg-fuchsia-900/40', border:'border-fuchsia-600', ring:'ring-fuchsia-400/50', chip:'bg-fuchsia-700', text:'text-fuchsia-200' },
  legendary: { bg:'bg-amber-900/40',   border:'border-amber-600',   ring:'ring-amber-400/50',   chip:'bg-amber-700',   text:'text-amber-200' },
  mythic:    { bg:'bg-rose-900/40',    border:'border-rose-600',    ring:'ring-rose-400/50',    chip:'bg-rose-700',    text:'text-rose-200' },
};

const asRarity = (r?: string): Rarity => (['common','uncommon','rare','epic','legendary','mythic'].includes(String(r)) ? (r as Rarity) : 'common');

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
      const firstSlotWithItems = SLOTS.find(sl => Object.values(cat).some(i => i.slot === sl));
      if (firstSlotWithItems) setActiveSlot(firstSlotWithItems);
    })();
  }, [inv]);

  // ✅ 가챠/인벤 변경 즉시 반영 훅 (초기 로딩 로직은 그대로 유지)
  useEffect(() => {
    let alive = true;

    const onInvChanged = async () => {
      // 최신 인벤토리 상태 재조회
      const s = await inv.load();
      if (!alive) return;
      setInvState(s);
    };

    // 가챠/인벤 적용 측에서 dispatch하는 CustomEvent
    window.addEventListener('inv:changed', onInvChanged as EventListener);

    // (선택) 탭 전환 후 돌아왔을 때도 신선한 상태 보장
    const onFocus = () => onInvChanged();
    window.addEventListener('focus', onFocus);

    return () => {
      alive = false;
      window.removeEventListener('inv:changed', onInvChanged as EventListener);
      window.removeEventListener('focus', onFocus);
    };
  }, [inv]);

  const equipped = (invState?.equipped || {}) as Partial<Record<Slot, string>>;
  const layers = useMemo(() => equippedToLayers(equipped as any, catalog), [equipped, catalog]);
  const [rarityFilter, setRarityFilter] = useState<'all'|Rarity>('all');


  const allItems = useMemo(() => Object.values(catalog), [catalog]);
  const countsBySlot = useMemo(() => {
    const m = new Map<Slot, number>();
    for (const sl of SLOTS) m.set(sl, 0);
    for (const it of allItems) m.set(it.slot as Slot, (m.get(it.slot as Slot) || 0) + 1);
    return m;
    }, [allItems]);
  const list = useMemo(() => {
    const rq = q.trim().toLowerCase();
    return allItems
      .filter(i => i.slot === activeSlot)
      .filter(i => (rq ? `${i.name} ${i.id}`.toLowerCase().includes(rq) : true))
      .filter(i => rarityFilter === 'all' ? true : asRarity(i.rarity) === rarityFilter);
    }, [allItems, activeSlot, q, rarityFilter]);

  const [busy, setBusy] = useState(false);
   async function equip(slot: Slot, itemId?: string) {
       if (!invState) return;
       // 해제를 "기본 아이템 장착"으로 처리 → 머지 저장에서도 확실히 반영
         const nextEquip = { ...(invState.equipped || {}) } as Record<string, string>;
         if (itemId) {
           nextEquip[slot] = itemId;
         } else {
           const def = pickDefaultId(slot, catalog);
           if (def) nextEquip[slot] = def; else delete nextEquip[slot];
         }
       await inv.apply({ equip: nextEquip as any });
       // 적용 직후 최신 상태로 리로드(캐시/지연 대비)
        const loaded = await inv.load();
       setInvState(loaded);
       notifyInventoryChanged(); // 헤더 갱신
     }

  const equippedId = equipped[activeSlot];

  function pickDefaultId(slot: Slot, cat: Record<string, WearableItem>): string | undefined {
    const items = Object.values(cat).filter(i => i.slot === slot);
    const score = (it: WearableItem) => {
      const s = `${it.id} ${it.name}`.toLowerCase();
      // 기본 후보 우선
      if (s.includes('blank') || s.includes('basic') || s.includes('regular') || s.includes('default')) return 0;
      return 1;
    };
    return items.sort((a,b)=>score(a)-score(b))[0]?.id;
  }


  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 상단 바 */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">옷장</h2>
            <div className="flex gap-2">
              <a href="/" className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700">
                메인으로
              </a>
            </div>
          </div>
      {/* 미리보기 */}
      <div className="flex items-center gap-6">
        <AvatarRenderer layers={layers} size={220} corsMode="none" />
        <div className="flex-1">
          <div className="text-xl font-semibold mb-2 flex items-center gap-2">
            <span>{SLOT_LABEL[activeSlot]} {equippedId ? '착용 중' : '(기본)'}</span>
            {equippedId && (() => {
              const r = asRarity(catalog[equippedId!]?.rarity);
              const sty = RARITY_STYLE[r];
              return <span className={`px-2 py-0.5 rounded text-xs ${sty.chip} ${sty.text}`}>{RARITY_LABEL[r]}</span>;
            })()}
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
            <select
              className="px-3 py-2 rounded bg-slate-800"
              value={rarityFilter}
              onChange={e=>setRarityFilter(e.target.value as any)}
              title="희귀도 필터"
            >
              <option value="all">전체</option>
              <option value="common">일반</option>
              <option value="uncommon">고급</option>
              <option value="rare">희귀</option>
              <option value="epic">영웅</option>
              <option value="legendary">전설</option>
              <option value="mythic">신화</option>
            </select>
          </div>
        </div>
      </div>

      {/* 슬롯 탭 */}
      <div className="flex flex-wrap gap-2">
        {SLOTS.map((slot) => {
          const count = countsBySlot.get(slot) || 0;
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
              const r = asRarity(i.rarity);
              const sty = RARITY_STYLE[r];
              return (
                <button 
                  key={i.id}
                  onClick={() => equip(activeSlot, i.id)}
                  className={[
                    'group text-left rounded p-2 border transition-shadow',
                    sty.bg, sty.border, selected ? `${sty.ring} ring-2` : ''
                  ].join(' ')}
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
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${sty.chip} ${sty.text}`}>
                      {RARITY_LABEL[r]}
                    </span>
                    {selected && <span className="text-xs text-emerald-300">착용 중</span>}
                  </div>        
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
