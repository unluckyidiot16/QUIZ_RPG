// --- Item & Wearable unified types (backward compatible) ---
// 레이어 z-순서 (필요시 조정 가능)
export const SLOT_Z = {
    Body: 0, Face: 10, BodySuit: 20, Pants: 30, Shoes: 40, Clothes: 50,
    Sleeves: 60, Necklace: 70, Bag: 80, Scarf: 90, Bowtie: 100,
    Hair: 110, Hat: 120, Weapon: 130,
};
export const asRarity = (r) => (['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].includes(String(r)) ? r : 'common');
export function cosmeticsOnly(cat) {
    const out = {};
    for (const [id, it] of Object.entries(cat)) {
        if (it?.kind === 'cosmetic')
            out[id] = it;
        // 구버전 JSON에는 kind가 없을 수 있으니 slot이 존재하면 코스메틱으로 간주
        else if (it?.slot && it?.src && !it?.icon) {
            out[id] = { kind: 'cosmetic', ...it };
        }
    }
    return out;
}
// 11) 타입 가드 (옵션)
export const isCosmetic = (x) => x?.kind === 'cosmetic';
export const isWeapon = (x) => x?.kind === 'weapon';
export const isConsumable = (x) => x?.kind === 'consumable';
