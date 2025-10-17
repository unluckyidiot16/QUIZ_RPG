import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { sb } from '../core/sb';
import QRCode from 'qrcode';
const STUDENT_BASE = import.meta.env?.VITE_STUDENT_BASE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
export default function AdminTokens() {
    const [count, setCount] = useState(12);
    const [ttlMin, setTtlMin] = useState(120); // 만료(분)
    const [prefix, setPrefix] = useState('3반-'); // 레이블 프리픽스
    const [rows, setRows] = useState([]);
    const baseUrl = useMemo(() => {
        const base = (STUDENT_BASE || '').replace(/\/+$/, '');
        return `${base}/token`;
    }, []);
    const issue = async () => {
        const expires = new Date(Date.now() + ttlMin * 60000).toISOString();
        const { data, error } = await sb.rpc('issue_qr_tokens', {
            p_class_id: null,
            p_count: count,
            p_expires_at: expires,
            p_note: prefix
        });
        if (error) {
            alert(error.message);
            return;
        }
        const out = [];
        for (let i = 0; i < data.length; i++) {
            const tok = data[i];
            const label = `${prefix}${String(i + 1).padStart(2, '0')}`;
            const url = `${baseUrl}/${tok.id}`; // ← 학생앱 도메인으로 고정됨
            const qr = await QRCode.toDataURL(url, { margin: 1, scale: 6 });
            out.push({ id: tok.id, status: tok.status, expires_at: tok.expires_at, url, label, qr });
        }
        setRows(out);
    };
    const revoke = async (id) => {
        const { error } = await sb.rpc('revoke_qr_token', { p_token_id: id });
        if (error) {
            alert(error.message);
            return;
        }
        setRows(r => r.map(x => x.id === id ? { ...x, status: 'revoked' } : x));
    };
    const downloadPng = (row) => {
        const a = document.createElement('a');
        a.href = row.qr;
        a.download = `${row.label}.png`;
        a.click();
    };
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "QR \uC811\uC18D \uD1A0\uD070 \uBC1C\uAE09" }), _jsxs("div", { className: "flex gap-4 items-end", children: [_jsxs("label", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm", children: "\uAC1C\uC218" }), _jsx("input", { type: "number", min: 1, max: 2000, value: count, onChange: e => setCount(parseInt(e.target.value || '1')), className: "border rounded px-2 py-1 w-28" })] }), _jsxs("label", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm", children: "\uB9CC\uB8CC(\uBD84)" }), _jsx("input", { type: "number", min: 5, value: ttlMin, onChange: e => setTtlMin(parseInt(e.target.value || '5')), className: "border rounded px-2 py-1 w-28" })] }), _jsxs("label", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm", children: "\uB808\uC774\uBE14 \uC811\uB450\uC0AC" }), _jsx("input", { value: prefix, onChange: e => setPrefix(e.target.value), className: "border rounded px-2 py-1 w-40" })] }), _jsx("button", { onClick: issue, className: "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700", children: "\uBC1C\uAE09" })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5", children: rows.map(row => (_jsxs("div", { className: "border rounded-lg p-3 flex flex-col", children: [_jsx("img", { src: row.qr, alt: row.label, className: "w-full aspect-square object-contain bg-white rounded" }), _jsxs("div", { className: "mt-2 flex items-center justify-between", children: [_jsx("span", { className: "font-medium", children: row.label }), _jsx("span", { className: `text-xs px-2 py-0.5 rounded ${row.status === 'issued' ? 'bg-green-100 text-green-700'
                                        : row.status === 'used' ? 'bg-gray-100 text-gray-700'
                                            : 'bg-red-100 text-red-700'}`, children: row.status })] }), _jsx("a", { href: row.url, target: "_blank", className: "text-xs text-blue-700 underline break-all", children: row.url }), _jsxs("div", { className: "text-xs text-gray-500 mt-1", children: ["\uB9CC\uB8CC: ", new Date(row.expires_at).toLocaleString()] }), _jsxs("div", { className: "mt-2 flex gap-2", children: [_jsx("button", { onClick: () => downloadPng(row), className: "px-2 py-1 border rounded", children: "PNG \uC800\uC7A5" }), _jsx("button", { onClick: () => revoke(row.id), disabled: row.status !== 'issued', className: "px-2 py-1 border rounded disabled:opacity-50", children: "\uD68C\uC218" })] })] }, row.id))) })] }));
}
