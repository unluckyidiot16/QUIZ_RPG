import {
  ENEMY_CRIT_CHANCE, ENEMY_NORMAL_DMG, ENEMY_STRONG_DMG,
  ENEMY_WEAK_DMG, SHIELD_RATIO, SPIKE_RETALIATION
} from './constants';

export type TurnCtx = { rng: () => number; turn: number };

export type EnemyAction = {
  dmgToPlayer: number;     // 이번 턴 플레이어가 받을 피해(오답 시)
  shieldActive?: boolean;  // 이번 턴 "플레이어가 적에게 주는 피해"에 실드 적용 여부
  spikeOnHit?: number;     // 이번 턴 "플레이어가 적을 때릴 경우" 반격 피해(플레이어에게)
};

const crit = (base: number, rng: () => number, chance: number) =>
  base + (rng() < chance ? Math.ceil(base * 0.5) : 0);

// 3턴마다 강공격, 나머지 보통 공격. 낮은 확률로 크리
export function actAggressive(ctx: TurnCtx): EnemyAction {
  const base = (ctx.turn % 3 === 0) ? ENEMY_STRONG_DMG : ENEMY_NORMAL_DMG;
  return { dmgToPlayer: crit(base, ctx.rng, ENEMY_CRIT_CHANCE) };
}

// 2턴마다 실드(받는 피해 절반). 공격은 늘 약공격
export function actShield(ctx: TurnCtx): EnemyAction {
  return {
    dmgToPlayer: ENEMY_WEAK_DMG,
    shieldActive: ctx.turn % 2 === 0, // 짝수턴 실드
  };
}

// 항상 약공격, 대신 "플레이어가 적을 때리면" 반격 고정 피해
export function actSpiky(_ctx: TurnCtx): EnemyAction {
  return {
    dmgToPlayer: ENEMY_WEAK_DMG,
    spikeOnHit: SPIKE_RETALIATION,
  };
}

export type PatternKey = 'Aggressive'|'Shield'|'Spiky';
export function actByPattern(kind: PatternKey, ctx: TurnCtx): EnemyAction {
  if (kind === 'Aggressive') return actAggressive(ctx);
  if (kind === 'Shield')     return actShield(ctx);
  return actSpiky(ctx);
}

/** 실드 적용: 플레이어가 적에게 주는 피해에 적용 */
export const applyShieldToDamage = (raw: number, shieldActive?: boolean) =>
  shieldActive ? Math.ceil(raw * SHIELD_RATIO) : raw;
