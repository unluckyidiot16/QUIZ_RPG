async function sha256OfText(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function fetchJson(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok)
        throw new Error(`load failed: ${path}`);
    const raw = await res.text();
    return { data: JSON.parse(raw), raw };
}
export async function loadCosmeticsPack(path = '/packs/cosmetics_v1.json') {
    const { data, raw } = await fetchJson(path);
    if (data.hash) {
        const calc = await sha256OfText(raw);
        if (calc !== data.hash)
            throw new Error('cosmetics pack integrity failed');
    }
    return data;
}
// 🔁 Raw → Core로 변환하여 "id" 필드를 맞춰 반환
export async function loadGachaPool(path = '/packs/gacha_basic.json') {
    const { data, raw } = await fetchJson(path);
    if (data.hash) {
        const calc = await sha256OfText(raw);
        if (calc !== data.hash)
            throw new Error('gacha pack integrity failed');
    }
    // 👇 Core 스키마로 매핑
    return {
        id: data.poolId, // ← 여기서 id로 통합
        cost: data.cost,
        entries: data.entries,
    };
}
