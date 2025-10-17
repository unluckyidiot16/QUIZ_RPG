import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { sb } from '../core/sb';
export default function Login() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    async function send() {
        await sb.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: window.location.origin } // ← 현재 도메인으로 귀환
        });
        setSent(true);
    }
    return (_jsxs("div", { className: "p-6 max-w-sm mx-auto space-y-3", children: [_jsx("h1", { className: "text-xl font-bold", children: "Admin \uB85C\uADF8\uC778" }), _jsx("input", { className: "w-full p-2 rounded bg-slate-800", placeholder: "you@school.edu", value: email, onChange: e => setEmail(e.target.value) }), _jsx("button", { onClick: send, className: "px-3 py-2 rounded bg-emerald-600", children: "\uBA54\uC77C\uB85C \uB85C\uADF8\uC778 \uB9C1\uD06C \uBC1B\uAE30" }), sent && _jsx("div", { className: "text-sm opacity-80", children: "\uBA54\uC77C\uC744 \uD655\uC778\uD558\uC138\uC694. (\uAC19\uC740 \uBE0C\uB77C\uC6B0\uC800\uB85C \uC5F4\uAE30)" })] }));
}
