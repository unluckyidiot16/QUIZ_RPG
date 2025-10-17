import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// apps/student/src/pages/Inventory.tsx
import { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
export default function Inventory() {
    const { inv } = useMemo(() => makeServices(), []);
    const [s, setS] = useState(null);
    useEffect(() => { inv.load().then(setS); }, []);
    if (!s)
        return _jsx("div", { className: "p-6", children: "\uB85C\uB529\u2026" });
    return (_jsxs("div", { className: "p-6 max-w-xl mx-auto", children: [_jsx("h2", { className: "text-2xl font-bold", children: "\uC778\uBCA4\uD1A0\uB9AC" }), _jsxs("div", { className: "mt-2", children: ["\uCF54\uC778: ", _jsx("b", { children: s.coins })] }), _jsx("h3", { className: "mt-4 font-semibold", children: "\uC544\uC774\uD15C" }), _jsxs("ul", { className: "mt-2 space-y-1", children: [Object.entries(s.items).map(([id, c]) => (_jsxs("li", { className: "text-sm", children: [id, ": ", c] }, id))), Object.keys(s.items).length === 0 && _jsx("li", { className: "text-sm opacity-70", children: "\uC5C6\uC74C" })] }), _jsx("h3", { className: "mt-4 font-semibold", children: "\uCF54\uC2A4\uBA54\uD2F1 \uBCF4\uC720" }), _jsxs("ul", { className: "mt-2 space-y-1", children: [Object.keys(s.cosmeticsOwned).map(id => (_jsx("li", { className: "text-sm", children: id }, id))), Object.keys(s.cosmeticsOwned).length === 0 && _jsx("li", { className: "text-sm opacity-70", children: "\uC5C6\uC74C" })] })] }));
}
