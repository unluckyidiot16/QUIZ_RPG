import { SUBJECTS, type Subject, type Stats, type SubjectLevels } from './char.types';

export type EquipmentSlot = 'Weapon'|'Armor'|'Accessory';

// 로컬스토리지 I/O
const LS_KEY = 'qd:player';
// === Player schema migration (drop-in) =======================================

// ===== 파라미터(튜닝값) =====
export const ATK_PER_LEVEL = 2;
export const HP_PER_L_SUM  = 5;
export const DEF_PER_L_SUM = 1;
export const needXP = (lv: number) => 10 + 5 * lv; // n→n+1

function migrateToLevels(p: any) {
  if (p?.base?.subLevels) return; // 이미 있으면 스킵
  const prev: Partial<Stats> = (p?.base?.subAtk && typeof p.base.subAtk === 'object') ? p.base.subAtk : {};
  const levels = {} as SubjectLevels;
  for (const s of SUBJECTS) {
    const atk = Number(prev[s] ?? 0);
    const lv = Math.max(0, Math.floor(atk / ATK_PER_LEVEL));
    levels[s] = { lv, xp: 0 };
  }
  p.base.subLevels = levels;
  p.base.subAtk = deriveSubAtkFromLevels(levels); // 동기화
}


// 안전 숫자
const num = (v: unknown, d = 0) => (Number.isFinite(+((v as any))) ? +((v as any)) : d);

// ===== 파생 유틸 =====
// ===== 파생 유틸 (⚠️ export 필수) =====
export function deriveSubAtkFromLevels(levels: SubjectLevels): Stats {
  const out = {} as Record<Subject, number>;
  for (const s of SUBJECTS) out[s] = (levels?.[s]?.lv ?? 0) * ATK_PER_LEVEL;
  return out as Stats;
}

export function totalLevel(levels: SubjectLevels): number {
  return SUBJECTS.reduce((sum, s) => sum + (levels[s]?.lv ?? 0), 0);
}

export const PLAYER_SCHEMA_VERSION = 2;

type EquipSlots = 'Weapon'|'Armor'|'Accessory';

const DEFAULT_BASE = { hp: 50, def: 0 };
const DEFAULT_EQUIP: Record<EquipSlots, string | undefined> = {
  Weapon: undefined, Armor: undefined, Accessory: undefined,
};

function coerceNum(v: any, d = 0){ const n = Number(v); return Number.isFinite(n) ? n : d; }

export function migratePlayerSchema(raw: any){
  const p = raw && typeof raw === 'object' ? { ...raw } : {};

  // 버전 플래그
  const cur = Number(p.__v) || 0;

  // 1) base 보정 (없거나 타입이 잘못된 경우)
  const baseIn = p?.base && typeof p.base === 'object' ? p.base : {};
  p.base = {
    hp:  num(baseIn.hp, 50),
    def: num(baseIn.def, 0),
    subAtk: (baseIn.subAtk && typeof baseIn.subAtk === 'object') ? baseIn.subAtk : {},
    subLevels: (baseIn.subLevels && typeof baseIn.subLevels === 'object') ? baseIn.subLevels : undefined,
  };
  if (!p.base.subLevels) migrateToLevels(p);

  // 2) 장비/가방 보정
  p.equipment = p.equipment && typeof p.equipment === 'object'
    ? { ...DEFAULT_EQUIP, ...p.equipment }
    : { ...DEFAULT_EQUIP };

  p.bag = p.bag && typeof p.bag === 'object' ? p.bag : {};

  // 3) 진행도/기타 기본값
  p.totalXp = coerceNum(p.totalXp, 0);
  p.gold    = coerceNum(p.gold,    0);

  // 4) 버전 올림
  p.__v = Math.max(cur, PLAYER_SCHEMA_VERSION);

  const baseStatsFromCharacter = p?.character?.baseStats ?? null;
  const legacyStats = p?.stats ?? null;

  if (!p.subAtk) {
    const src = baseStatsFromCharacter ?? legacyStats ?? null;
    p.subAtk = normalizeSubAtk(src || {});
  }
  
  return p;
}

export function loadPlayer(): PlayerState {
  try {
    const raw = localStorage.getItem('qd:player');
    const parsed = raw ? JSON.parse(raw) : null;

    // ▼ 마이그레이션 적용
    const migrated = migratePlayerSchema(parsed);

    // 변경 사항이 있으면 저장
    if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
      localStorage.setItem('qd:player', JSON.stringify(migrated));
    }

    return migrated as PlayerState;
  } catch {
    // 완전 파손 시 기본값 생성
    const fresh = migratePlayerSchema({});
    localStorage.setItem('qd:player', JSON.stringify(fresh));
    return fresh as PlayerState;
  }
}

export function savePlayer(p: any) {
  localStorage.setItem(LS_KEY, JSON.stringify(p));
}

// 1) 기본 값 생성기 (하드코딩 없이 SUBJECTS 기반)
export const zeroStats = (): Stats =>
  SUBJECTS.reduce((acc, s) => (acc[s] = 0, acc), {} as Stats);

let _itemDBCache: Record<string, ItemDef> | null = null;
let _itemDBInflight: Promise<Record<string, ItemDef>> | null = null;

/** 어디서든 '플레이어의 베이스 스탯'을 안전하게 얻는 단일 진입점 */
export function getBaseStats(p: any): Stats | null {
  const bs = p?.character?.baseStats ?? p?.stats;
  return bs ? ({ ...zeroStats(), ...bs }) : null;
}
function appBaseURL(): URL {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const base = (import.meta as any)?.env?.BASE_URL ?? (import.meta as any)?.env?.BASE ?? (import.meta.env?.BASE_URL ?? '/');
  return new URL(base, origin); // ex) https://site.com/app/
}
function abs(urlLike: string): string {
  if (/^https?:\/\//i.test(urlLike)) return urlLike;
  const path = urlLike.replace(/^\//, '');
  return new URL(path, appBaseURL()).toString();
}
async function fetchJsonSmart(primary: string, fallback?: string) {
  try {
    const r = await fetch(abs(primary), { cache: 'no-store' });
    if (r.ok) return await r.json();
  } catch {}
  if (fallback) {
    try {
      const r2 = await fetch(abs(fallback), { cache: 'no-store' });
      if (r2.ok) return await r2.json();
    } catch {}
  }
  throw new Error(`JSON load failed: ${primary}${fallback ? ` (fallback: ${fallback})` : ''}`);
}


//** 아이템 DB 로더(항상 절대 URL, 실패 시 1회 폴백, 캐시/병합) */
export async function loadItemDB(urlLike?: string): Promise<Record<string, ItemDef>> {
  if (_itemDBCache) return _itemDBCache;
  if (_itemDBInflight) return _itemDBInflight;

  _itemDBInflight = (async () => {
    const raw = await fetchJsonSmart(urlLike ?? 'items.v1.json', '/packs/items.v1.json');
    const arr: ItemDef[] = Array.isArray(raw) ? raw : Object.values(raw || {});
    const map: Record<string, ItemDef> = {};
    for (const it of arr) {
      if (!it?.id) continue;
      map[it.id] = it;
      const lc = it.id.toLowerCase();
      if (!map[lc]) map[lc] = it; // ID 대소문자 혼용 보호
    }
    _itemDBCache = map;
    _itemDBInflight = null;
    return map;
  })();

  return _itemDBInflight;
}

// ── 과목(6) 정의 ──
export type SubjectPower = Record<Subject, number>;

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

export function normalizeSubAtk(x?: Partial<Record<Subject, number>> | Record<string, number> | null): SubjectPower {
  const out = {} as SubjectPower;
  for (const s of SUBJECTS) out[s] = (x && (x as any)[s]) ?? 0;
  return out;
}

// 3) 레거시 모양 보정: p.stats만 있으면 character.baseStats로 승격
export function migratePlayerShape(p: any) {
  p = p ?? {};
  p.bag = p.bag ?? {};
  p.equipment = p.equipment ?? {};
  p.character = p.character ?? {};
  // 레거시: p.stats만 있던 데이터 → character.baseStats로 승격
  if (!p.character.baseStats) {
    const legacy = (p.stats && typeof p.stats === 'object') ? p.stats : null;
    p.character.baseStats = legacy ? { ...zeroStats(), ...legacy }
      : (p.character.baseStats ?? zeroStats());
  }
  return p;
}

/** xp_for_level(n) = base * n^1.6 (round) */
export function xpForLevel(n: number, base = 20){ return Math.round(base * Math.pow(n, 1.6)) }

export function grantSubjectXp(p: any, subject: Subject, amount: number){
  const L = p.base.subLevels;
  const slot = L[subject] || (L[subject] = { lv: 0, xp: 0 });
  let lv = slot.lv, xp = slot.xp + Math.max(0, amount|0);
  while (xp >= needXP(lv)) { xp -= needXP(lv); lv += 1; }
  slot.lv = lv; slot.xp = xp;
  p.base.subAtk = deriveSubAtkFromLevels(L);
  return p;
}


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
  thumb : string
  slot: ItemSlot
  rarity: 'N'|'R'|'SR'|'SSR'
  stats?: Partial<StatsBase> & { subAtk?: Partial<Record<Subject, number>> } // 장비 스탯
}

/** 장비/지급 도우미 */
// player.ts (동일 파일 내, 위 헬퍼들 아래)
export const PlayerOps = {
  /** 캐릭터 생성: baseStats 저장 + 레거시(p.stats) 동기화 */
  // ✅ 드롭-인 교체: PlayerOps.createCharacter
  createCharacter(args?: { baseStats?: Stats; nickname?: string }) {
    const a = args || {};
    const p = migratePlayerShape(loadPlayer()); // 기존 헬퍼 그대로 사용

    // ---------- 새 모델 초기화 ----------
    // base 컨테이너 보장
    p.base = p.base ?? {};
    // 기본 HP/DEF 보장(스케일 상수는 player.ts 상단에서 관리)
    p.base.hp  = Number.isFinite(p.base.hp)  ? p.base.hp  : 50;
    p.base.def = Number.isFinite(p.base.def) ? p.base.def : 0;

    // 과목별 레벨/XP 초기화: baseStats가 있으면 "레벨로 환산", 없으면 0으로 시작
    p.base.subLevels = p.base.subLevels ?? {};
    for (const s of SUBJECTS) {
      const v  = Number((a.baseStats as any)?.[s] ?? 0);
      const lv = Math.max(0, Math.floor(v / ATK_PER_LEVEL)); // 예: ATK_PER_LEVEL=2
      p.base.subLevels[s] = { lv, xp: 0 };
    }

    // 파생 공격력(Stats) 동기화: ✅ 단일 소스는 base.subLevels → base.subAtk
    p.base.subAtk = deriveSubAtkFromLevels(p.base.subLevels);

    // ---------- 레거시 호환(있던 코드 유지) ----------
    // character 블록은 남겨두되, level은 합계 레벨로 동기화
    p.character = {
      id: p.character?.id ?? 'char-1',
      level: totalLevel(p.base.subLevels),  // Σ lv[s]
      exp: 0,
      baseStats: { ...zeroStats(), ...(a.baseStats || {}) }, // 읽는 코드가 있으면 위해 미러
      equip: p.character?.equip ?? {},
    };

    // 기존 상위 필드들도 미러(가능하면 점진 제거 권장)
    p.subAtk = { ...p.base.subAtk };
    p.stats  = { ...p.character.baseStats };

    // 닉네임은 별도 프로필에서 관리하지만, 인자가 오면 저장해도 무방
    if (a.nickname && typeof a.nickname === 'string') {
      p.nickname = a.nickname;
    }

    savePlayer(p);
    return p;
  },

  /** 경험치 지급 */
  grantXp(delta: number) {
    const s = migratePlayerShape(loadPlayer());
    s.totalXp = Math.max(0, Math.round((s.totalXp ?? 0) + delta));
    savePlayer(s);
    return s;
  },

  /** 아이템 지급(개수형 인벤토리) */
  grantItem(id: string, count = 1) {
    const s = migratePlayerShape(loadPlayer());
    s.bag[id] = Math.max(0, (s.bag[id] ?? 0) + count);
    if (s.bag[id] === 0) delete s.bag[id];
    savePlayer(s);
    return s;
  },

  /** 장비 장착/해제(슬롯 기반) */
  // EquipmentSlot 타입 경로가 다르면 해당 경로로 수정
  equip(slot: /* EquipmentSlot */ any, itemId: string | undefined) {
    const s = migratePlayerShape(loadPlayer());
    if (itemId) s.equipment[slot] = itemId;
    else delete s.equipment[slot];
    savePlayer(s);
    return s;
  },
};


/** 최종 전투 스탯 계산: (기본 + 장비합산) */
export interface CombatStats { hp:number; def:number; subAtk: SubjectPower }

export function deriveBattleStats(items: Record<string, ItemDef>, s: PlayerState): CombatStats {
  let addHp = 0, addDef = 0;
  const addSub: SubjectPower = SUBJECTS.reduce((acc, k) => (acc[k]=0, acc), {} as SubjectPower);

  for (const id of Object.values(s.equipment)) {
    const it = id ? items[id] : undefined;
    if (!it?.stats) continue;
    addHp  += it.stats.hp  ?? 0;
    addDef += it.stats.def ?? 0;
    const sub = it.stats.subAtk ?? {};
    for (const k of SUBJECTS) addSub[k] += (sub as any)[k] ?? 0;
  }

  // ← 여기서 6키를 보장해 반환
  const baseSub = normalizeSubAtk(s.subAtk);
  const outSub: SubjectPower = SUBJECTS.reduce((acc,k)=> (acc[k]= baseSub[k] + addSub[k], acc), {} as SubjectPower);

  return { hp: s.base.hp + addHp, def: s.base.def + addDef, subAtk: outSub };
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

const LVQ = 'qrpg_level_queue_v1';
function pushLevelUp(lv:number){ const arr = JSON.parse(localStorage.getItem(LVQ) ?? '[]'); arr.push(lv); localStorage.setItem(LVQ, JSON.stringify(arr)) }
export function popLevelUps(): number[]{ const arr = JSON.parse(localStorage.getItem(LVQ) ?? '[]'); localStorage.setItem(LVQ, '[]'); return arr }
export function grantXpAndCheckLevel(delta:number){
  const s = loadPlayer(); const before = levelFromXp(s.totalXp).level;
  s.totalXp = Math.max(0, s.totalXp + Math.round(delta)); savePlayer(s);
  const after = levelFromXp(s.totalXp).level; for (let lv=before+1; lv<=after; lv++) pushLevelUp(lv);
  return { before, after };
  
  
}
