export type Slot = 'Body' | 'Face' | 'BodySuit' | 'Pants' | 'Shoes' | 'Clothes' | 'Sleeves' | 'Necklace' | 'Bag' | 'Scarf' | 'Bowtie' | 'Hair' | 'Hat' | 'Weapon';
export declare const SLOT_Z: Record<Slot, number>;
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export declare const asRarity: (r?: string) => Rarity;
export type ItemKind = 'cosmetic' | 'weapon' | 'consumable';
export type BaseItem = {
    id: string;
    name: string;
    rarity?: Rarity;
};
export type CosmeticItem = BaseItem & {
    kind: 'cosmetic';
    slot: Exclude<Slot, 'Weapon'>;
    src: string;
    opacity?: number;
    scale?: number;
    offset?: {
        x: number;
        y: number;
    };
    atlas?: {
        cols: number;
        rows: number;
        frames: number;
        fps?: number;
    };
};
export type WeaponItem = BaseItem & {
    kind: 'weapon';
    slot: 'Weapon';
    src: string;
    atk?: number;
    spd?: number;
    effectId?: string;
    twoHanded?: boolean;
};
export type ConsumableItem = BaseItem & {
    kind: 'consumable';
    icon: string;
    effectId?: string;
    stackMax?: number;
};
export type AnyItem = CosmeticItem | WeaponItem | ConsumableItem;
export type Equipped = Partial<Record<Slot, string>>;
export type WearableItem = CosmeticItem;
export type ItemCatalog = Record<string, AnyItem>;
export type WearableCatalog = Record<string, WearableItem>;
export declare function cosmeticsOnly(cat: ItemCatalog | WearableCatalog): WearableCatalog;
export declare const isCosmetic: (x: AnyItem | unknown) => x is CosmeticItem;
export declare const isWeapon: (x: AnyItem | unknown) => x is WeaponItem;
export declare const isConsumable: (x: AnyItem | unknown) => x is ConsumableItem;
