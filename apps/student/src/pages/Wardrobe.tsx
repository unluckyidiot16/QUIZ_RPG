import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { makeServices } from "@/core/service.locator";
import { loadWearablesCatalog } from "@/core/wearable.catalog";

/** ─ Types ─ */
type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
type Slot =
  | "Body" | "Face" | "BodySuit" | "Pants" | "Shoes" | "Clothes" | "Sleeves"
  | "Necklace" | "Bag" | "Scarf" | "Bowtie" | "Hair" | "Hat";

type WearableItem = {
  id: string;
  name?: string;
  slot: Slot;
  src?: string;
  rarity?: Rarity | string;
  layer?: number;
  z?: number;
};

type InvState = {
  coins?: number;
  equipped?: Partial<Record<Slot, string>>;
  owned?: any;
  cosmeticsOwned?: any;
};

/** ─ Consts ─ */
const SLOTS: Slot[] = [
  "Hair","Hat","Clothes","BodySuit","Pants","Shoes","Sleeves",
  "Necklace","Scarf","Bowtie","Bag","Body","Face",
];
const SLOT_LABEL: Record<Slot,string> = {
  Hair:"헤어", Hat:"모자", Clothes:"상의/원피스", BodySuit:"바디수트", Pants:"하의",
  Shoes:"신발", Sleeves:"소매", Necklace:"목걸이", Scarf:"스카프", Bowtie:"보타이",
  Bag:"가방", Body:"바디", Face:"페이스",
};
const Z_BY_SLOT: Record<Slot, number> = {
  Body: 0, BodySuit: 5, Pants: 10, Shoes: 15, Clothes: 20, Sleeves: 25,
  Bag: 30, Necklace: 40, Scarf: 45, Bowtie: 50, Face: 55, Hair: 60, Hat: 70,
};

const __prefix = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const normalizeSrc = (src?: string) => {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  return src.startsWith("/") ? `${__prefix}${src}` : `${__prefix}/${src}`;
};
const pickSrc = (it?: any) =>
  normalizeSrc(
    it?.src ?? it?.image ?? it?.img ?? it?.renderSrc ?? it?.render ??
    it?.thumbnail ?? it?.thumb ??
    (Array.isArray(it?.images) ? it.images[0] : undefined) ??
    (Array.isArray(it?.assets) ? it.assets[0] : undefined) ??
    (typeof it?.file === "string" ? it.file : undefined) ??
    (typeof it?.url === "string" ? it.url : undefined)
  );
const toL = (s?: string) => (s ?? "").toLowerCase();

function asRarity(r?: string): Rarity {
  const v = (r ?? "common").toLowerCase();
  if (v === "uncommon") return "uncommon";
  if (v === "rare") return "rare";
  if (v === "epic") return "epic";
  if (v === "legendary") return "legendary";
  if (v === "mythic") return "mythic";
  return "common";
}
const rarityRing: Record<Rarity,string> = {
  common: "border-white/10",
  uncommon: "border-emerald-400/60",
  rare: "border-sky-400/60",
  epic: "border-violet-400/60",
  legendary: "border-amber-400/70",
  mythic: "border-fuchsia-400/70",
};
const rarityLabel: Record<Rarity,string> = {
  common: "일반", uncommon: "고급", rare: "희귀",
  epic: "영웅", legendary: "전설", mythic: "신화",
};

function getZ(slot: Slot, it?: any) {
  const meta = it?.layer ?? it?.z;
  if (Number.isFinite(meta)) return Number(meta);
  return Z_BY_SLOT[slot] ?? 0;
}
function toCatalogL(catAny: any) {
  const m: Record<string, WearableItem> = {};
  if (Array.isArray(catAny)) for (const it of catAny) m[toL(it.id)] = it;
  else if (catAny && typeof catAny === "object") for (const [id, it] of Object.entries(catAny)) m[toL(id)] = it as any;
  return m;
}
function toIdArray(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string");
  if (raw instanceof Set) return Array.from(raw).filter((x) => typeof x === "string");
  if (typeof raw === "object") return Object.keys(raw);
  if (typeof raw === "string") return raw ? [raw] : [];
  return [];
}

export default function Wardrobe() {
  const { inv } = useMemo(() => makeServices(), []);
  const [invState, setInvState] = useState<InvState | null>(null);
  const [catalogL, setCatalogL] = useState<Record<string, WearableItem>>({});
  const [activeSlot, setActiveSlot] = useState<Slot>("Hair");
  const [q, setQ] = useState("");
  const [rarityFilter, setRarityFilter] = useState<"all" | Rarity>("all");

  useEffect(() => {
    (async () => {
      const [s, catAny] = await Promise.all([inv.load(), loadWearablesCatalog()]);
      setInvState(s as any);
      setCatalogL(toCatalogL(catAny));
    })();
  }, [inv]);

  useEffect(() => {
    const reload = async () => setInvState(await inv.load() as any);
    const onChanged = () => reload();
    const onFocus = () => reload();
    window.addEventListener("inv:changed", onChanged as EventListener);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("inv:changed", onChanged as EventListener);
      window.removeEventListener("focus", onFocus);
    };
  }, [inv]);

  const getItemByAnyId = (id?: string) => (id ? catalogL[toL(id)] : undefined);
  const toCanonicalId = (id?: string) => (id ? getItemByAnyId(id)?.id ?? id : undefined);

  const ownedIds = useMemo(() => {
    const raw = (invState as any)?.cosmeticsOwned ?? (invState as any)?.owned ?? [];
    return toIdArray(raw);
  }, [invState]);
  const ownedSetL = useMemo(() => new Set(ownedIds.map(toL)), [ownedIds]);

  const equipped = (invState?.equipped || {}) as Partial<Record<Slot, string>>;
  const equippedId = equipped[activeSlot];

  /** ─ 상단 큰 미리보기(고정 크기) ─ */
  const previewLayers = useMemo(() => {
    const arr: { id:string; slot:Slot; src:string; z:number }[] = [];
    for (const slot of SLOTS) {
      const id = equipped[slot];
      if (!id) continue;
      const it = getItemByAnyId(id);
      const src = pickSrc(it);
      if (!src) continue;
      arr.push({ id, slot, src, z: getZ(slot, it) });
    }
    return arr.sort((a,b)=>a.z-b.z);
  }, [equipped, catalogL]);

  /** 슬롯별 보유 개수 */
  const countsBySlot = useMemo(() => {
    const m = new Map<Slot, number>();
    for (const s of SLOTS) m.set(s, 0);
    for (const id of ownedIds) {
      const it = getItemByAnyId(id);
      if (it) m.set(it.slot, (m.get(it.slot) || 0) + 1);
    }
    return m;
  }, [ownedIds, catalogL]);

  /** 목록(보유 + 슬롯/검색/희귀도 필터) */
  const list = useMemo(() => {
    const rq = q.trim().toLowerCase();
    return ownedIds
      .map(getItemByAnyId)
      .filter(Boolean)
      .filter(i => (i as WearableItem).slot === activeSlot)
      .filter(i => (rq ? `${i!.name ?? ""} ${i!.id}`.toLowerCase().includes(rq) : true))
      .filter(i => (rarityFilter === "all" ? true : (():boolean=>{
        const r = (i as WearableItem).rarity as string | undefined;
        return (r ? r.toLowerCase() : "common") === rarityFilter;
      })()));
  }, [ownedIds, activeSlot, q, rarityFilter, catalogL]);

  async function equip(slot: Slot, itemId?: string) {
    const nextId = itemId ? toCanonicalId(itemId) : undefined; // undefined = 해제(없음)
    await inv.apply({ equip: { [slot]: nextId }, reason: itemId ? "wardrobe:equip" : "wardrobe:unequip" });
    window.dispatchEvent(new CustomEvent("inv:changed"));
    setInvState(await inv.load() as any);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 상단 */}
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm opacity-80 hover:opacity-100">← 메인으로</Link>
        <h2 className="text-2xl font-bold">옷장</h2>
        <div />
      </div>

      {/* ======= 고정 크기 미리보기 ======= */}
      <div className="mt-4 grid place-items-center">
        <div className="w-[280px] h-[280px] md:w-[320px] md:h-[320px] rounded-xl bg-slate-900/50 border border-white/10 relative overflow-hidden">
          {previewLayers.map(L => (
            <img
              key={`${L.slot}:${L.id}`}
              src={L.src}
              alt=""
              className="absolute inset-0 object-contain max-w-full max-h-full pointer-events-none select-none"
              style={{ zIndex: L.z }}
              draggable={false}
            />
          ))}
        </div>
      </div>

      {/* 슬롯 탭 */}
      <div className="mt-4 flex flex-wrap gap-2">
        {SLOTS.map((sl) => {
          const cnt = countsBySlot.get(sl) ?? 0;
          const active = sl === activeSlot;
          return (
            <button
              key={sl}
              onClick={() => setActiveSlot(sl)}
              className={`px-3 py-2 rounded-lg border ${active ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 bg-white/5"} `}
              title={`${SLOT_LABEL[sl]} (${cnt})`}
            >
              {SLOT_LABEL[sl]} <span className="opacity-60 text-xs">({cnt})</span>
            </button>
          );
        })}
      </div>

      {/* 툴바 */}
      <div className="mt-4 flex gap-2">
        <button
          className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
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
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          className="px-3 py-2 rounded bg-slate-800"
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value as any)}
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

      {/* 보유 목록(썸네일은 기존처럼 aspect-square 유지 OK) */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {list.map((i: any) => {
          const selected = equippedId === i.id;
          const r = (i.rarity ? i.rarity.toLowerCase() : "common") as Rarity;
          const src = pickSrc(i);
          return (
            <button
              key={`${i.slot}:${i.id}`}
              onClick={() => equip(activeSlot, i.id)}
              className={`group text-left border rounded-xl p-2 hover:border-emerald-500 transition
                ${selected ? "border-emerald-500 bg-emerald-500/10" : rarityRing[r] + " bg-white/5"}`}
              title={i.id}
            >
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-white/5 grid place-items-center relative">
                {src ? (
                  <img src={src} alt={i.name ?? i.id} className="max-w-full max-h-full object-contain pointer-events-none" loading="lazy" />
                ) : (
                  <span className="text-xs opacity-60">이미지 없음</span>
                )}
                {selected && (
                  <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/80 text-white">
                    장착중
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs">
                <div className="font-medium truncate">{i.name ?? i.id}</div>
                <div className="opacity-60">{SLOT_LABEL[i.slot] ?? i.slot}</div>
                <div className="mt-1 opacity-60">{rarityLabel[r]}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
