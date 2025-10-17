import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { bootstrapFromToken } from './useConsumeToken';
export default function TokenGatePage() {
    const [s, setS] = React.useState({ loading: true, gate: '', message: '' });
    React.useEffect(() => {
        (async () => {
            const res = await bootstrapFromToken();
            if (res.gate === 'ok') {
                location.replace('/home');
            }
            else {
                setS({ loading: false, gate: res.gate, message: res.message });
            }
        })();
    }, []);
    if (s.loading)
        return _jsx("div", { className: "p-6", children: "\uC811\uC18D \uD655\uC778 \uC911\u2026" });
    const title = s.gate === 'maintenance' ? '서버 점검 중' :
        s.gate === 'blocked' ? '접속 차단됨' :
            s.gate === 'out_of_window' ? '접속 가능 시간이 아님' :
                '알 수 없는 상태';
    return (_jsxs("div", { className: "m-6 rounded-xl border p-5 bg-yellow-50", children: [_jsx("h2", { className: "font-bold text-lg", children: title }), _jsx("p", { className: "text-sm mt-1", children: s.message || '관리자에게 문의하세요.' }), _jsxs("div", { className: "mt-3 flex gap-3", children: [_jsx("a", { className: "underline", href: "/", children: "\uBA54\uC778\uC73C\uB85C" }), _jsx("button", { className: "underline", onClick: () => location.reload(), children: "\uB2E4\uC2DC \uC2DC\uB3C4" })] })] }));
}
