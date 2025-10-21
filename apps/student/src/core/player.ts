export type EquipmentSlot = 'Weapon'|'Armor'|'Accessory';

export interface Stats { hp:number; atk:number; def:number }
export interface PlayerState {
  totalXp: number; // 누적 XP
  base: Stats; // 캐릭터 기본 스탯 (레벨에 따른 증가분 포함 전)
  equipment: Partial<Record<EquipmentSlot, string>>; // 아이템 ID 참조
  bag: Record<string, number>; // 장비/소모품 보유 수량
  version: number;
}

const K = 'qrpg_player_v1';
const DEF: PlayerState = {
  totalXp: 0,
  base: { hp: 100, atk: 10, def: 0 },
  equipment: {},
  bag: {},
  version: 1,
};

export function loadPlayer(): PlayerState {
  try { return { ...DEF, ...JSON.parse(localStorage.getItem(K) ?? 'null') } }
  catch { return { ...DEF } }
}
export function savePlayer(s: PlayerState){ localStorage.setItem(K, JSON.stringify(s)) }

/** xp_for_level(n) = base * n^1.6 (round) */
export function xpForLevel(n: number, base = 20){ return Math.round(base * Math.pow(n, 1.6)) }

/** 누적 XP로부터 현재 레벨/진행 계산 */
export function levelFromXp(totalXp: number, base = 20, maxLevel = 100){
  let lvl = 1, acc = 0
  while (lvl < maxLevel){
    const need = xpForLevel(lvl, base)
    if (totalXp < acc + need) break
    acc += need; lvl++
  }
  const need = xpForLevel(lvl, base)
  return { level: lvl, curXp: totalXp - acc, needXp: need, progress: need>0 ? (totalXp - acc)/need : 1 }
}

export type ItemSlot = EquipmentSlot
export interface ItemDef {
  id: string
  name: string
  slot: ItemSlot
  rarity: 'N'|'R'|'SR'|'SSR'
  stats?: Partial<Stats> // 장비가 제공하는 스탯
}

export async function loadItemDB(url = '/items.v1.json'): Promise<Record<string, ItemDef>>{
  const res = await fetch(url)
  const list = await res.json() as ItemDef[]
  const map: Record<string, ItemDef> = {}
  for (const it of list) map[it.id] = it
  return map
}

/** 장비 착용/해제/지급 도우미 */
export const PlayerOps = {
  grantXp(delta: number){
    const s = loadPlayer(); s.totalXp = Math.max(0, s.totalXp + Math.round(delta)); savePlayer(s); return s
  },
  grantItem(id: string, count = 1){
    const s = loadPlayer(); s.bag[id] = Math.max(0, (s.bag[id] ?? 0) + count); if (s.bag[id]===0) delete s.bag[id]; savePlayer(s); return s
  },
  equip(slot: EquipmentSlot, itemId: string|undefined){
    const s = loadPlayer(); if (itemId) s.equipment[slot] = itemId; else delete s.equipment[slot]; savePlayer(s); return s
  }
}

/** 최종 전투 스탯 계산: base + 장비 합산 */
export function deriveBattleStats(items: Record<string, ItemDef>, s: PlayerState){
  const { hp, atk, def } = Object.values(s.equipment).reduce((acc, id) => {
    const it = id ? items[id] : undefined
    if (!it?.stats) return acc
    return {
      hp: acc.hp + (it.stats.hp ?? 0),
      atk: acc.atk + (it.stats.atk ?? 0),
      def: acc.def + (it.stats.def ?? 0),
    }
  }, { hp:0, atk:0, def:0 })
  return {
    hp: s.base.hp + hp,
    atk: s.base.atk + atk,
    def: s.base.def + def,
  } as Stats
}

// ── 멱등 지급 영수증 키(클라) 생성 도우미 ──
export function makeReceiptKey(kind: 'xp'|'item'|'equip', payload: unknown){
// 간단 해시(충분): JSON 문자열 길이+CRC32 대체로 djb2
  const str = kind + ':' + JSON.stringify(payload)
  let h = 5381; for (let i=0;i<str.length;i++) h = ((h<<5)+h) + str.charCodeAt(i)
  return 'rcp_' + (h>>>0).toString(16)
}

