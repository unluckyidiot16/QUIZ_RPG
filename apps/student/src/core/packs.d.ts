export type CosmeticType = 'hat' | 'frame' | 'badge';
export type Rarity = 'N' | 'R' | 'SR' | 'SSR';
export interface CosmeticDef {
    id: string;
    type: CosmeticType;
    name: string;
    icon: string;
}
export interface CosmeticsPack {
    packId: string;
    cosmetics: CosmeticDef[];
    hash?: string;
}
export interface GachaEntry {
    cosmeticId: string;
    weight: number;
    rarity: Rarity;
}
export interface RawGachaPool {
    poolId: string;
    cost: {
        coin?: number;
        ticketId?: string;
    };
    entries: GachaEntry[];
    hash?: string;
}
import type { GachaPoolDef as CoreGachaPoolDef } from './items';
export declare function loadCosmeticsPack(path?: string): Promise<CosmeticsPack>;
export declare function loadGachaPool(path?: string): Promise<CoreGachaPoolDef>;
