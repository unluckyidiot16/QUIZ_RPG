// apps/student/src/game/combat/affinity.ts
import type { Subject } from '../core/char.types';
export type SkillColor = 'blank'|'blue'|'dark'|'green'|'red'|'yellow';

export const SUBJECT_ORDER: Subject[] = ['KOR','ENG','MATH','SCI','SOC','HIST'];

export const BAL = {
  WEAK_MULT: 1.5,      // 유리
  RESIST_MULT: 0.5,    // 불리 (0은 소프트락 유발 가능, 튜토리얼 제외 권장 X)
  IMMUNE_MULT: 0,      // 완전 면역 (특수 적에서만 사용)
  MIN_HIT_DAMAGE: 0,   // ← 요청대로 0피해 허용(UX로 표시)
};

const WHEEL: Subject[] = ['KOR','ENG','MATH','SCI','SOC','HIST'];

export const SUBJECT_TO_COLOR: Record<Subject, SkillColor> = {
  KOR:'blank', ENG:'blue', MATH:'dark', SCI:'green', SOC:'red', HIST:'yellow',
};
export const COLOR_TO_SUBJECT: Record<SkillColor, Subject> = {
  blank:'KOR', blue:'ENG', dark:'MATH', green:'SCI', red:'SOC', yellow:'HIST',
};

export const SKILL_HEX = {
  blank:'#e5e7eb', blue:'#60a5fa', dark:'#64748b',
  green:'#34d399', red:'#f87171', yellow:'#fbbf24',
} as const;

export const COLOR_CLS = {
  blank:{ bg:'bg-slate-800', text:'text-slate-200', ring:'ring-slate-400' },
  blue:{ bg:'bg-blue-900/40', text:'text-blue-300', ring:'ring-blue-400' },
  dark:{ bg:'bg-slate-900/60', text:'text-slate-300', ring:'ring-slate-500' },
  green:{ bg:'bg-emerald-900/40', text:'text-emerald-300', ring:'ring-emerald-400' },
  red:{ bg:'bg-rose-900/40', text:'text-rose-300', ring:'ring-rose-400' },
  yellow:{ bg:'bg-amber-900/40', text:'text-amber-300', ring:'ring-amber-400' },
} as const;

// 6각 순환 상성: att가 def의 '다음 칸'이면 강(1.25), '이전 칸'이면 약(0.8)
export function subjectMultiplier(attacker: Subject, defender: Subject): number {
  if (!attacker || !defender) return 1.0;
  if (attacker === defender) return 1.0;
  const a = WHEEL.indexOf(attacker);
  const d = WHEEL.indexOf(defender);
  if (a < 0 || d < 0) return 1.0;

  // 유리: 공격자의 다음 칸이 방어자
  if (d === (a + 1) % WHEEL.length) return BAL.WEAK_MULT;
  // 불리: 공격자의 이전 칸이 방어자
  if (d === (a + WHEEL.length - 1) % WHEEL.length) return BAL.RESIST_MULT;

  return 1.0;
}

/** 안정형 데미지: (atk * mult) 를 바닥(Floor), min-hit 보정(옵션) */
export function calcDamage(atk: number, mult: number, minHit = BAL.MIN_HIT_DAMAGE): number {
  let dmg = Math.floor(Math.max(0, atk) * Math.max(0, mult));
  if (mult > 0 && dmg < minHit) dmg = minHit;  // 지금은 minHit=0 → 0 허용
  return dmg;
}
