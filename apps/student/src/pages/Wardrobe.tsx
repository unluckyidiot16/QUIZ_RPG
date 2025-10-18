import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { makeServices } from "../core/service.locator";
import { loadWearablesCatalog } from "../core/wearable.catalog";

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
  layer?: number; // optional
  z?: number;     // optional
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
const toIdArray = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string");
  if (raw instanceof Set) return Array.from(raw).filter((x) => typeof x === "string");
  if (typeof raw === "object") return Object.keys(raw);
  if (typeof raw === "string") return raw ? [raw] : [];
  return [];
};

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

function getZ(slot: Slot, item?: any): number {
  const meta = item?.layer ?? item?.z;
  if (Number.isFinite(meta)) return Number(meta);
  return Z_BY_SLOT[slot] ?? 0;
}

function inferSlotFromId(id: string): Slot | undefined {
  const s = toL(id);
  if (s.startsWith("hair.") || s.includes("hair")) return "Hair";
  if (s.startsWith("hat.") || s.startsWith("bow.")) return "Hat";
  if (s.startsWith("clothes.") || s.startsWith("shirts.") || s.startsWith("dress.")) return "Clothes";
  if (s.startsWith("bodysuit.")) return "BodySuit";
  if (s.startsWith("pants.")) return "Pants";
  if (s.startsWith("shoes.")) return "Shoes";
  if (s.startsWith("sleeve.")) return "Sleeves";
  if (s.startsWith("necklace.")) return "Necklace";
  if (s.startsWith("scarf.") || s.startsWith("scaf.")) return "Scarf";
  if (s.startsWith("bag.")) return "Bag";
  if (s.startsWith("body.")) return "Body";
  if (s.startsWith("face.")) return "Face";
  if (s.startsWith("bowtie.")) return "Bowtie";
  return undefined;
}

/** 카탈로그 -> 소문자 ID 맵 */
function toCatalogL(cat: WearableItem[] | Record<string, WearableItem>) {
  const m: Record<string, WearableItem> = {};
  if (Array.isArray(cat)) for (const it of cat) m[toL(it.id)] = it;
  else for (const [id, it] of Object.entries(cat)) m[toL(id)] = it as WearableItem;
  return m;
}

/** 슬롯별 “없음(null)” 후보 찾기 */
function findNullId(slot: Slot, catalogL: Record<string, WearableItem>) {
  const keys = Object.keys(catalogL);
  const hit = keys.find(k => {
    const it = catalogL[k];
    return it.slot === slot && (
      k.endsWith(".null") ||
      k.includes("null") ||
      k.includes("none") ||
      k.includes("blank") ||
      k.includes("default") ||
      (toL(it.name).includes("없음")) ||
      (toL(it.name).includes("기본"))
    );
  });
  return hit ? catalogL[hit].id : undefined;
}

/** 기본(Null) 선택 휴리스틱 */
function pickDefaultId(slot: Slot, catalogL: Record<string, WearableItem>) {
  const items = Object.values(catalogL).filter(i => i.slot === slot);
  const score = (it: WearableItem) => {
    const s = `${it.id} ${it.name ?? ""}`.toLowerCase();
    return (s.includes("blank") || s.includes("basic") || s.includes("regular") ||
      s.includes("default") || s.endsWith(".null") || s.includes("없음")) ? 0 : 1;
  };
  return items.sort((a,b)=>score(a)-score(b))[0]?.id;
}

/** ─ Component ─ */
export default function Wardrobe() {
  const { inv } = useMemo(() => makeServices(), []);
  const [invState, setInvState] = useState<InvState | null>(null);
  const [catalog, setCatalog] = useState<Record<string, WearableItem>>({});
  const [activeSlot, setActiveSlot] = useState<Slot>("Hair");
  const [q, setQ] = useState("");
  const [rarityFilter, setRarityFilter] = useState<"all" | Rarity>("all");

  useEffect(() => {
    (async () => {
      const [state, catAny] = await Promise.all([inv.load(), loadWearablesCatalog()]);
      setInvState(state as any);
      setCatalog(Array.isArray(catAny)
        ? Object.fromEntries((catAny as WearableItem[]).map(it => [it.id, it]))
        : (catAny as Record<string, WearableItem>));
    })();
  }, [inv]);

  // 변경/포커스 시 동기화
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

  const catalogL = useMemo(() => toCatalogL(catalog), [catalog]);
  const getItemByAnyId = (id?: string) => (id ? catalogL[toL(id)] : undefined);
  const toCanonicalId = (id?: string) => (id ? getItemByAnyId(id)?.id ?? id : undefined);

  const ownedIds = useMemo(() => {
    const raw = (invState as any)?.cosmeticsOwned ?? (invState as any)?.owned ?? [];
    return toIdArray(raw);
  }, [invState]);
  const ownedSetL = useMemo(() => new Set(ownedIds.map(toL)), [ownedIds]);

  const equipped = (invState?.equipped || {}) as Partial<Record<Slot, string>>;
  const equippedId = equipped[activeSlot];

  /** 슬롯별 카운트(보유만) */
  const countsBySlot = useMemo(() => {
    const counts = new Map<Slot, number>();
    for (const s of SLOTS) counts.set(s, 0);
    for (const id of ownedIds) {
      const it = getItemByAnyId(id);
      if (it) counts.set(it.slot, (counts.get(it.slot) || 0) + 1);
    }
    return counts;
  }, [ownedIds, catalogL]);

  /** “없음” 가상 옵션 (인벤토리에 없어도 항상 노출) */
  const nullId = findNullId(activeSlot, catalogL) ?? `__none__/${activeSlot}`;
  const virtualNone: WearableItem = {
    id: nullId,
    name: "없음",
    slot: activeSlot,
    src: undefined, // 투명
    rarity: "common",
  };

  /** 슬롯/검색/희귀도 필터 + 보유만 */
  const filteredOwned = useMemo(() => {
    const rq = q.trim().toLowerCase();
    return ownedIds
      .map(getItemByAnyId)
      .filter(Boolean)
      .filter(i => i!.slot === activeSlot)
      .filter(i => (rq ? `${i!.name ?? ""} ${i!.id}`.toLowerCase().includes(rq) : true))
      .filter(i => (rarityFilter === "all" ? true : asRarity(i!.rarity) === rarityFilter)) as WearableItem[];
  }, [ownedIds, activeSlot, q, rarityFilter, catalogL]);

  /** 표시 목록: “없음”을 항상 선두에 + 현재 장착(카탈로그 누락)도 강제 포함 */
  const list = useMemo(() => {
    const arr: WearableItem[] = [virtualNone, ...filteredOwned];

    if (equippedId) {
      const inList = arr.some(i => i.id === equippedId);
      if (!inList) {
        const ghost = getItemByAnyId(equippedId) ?? {
          id: equippedId,
          slot: activeSlot,
          name: equippedId,
          rarity: "common",
        };
        arr.splice(1, 0, ghost as WearableItem); // 없음 다음에 배치
      }
    }
    return arr;
  }, [filteredOwned, virtualNone, equippedId, activeSlot]);

  async function equip(slot: Slot, itemId?: string) {
    // “없음” 가상 옵션 → undefined로 저장(=해제)
    const isNone = !itemId || itemId === `__none__/${slot}` || toL(itemId).includes(".null") || toL(itemId).includes("none") || toL(itemId).includes("blank") || toL(itemId).includes("default");
    const nextId = isNone ? undefined : toCanonicalId(itemId);

    await inv.apply({ equip: { [slot]: nextId }, reason: isNone ? "wardrobe:unequip" : "wardrobe:equip" });
    window.dispatchEvent(new CustomEvent("inv:changed"));
    setInvState(await inv.load() as any);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm opacity-80 hover:opacity-100">← 메인으로</Link>
        <h2 className="text-2xl font-bold">옷장</h2>
        <div />
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
          className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500"
          onClick={() => equip(activeSlot, virtualNone.id)}
          title="해제하고 기본 상태로"
        >
          {SLOT_LABEL[activeSlot]} 없음으로
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

      {/* 목록 */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {list.map((i) => {
          const selected = equippedId === i.id || (!equippedId && i.id === virtualNone.id);
          const r = asRarity(i.rarity);
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
                  <span className="text-xs opacity-60">없음</span>
                )}
                {selected && (
                  <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/80 text-white">
                    {i.id === virtualNone.id ? "없음(장착)" : "장착중"}
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
