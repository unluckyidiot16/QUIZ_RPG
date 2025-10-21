// Stage 정의 & 런타임 유틸
import { type Subject } from '../game/combat/affinity';
import type { DropTable } from './loot';

export type StageDef = {
  id: string;
  name: string;
  packId: string;          // 사용할 퀴즈 팩 ID (없으면 'sample')
  enemyId: string;         // ENEMIES 내부 id (E01..)
  subjectPool?: Subject[]; // 이 스테이지에서 주로 나오는 과목 후보(없으면 6과목)
  drops?: DropTable;       // 스테이지 전용 드랍 테이블(없으면 기본)
};

export const STAGES: Record<string, StageDef> = {
  ST01: {
    id: 'ST01', name: '초원 1', packId: 'sample', enemyId: 'E01',
    subjectPool: ['KOR','ENG','MATH','SCI','SOC','HIST'],
    drops: {
      seedBase: 'ST01', pulls: 1,
      entries: [
        { kind:'item', id:'w_iron_sword',  weight:5 },
        { kind:'item', id:'a_chain_mail',  weight:3 },
        { kind:'item', id:'acc_lucky_charm', weight:2 },
      ]
    }
  },
  ST02: {
       id:'ST02', name:'숲 2', packId:'sample', enemyId:'E02',
     subjectPool:['KOR','ENG','MATH','SCI','SOC','HIST'],
     drops:{
       seedBase:'ST02', pulls:1, 
       entries:[
        {kind:'item', id:'w_iron_sword', weight:3},
        {kind:'item', id:'a_chain_mail', weight:4},
        {kind:'item', id:'acc_lucky_charm', weight:3},
       ]
     }
  },
  ST03: {
     id:'ST03', name:'동굴 3', packId:'sample', enemyId:'E03',
       subjectPool:['KOR','ENG','MATH','SCI','SOC','HIST'],
       drops:{ 
        seedBase:'ST03', pulls:1,
        entries:[
         {kind:'item', id:'w_knight_blade', weight:2}, 
         {kind:'item', id:'a_chain_mail', weight:5},
         {kind:'item', id:'acc_lucky_charm', weight:3},
       ]
     }
  },
};

export function getStageFromQuery(qs: URLSearchParams): StageDef {
  const id = qs.get('stage') || 'ST01';
  return STAGES[id] ?? STAGES['ST01'];
}

// 결정론 4과목 선택 (스테이지/턴/seed 기반)
function mulberry32(a:number){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296 } }
const hash32 = (s:string)=>{ let h=2166136261>>>0; for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619) } return h>>>0; };

export function selectSubjectsForTurn(stage: StageDef, turn: number, seed: string): Subject[] {
  const pool = (stage.subjectPool && stage.subjectPool.length ? stage.subjectPool : ['KOR','ENG','MATH','SCI','SOC','HIST']) as Subject[];
  const rng = mulberry32(hash32(`${stage.id}:${seed}:${turn}`));
  const arr = [...pool];
  for (let i=arr.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]] }
  return arr.slice(0, 4);
}

// 런타임(클리어 카운트) — 로컬 저장
const RT_KEY = 'qd:stage';
export function getStageRuntime(stageId: string){
  const raw = JSON.parse(localStorage.getItem(RT_KEY) ?? '{}');
  return { clearCount: Number(raw?.[stageId]?.clearCount ?? 0) };
}
export function recordStageClear(stageId: string){
  const raw = JSON.parse(localStorage.getItem(RT_KEY) ?? '{}');
  const cur = Number(raw?.[stageId]?.clearCount ?? 0) + 1;
  raw[stageId] = { clearCount: cur };
  localStorage.setItem(RT_KEY, JSON.stringify(raw));
  return { clearCount: cur };
}

// 스테이지별 드랍 테이블 조회
export function stageDropTable(stage: StageDef){
  return stage.drops ?? {
    seedBase: stage.id, pulls: 1,
    entries: [
      { kind:'item', id:'w_iron_sword',  weight:5 },
      { kind:'item', id:'a_chain_mail',  weight:3 },
      { kind:'item', id:'acc_lucky_charm', weight:2 },
    ]
  };
}
