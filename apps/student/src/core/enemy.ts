// apps/student/src/game/combat/enemy.ts
// Drop-in replacement: Sprite(객체) → 색상 추론 → 과목(6) 역매핑 포함

import {SkillColor, COLOR_TO_SUBJECT } from './affinity';
import type { Subject } from '../core/char.types';

// ───────────────────────────────────────────────────────────────────────────────
// 스프라이트/적 타입

export type EnemySprite = {
  type: 'Slime' | 'Goblin';      // 폴더명 (Enemy/<type>/…)
  variant: 'Blue' | 'Green' | 'Red' | 'Yellow' | 'Dark' | 'Blank' | string;
  frames?: Partial<Record<'Move'|'Attack'|'Die'|'Hit', number>>;
};

export type PatternKey =
  | 'Aggressive' | 'Shield' | 'Spiky'
  | 'Stagger' | 'Charge' | 'GuardBreak'
  | 'Rain' | 'Berserk' | 'Heal';

export interface EnemyDef {
  id: string;
  name: string;
  subject?: Subject;    // ✅ 전투 상성/과목(6)
  pattern: PatternKey;
  hpMul?: number;
  sprite: EnemySprite;  // ✅ 객체 스프라이트
}

// ───────────────────────────────────────────────────────────────────────────────
// 기본 ENEMIES (예시: 질문에서 준 3종 그대로 + 확장 가능)

export const ENEMIES: EnemyDef[] = [
  {
    id: 'E01', name: 'Blue Slime', subject: 'ENG', pattern: 'Shield', hpMul: 0.005,
    sprite: { type: 'Slime', variant: 'Blue', frames: { Move: 6, Attack: 8, Die: 8, Hit: 2 } }
  },
  {
    id: 'E02', name: 'Green Slime', subject: 'ENG', pattern: 'Aggressive', hpMul: 1.1,
    sprite: { type: 'Slime', variant: 'Green', frames: { Move: 6, Attack: 8, Die: 8, Hit: 2 } }
  },
  {
    id: 'E03', name: 'Red Slime', subject: 'KOR', pattern: 'Spiky', hpMul: 0.9,
    sprite: { type: 'Slime', variant: 'Red', frames: { Move: 6, Attack: 8, Die: 8, Hit: 2 } }
  },
];

// ───────────────────────────────────────────────────────────────────────────────
// 유틸: 타입 가드 & 색상/과목 추론

const ALL_SUBJECTS = ['KOR','ENG','MATH','SCI','SOC','HIST'] as const;
const isSubject = (x: any): x is Subject =>
  (ALL_SUBJECTS as readonly string[]).includes(x);

const ALL_COLORS = ['blank','blue','dark','green','red','yellow'] as const;
const isSkillColor = (x: any): x is SkillColor =>
  (ALL_COLORS as readonly string[]).includes(x);

// variant 문자열(대소문자/동의어) → SkillColor 매핑
const VARIANT_TO_COLOR: Record<string, SkillColor> = {
  blue: 'blue',
  azure: 'blue',
  cyan: 'blue',
  green: 'green',
  lime: 'green',
  red: 'red',
  crimson: 'red',
  yellow: 'yellow',
  gold: 'yellow',
  dark: 'dark',
  black: 'dark',
  purple: 'dark', // 없으면 제거 가능
  blank: 'blank',
  gray: 'blank',
  grey: 'blank',
  white: 'blank',
};

// 스프라이트에서 색 추론
export function colorFromSprite(sprite: EnemySprite): SkillColor | undefined {
  const v = (sprite?.variant ?? '').toString().toLowerCase();
  const c = VARIANT_TO_COLOR[v];
  return isSkillColor(c) ? c : undefined;
}

// 색상 → 과목 역매핑 (affinity.ts의 COLOR_TO_SUBJECT 사용)
export function subjectFromSprite(sprite: EnemySprite): Subject | undefined {
  const c = colorFromSprite(sprite);
  return c ? COLOR_TO_SUBJECT[c] : undefined;
}

// 프레임 조회(기본치 보정)
const DEFAULT_FRAMES = { Move: 4, Attack: 4, Die: 4, Hit: 2 } as const;
export function getFrameCount(sprite: EnemySprite, kind: keyof typeof DEFAULT_FRAMES): number {
  return sprite.frames?.[kind] ?? DEFAULT_FRAMES[kind];
}

// 경로 유틸(예: 이미지 베이스 경로)
export function spriteBasePath(sp: EnemySprite) {
  // 예: Enemy/Slime/Blue
  return `Enemy/${sp.type}/${sp.variant}`;
}

// ───────────────────────────────────────────────────────────────────────────────
// 선택/픽: URLSearchParams 기반 적 선택 + subject 확정
// - enemy: id (예: 'E01')
// - esubj: 과목 강제 (예: 'SCI')

export function pickEnemyByQuery(
  qs: URLSearchParams,
  list: EnemyDef[] = ENEMIES
): EnemyDef {
  // 1) id로 베이스 선택
  const key = qs.get('enemy') ?? 'E01';
  const base = list.find(e => e.id === key) ?? list[0];

  // 2) 과목 강제(esubj)가 유효하면 최우선
  const forced = (qs.get('esubj') || '').toUpperCase();
  if (isSubject(forced)) return { ...base, subject: forced as Subject };

  // 3) 모델에 과목 있으면 그대로
  if (base.subject && isSubject(base.subject)) return base;

  // 4) 스프라이트 → 색 → 과목 역매핑
  const sj = subjectFromSprite(base.sprite);
  if (sj && isSubject(sj)) return { ...base, subject: sj };

  // 5) 최종 기본값
  return { ...base, subject: 'ENG' };
}
