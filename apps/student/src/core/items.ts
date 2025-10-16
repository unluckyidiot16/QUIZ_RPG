// core/items.ts
export type Rarity = 'N'|'R'|'SR'|'SSR';
export type CosmeticType = 'hat'|'frame'|'badge';

export interface CosmeticDef { id:string; type:CosmeticType; name:string; icon:string; }
export interface GachaPoolDef {
  id: string;
  cost: { coin?: number; ticketId?: string };          // 둘 중 하나
  entries: Array<{ cosmeticId:string; weight:number; rarity:Rarity }>;
  pity?: { threshold:number; grantRarity:Rarity };      // (미구현 가능)
}

export interface InventoryState {
  coins: number;
  items: Record<string, number>;                        // itemId -> count
  cosmeticsOwned: Record<string, true>;
  equipped: { frame?: string; hat?: string; badge?: string };
  version: number;
}

export interface InventoryDiff {
  idempotencyKey?: string;                              // 서버 전환 대비
  coinDelta?: number;
  itemDelta?: Record<string, number>;                   // +/-
  cosmeticsAdd?: string[];                              // 소유 마킹
  equip?: Partial<InventoryState['equipped']>;          // 착용 변경
  reason?: string;                                      // "gacha:basic" 등
}
