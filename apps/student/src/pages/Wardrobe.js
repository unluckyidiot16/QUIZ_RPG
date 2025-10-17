import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { loadWearablesCatalog } from "../core/wearable.catalog";
import { Link } from "react-router-dom";
import { makeServices } from "../core/service.locator";
/** ─ Consts ─ */
const SLOTS = [
    "Hair", "Hat", "Clothes", "BodySuit", "Pants", "Shoes", "Sleeves",
    "Necklace", "Scarf", "Bowtie", "Bag", "Body", "Face",
];
const SLOT_LABEL = {
    Hair: "헤어", Hat: "모자", Clothes: "상의/원피스", BodySuit: "바디수트", Pants: "하의",
    Shoes: "신발", Sleeves: "소매", Necklace: "목걸이", Scarf: "스카프", Bowtie: "보타이",
    Bag: "가방", Body: "바디", Face: "페이스",
};
const Z_BY_SLOT = {
    Body: 0,
    BodySuit: 5,
    Pants: 10,
    Shoes: 15,
    Clothes: 20,
    Sleeves: 25,
    Bag: 30,
    Necklace: 40,
    Scarf: 45,
    Bowtie: 50,
    Face: 55,
    Hair: 60,
    Hat: 70,
};
function getZ(slot, item) {
    const meta = item?.layer ?? item?.z; // 시트/JSON에 layer(z) 있으면 우선
    if (Number.isFinite(meta))
        return Number(meta);
    return Z_BY_SLOT[slot] ?? 0;
}
/** 희귀도 정규화/스타일 */
function asRarity(r) {
    const v = (r ?? "common").toLowerCase();
    if (v === "uncommon")
        return "uncommon";
    if (v === "rare")
        return "rare";
    if (v === "epic")
        return "epic";
    if (v === "legendary")
        return "legendary";
    if (v === "mythic")
        return "mythic";
    return "common";
}
const rarityRing = {
    common: "border-white/10",
    uncommon: "border-emerald-400/60",
    rare: "border-sky-400/60",
    epic: "border-violet-400/60",
    legendary: "border-amber-400/70",
    mythic: "border-fuchsia-400/70",
};
const rarityLabel = {
    common: "일반", uncommon: "고급", rare: "희귀",
    epic: "영웅", legendary: "전설", mythic: "신화",
};
/** 카탈로그 로드: 맵/배열 호환 */
async function loadCatalogMap() {
    const res = await fetch("/packs/wearables.v1.json", { cache: "no-store" });
    const raw = await res.json();
    if (raw && !Array.isArray(raw) && typeof raw === "object") {
        return raw;
    }
    const arr = Array.isArray(raw) ? raw : (raw.items ?? []);
    const map = {};
    for (const it of arr)
        map[it.id] = it;
    return map;
}
// BASE_URL-safe 이미지 경로 정규화
const __prefix = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const normalizeSrc = (src) => {
    if (!src)
        return undefined;
    if (/^https?:\/\//i.test(src))
        return src;
    return src.startsWith("/") ? `${__prefix}${src}` : `${__prefix}/${src}`;
};
// 다양한 스키마 대응: src | image | url | thumbnail | images[0] | assets[0] ...
const pickSrc = (it) => normalizeSrc(it?.src ??
    it?.image ??
    it?.img ??
    it?.renderSrc ??
    it?.render ??
    it?.thumbnail ??
    it?.thumb ??
    (Array.isArray(it?.images) ? it.images[0] : undefined) ??
    (Array.isArray(it?.assets) ? it.assets[0] : undefined) ??
    (typeof it?.file === "string" ? it.file : undefined) ??
    (typeof it?.url === "string" ? it.url : undefined));
/** ─ Utils ─ */
const toL = (s) => (s ?? "").toLowerCase();
function toIdArray(raw) {
    if (!raw)
        return [];
    if (Array.isArray(raw))
        return raw.filter((x) => typeof x === "string");
    if (raw instanceof Set)
        return Array.from(raw).filter((x) => typeof x === "string");
    if (typeof raw === "object")
        return Object.keys(raw);
    if (typeof raw === "string")
        return raw ? [raw] : [];
    return [];
}
function inferSlotFromId(id) {
    const s = toL(id);
    if (s.startsWith("hair.") || s.includes("hair"))
        return "Hair";
    if (s.startsWith("hat.") || s.startsWith("bow."))
        return "Hat";
    if (s.startsWith("clothes.") || s.startsWith("shirts.") || s.startsWith("dress."))
        return "Clothes";
    if (s.startsWith("bodysuit."))
        return "BodySuit";
    if (s.startsWith("pants."))
        return "Pants";
    if (s.startsWith("shoes."))
        return "Shoes";
    if (s.startsWith("sleeve."))
        return "Sleeves";
    if (s.startsWith("necklace."))
        return "Necklace";
    if (s.startsWith("scarf.") || s.startsWith("scaf."))
        return "Scarf";
    if (s.startsWith("bag."))
        return "Bag";
    if (s.startsWith("body."))
        return "Body";
    if (s.startsWith("face."))
        return "Face";
    if (s.startsWith("bowtie."))
        return "Bowtie";
    return undefined;
}
/** 기본(Null) 선택 휴리스틱 */
function pickDefaultId(slot, catalog) {
    const items = Object.values(catalog).filter(i => i.slot === slot);
    const score = (it) => {
        const s = `${it.id} ${it.name ?? ""}`.toLowerCase();
        return (s.includes("blank") || s.includes("basic") || s.includes("regular") || s.includes("default") || s.endsWith(".null")) ? 0 : 1;
    };
    return items.sort((a, b) => score(a) - score(b))[0]?.id;
}
/** 프리뷰 레이어(간단) */
function equippedToLayers(equipped, catalog) {
    const order = SLOTS;
    const layers = [];
    for (const slot of order) {
        const id = equipped[slot];
        if (!id)
            continue;
        const it = catalog[id];
        layers.push({ id: id, slot, src: it?.src, name: it?.name ?? id });
    }
    return layers;
}
/** ─ Component ─ */
export default function Wardrobe() {
    const { inv } = useMemo(() => makeServices(), []);
    const [invState, setInvState] = useState(null);
    const [catalog, setCatalog] = useState({});
    const [activeSlot, setActiveSlot] = useState("Hair");
    const [q, setQ] = useState("");
    /** 초기 로딩 */
    useEffect(() => {
        (async () => {
            try {
                const [s, catAny] = await Promise.all([inv.load(), loadWearablesCatalog()]);
                setInvState(s);
                const catMap = Array.isArray(catAny)
                    ? Object.fromEntries(catAny.map(it => [it.id, it]))
                    : catAny;
                setCatalog(catMap);
            }
            catch { /* ignore */ }
        })();
    }, [inv]);
    /** 가챠 등 변경 즉시 반영 + 탭 복귀 동기화 */
    useEffect(() => {
        let alive = true;
        const reload = async () => {
            try {
                const s = await inv.load();
                if (!alive)
                    return;
                setInvState(s);
            }
            catch { }
        };
        const onChanged = () => reload();
        const onFocus = () => reload();
        window.addEventListener("inv:changed", onChanged);
        window.addEventListener("focus", onFocus);
        return () => {
            alive = false;
            window.removeEventListener("inv:changed", onChanged);
            window.removeEventListener("focus", onFocus);
        };
    }, [inv]);
    /** 정규화 카탈로그/보유/장착 */
    const catalogByIdL = useMemo(() => {
        const m = {};
        if (Array.isArray(catalog)) {
            for (const it of catalog)
                if (it?.id)
                    m[toL(it.id)] = it;
        }
        else {
            for (const [id, it] of Object.entries(catalog))
                m[toL(id)] = it;
        }
        return m;
    }, [catalog]);
    const getItemByAnyId = (id) => catalogByIdL[toL(id)];
    const toCanonicalId = (id) => getItemByAnyId(id)?.id ?? id;
    const ownedIds = useMemo(() => {
        const raw = invState?.cosmeticsOwned ?? invState?.owned ?? [];
        return toIdArray(raw);
    }, [invState]);
    const ownedSetL = useMemo(() => new Set(ownedIds.map(toL)), [ownedIds]);
    const equipped = (invState?.equipped || {});
    /** 카탈로그+보유 머지(보유 중인데 카탈로그에 없으면 placeholder) */
    const mergedCatalogL = useMemo(() => {
        const base = { ...catalogByIdL };
        for (const idL of ownedSetL) {
            if (!base[idL]) {
                base[idL] = {
                    id: idL,
                    name: idL,
                    slot: (inferSlotFromId(idL) ?? "Clothes"),
                    rarity: "common",
                };
                console.warn("[wardrobe] owned id missing in catalog:", idL);
            }
        }
        return base;
    }, [catalogByIdL, ownedSetL]);
    /** 프리뷰 레이어: 정규 카탈로그 사용(원본 src 경로 유지) */
    const layers = useMemo(() => {
        const items = [];
        for (const slot of SLOTS) {
            const id = equipped[slot];
            if (!id)
                continue;
            const it = getItemByAnyId(id);
            items.push({
                id,
                slot,
                src: pickSrc(it),
                name: it?.name ?? id,
                z: getZ(slot, it),
            });
        }
        // 낮은 z가 먼저(아래), 높은 z가 나중(위)
        items.sort((a, b) => a.z - b.z);
        return items;
    }, [equipped, catalogByIdL]);
    /** 실제 보유한 아이템만(allItems) */
    const allItems = useMemo(() => Object.values(mergedCatalogL).filter(it => ownedSetL.has(toL(it.id))), [mergedCatalogL, ownedSetL]);
    /** 슬롯별 카운트 (보유만) */
    const countsBySlot = useMemo(() => {
        const m = new Map();
        for (const sl of SLOTS)
            m.set(sl, 0);
        for (const it of allItems) {
            m.set(it.slot, (m.get(it.slot) || 0) + 1);
        }
        return m;
    }, [allItems]);
    /** 필터(슬롯/검색/희귀도) + 보유만 */
    const [rarityFilter, setRarityFilter] = useState("all");
    const equippedId = equipped[activeSlot];
    const list = useMemo(() => {
        const rq = q.trim().toLowerCase();
        return allItems
            .filter(i => i.slot === activeSlot)
            .filter(i => (rq ? `${i.name ?? ""} ${i.id}`.toLowerCase().includes(rq) : true))
            .filter(i => (rarityFilter === "all" ? true : asRarity(i.rarity) === rarityFilter));
    }, [allItems, activeSlot, q, rarityFilter]);
    /** 장착/해제 (정규 ID로 저장) */
    async function equip(slot, itemId) {
        const nextId = itemId ? toCanonicalId(itemId) :
            (() => {
                const items = allItems.filter(i => i.slot === slot);
                const score = (it) => {
                    const s = `${it.id} ${it.name ?? ""}`.toLowerCase();
                    return (s.includes("blank") || s.includes("basic") || s.includes("regular") || s.includes("default") || s.endsWith(".null")) ? 0 : 1;
                };
                const pick = items.sort((a, b) => score(a) - score(b))[0];
                return pick ? toCanonicalId(pick.id) : undefined;
            })();
        await inv.apply({ equip: { [slot]: nextId }, reason: itemId ? "wardrobe:equip" : "wardrobe:unequip" });
        window.dispatchEvent(new CustomEvent("inv:changed"));
        setInvState(await inv.load());
    }
    return (_jsxs("div", { className: "p-6 max-w-5xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Link, { to: "/", className: "text-sm opacity-80 hover:opacity-100", children: "\u2190 \uBA54\uC778\uC73C\uB85C" }), _jsx("h2", { className: "text-2xl font-bold", children: "\uC637\uC7A5" }), _jsx("div", {})] }), _jsxs("div", { className: "mt-4 grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx("div", { className: "aspect-square rounded-xl bg-slate-900/50 border border-white/10 relative overflow-hidden", children: layers.map((L) => (_jsx("div", { className: "absolute inset-0 flex items-center justify-center", style: { zIndex: L.z }, children: L.src ? (_jsx("img", { src: normalizeSrc(L.src), alt: L.name ?? L.id, className: "max-w-full max-h-full object-contain pointer-events-none select-none", draggable: false })) : (_jsx("div", { className: "text-xs opacity-60", children: L.slot })) }, `${L.slot}:${L.id}`))) }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("div", { className: "flex flex-wrap gap-2", children: SLOTS.map((sl) => {
                                    const cnt = countsBySlot.get(sl) ?? 0;
                                    const active = sl === activeSlot;
                                    return (_jsxs("button", { onClick: () => setActiveSlot(sl), className: `px-3 py-2 rounded-lg border ${active ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 bg-white/5"} `, title: `${SLOT_LABEL[sl]} (${cnt})`, children: [SLOT_LABEL[sl], " ", _jsxs("span", { className: "opacity-60 text-xs", children: ["(", cnt, ")"] })] }, sl));
                                }) }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsxs("button", { className: "px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40", disabled: !equippedId, onClick: () => equip(activeSlot, undefined), title: "\uD574\uC81C\uD558\uACE0 \uAE30\uBCF8 \uC0C1\uD0DC\uB85C", children: [SLOT_LABEL[activeSlot], " \uD574\uC81C"] }), _jsx("input", { className: "px-3 py-2 rounded bg-slate-800 flex-1", placeholder: "\uC544\uC774\uD15C \uAC80\uC0C9 (\uC774\uB984/ID)", value: q, onChange: (e) => setQ(e.target.value) }), _jsxs("select", { className: "px-3 py-2 rounded bg-slate-800", value: rarityFilter, onChange: (e) => setRarityFilter(e.target.value), title: "\uD76C\uADC0\uB3C4 \uD544\uD130", children: [_jsx("option", { value: "all", children: "\uC804\uCCB4" }), _jsx("option", { value: "common", children: "\uC77C\uBC18" }), _jsx("option", { value: "uncommon", children: "\uACE0\uAE09" }), _jsx("option", { value: "rare", children: "\uD76C\uADC0" }), _jsx("option", { value: "epic", children: "\uC601\uC6C5" }), _jsx("option", { value: "legendary", children: "\uC804\uC124" }), _jsx("option", { value: "mythic", children: "\uC2E0\uD654" })] })] }), _jsxs("div", { className: "mt-2 text-sm opacity-80", children: ["\uD604\uC7AC ", SLOT_LABEL[activeSlot], ": ", _jsx("b", { children: equippedId ?? "없음(기본)" })] })] })] }), _jsx("div", { className: "mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3", children: list.map((i) => {
                    const selected = equippedId === i.id;
                    const r = asRarity(i.rarity);
                    return (_jsxs("button", { onClick: () => equip(activeSlot, i.id), className: `group text-left border rounded-xl p-2 hover:border-emerald-500 transition
                ${selected ? "border-emerald-500 bg-emerald-500/10" : rarityRing[r] + " bg-white/5"}`, title: i.id, children: [_jsxs("div", { className: "w-full aspect-square rounded-lg overflow-hidden bg-white/5 grid place-items-center relative", children: [(() => {
                                        const full = getItemByAnyId(i.id) ?? i; // 카탈로그 원본 우선
                                        const src = pickSrc(full);
                                        return src ? (_jsx("img", { src: src, alt: full.name ?? i.id, className: "max-w-full max-h-full object-contain pointer-events-none", loading: "lazy" })) : (_jsx("span", { className: "text-xs opacity-60", children: "\uC774\uBBF8\uC9C0 \uC5C6\uC74C" }));
                                    })(), selected && (_jsx("span", { className: "absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/80 text-white", children: "\uC7A5\uCC29\uC911" }))] }), _jsxs("div", { className: "mt-2 text-xs", children: [_jsx("div", { className: "font-medium truncate", children: i.name ?? i.id }), _jsx("div", { className: "opacity-60", children: SLOT_LABEL[i.slot] ?? i.slot }), _jsx("div", { className: "mt-1 opacity-60", children: rarityLabel[r] })] })] }, i.id));
                }) })] }));
}
