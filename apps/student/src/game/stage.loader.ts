import type { Subject } from '../core/char.types';
import type { DropTable } from './loot';

export type Difficulty = 'EASY'|'NORMAL'|'HARD';

export type StageRule = {
  enemyPool: { id: string; w: number }[];
  question?: { min?: number; max?: number; tagsAllow?: string[]; tagsDeny?: string[] };
  drops?: DropTable;
};

export type StageJson = {
  id: string; name: string; packId: string;
  subjectPool?: Subject[];
  defaultDifficulty?: Difficulty;
  difficulties: Record<Difficulty, StageRule>;
};

export type StageDB = Record<string, StageJson>;

let _cache: StageDB | null = null;

export async function loadStageDB(url = '/packs/stages.v1.json'): Promise<StageDB> {
  if (_cache) return _cache;
  const res = await fetch(url);
  _cache = await res.json() as StageDB;
  return _cache!;
}

export async function getStageFromQuery(qs: URLSearchParams) {
  const id = qs.get('stage') || 'ST01';
  const db = await loadStageDB();
  return db[id] ?? Object.values(db)[0];
}

export function getDifficulty(qs: URLSearchParams, st: StageJson): Difficulty {
  const q = (qs.get('diff') || '').toUpperCase();
  return (q==='EASY'||q==='HARD'||q==='NORMAL') ? (q as Difficulty) : (st.defaultDifficulty || 'NORMAL');
}

// 가중치 랜덤 선택
function pickWeighted<T extends {w:number}>(arr: T[], rng: ()=>number){
  const sum = arr.reduce((a,x)=>a+(x.w||0),0) || 0;
  if (!sum) return arr[0];
  let r = rng()*sum;
  for (const x of arr){ r -= (x.w||0); if (r <= 0) return x; }
  return arr[arr.length-1];
}

export function pickEnemyForTurn(st: StageJson, diff: Difficulty, rng: ()=>number): string {
  const pool = st.difficulties?.[diff]?.enemyPool || [];
  if (!pool.length) return 'E01';
  return pickWeighted(pool, rng).id;
}

// picker.ts의 DiffSelector에 물려줄 함수
export function makeDiffSelector(st: StageJson, diff: Difficulty){
  const rule = st.difficulties?.[diff]?.question;
  return (params: { level:number, subject: Subject }) => {
    if (!rule) return undefined;
    // min/max 평균을 타깃으로
    const hasMin = Number.isFinite(rule.min as any);
    const hasMax = Number.isFinite(rule.max as any);
    if (hasMin && hasMax) return Math.round(((rule.min as number)+(rule.max as number))/2);
    if (hasMin) return rule.min;
    if (hasMax) return rule.max;
    return undefined;
  };
}

// 난이도별 드랍 테이블
export function stageDropTableByDiff(st: StageJson, diff: Difficulty): DropTable | undefined {
  return st.difficulties?.[diff]?.drops;
}
