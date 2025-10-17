import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// apps/student/src/pages/Result.tsx
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { newRunToken, resetLocalRunState, ensureRunToken, finishDungeon } from '../api';
import { initQueue, enqueue } from '../shared/lib/queue';
export default function Result() {
    const nav = useNavigate();
    // 오프라인 재시도 큐 가동
    useEffect(() => { initQueue(finishDungeon); }, []);
    async function restart() {
        await newRunToken();
        resetLocalRunState();
        nav('/play', { replace: true });
    }
    function goHome() {
        resetLocalRunState();
        nav('/', { replace: true });
    }
    // 저장된 결과 읽기 — 객체/배열 모두 허용
    const raw = localStorage.getItem('qd:lastResult');
    const parsed = useMemo(() => (raw ? JSON.parse(raw) : null), [raw]);
    // 호환: 배열(턴 로그)로 저장된 옛 포맷도 요약으로 변환
    const data = useMemo(() => {
        if (!parsed)
            return null;
        if (Array.isArray(parsed)) {
            const turns = parsed;
            const total = turns.length || 0;
            const correct = turns.filter((t) => t?.correct).length;
            const cleared = correct >= Math.ceil(Math.max(1, total) * 0.6);
            const durationSec = Number(localStorage.getItem('qd:lastDurationSec') || '0') || 0;
            return { cleared, turns: total, durationSec };
        }
        // 객체 포맷
        const { cleared, turns, durationSec } = parsed;
        if (typeof turns === 'number') {
            return {
                cleared: Boolean(cleared),
                turns: Math.max(0, turns | 0),
                durationSec: Math.max(0, Number(durationSec) || 0),
            };
        }
        return null;
    }, [parsed]);
    const [resp, setResp] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    async function submit() {
        if (!data || submitting)
            return;
        setSubmitting(true);
        let runToken;
        try {
            runToken = await ensureRunToken();
        }
        catch (e) {
            console.error('enter_dungeon failed', e);
            setSubmitting(false);
            alert('던전 입장 토큰 발급 실패: 서버 연결을 확인해주세요.');
            return;
        }
        const summary = { ...data, runToken, finalHash: '' };
        try {
            const r = await finishDungeon(summary);
            setResp(r);
        }
        catch (e) {
            enqueue(summary);
            console.error('finish_dungeon failed', e);
            alert('오프라인/오류: 네트워크 복구 시 자동 재시도합니다.');
        }
        finally {
            setTimeout(() => setSubmitting(false), 1200);
        }
    }
    async function resubmitSameToken() {
        if (!data || submitting)
            return;
        const runToken = localStorage.getItem('qd:runToken');
        if (!runToken) {
            alert('runToken이 없어 재제출을 할 수 없어요. 먼저 "제출"을 한 번 눌러주세요.');
            return;
        }
        setSubmitting(true);
        const summary = { ...data, runToken, finalHash: '' };
        try {
            const r = await finishDungeon(summary);
            setResp(r);
        }
        catch (e) {
            enqueue(summary);
            console.error('resubmit failed', e);
            alert('오프라인/오류: 네트워크 복구 시 자동 재시도합니다.');
        }
        finally {
            setTimeout(() => setSubmitting(false), 800);
        }
    }
    if (!data)
        return _jsx("div", { className: "p-6", children: "\uAE30\uB85D\uC774 \uC5C6\uC5B4\uC694." });
    return (_jsxs("div", { className: "p-6 max-w-xl mx-auto space-y-4", children: [_jsx("h2", { className: "text-2xl font-bold", children: "\uACB0\uACFC" }), _jsxs("div", { className: "p-4 bg-slate-800 rounded space-y-2", children: [_jsxs("div", { children: ["\uD074\uB9AC\uC5B4: ", data.cleared ? '성공' : '실패'] }), _jsxs("div", { children: ["\uD134 \uC218: ", data.turns] }), _jsxs("div", { children: ["\uC18C\uC694 \uC2DC\uAC04(\uCD08): ", data.durationSec] }), _jsxs("div", { className: "pt-2 flex gap-2", children: [_jsx("button", { disabled: submitting, onClick: submit, className: `px-3 py-2 rounded ${submitting ? 'opacity-50 cursor-not-allowed bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-500'}`, children: submitting ? '처리 중…' : '제출' }), _jsx("button", { disabled: submitting, onClick: resubmitSameToken, className: "px-3 py-2 rounded bg-slate-700 hover:bg-slate-600", children: "\uC7AC\uC81C\uCD9C \uD14C\uC2A4\uD2B8" })] }), resp && (_jsxs("div", { className: `mt-2 inline-flex items-center gap-2 px-2 py-1 rounded text-sm ${resp.idempotent ? 'bg-slate-700' : 'bg-emerald-700'}`, children: [_jsx("span", { className: "font-semibold", children: resp.idempotent ? '이미 제출됨(멱등 처리)' : '제출 완료' }), _jsxs("span", { className: "opacity-80", children: ["idempotent=", _jsx("b", { children: String(resp.idempotent) })] })] }))] }), _jsxs("div", { className: "mt-6 flex gap-3", children: [_jsx("button", { className: "px-4 py-2 bg-emerald-600 rounded", onClick: restart, children: "\uB2E4\uC2DC\uD558\uAE30" }), _jsx("button", { className: "px-4 py-2 bg-slate-700 rounded", onClick: goHome, children: "\uBA54\uC778" })] })] }));
}
