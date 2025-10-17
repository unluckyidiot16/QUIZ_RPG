import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// apps/student/src/pages/Play.tsx
// 전투 씬: QR 토큰 로그인 → 런 발급 → 팩 로드/정규화 → 진행/기록 → 결과 저장(로컬) → /result
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// ⚠️ Result.tsx가 '../api'를 쓰고 있으니 여기도 동일 경로로 맞춰 드롭 인
import * as api from '../api';
function usePackParam() {
    const qs = new URLSearchParams(location.search);
    return qs.get('pack') || 'sample';
}
function normalizeAnswerKey(answerKey, answer, correctIndex) {
    if (typeof answerKey === 'string' && /^[ABCD]$/.test(answerKey))
        return answerKey;
    if (typeof answer === 'string' && /^[ABCD]$/.test(answer))
        return answer;
    const idx = (typeof correctIndex === 'number' ? correctIndex
        : typeof answer === 'number' ? answer
            : typeof answerKey === 'number' ? answerKey
                : -1);
    if (idx >= 0 && idx <= 3)
        return ['A', 'B', 'C', 'D'][idx];
    return null;
}
function normalizeQuestion(raw, i) {
    if (!raw)
        return null;
    // 1) 표준 {stem, choices[], answerKey}
    if (raw.stem && Array.isArray(raw.choices)) {
        const arr = raw.choices;
        const normChoices = arr.slice(0, 4).map((t, idx) => ({
            key: ['A', 'B', 'C', 'D'][idx],
            text: typeof t === 'string' ? t : t?.text ?? String(t)
        }));
        const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
        if (!ans)
            return null;
        return { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans, explanation: raw.explanation };
    }
    // 2) {stem, options[]}
    if (raw.stem && Array.isArray(raw.options)) {
        const normChoices = raw.options.slice(0, 4).map((t, idx) => ({
            key: ['A', 'B', 'C', 'D'][idx],
            text: typeof t === 'string' ? t : t?.text ?? String(t)
        }));
        const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
        if (!ans)
            return null;
        return { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans };
    }
    // 3) {stem, A/B/C/D}
    if (raw.stem && (raw.A || raw.B || raw.C || raw.D)) {
        const keys = ['A', 'B', 'C', 'D'];
        const normChoices = keys.filter(k => raw[k] != null).map((k) => ({ key: k, text: String(raw[k]) }));
        const ans = normalizeAnswerKey(raw.answerKey, raw.answer, raw.correctIndex);
        if (!ans)
            return null;
        return { id: String(raw.id ?? i), stem: String(raw.stem), choices: normChoices, answerKey: ans };
    }
    return null;
}
export default function Play() {
    const pack = usePackParam();
    const nav = useNavigate();
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('로딩 중…');
    const [questions, setQuestions] = useState([]);
    const [idx, setIdx] = useState(0);
    const q = questions[idx] || null;
    const turnsRef = useRef([]);
    const startedRef = useRef(false);
    const startAtRef = useRef(0);
    const proofRef = useRef(null); // 동적 import 대응
    // 1) QR 토큰 로그인 → 런 발급 → Proof 로깅 준비
    useEffect(() => {
        if (startedRef.current)
            return;
        startedRef.current = true;
        (async () => {
            try {
                const qs = new URLSearchParams(location.search);
                const t = qs.get('t');
                if (t && typeof api.guestLogin === 'function') {
                    await api.guestLogin(t);
                }
                const ensure = api.ensureRunToken || api.newRunToken || api.enterDungeon;
                if (typeof ensure === 'function')
                    await ensure();
                // Proof (있으면 사용, 없어도 진행)
                try {
                    const mod = await import('../shared/lib/proof');
                    const ProofCtor = mod?.Proof ?? mod?.default;
                    const runId = localStorage.getItem('qd:runToken');
                    proofRef.current = runId ? new ProofCtor(runId) : new ProofCtor();
                    await proofRef.current?.log?.({ type: 'session_start', pack });
                }
                catch { }
                // 새 세션 초기화
                turnsRef.current = [];
                startAtRef.current = Date.now();
                setMsg('준비 완료!');
            }
            catch (e) {
                console.warn('Play init failed', e);
                setMsg(e?.message ?? '접속 권한이 없거나 만료되었습니다.');
            }
            finally {
                setLoading(false);
            }
        })();
    }, [pack]);
    // 2) 팩 로드(+정규화)
    useEffect(() => {
        const ac = new AbortController();
        (async () => {
            try {
                setLoading(true);
                const url = new URL(`packs/${pack}.json`, location.origin).toString();
                const res = await fetch(url, { cache: 'no-store', signal: ac.signal });
                let rawList = [];
                if (res.ok)
                    rawList = await res.json();
                else
                    rawList = [{ id: 'sample-1', stem: '샘플 문항입니다. A를 선택하세요.', choices: ['A', 'B', 'C', 'D'], answerKey: 'A' }];
                const arr = Array.isArray(rawList)
                    ? rawList
                    : (rawList?.questions ?? rawList?.items ?? rawList?.data?.questions ?? []);
                const clean = [];
                const invalids = [];
                arr.forEach((raw, i) => {
                    const nq = normalizeQuestion(raw, i);
                    if (nq && nq.stem && Array.isArray(nq.choices) && nq.choices.length >= 2)
                        clean.push(nq);
                    else
                        invalids.push({ i, raw });
                });
                setQuestions(clean);
                setIdx(0);
                if (invalids.length)
                    console.warn(`[PACK:${pack}] 무시된 비정상 문항 ${invalids.length}개`, invalids.slice(0, 5));
            }
            catch (e) {
                if (!ac.signal.aborted) {
                    console.warn('pack load failed', e);
                    setQuestions([]);
                    setMsg('팩 로딩 실패');
                }
            }
            finally {
                if (!ac.signal.aborted)
                    setLoading(false);
            }
        })();
        return () => ac.abort();
    }, [pack]);
    // 3) 문항 표출 로그(선택)
    useEffect(() => {
        if (q && proofRef.current?.log) {
            proofRef.current.log({ type: 'q_shown', id: q.id, idx }).catch?.(() => { });
        }
    }, [q, idx]);
    // 4) 답안 처리
    async function onAnswer(key) {
        if (!q)
            return;
        const correct = q.answerKey === key;
        // Proof 로그는 실패해도 무시
        try {
            await proofRef.current?.log?.({ type: 'answer', id: q.id, pick: key, correct });
        }
        catch { }
        // 로컬 턴 누적
        turnsRef.current.push({ id: q.id, pick: key, correct });
        const isLast = idx >= (questions.length - 1);
        if (!isLast) {
            setIdx(i => i + 1);
            setMsg(correct ? '정답! 다음 문제로…' : '오답 💦 다음 문제로…');
            return;
        }
        // 마지막: 결과 객체(배열 아님!)를 직접 저장 → Result.tsx가 곧바로 읽음
        setMsg(correct ? '정답! 결과 정리 중…' : '오답 💦 결과 정리 중…');
        try {
            const turns = turnsRef.current;
            const total = Math.max(1, questions.length);
            const score = turns.filter(t => t.correct).length;
            const durationSec = Math.max(1, Math.round((Date.now() - (startAtRef.current || Date.now())) / 1000));
            const cleared = score >= Math.ceil(total * 0.6); // 통과 기준(60%) — 필요 시 조정
            const summary = { cleared, turns: total, durationSec };
            localStorage.setItem('qd:lastResult', JSON.stringify(summary));
            localStorage.setItem('qd:lastPack', pack);
            // (선택) 디버깅용으로 턴 배열도 남김
            localStorage.setItem('qd:lastTurns', JSON.stringify(turns));
            // Proof summary는 부가적으로만 시도(형태가 달라도 무시)
            try {
                await proofRef.current?.summary?.(correct);
            }
            catch { }
        }
        finally {
            nav('/result');
        }
    }
    // 5) 키보드 입력(ABCD)
    useEffect(() => {
        const onKey = (e) => {
            const k = e.key.toUpperCase();
            if (k === 'A' || k === 'B' || k === 'C' || k === 'D')
                onAnswer(k);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [q]);
    // ───────────── 렌더 ─────────────
    if (loading)
        return _jsx("div", { className: "p-6", children: "\uB85C\uB529\u2026" });
    if (!q)
        return _jsxs("div", { className: "p-6", children: ["\uBB38\uD56D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. ", _jsx("span", { className: "text-rose-400 ml-2", children: msg })] });
    const total = Math.max(1, questions.length);
    const progress = Math.round(((Math.min(idx, total - 1) + 1) / total) * 100);
    return (_jsxs("div", { className: "p-6 max-w-xl mx-auto space-y-4", children: [_jsx("div", { className: "h-2 bg-slate-800 rounded overflow-hidden", children: _jsx("div", { className: "h-full bg-emerald-500", style: { width: `${progress}%` } }) }), _jsxs("div", { className: "text-sm opacity-80", children: [idx + 1, " / ", total] }), _jsx("h2", { className: "text-xl font-bold", children: "\uC804\uD22C(\uD034\uC988)" }), _jsxs("div", { className: "p-4 rounded bg-slate-800", children: [_jsx("div", { className: "font-medium whitespace-pre-wrap", children: q.stem }), _jsxs("div", { className: "grid gap-2 mt-3", children: [(q?.choices ?? []).map((c) => (_jsxs("button", { className: "text-left px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 transition", onClick: () => onAnswer(c.key), children: [_jsxs("span", { className: "font-bold mr-2", children: [c.key, "."] }), c.text] }, c.key))), (!q?.choices || q.choices.length === 0) && (_jsx("div", { className: "text-sm text-rose-300", children: "\uC774 \uBB38\uD56D\uC758 \uC120\uD0DD\uC9C0 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }))] })] }), _jsx("div", { className: "text-emerald-400", children: msg })] }));
}
