import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { sb } from '../core/sb';
export default function AccessControl() {
    const [maint, setMaint] = useState(false);
    const [msg, setMsg] = useState('서버 점검 중입니다.');
    const [userId, setUserId] = useState('');
    const [status, setStatus] = useState('active');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [reason, setReason] = useState('수업 시간 외 접속 제한');
    const applyMaintenance = async () => {
        const { error } = await sb.rpc('set_maintenance', { p_on: maint, p_message: msg, p_until: null });
        if (error)
            alert(error.message);
        else
            alert('적용됨');
    };
    const applyRule = async () => {
        const { error } = await sb.rpc('set_account_access_rule', {
            p_user_id: userId || null,
            p_status: status,
            p_window_start: start || null,
            p_window_end: end || null,
            p_reason: reason || null
        });
        if (error)
            alert(error.message);
        else
            alert('적용됨');
    };
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "\uC811\uC18D \uC81C\uC5B4" }), _jsxs("section", { className: "border rounded p-4", children: [_jsx("h2", { className: "font-semibold", children: "\uC810\uAC80 \uBAA8\uB4DC" }), _jsxs("label", { className: "flex items-center gap-2 mt-2", children: [_jsx("input", { type: "checkbox", checked: maint, onChange: e => setMaint(e.target.checked) }), _jsx("span", { children: "\uC810\uAC80 \uD65C\uC131\uD654" })] }), _jsx("input", { className: "border rounded px-2 py-1 mt-2 w-full", value: msg, onChange: e => setMsg(e.target.value) }), _jsx("button", { className: "mt-3 bg-blue-600 text-white px-4 py-2 rounded", onClick: applyMaintenance, children: "\uC801\uC6A9" })] }), _jsxs("section", { className: "border rounded p-4", children: [_jsx("h2", { className: "font-semibold", children: "\uD559\uC0DD\uBCC4 \uCC28\uB2E8/\uC2DC\uAC04\uCC3D" }), _jsx("input", { className: "border rounded px-2 py-1 w-full", placeholder: "user_id(UUID)", value: userId, onChange: e => setUserId(e.target.value) }), _jsxs("div", { className: "mt-2 flex gap-3 items-center", children: [_jsxs("select", { className: "border rounded px-2 py-1", value: status, onChange: e => setStatus(e.target.value), children: [_jsx("option", { value: "active", children: "\uD5C8\uC6A9" }), _jsx("option", { value: "blocked", children: "\uCC28\uB2E8" })] }), _jsx("input", { className: "border rounded px-2 py-1", type: "datetime-local", value: start, onChange: e => setStart(e.target.value) }), _jsx("span", { children: "~" }), _jsx("input", { className: "border rounded px-2 py-1", type: "datetime-local", value: end, onChange: e => setEnd(e.target.value) })] }), _jsx("input", { className: "border rounded px-2 py-1 mt-2 w-full", placeholder: "\uC0AC\uC720", value: reason, onChange: e => setReason(e.target.value) }), _jsx("button", { className: "mt-3 bg-blue-600 text-white px-4 py-2 rounded", onClick: applyRule, children: "\uC801\uC6A9" })] })] }));
}
