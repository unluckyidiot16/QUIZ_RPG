import React, { useEffect, useMemo, useState } from "react";
import { loadWearablesCatalog } from "../core/wearable.catalog";
import { Link } from "react-router-dom";
import { makeServices } from "../core/service.locator";

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
};

type InvState = {
  coins: number;
  equipped: Partial<Record<Slot, string>>;
  owned?: any;           // 배열/객체/Set/문자열 모두 허용
  cosmeticsOwned?: any;  // ^
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

/** 희귀도 정규화/스타일 */
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

/** 카탈로그 로드: 맵/배열 호환 */
async function loadCatalogMap(): Promise<Record<string, WearableItem>> {
  const res = await fetch("/packs/wearables.v1.json", { cache: "no-store" });
  const raw = await res.json();
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    return raw as Record<string, WearableItem>;
  }
  const arr: WearableItem[] = Array.isArray(raw) ? raw : (raw.items ?? []);
  const map: Record<string, WearableItem> = {};
  for (const it of arr) map[it.id] = it;
  return map;
}

// BASE_URL-safe 이미지 경로 정규화
const __prefix = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const normalizeSrc = (src?: string) => {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  return src.startsWith("/") ? `${__prefix}${src}` : `${__prefix}/${src}`;
};

// 다양한 스키마 대응: src | image | url | thumbnail | images[0] | assets[0] ...
const pickSrc = (it?: any) =>
  normalizeSrc(
    it?.src ??
    it?.image ??
    it?.img ??
    it?.renderSrc ??
    it?.render ??
    it?.thumbnail ??
    it?.thumb ??
    (Array.isArray(it?.images) ? it.images[0] : undefined) ??
    (Array.isArray(it?.assets) ? it.assets[0] : undefined) ??
    (typeof it?.file === "string" ? it.file : undefined) ??
    (typeof it?.url === "string" ? it.url : undefined)
  );

/** ─ Utils ─ */
const toL = (s?: string) => (s ?? "").toLowerCase();
function toIdArray(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string");
  if (raw instanceof Set) return Array.from(raw).filter((x) => typeof x === "string");
  if (typeof raw === "object") return Object.keys(raw);
  if (typeof raw === "string") return raw ? [raw] : [];
  return [];
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
/** 기본(Null) 선택 휴리스틱 */
function pickDefaultId(slot: Slot, catalog: Record<string, WearableItem>): string | undefined {
  const items = Object.values(catalog).filter(i => i.slot === slot);
  const score = (it: WearableItem) => {
    const s = `${it.id} ${it.name ?? ""}`.toLowerCase();
    return (s.includes("blank") || s.includes("basic") || s.includes("regular") || s.includes("default") || s.endsWith(".null")) ? 0 : 1;
  };
  return items.sort((a,b)=>score(a)-score(b))[0]?.id;
}
/** 프리뷰 레이어(간단) */
function equippedToLayers(equipped: Partial<Record<Slot,string>>, catalog: Record<string, WearableItem>) {
  const order = SLOTS;
  const layers: { id:string; slot:Slot; src?:string; name?:string }[] = [];
  for (const slot of order) {
    const id = equipped[slot];
    if (!id) continue;
    const it = catalog[id];
    layers.push({ id:id, slot, src: it?.src, name: it?.name ?? id });
  }
  return layers;
}

/** ─ Component ─ */
export default function Wardrobe() {
  const { inv } = useMemo(() => makeServices(), []);
  const [invState, setInvState] = useState<InvState | null>(null);
  const [catalog, setCatalog] = useState<Record<string, WearableItem>>({});
  const [activeSlot, setActiveSlot] = useState<Slot>("Hair");
  const [q, setQ] = useState("");

  /** 초기 로딩 */
  useEffect(() => {
    (async () => {
      try {
        const [s, cat] = await Promise.all([inv.load(), loadWearablesCatalog()]);
        setInvState(s as any);
        setCatalog(cat);
      } catch {/* ignore */}
    })();
  }, [inv]);

  /** 가챠 등 변경 즉시 반영 + 탭 복귀 동기화 */
  useEffect(() => {
    let alive = true;
    const reload = async () => {
      try {
        const s = await inv.load();
        if (!alive) return;
        setInvState(s as any);
      } catch {}
    };
    const onChanged = () => reload();
    const onFocus = () => reload();
    window.addEventListener("inv:changed", onChanged as EventListener);
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("inv:changed", onChanged as EventListener);
      window.removeEventListener("focus", onFocus);
    };
  }, [inv]);

  /** 정규화 카탈로그/보유/장착 */
   const catalogByIdL = useMemo(() => {
       const m: Record<string, WearableItem> = {};
       if (Array.isArray(catalog)) {
           for (const it of catalog) if (it?.id) m[toL(it.id)] = it;
         } else {
           for (const [id, it] of Object.entries(catalog as any)) m[toL(id)] = it as WearableItem;
         }
       return m;
     }, [catalog]);
  const getItemByAnyId = (id: string) => catalogByIdL[toL(id)];
  const toCanonicalId   = (id: string) => getItemByAnyId(id)?.id ?? id;

  const ownedIds = useMemo(() => {
    const raw = (invState as any)?.cosmeticsOwned ?? (invState as any)?.owned ?? [];
    return toIdArray(raw);
  }, [invState]);
  const ownedSetL = useMemo(() => new Set(ownedIds.map(toL)), [ownedIds]);

  const equipped = (invState?.equipped || {}) as Partial<Record<Slot, string>>;

  /** 카탈로그+보유 머지(보유 중인데 카탈로그에 없으면 placeholder) */
  const mergedCatalogL = useMemo(() => {
    const base: Record<string, WearableItem> = { ...catalogByIdL };
    for (const idL of ownedSetL) {
      if (!base[idL]) {
        base[idL] = {
          id: idL,
          name: idL,
          slot: (inferSlotFromId(idL) ?? "Clothes") as Slot,
          rarity: "common",
        };
        console.warn("[wardrobe] owned id missing in catalog:", idL);
      }
    }
    return base;
  }, [catalogByIdL, ownedSetL]);

  /** 프리뷰 레이어: 정규 카탈로그 사용(원본 src 경로 유지) */
  const layers = useMemo(() => {
    const items: { id:string; slot:Slot; src?:string; name?:string }[] = [];
    for (const slot of SLOTS) {
      const id = equipped[slot];
      if (!id) continue;
      const it = getItemByAnyId(id);
      items.push({ id, slot, src: pickSrc(it), name: it?.name ?? id });
    }
    return items;
  }, [equipped, catalogByIdL]);

  /** 실제 보유한 아이템만(allItems) */
  const allItems = useMemo(
    () => Object.values(mergedCatalogL).filter(it => ownedSetL.has(toL(it.id))),
    [mergedCatalogL, ownedSetL]
  );

  /** 슬롯별 카운트 (보유만) */
  const countsBySlot = useMemo(() => {
    const m = new Map<Slot, number>();
    for (const sl of SLOTS) m.set(sl, 0);
    for (const it of allItems) {
      m.set(it.slot, (m.get(it.slot) || 0) + 1);
    }
    return m;
  }, [allItems]);

  /** 필터(슬롯/검색/희귀도) + 보유만 */
  const [rarityFilter, setRarityFilter] = useState<"all" | Rarity>("all");
  const equippedId = equipped[activeSlot];
  const list = useMemo(() => {
    const rq = q.trim().toLowerCase();
    return allItems
      .filter(i => i.slot === activeSlot)
      .filter(i => (rq ? `${i.name ?? ""} ${i.id}`.toLowerCase().includes(rq) : true))
      .filter(i => (rarityFilter === "all" ? true : asRarity(i.rarity) === rarityFilter));
  }, [allItems, activeSlot, q, rarityFilter]);

  /** 장착/해제 (정규 ID로 저장) */
  async function equip(slot: Slot, itemId?: string) {
    const nextId =
      itemId ? toCanonicalId(itemId) :
        (() => {
          const items = allItems.filter(i => i.slot === slot);
          const score = (it: WearableItem) => {
            const s = `${it.id} ${it.name ?? ""}`.toLowerCase();
            return (s.includes("blank") || s.includes("basic") || s.includes("regular") || s.includes("default") || s.endsWith(".null")) ? 0 : 1;
          };
          const pick = items.sort((a,b)=>score(a)-score(b))[0];
          return pick ? toCanonicalId(pick.id) : undefined;
        })();

    await inv.apply({ equip: { [slot]: nextId }, reason: itemId ? "wardrobe:equip" : "wardrobe:unequip" });
    window.dispatchEvent(new CustomEvent("inv:changed"));
    setInvState(await inv.load() as any);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 상단 바: 메인으로 */}
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm opacity-80 hover:opacity-100">← 메인으로</Link>
        <h2 className="text-2xl font-bold">옷장</h2>
        <div />
      </div>

      {/* 프리뷰 */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="aspect-square rounded-xl bg-slate-900/50 border border-white/10 relative overflow-hidden">
          {layers.map((L) => (
            <div key={`${L.slot}:${L.id}`} className="absolute inset-0 flex items-center justify-center">
              {L.src ? (
                <img
                  src={normalizeSrc(L.src)}
                  alt={L.name ?? L.id}
                  className="max-w-full max-h-full object-contain pointer-events-none select-none"
                  draggable={false}
                />
              ) : (
                <div className="text-xs opacity-60">{L.slot}</div>
              )}
            </div>
          ))}
        </div>

        {/* 슬롯 탭 + 툴바 */}
        <div className="md:col-span-2">
          <div className="flex flex-wrap gap-2">
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

          <div className="mt-2 text-sm opacity-80">
            현재 {SLOT_LABEL[activeSlot]}: <b>{equippedId ?? "없음(기본)"}</b>
          </div>
        </div>
      </div>

      {/* 목록: 실제 보유만 */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {list.map((i) => {
          const selected = equippedId === i.id;
          const r = asRarity(i.rarity);
          return (
            <button
              key={i.id}
              onClick={() => equip(activeSlot, i.id)}
              className={`group text-left border rounded-xl p-2 hover:border-emerald-500 transition
                ${selected ? "border-emerald-500 bg-emerald-500/10" : rarityRing[r] + " bg-white/5"}`}
              title={i.id}
            >
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-white/5 grid place-items-center relative">
                {(() => {
                  const full = getItemByAnyId(i.id) ?? i; // 카탈로그 원본 우선
                  const src = pickSrc(full);
                  return src ? (
                    <img src={src} alt={full.name ?? i.id} className="max-w-full max-h-full object-contain pointer-events-none" loading="lazy" />
                  ) : (
                    <span className="text-xs opacity-60">이미지 없음</span>
                  );
                })()}
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
