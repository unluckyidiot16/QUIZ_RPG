// apps/student/src/core/packs.ts
export type CosmeticType = 'hat'|'frame'|'badge';
export type Rarity = 'N'|'R'|'SR'|'SSR';

export interface CosmeticDef { id:string; type:CosmeticType; name:string; icon:string; }
export interface CosmeticsPack { packId: string; cosmetics: CosmeticDef[]; hash?: string; }
export interface GachaEntry { cosmeticId:string; weight:number; rarity:Rarity; }

// 🔁 파일에 들어오는 "Raw" 스키마 (poolId)
export interface RawGachaPool { poolId:string; cost:{ coin?:number; ticketId?:string }; entries:GachaEntry[]; hash?:string; }

// ⬇️ 여기서 Core 타입을 불러와서 반환 타입으로 사용
import type { GachaPoolDef as CoreGachaPoolDef } from './items';

async function sha256OfText(text:string){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function fetchJson<T>(path:string): Promise<{data:T; raw:string}>{
  const res = await fetch(path, { cache:'no-store' });
  if (!res.ok) throw new Error(`load failed: ${path}`);
  const raw = await res.text();
  return { data: JSON.parse(raw) as T, raw };
}

export async function loadCosmeticsPack(path='/packs/cosmetics_v1.json'){
  const { data, raw } = await fetchJson<CosmeticsPack>(path);
  if (data.hash){
    const calc = await sha256OfText(raw);
    if (calc !== data.hash) throw new Error('cosmetics pack integrity failed');
  }
  return data;
}

// 🔁 Raw → Core로 변환하여 "id" 필드를 맞춰 반환
export async function loadGachaPool(path='/packs/gacha_basic.json'): Promise<CoreGachaPoolDef>{
  const { data, raw } = await fetchJson<RawGachaPool>(path);
  if (data.hash){
    const calc = await sha256OfText(raw);
    if (calc !== data.hash) throw new Error('gacha pack integrity failed');
  }
  // 👇 Core 스키마로 매핑
  return {
    id: data.poolId,                 // ← 여기서 id로 통합
    cost: data.cost,
    entries: data.entries,
  };
}
