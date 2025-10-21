// core/enemyLoader.ts
import { ENEMIES, type EnemyDef } from '../game/combat/enemy';

// 런타임 소스 선택: 기본 = 하드코딩, 옵션 = JSON
export async function loadEnemyDB(jsonUrl?: string): Promise<Record<string, EnemyDef>> {
  if (!jsonUrl) return indexById(ENEMIES);
  try {
    const res = await fetch(jsonUrl);
    const arr = (await res.json()) as EnemyDef[];
    // 간단 검증(필수 키만)
    for (const e of arr) {
      if (!e.id || !e.pattern || !e.sprite) throw new Error('Invalid enemy row');
    }
    return indexById(arr);
  } catch (e) {
    console.warn('[enemy] JSON load failed, fallback to static', e);
    return indexById(ENEMIES);
  }
}

function indexById(list: EnemyDef[] | Record<string, EnemyDef>){
  const entries = Array.isArray(list) ? list.map(e=>[e.id, e] as const) : Object.entries(list);
  return Object.fromEntries(entries) as Record<string, EnemyDef>;
}
