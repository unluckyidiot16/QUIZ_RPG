// apps/student/src/core/wardrobe.ts
import { addGold } from './currency';

const KEY = 'qrpg_wardrobe_v1'; // Set<string>
type Wardrobe = { owned: Record<string, true> };

function load(): Wardrobe {
  try { const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return { owned: raw?.owned ?? {} } }
  catch { return { owned: {} } }
}
function save(w: Wardrobe){ localStorage.setItem(KEY, JSON.stringify(w)) }
export function ownsAvatar(id: string){ return !!load().owned[id] }

/** 중복 획득 시 자동 판매(환전) 정책 */
export function grantAvatarOrAutoSell(id: string){
  const w = load();
  if (w.owned[id]) {
    const gold = avatarDupPrice(id); addGold(gold);
    return { granted: false, autoSold: true, gold };
  }
  w.owned[id] = true; save(w);
  return { granted: true, autoSold: false, gold: 0 };
}

/** 중복 환전 단가(등급/희귀도에 따라 튜닝 가능) */
export function avatarDupPrice(id: string){
  // id/rarity 매핑이 있으면 rarity로 계산. 일단 기본값:
  return 50; // MVP: 중복 아바타 = 50골드
}
