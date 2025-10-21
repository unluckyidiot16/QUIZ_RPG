export type EquipmentSlot = 'Weapon'|'Armor'|'Accessory';

// ── 과목(6) 정의 ──
export type Subject = 'KOR'|'ENG'|'MATH'|'SCI'|'SOC'|'HIST';
export const SUBJECTS: Subject[] = ['KOR','ENG','MATH','SCI','SOC','HIST'];
export const SUBJECT_LABEL: Record<Subject,string> = {
  KOR:'국어', ENG:'영어', MATH:'수학', SCI:'과학', SOC:'사회', HIST:'역사'
};

export interface SubjectPower { [k: string]: number } // key: Subject

export interface StatsBase { hp:number; def:number }
export interface PlayerState {
  totalXp: number; // 누적 XP
  base: StatsBase; // 캐릭터 기본 스탯(레벨 보정 전)
  subAtk: SubjectPower; // 과목별 기본 공격력(캐릭터 고유치/레벨 보정치)
  equipment: Partial<Record<EquipmentSlot, string>>; // 아이템 ID 참조
  bag: Record<string, number>; // 장비/소모품 보유 수량
  version: number;
}

const K = 'qrpg_player_v1';
const DEF: PlayerState = {
  totalXp: 0,
  base: { hp: 100, def: 0 },
  subAtk: { KOR:1, ENG:1, MATH:1, SCI:1, SOC:1, HIST:1 },
  equipment: {},
  bag: {},
  version: 2,
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
  stats?: Partial<StatsBase> & { subAtk?: Partial<Record<Subject, number>> } // 장비 스탯
}

/** 아이템 DB 로더 (public/items.v1.json) */
export async function loadItemDB(url = 'items.v1.json'): Promise<Record<string, ItemDef>>{
  const res = await fetch(url)
  const list = await res.json() as ItemDef[]
  const map: Record<string, ItemDef> = {}
  for (const it of list) map[it.id] = it
  return map
}

/** 장비/지급 도우미 */
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

/** 최종 전투 스탯 계산: (기본 + 장비합산) */
export interface CombatStats { hp:number; def:number; subAtk: Record<Subject, number> }
export function deriveBattleStats(items: Record<string, ItemDef>, s: PlayerState): CombatStats{
  const agg = { hp:0, def:0, subAtk: { KOR:0, ENG:0, MATH:0, SCI:0, SOC:0, HIST:0 } as Record<Subject,number> }
  for (const id of Object.values(s.equipment)){
    const it = id ? items[id] : undefined
    if (!it?.stats) continue
    agg.hp += it.stats.hp ?? 0
    agg.def += it.stats.def ?? 0
    const sub = it.stats.subAtk ?? {}
    for (const k of SUBJECTS){ agg.subAtk[k] += (sub[k] ?? 0) }
  }
  const out: CombatStats = {
    hp: s.base.hp + agg.hp,
    def: s.base.def + agg.def,
    subAtk: { ...s.subAtk }
  }
  for (const k of SUBJECTS){ out.subAtk[k] += agg.subAtk[k] }
  return out
}

// ── 멱등 지급 영수증 키(클라) ──
export function makeReceiptKey(kind: 'xp'|'item'|'equip', payload: unknown){
  const str = kind + ':' + JSON.stringify(payload)
  let h = 5381; for (let i=0;i<str.length;i++) h = ((h<<5)+h) + str.charCodeAt(i)
  return 'rcp_' + (h>>>0).toString(16)
}

// ── 결정론 랜덤 부속성(과목 2종) 롤러 ──
export function rollSubjectAffixes(seed: number, amountMin=1, amountMax=3){
  const rng = mulberry32(seed)
  const picks = new Set<Subject>()
  while (picks.size < 2){
    const k = SUBJECTS[Math.floor(rng()*SUBJECTS.length)]
    picks.add(k)
  }
  const out: Partial<Record<Subject,number>> = {}
  for (const k of picks){ out[k] = amountMin + Math.floor(rng()*(amountMax-amountMin+1)) }
  return out
}
function mulberry32(a:number){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296 } }

