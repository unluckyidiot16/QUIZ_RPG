import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// apps/student/src/pages/Gacha.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { makeServices } from '../core/service.locator';
import { loadGachaPool } from '../core/packs';
import { loadWearablesCatalog } from '../core/wearable.catalog';
import { newIdempotencyKey } from '../shared/lib/idempotency';
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
export default function Gacha() {
    const { inv, gacha } = useMemo(() => makeServices(), []);
    const [pool, setPool] = useState(null);
    const [coins, setCoins] = useState(0);
    const [err, setErr] = useState(null);
    const [cat, setCat] = useState({});
    const catL = useMemo(() => {
        const m = {};
        if (Array.isArray(cat)) {
            for (const it of cat)
                if (it?.id)
                    m[it.id.toLowerCase()] = it;
        }
        else {
            for (const [id, it] of Object.entries(cat))
                m[id.toLowerCase()] = it;
        }
        return m;
    }, [cat]);
    const toCanonicalId = (id) => (cat[id] ?? catL[id.toLowerCase()] ?? { id }).id;
    const [results, setResults] = useState([]); // 최근 획득 아이템 id[]
    useEffect(() => {
        (async () => {
            const s = await inv.load();
            setCoins(s.coins);
            try {
                setPool(await loadGachaPool());
            }
            catch { }
            try {
                setCat(await loadWearablesCatalog());
            }
            catch { }
        })();
    }, []);
    async function draw(n) {
        if (!pool)
            return;
        setErr(null);
        try {
            const res = await gacha.open(pool, n, { idempotencyKey: newIdempotencyKey('gacha') });
            // ⬇️ 핵심: 소유 인벤토리에 '획득' 반영 (중복은 내부에서 무시되도록 설계)
            const fixed = res.results.map(toCanonicalId);
            await inv.apply({ cosmeticsAdd: fixed, reason: 'gacha:open' });
            // 코인 최신화
            const s = await inv.load();
            setCoins(s.coins);
            // 결과 카드 그리드 표시
            setResults(prev => [...fixed, ...prev].slice(0, 50));
            // 옷장 등에서 즉시 반영되도록 이벤트 브로드캐스트(간단 버스)
            window.dispatchEvent(new CustomEvent('inv:changed'));
        }
        catch (e) {
            setErr(e?.message ?? '가챠 실패');
        }
    }
    return (_jsxs("div", { className: "p-6 max-w-xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Link, { to: "/", className: "text-sm opacity-80 hover:opacity-100", children: "\u2190 \uBA54\uC778\uC73C\uB85C" }), _jsx(Link, { to: "/wardrobe", className: "text-sm opacity-80 hover:opacity-100", children: "\uC637\uC7A5\uC73C\uB85C \u2192" })] }), _jsx("h2", { className: "mt-2 text-2xl font-bold", children: "\uAC00\uCC60" }), _jsxs("div", { className: "mt-1 text-sm opacity-80", children: ["\uBCF4\uC720 \uCF54\uC778: ", _jsx("b", { children: coins })] }), err && _jsx("div", { className: "mt-2 text-red-400 text-sm", children: err }), _jsxs("div", { className: "mt-4 flex gap-3", children: [_jsx("button", { className: "px-3 py-2 bg-slate-700 rounded", onClick: () => draw(1), children: "1\uD68C" }), _jsx("button", { className: "px-3 py-2 bg-slate-700 rounded", onClick: () => draw(10), children: "10\uD68C" }), _jsx("button", { className: "ml-auto px-3 py-2 bg-emerald-700 rounded", onClick: async () => {
                            await inv.apply({ coinDelta: +100, reason: 'dev:grant' });
                            setCoins((await inv.load()).coins);
                        }, children: "+100 \uCF54\uC778(DEV)" })] }), _jsx("div", { className: "mt-6 grid grid-cols-3 gap-3", children: results.map((id, i) => {
                    const it = cat[id] ?? catL[id.toLowerCase()];
                    const src = pickSrc(it); // ← 다양한 키(src/image/renderSrc/thumbnail...) + BASE_URL 보정
                    return (_jsxs("div", { className: "border border-white/10 rounded-xl p-2 flex flex-col items-center", children: [_jsx("div", { className: "w-20 h-20 bg-white/5 rounded-lg overflow-hidden flex items-center justify-center", children: src
                                    ? _jsx("img", { src: src, alt: it?.name ?? id, className: "w-full h-full object-contain" })
                                    : _jsx("span", { className: "text-xs opacity-60", children: "\uC774\uBBF8\uC9C0 \uC5C6\uC74C" }) }), _jsxs("div", { className: "mt-2 text-xs text-center leading-tight", children: [_jsx("div", { className: "font-medium", children: it?.name ?? id }), it?.slot && _jsx("div", { className: "opacity-60", children: it.slot })] })] }, i));
                }) }), _jsx("div", { className: "mt-6 flex justify-end gap-3", children: _jsx(Link, { to: "/wardrobe", className: "px-3 py-2 bg-indigo-700 rounded", children: "\uC637\uC7A5\uC5D0\uC11C \uD655\uC778" }) })] }));
}
