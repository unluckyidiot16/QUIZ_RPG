import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { makeServices } from "../core/service.locator";

type Slot =
  | "Body" | "Face" | "BodySuit" | "Pants" | "Shoes" | "Clothes" | "Sleeves"
  | "Necklace" | "Bag" | "Scarf" | "Bowtie" | "Hair" | "Hat";
type WearableItem = { id:string; name?:string; slot:Slot; src?:string; rarity?:string; layer?:number; z?:number; };

const SLOTS: Slot[] = ["Hair","Hat","Clothes","BodySuit","Pants","Shoes","Sleeves","Necklace","Scarf","Bowtie","Bag","Body","Face"];
const SLOT_LABEL: Record<Slot,string> = { Hair:"헤어", Hat:"모자", Clothes:"상의/원피스", BodySuit:"바디수트", Pants:"하의", Shoes:"신발", Sleeves:"소매", Necklace:"목걸이", Scarf:"스카프", Bowtie:"보타이", Bag:"가방", Body:"바디", Face:"페이스" };
const Z: Record<Slot, number> = { Body:0, BodySuit:5, Pants:10, Shoes:15, Clothes:20, Sleeves:25, Bag:30, Necklace:40, Scarf:45, Bowtie:50, Face:55, Hair:60, Hat:70 };
const rarityRing: Record<string,string> = { common:"border-white/10", uncommon:"border-emerald-400/60", rare:"border-sky-400/60", epic:"border-violet-400/60", legendary:"border-amber-400/70", mythic:"border-fuchsia-400/70" };

const __prefix = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const norm = (src?: string) => !src ? undefined : /^https?:\/\//.test(src) ? src : (src.startsWith("/") ? `${__prefix}${src}` : `${__prefix}/${src}`);
const pickSrc = (it?: any) => norm(it?.src ?? it?.image ?? it?.img ?? it?.renderSrc ?? it?.render ?? (Array.isArray(it?.images) ? it.images[0] : undefined) ?? (typeof it?.url==='string' ? it.url : undefined));

async function loadCatalogMap(): Promise<Record<string, WearableItem>> {
  const url = (import.meta as any).env?.VITE_PACKS_BASE
    ? `${(import.meta as any).env.VITE_PACKS_BASE.replace(/\/+$/,'')}/wearables.v1.json`
    : "/packs/wearables.v1.json";
  const res = await fetch(url, { cache:"no-store" });
  const raw = await res.json();
  const arr: WearableItem[] = Array.isArray(raw) ? raw : Object.values(raw||{});
  return Object.fromEntries(arr.map(it => [it.id, it])) as Record<string, WearableItem>;
}

const toL = (s?:string)=> (s??"").toLowerCase();
const getZ = (slot:Slot, it?:any) => Number.isFinite((it?.layer ?? it?.z)) ? Number(it?.layer ?? it?.z) : (Z[slot] ?? 0);
const toIdArray = (raw:any):string[] => Array.isArray(raw) ? raw.filter(x=>typeof x==='string') : (raw && typeof raw==='object' ? Object.keys(raw) : []);

export default function Wardrobe() {
  const { inv } = useMemo(() => makeServices(), []);
  const [invState, setInvState] = useState<any>(null);
  const [catalog, setCatalog] = useState<Record<string, WearableItem>>({});
  const [activeSlot, setActiveSlot] = useState<Slot>("Hair");
  const [q, setQ] = useState(""); const [rarityFilter, setRarityFilter] = useState("all");

  useEffect(() => { (async () => {
    const [s, cat] = await Promise.all([inv.load(), loadCatalogMap()]);
    setInvState(s); setCatalog(cat);
  })(); }, [inv]);

  useEffect(() => {
    const reload = async () => setInvState(await inv.load());
    const onChanged = () => reload(); const onFocus = () => reload();
    window.addEventListener("inv:changed", onChanged as EventListener);
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener("inv:changed", onChanged as EventListener); window.removeEventListener("focus", onFocus); };
  }, [inv]);

  const getItem = (id?:string) => id ? (catalog[id] ?? catalog[toL(id)]) : undefined;
  const ownedIds = useMemo(()=> toIdArray(invState?.cosmeticsOwned ?? invState?.owned ?? []), [invState]);
  const ownedSetL = useMemo(()=> new Set(ownedIds.map(toL)), [ownedIds]);
  const equipped = (invState?.equipped || {}) as Partial<Record<Slot,string>>;
  const equippedId = equipped[activeSlot];

  // ===== 상단 미리보기(고정 크기) =====
  const previewLayers = useMemo(() => {
    const arr: {id:string; slot:Slot; src:string; z:number}[] = [];
    for (const s of SLOTS){ const id = equipped[s]; if (!id) continue; const it = getItem(id); const src = pickSrc(it); if (!src) continue; arr.push({ id, slot:s, src, z:getZ(s,it) }); }
    return arr.sort((a,b)=>a.z-b.z);
  }, [equipped, catalog]);

  const countsBySlot = useMemo(() => {
    const m = new Map<Slot, number>(); for (const s of SLOTS) m.set(s, 0);
    for (const id of ownedIds){ const it = getItem(id); if (it) m.set(it.slot, (m.get(it.slot)||0)+1); }
    return m;
  }, [ownedIds, catalog]);

  const list = useMemo(() => {
    const rq = q.trim().toLowerCase();
    return ownedIds.map(getItem).filter(Boolean)
      .filter(i => (i as WearableItem).slot === activeSlot)
      .filter(i => rq ? `${(i as WearableItem).name ?? ""} ${(i as WearableItem).id}`.toLowerCase().includes(rq) : true)
      .filter(i => rarityFilter === "all" ? true : toL((i as WearableItem).rarity) === rarityFilter) as WearableItem[];
  }, [ownedIds, activeSlot, q, rarityFilter, catalog]);

  async function equip(slot:Slot, itemId?:string){
    await inv.apply({ equip: { [slot]: itemId ? (getItem(itemId)?.id ?? itemId) : undefined }, reason: itemId ? "wardrobe:equip" : "wardrobe:unequip" });
    window.dispatchEvent(new CustomEvent("inv:changed"));
    setInvState(await inv.load());
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm opacity-80 hover:opacity-100">← 메인으로</Link>
        <h2 className="text-2xl font-bold">옷장</h2><div />
      </div>

      {/* 고정 크기 미리보기 */}
      <div className="mt-4 grid place-items-center">
        <div className="w-[280px] h-[280px] md:w-[320px] md:h-[320px] rounded-xl bg-slate-900/50 border border-white/10 relative overflow-hidden">
          {previewLayers.map(L => (
            <img key={`${L.slot}:${L.id}`} src={L.src} alt="" className="absolute inset-0 object-contain max-w-full max-h-full pointer-events-none select-none" style={{ zIndex:L.z }} />
          ))}
        </div>
      </div>

      {/* 슬롯 탭 */}
      <div className="mt-4 flex flex-wrap gap-2">
        {SLOTS.map((sl) => {
          const cnt = countsBySlot.get(sl) ?? 0; const active = sl === activeSlot;
          return (
            <button key={sl} onClick={() => setActiveSlot(sl)}
                    className={`px-3 py-2 rounded-lg border ${active ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}
                    title={`${SLOT_LABEL[sl]} (${cnt})`}>
              {SLOT_LABEL[sl]} <span className="opacity-60 text-xs">({cnt})</span>
            </button>
          );
        })}
      </div>

      {/* 툴바 */}
      <div className="mt-4 flex gap-2">
        <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
                disabled={!equippedId} onClick={() => equip(activeSlot, undefined)} title="해제하고 기본 상태로">
          {SLOT_LABEL[activeSlot]} 해제
        </button>
        <input className="px-3 py-2 rounded bg-slate-800 flex-1" placeholder="아이템 검색 (이름/ID)" value={q} onChange={(e)=>setQ(e.target.value)} />
        <select className="px-3 py-2 rounded bg-slate-800" value={rarityFilter} onChange={(e)=>setRarityFilter(e.target.value)} title="희귀도 필터">
          <option value="all">전체</option><option value="common">일반</option><option value="uncommon">고급</option>
          <option value="rare">희귀</option><option value="epic">영웅</option><option value="legendary">전설</option><option value="mythic">신화</option>
        </select>
      </div>

      {/* 보유 목록(썸네일은 그대로 정사각형) */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {list.map(i => {
          const selected = equippedId === i.id; const r = toL(i.rarity) || "common"; const src = pickSrc(i);
          return (
            <button key={`${i.slot}:${i.id}`} onClick={() => equip(activeSlot, i.id)}
                    className={`group text-left border rounded-xl p-2 hover:border-emerald-500 transition ${selected ? "border-emerald-500 bg-emerald-500/10" : (rarityRing[r]||rarityRing.common) + " bg-white/5"}`} title={i.id}>
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-white/5 grid place-items-center relative">
                {src ? <img src={src} alt={i.name ?? i.id} className="max-w-full max-h-full object-contain pointer-events-none" loading="lazy" /> : <span className="text-xs opacity-60">이미지 없음</span>}
                {selected && <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/80 text-white">장착중</span>}
              </div>
              <div className="mt-2 text-xs">
                <div className="font-medium truncate">{i.name ?? i.id}</div>
                <div className="opacity-60">{SLOT_LABEL[i.slot] ?? i.slot}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
