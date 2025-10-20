import type { Elem } from './affinity';
import type { PatternKey } from './patterns';

export type EnemyDef = {
  id: string;
  name: string;
  elem: Elem;        // 적 속성
  pattern: PatternKey;
  hpMul?: number;    // 기본 HP 배수(기본 1.0)
};

export const ENEMIES: EnemyDef[] = [
  { id: 'E01', name: 'Sentinel',   elem: 'SCI',  pattern: 'Shield',     hpMul: 1.0 },
  { id: 'E02', name: 'Ravager',    elem: 'ENG',  pattern: 'Aggressive', hpMul: 1.1 },
  { id: 'E03', name: 'Thornling',  elem: 'SOC',  pattern: 'Spiky',      hpMul: 0.9 },
];

// 쿼리(?enemy=E02) → 없으면 첫 항목
export function pickEnemyByQuery(qs: URLSearchParams): EnemyDef {
  const id = qs.get('enemy');
  return ENEMIES.find(e => e.id === id) ?? ENEMIES[0];
}
