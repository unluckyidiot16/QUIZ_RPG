import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { sb } from '../core/sb';
export default function Runs() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    async function load() {
        setLoading(true);
        setErr(null);
        const { data, error } = await sb.rpc('admin_list_recent_runs', {
            p_limit: 50, p_only_open: false, p_only_closed: false, p_since: null
        });
        if (error) {
            setErr(error.message);
            setLoading(false);
            return;
        }
        setRows(data);
        setLoading(false);
    }
    useEffect(() => { load(); }, []);
    if (loading)
        return _jsx("div", { className: "p-4", children: "\uB85C\uB529\u2026" });
    if (err)
        return _jsxs("div", { className: "p-4 text-rose-400", children: ["\uC624\uB958: ", err] });
    return (_jsxs("div", { className: "p-4", children: [_jsx("h1", { className: "text-xl font-bold mb-3", children: "\uCD5C\uADFC \uB7F0(\uCD5C\uADFC 50)" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-[720px] text-sm", children: [_jsx("thead", { className: "text-left opacity-80", children: _jsxs("tr", { children: [_jsx("th", { className: "px-2 py-1", children: "\uC2DC\uAC04" }), _jsx("th", { className: "px-2 py-1", children: "\uC720\uC800" }), _jsx("th", { className: "px-2 py-1", children: "\uACB0\uACFC" }), _jsx("th", { className: "px-2 py-1", children: "\uD134" }), _jsx("th", { className: "px-2 py-1", children: "\uC18C\uC694(\uCD08)" }), _jsx("th", { className: "px-2 py-1", children: "\uB9C8\uAC10" }), _jsx("th", { className: "px-2 py-1", children: "\uC9C0\uAC11" })] }) }), _jsx("tbody", { children: rows.map(r => (_jsxs("tr", { className: "border-t border-slate-800", children: [_jsx("td", { className: "px-2 py-1", children: new Date(r.created_at).toLocaleString() }), _jsxs("td", { className: "px-2 py-1", children: [r.nickname.slice(0, 24), _jsxs("div", { className: "opacity-60", children: [r.user_id.slice(0, 8), "\u2026"] })] }), _jsx("td", { className: "px-2 py-1", children: r.cleared ? '성공' : '실패' }), _jsx("td", { className: "px-2 py-1", children: r.turns }), _jsx("td", { className: "px-2 py-1", children: r.duration_sec }), _jsx("td", { className: "px-2 py-1", children: r.closed_at ? '마감' : _jsx("span", { className: "px-2 py-0.5 rounded bg-amber-700", children: "\uC9C4\uD589\uC911" }) }), _jsxs("td", { className: "px-2 py-1", children: [(r.coins ?? 0), "/", (r.stars ?? 0), "\u2B50"] })] }, r.run_id))) })] }) }), _jsx("button", { onClick: load, className: "mt-3 px-3 py-2 rounded bg-slate-700", children: "\uC0C8\uB85C\uACE0\uCE68" })] }));
}
