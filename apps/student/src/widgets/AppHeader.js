import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { AvatarRenderer } from '../shared/ui/AvatarRenderer';
import { makeServices } from '../core/service.locator';
import { loadWearablesCatalog } from '../core/wearable.catalog';
import { onInventoryChanged } from '../core/inv.bus';
import { preloadImages } from '../shared/ui/preload'; // 프리로드 유틸
const SLOTS = ['Body', 'BodySuit', 'Pants', 'Shoes', 'Clothes', 'Sleeves', 'Bag', 'Necklace', 'Scarf', 'Bowtie', 'Face', 'Hair', 'Hat'];
const toL = (s) => (s ?? '').toLowerCase();
const __prefix = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const normalizeSrc = (src) => {
    if (!src)
        return undefined;
    if (/^https?:\/\//i.test(src))
        return src;
    return src.startsWith('/') ? `${__prefix}${src}` : `${__prefix}/${src}`;
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
    (typeof it?.file === 'string' ? it.file : undefined) ??
    (typeof it?.url === 'string' ? it.url : undefined));
// equipped만으로 레이어 계산(절대 카탈로그 전체로 확장 금지)
function toLayers(equipped, catalog) {
    const layers = [];
    const Z_BY_SLOT = {
        Body: 0, BodySuit: 5, Pants: 10, Shoes: 15, Clothes: 20, Sleeves: 25,
        Bag: 30, Necklace: 40, Scarf: 45, Bowtie: 50, Face: 55, Hair: 60, Hat: 70,
    };
    const getZ = (slot, it) => Number.isFinite(it?.layer ?? it?.z) ? Number(it?.layer ?? it?.z) : (Z_BY_SLOT[slot] ?? 0);
    for (const slot of SLOTS) {
        const id = equipped[slot];
        if (!id)
            continue;
        const it = catalog[id] ?? catalog[toL(id)];
        layers.push({
            id,
            slot,
            src: pickSrc(it) ?? '',
            name: it?.name ?? id,
            z: getZ(slot, it),
        });
    }
    // 낮은 z 아래, 높은 z 위
    layers.sort((a, b) => a.z - b.z);
    return layers;
}
// ── 컴포넌트 ─────────────────────────────────────
export default function AppHeader() {
    const { inv } = useMemo(() => makeServices(), []);
    const [equipped, setEquipped] = useState({});
    const [catalog, setCatalog] = useState({});
    const [ready, setReady] = useState(false);
    // 초기 로드
    useEffect(() => {
        (async () => {
            try {
                const [s, catAny] = await Promise.all([inv.load(), loadWearablesCatalog()]);
                // 카탈로그: 배열/맵 모두 대응
                const catMap = Array.isArray(catAny)
                    ? Object.fromEntries(catAny.map(it => [it.id, it]))
                    : catAny;
                setEquipped((s.equipped || {}));
                setCatalog(catMap);
            }
            finally {
                setReady(true);
            }
        })();
    }, [inv]);
    // 인벤 변경 반영
    useEffect(() => {
        const off = onInventoryChanged(async () => {
            const [s, catAny] = await Promise.all([inv.load(), loadWearablesCatalog()]);
            const catMap = Array.isArray(catAny)
                ? Object.fromEntries(catAny.map(it => [it.id, it]))
                : catAny;
            setEquipped((s.equipped || {}));
            setCatalog(catMap);
        });
        return off;
    }, [inv]);
    // 장착 데이터가 실제로 존재할 때만 레이어 계산/프리로드
    const hasEquip = useMemo(() => Object.values(equipped || {}).some(Boolean), [equipped]);
    const layers = useMemo(() => (hasEquip ? toLayers(equipped, catalog) : []), [hasEquip, equipped, catalog]);
    // 프리로드: 장착된 레이어 src만, 중복 제거
    useEffect(() => {
        if (!hasEquip)
            return; // ☜ 첫 진입에 장착이 준비되기 전에 전체 프리로드 방지
        const srcs = Array.from(new Set(layers.map(l => l.src).filter(Boolean)));
        if (srcs.length)
            preloadImages(srcs);
    }, [hasEquip, layers]);
    return (_jsxs("header", { className: "w-full px-4 py-3 flex items-center gap-3 bg-slate-900/60", children: [_jsx("div", { className: "shrink-0", children: ready && hasEquip ? (_jsx(AvatarRenderer, { layers: layers, size: 120, corsMode: "none" })) : (_jsx("div", { style: { width: 120, height: 120 } })) }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-lg font-semibold", children: "\uC624\uB298\uC758 \uB358\uC804" }), _jsx("div", { className: "text-sm opacity-70", children: "\uB0B4 \uC544\uBC14\uD0C0" })] })] }));
}
