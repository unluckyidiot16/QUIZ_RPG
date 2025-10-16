// src/core/wearable.types.ts
export type Slot =
  | 'Body' | 'Face' | 'BodySuit' | 'Pants' | 'Shoes' | 'Clothes'
  | 'Sleeves' | 'Necklace' | 'Bag' | 'Scarf' | 'Bowtie' | 'Hair' | 'Hat';

export const SLOT_Z: Record<Slot, number> = {
  Body:0, Face:1, BodySuit:2, Pants:3, Shoes:4, Clothes:5,
  Sleeves:6, Necklace:7, Bag:8, Scarf:9, Bowtie:10, Hair:11, Hat:12,
};

export type WearableItem = {
  id: string;              // ex) body.blank1
  name: string;
  slot: Slot;
  src: string;             // 절대/상대 경로(루트와 합쳐 사용)
  // (확장) 렌더 옵션
  opacity?: number;
  scale?: number;
  offset?: { x:number; y:number };
  atlas?: { cols:number; rows:number; frames:number; fps?:number };
};

export type Equipped = Partial<Record<Slot, string>>;   // slot -> itemId
