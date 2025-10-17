// 안전한 멱등키 생성 (브라우저 호환)
export function newIdempotencyKey(prefix = 'gacha') {
    try {
        const c = globalThis.crypto;
        if (c?.randomUUID)
            return `${prefix}:${c.randomUUID()}`;
        // fallback(getRandomValues)
        const a = new Uint8Array(16);
        if (c?.getRandomValues) {
            c.getRandomValues(a);
            const hex = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
            return `${prefix}:${Date.now().toString(36)}:${hex}`;
        }
    }
    catch (_) {
        // no-op
    }
    // 최후의 수단: Date+Math.random
    return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}
