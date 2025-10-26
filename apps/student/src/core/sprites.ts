// apps/student/src/game/combat/sprites.ts
import type { EnemySprite } from './enemy';

export const ENEMY_ASSET_ROOT =
  'https://unluckyidiot16.github.io/assets-common/QuizRpg/Enemy/';

export type EnemyState = 'Move' | 'Attack' | 'Die' | 'Hit';

/** 1프레임 URL을 생성 (번호는 1부터) */
export function enemyFrameUrl(s: EnemySprite, state: EnemyState, frame: number = 1) {
  // 예: Enemy/Slime/Move/Slime_Move_Blue1.png
  const { type, variant } = s;
  const st = resolveStateForUrl(s, state);
  return `${ENEMY_ASSET_ROOT}${type}/${st}/${type}_${st}_${variant}${frame}.png`;
}

function resolveStateForUrl(sprite: EnemySprite, state: EnemyState): 'Move'|'Attack'|'Die' {
  const has = (sprite.frames?.[state] ?? 0) > 0;
  if (has) return state as any;
  return state === 'Hit' ? 'Move' : (state as any);
  }

/** 해당 상태의 프레임 수(없으면 1) */
export function stateFrameCount(s: EnemySprite, state: EnemyState) {
    return s.frames?.[state] ?? 1;
}

export function hitTintStyle(state: EnemyState): React.CSSProperties | undefined {
  if (state !== 'Hit') return;
  // sepia + saturate + hue-rotate 로 빠른 레드 틴트 (GPU 가속)
  return { filter: 'sepia(1) saturate(6) hue-rotate(-20deg) brightness(1.15)' };
}

