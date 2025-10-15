// 이벤트 체인: H0=nonce, Hi=sha256(Hi-1 || JSON(ev))
const enc = new TextEncoder();
async function sha256(u8: Uint8Array){
  const d = await crypto.subtle.digest('SHA-256', u8);
  return new Uint8Array(d);
}
function concat(a: Uint8Array, b: Uint8Array){
  const u = new Uint8Array(a.length + b.length); u.set(a); u.set(b, a.length); return u;
}
function b64(u8: Uint8Array){ let s=''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); }

export class Proof {
  private h!: Uint8Array;
  turns = 0;
  start = performance.now();

  static async create(){
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    const p = new Proof();
    p.h = await sha256(nonce);
    return p;
  }
  async log(ev: Record<string, unknown>){
    const msg = enc.encode(JSON.stringify({ ts: Date.now(), ...ev }));
    this.h = await sha256(concat(this.h, msg));
    this.turns++;
  }
  async summary(cleared: boolean){
    const durationSec = Math.round((performance.now() - this.start)/1000);
    return {
      finalHash: b64(this.h), // 서버에는 base64로 전송
      turns: this.turns,
      durationSec,
      cleared,
    };
  }
}
