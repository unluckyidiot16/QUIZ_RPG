// 이벤트 체인: H0=nonce, Hi=sha256(Hi-1 || JSON(ev))
const enc = new TextEncoder();
export async function sha256(input) {
    const u8 = typeof input === 'string'
        ? enc.encode(input)
        : input instanceof Uint8Array
            ? input
            : new Uint8Array(input); // ArrayBuffer → Uint8Array
    // ✅ 새 Uint8Array로 복사 → 이 버퍼는 ArrayBuffer 보장(SharedArrayBuffer 아님)
    const ab = u8.slice().buffer;
    const d = await crypto.subtle.digest('SHA-256', ab);
    return new Uint8Array(d);
}
function concat(a, b) {
    const u = new Uint8Array(a.length + b.length);
    u.set(a);
    u.set(b, a.length);
    return u;
}
function b64(u8) {
    let s = '';
    for (const b of u8)
        s += String.fromCharCode(b);
    return btoa(s);
}
export class Proof {
    constructor() {
        this.turns = 0;
        this.start = performance.now();
    }
    static async create() {
        const nonce = crypto.getRandomValues(new Uint8Array(16));
        const p = new Proof();
        p.h = await sha256(nonce);
        return p;
    }
    async log(ev) {
        const msg = enc.encode(JSON.stringify({ ts: Date.now(), ...ev }));
        this.h = await sha256(concat(this.h, msg));
        this.turns++;
    }
    async summary(cleared) {
        const durationSec = Math.round((performance.now() - this.start) / 1000);
        return {
            finalHash: b64(this.h), // 서버에는 base64로 전송
            turns: this.turns,
            durationSec,
            cleared,
        };
    }
}
