// --- Item & Wearable unified types (backward compatible) ---

// 1) 공통 슬롯 정의 (Weapon 슬롯 예약)
export type Slot =
  | 'Body' | 'Face' | 'BodySuit' | 'Pants' | 'Shoes' | 'Clothes'
  | 'Sleeves' | 'Necklace' | 'Bag' | 'Scarf' | 'Bowtie'
  | 'Hair' | 'Hat' | 'Weapon'; // ← 확장: Weapon

// 레이어 z-순서 (필요시 조정 가능)
export const SLOT_Z: Record<Slot, number> = {
  Body: 0, Face: 10, BodySuit: 20, Pants: 30, Shoes: 40, Clothes: 50,
  Sleeves: 60, Necklace: 70, Bag: 80, Scarf: 90, Bowtie: 100,
  Hair: 110, Hat: 120, Weapon: 130,
};

// 2) 희귀도
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const asRarity = (r?: string): Rarity =>
  (['common','uncommon','rare','epic','legendary','mythic'].includes(String(r)) ? (r as Rarity) : 'common');

// 3) 아이템 공통
export type ItemKind = 'cosmetic' | 'weapon' | 'consumable';
export type BaseItem = {
  id: string;
  name: string;
  rarity?: Rarity;
};

// 4) 코스메틱(= 기존 Wearable)  ← 기존 코드와 100% 호환
export type CosmeticItem = BaseItem & {
  kind: 'cosmetic';
  slot: Exclude<Slot, 'Weapon'>; // 의상 슬롯
  src: string;
  opacity?: number;
  scale?: number;
  offset?: { x: number; y: number };
  atlas?: { cols: number; rows: number; frames: number; fps?: number };
};

// 5) 무기(스텁)
export type WeaponItem = BaseItem & {
  kind: 'weapon';
  slot: 'Weapon';
  src: string;
  // P2에서 채울 필드들
  atk?: number; spd?: number; effectId?: string; twoHanded?: boolean;
};

// 6) 소모품(스텁)
export type ConsumableItem = BaseItem & {
  kind: 'consumable';
  icon: string;
  // P2에서 채울 필드들
  effectId?: string; stackMax?: number;
};

// 7) 유니온
export type AnyItem = CosmeticItem | WeaponItem | ConsumableItem;

// 8) 장착 상태(그대로 유지)
export type Equipped = Partial<Record<Slot, string>>;

// 9) ✅ 구버전 호환용 type alias
//    기존 코드가 import { WearableItem } 를 쓰고 있어도 그대로 동작
export type WearableItem = CosmeticItem;

// 10) 카탈로그 헬퍼(향후 AnyItem 카탈로그를 넘겼을 때 코스메틱만 추출)
export type ItemCatalog = Record<string, AnyItem>;
export type WearableCatalog = Record<string, WearableItem>;

export function cosmeticsOnly(cat: ItemCatalog | WearableCatalog): WearableCatalog {
  const out: WearableCatalog = {};
  for (const [id, it] of Object.entries(cat)) {
    if ((it as any)?.kind === 'cosmetic') out[id] = it as WearableItem;
    // 구버전 JSON에는 kind가 없을 수 있으니 slot이 존재하면 코스메틱으로 간주
    else if ((it as any)?.slot && (it as any)?.src && !(it as any)?.icon) {
      out[id] = { kind: 'cosmetic', ...(it as any) };
    }
  }
  return out;
}

// 11) 타입 가드 (옵션)
export const isCosmetic   = (x: AnyItem | unknown): x is CosmeticItem   => (x as any)?.kind === 'cosmetic';
export const isWeapon     = (x: AnyItem | unknown): x is WeaponItem     => (x as any)?.kind === 'weapon';
export const isConsumable = (x: AnyItem | unknown): x is ConsumableItem => (x as any)?.kind === 'consumable';
