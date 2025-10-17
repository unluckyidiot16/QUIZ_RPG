// core/items.ts
export type Rarity = 'N'|'R'|'SR'|'SSR';
export type CosmeticType = 'hat'|'frame'|'badge';
export type Slot = CosmeticType; // 👈 Slot = CosmeticType 로 통일

export interface CosmeticDef { id:string; type:CosmeticType; name:string; icon:string; }
export interface GachaPoolDef {
  id: string;
  cost: { coin?: number; ticketId?: string };
  entries: Array<{ cosmeticId:string; weight:number; rarity:Rarity }>;
  pity?: { threshold:number; grantRarity:Rarity };
}

export interface InventoryState {
  coins: number;
  items: Record<string, number>;
  cosmeticsOwned: Record<string, true>;
  equipped: { frame?: string; hat?: string; badge?: string };
  version: number;
}

export interface InventoryDiff {
  idempotencyKey?: string;
  coinDelta?: number;
  itemDelta?: Record<string, number>;
  cosmeticsAdd?: string[];
  equip?: Partial<Record<Slot, string>>; // 👈 Slot 기준으로 통일
  reason?: string;
}
