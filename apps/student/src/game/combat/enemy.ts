// apps/student/src/game/combat/enemy.ts
import type { Elem } from './affinity';
import type { PatternKey } from './patterns';

export type EnemySprite = {
  type: 'Slime' | 'Goblin';      // 폴더명 (Enemy/<type>/…)
  variant: 'Blue' | 'Green' | 'Red' | string;
  frames?: Partial<Record<'Move'|'Attack'|'Die'|'Hit', number>>;
};

export type EnemyDef = {
  id: string;
  name: string;
  elem: Elem;
  pattern: PatternKey;
  hpMul?: number;
  sprite: EnemySprite;
};

export const ENEMIES: EnemyDef[] = [
  {
    id: 'E01', name: 'Blue Slime', elem: 'SCI', pattern: 'Shield', hpMul: 1.0,
    sprite: { type: 'Slime', variant: 'Blue', frames: { Move: 6, Attack: 8, Die: 8, Hit: 2 } }
  },
  {
    id: 'E02', name: 'Goblin', elem: 'ENG', pattern: 'Aggressive', hpMul: 1.1,
    sprite: { type: 'Goblin', variant: 'Green', frames: { Move: 4, Attack: 4, Die: 4, Hit: 2 } }
  },
  {
    id: 'E03', name: 'Thorn Slime', elem: 'SOC', pattern: 'Spiky', hpMul: 0.9,
    sprite: { type: 'Slime', variant: 'Red', frames: { Move: 4, Attack: 4, Die: 4, Hit: 2 } }
  },
];

export function pickEnemyByQuery(qs: URLSearchParams): EnemyDef {
  const id = qs.get('enemy');
  return ENEMIES.find(e => e.id === id) ?? ENEMIES[0];
}
