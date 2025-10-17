import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// apps/student/src/pages/Codex.tsx
import { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import { loadCosmeticsPack } from '../core/packs';
export default function Codex() {
    const { inv } = useMemo(() => makeServices(), []);
    const [s, setS] = useState(null);
    const [defs, setDefs] = useState([]);
    useEffect(() => { inv.load().then(setS); loadCosmeticsPack().then(p => setDefs(p.cosmetics)); }, []);
    if (!s)
        return _jsx("div", { className: "p-6", children: "\uB85C\uB529\u2026" });
    return (_jsxs("div", { className: "p-6 max-w-3xl mx-auto", children: [_jsx("h2", { className: "text-2xl font-bold", children: "\uB3C4\uAC10" }), _jsx("div", { className: "mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2", children: defs.map(c => {
                    const owned = !!s.cosmeticsOwned[c.id];
                    return (_jsxs("div", { className: `p-3 rounded border ${owned ? 'opacity-100' : 'opacity-50'}`, children: [_jsx("div", { className: "text-sm", children: c.name }), _jsx("div", { className: "text-xs opacity-80", children: c.type }), _jsx("div", { className: "text-xs mt-1", children: owned ? '보유' : '미보유' })] }, c.id));
                }) })] }));
}
