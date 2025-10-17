import React, { useEffect, useMemo, useState } from "react";
import { makeServices } from "../core/service.locator";

/** ─────────────────────────────
 *  최소 타입(프로젝트 타입과 호환)
 *  ──────────────────────────── */
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
  /** 프로젝트에 따라 owned/cosmeticsOwned 중 하나를 씁니다. 둘 다 지원 */
  owned?: string[];
  cosmeticsOwned?: string[];
};

const SLOTS: Slot[] = [
  "Hair","Hat","Clothes","BodySuit","Pants","Shoes","Sleeves",
  "Necklace","Scarf","Bowtie","Bag","Body","Face",
];

const SLOT_LABEL: Record<Slot,string> = {
  Hair:"헤어", Hat:"모자", Clothes:"상의/원피스", BodySuit:"바디수트", Pants:"하의",
  Shoes:"신발", Sleeves:"소매", Necklace:"목걸이", Scarf:"스카프", Bowtie:"보타이",
  Bag:"가방", Body:"바디", Face:"페이스",
};

/** 희귀도 문자열 정규화 (없으면 common 취급) */
function asRarity(r?: string): Rarity {
  const v = (r ?? "common").toLowerCase();
  if (v === "uncommon") return "uncommon";
  if (v === "rare") return "rare";
  if (v === "epic") return "epic";
  if (v === "legendary") return "legendary";
  if (v === "mythic") return "mythic";
  return "common";
}

/** 카탈로그 로드: /packs/wearables.v1.json (맵/배열 모두 대응) */
async function loadCatalogMap(): Promise<Record<string, WearableItem>> {
  const res = await fetch("/packs/wearables.v1.json", { cache: "no-store" });
  const raw = await res.json();
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    // id -> item 맵 구조
    return raw as Record<string, WearableItem>;
  }
  const arr: WearableItem[] = Array.isArray(raw) ? raw : (raw.items ?? []);
  const map: Record<string, WearableItem> = {};
  for (const it of arr) map[it.id] = it;
  return map;
}

/** 슬롯 추론(카탈로그에 없는 보유 아이템을 표시하기 위한 안전장치) */
function inferSlotFromId(id: string): Slot | undefined {
  const s = id.toLowerCase();
  if (s.startsWith("hair.") || s.includes("hair")) return "Hair";
  if (s.startsWith("hat.") || s.startsWith("bow.")) return "Hat";
  if (s.startsWith("shirts.") || s.startsWith("dress.")) return "Clothes";
  if (s.startsWith("bodysuit.")) return "BodySuit";
  if (s.startsWith("pants.")) return "Pants";
  if (s.startsWith("shoes.")) return "Shoes";
  if (s.startsWith("sleeve.")) return "Sleeves";
  if (s.startsWith("necklace.")) return "Necklace";
  if (s.startsWith("scarf.") || s.startsWith("scaf.")) return "Scarf"; // scaf.* 보정
  if (s.startsWith("bag.")) return "Bag";
  if (s.startsWith("body.")) return "Body";
  if (s.startsWith("face.")) return "Face";
  if (s.startsWith("bowtie.")) return "Bowtie";
  return undefined;
}

/** 기본 아이템 선택 (blank/basic/regular/default 우선) */
function pickDefaultId(slot: Slot, catalog: Record<string, WearableItem>): string | undefined {
  const items = Object.values(catalog).filter(i => i.slot === slot);
  const score = (it: WearableItem) => {
    const s = `${it.id} ${it.name ?? ""}`.toLowerCase();
    // 이름 휴리스틱
    if (s.includes("blank") || s.includes("basic") || s.includes("regular") || s.includes("default")) return 0;
    return 1;
  };
  return items.sort((a,b)=>score(a)-score(b))[0]?.id;
}

/** 미리보기 레이어(간단 버전): 슬롯 우선순으로 이미지 스택 */
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

export default function Wardrobe() {
  const { inv } = useMemo(() => makeServices(), []);
  const [invState, setInvState] = useState<InvState | null>(null);
  const [catalog, setCatalog] = useState<Record<string, WearableItem>>({});
  const [activeSlot, setActiveSlot] = useState<Slot>("Hair");
  const [q, setQ] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [rarityFilter, setRarityFilter] = useState<"all" | Rarity>("all");

  /** 초기 로딩 그대로 유지 */
  useEffect(() => {
    (async () => {
      try {
        const [s, cat] = await Promise.all([inv.load(), loadCatalogMap()]);
        setInvState(s as any);
        setCatalog(cat);
      } catch {
        // ignore
      }
    })();
  }, [inv]);

  /** 가챠 등 인벤 변경 즉시 반영 + 탭 포커스 복귀 시 동기화 */
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

  /** 보유 ID 세트 */
  const ownedSet = useMemo(() => {
    const raw = (invState as any)?.cosmeticsOwned ?? (invState as any)?.owned ?? [];
    return new Set<string>(Array.isArray(raw) ? raw : []);
  }, [invState]);

  /** 카탈로그 + 보유ID 머지 (카탈로그에 없는 보유 아이템도 플레이스홀더 생성) */
  const mergedCatalog = useMemo(() => {
    const base: Record<string, WearableItem> = { ...catalog };
    for (const id of ownedSet) {
      if (!base[id]) {
        const slot = inferSlotFromId(id);
        base[id] = { id, slot: (slot ?? "Clothes") as Slot, name: id, rarity: "common" };
        console.warn("[wardrobe] owned id missing in catalog:", id);
      }
    }
    return base;
  }, [catalog, ownedSet]);

  const equipped = (invState?.equipped || {}) as Partial<Record<Slot, string>>;
  const equippedId = equipped[activeSlot];

  /** 프리뷰 레이어: mergedCatalog 사용 (누락 아이템 대비) */
  const layers = useMemo(
    () => equippedToLayers(equipped, mergedCatalog),
    [equipped, mergedCatalog]
  );

  /** 전체 아이템(머지본) */
  const allItems = useMemo(() => Object.values(mergedCatalog), [mergedCatalog]);

  /** 슬롯별 개수 (보유만 보기 반영) */
  const countsBySlot = useMemo(() => {
    const m = new Map<Slot, number>();
    for (const sl of SLOTS) m.set(sl, 0);
    for (const it of allItems) {
      if (ownedOnly && !ownedSet.has(it.id)) continue;
      m.set(it.slot as Slot, (m.get(it.slot as Slot) || 0) + 1);
    }
    return m;
  }, [allItems, ownedOnly, ownedSet]);

  /** 리스트 필터링 (슬롯/검색/희귀도/보유만) */
  const list = useMemo(() => {
    const rq = q.trim().toLowerCase();
    return allItems
      .filter((i) => i.slot === activeSlot)
      .filter((i) => (rq ? `${i.name ?? ""} ${i.id}`.toLowerCase().includes(rq) : true))
      .filter((i) => (rarityFilter === "all" ? true : asRarity(i.rarity) === rarityFilter))
      .filter((i) => !ownedOnly || ownedSet.has(i.id));
  }, [allItems, activeSlot, q, rarityFilter, ownedOnly, ownedSet]);

  /** 장착/해제 */
  async function equip(slot: Slot, itemId?: string) {
    const nextId =
      itemId ??
      pickDefaultId(slot, mergedCatalog) ??
      Object.values(mergedCatalog).find((i) => i.slot === slot)?.id;
    await inv.apply({ equip: { [slot]: nextId }, reason: itemId ? "wardrobe:equip" : "wardrobe:unequip" });
    // 헤더/다른 페이지에 즉시 반영
    window.dispatchEvent(new CustomEvent("inv:changed"));
    setInvState(await inv.load() as any);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold">옷장</h2>

      {/* 상단: 프리뷰 */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="aspect-square rounded-xl bg-slate-900/50 border border-white/10 relative overflow-hidden">
          {/* 간단 미리보기: 레이어 스택 */}
          {layers.map((L) => (
            <div key={`${L.slot}:${L.id}`} className="absolute inset-0 flex items-center justify-center">
              {L.src ? (
                <img
                  src={L.src}
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

        {/* 슬롯 탭 */}
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

            {/* 보유만 보기 */}
            <label className="flex items-center gap-2 px-2 py-2 rounded bg-slate-800">
              <input
                type="checkbox"
                checked={ownedOnly}
                onChange={(e) => setOwnedOnly(e.target.checked)}
              />
              <span className="text-sm">보유만 보기</span>
            </label>

            {/* 희귀도 필터 */}
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

          {/* 현재 장착 뱃지 */}
          <div className="mt-2 text-sm opacity-80">
            현재 {SLOT_LABEL[activeSlot]}:{" "}
            <b>{equippedId ?? "없음(기본)"}</b>
          </div>
        </div>
      </div>

      {/* 목록: 카드 그리드 */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {list.map((i) => {
          const owned = ownedSet.has(i.id);
          const selected = equippedId === i.id;
          return (
            <button
              key={i.id}
              onClick={() => equip(activeSlot, i.id)}
              className={`group text-left border rounded-xl p-2 hover:border-emerald-500 transition 
                ${selected ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 bg-white/5"}
                ${owned ? "" : "opacity-60"}`}
              title={i.id}
            >
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-white/5 grid place-items-center">
                {i.src ? (
                  <img
                    src={i.src}
                    alt={i.name ?? i.id}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xs opacity-60">이미지 없음</span>
                )}
              </div>
              <div className="mt-2 text-xs">
                <div className="font-medium truncate">{i.name ?? i.id}</div>
                <div className="opacity-60">{SLOT_LABEL[i.slot] ?? i.slot}</div>
                {owned && <div className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-200">보유</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
