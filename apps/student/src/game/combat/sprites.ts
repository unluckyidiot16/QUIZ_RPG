// apps/student/src/game/combat/sprites.ts
import type { EnemySprite } from './enemy';

export const ENEMY_ASSET_ROOT =
  'https://unluckyidiot16.github.io/assets-common/QuizRpg/Enemy/';

export type EnemyState = 'Move' | 'Attack' | 'Die';

/** 1프레임 URL을 생성 (번호는 1부터) */
export function enemyFrameUrl(s: EnemySprite, state: EnemyState, frame: number = 1) {
  // 예: Enemy/Slime/Move/Slime_Move_Blue1.png
  const { type, variant } = s;
  return `${ENEMY_ASSET_ROOT}${type}/${state}/${type}_${state}_${variant}${frame}.png`;
}

/** 해당 상태의 프레임 수(없으면 1) */
export function stateFrameCount(s: EnemySprite, state: EnemyState) {
  return s.frames?.[state] ?? 1;
}
