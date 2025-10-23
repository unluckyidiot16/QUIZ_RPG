// apps/student/src/game/loot.ts
import { PlayerOps, makeReceiptKey } from '../core/player';
import type { Subject } from '../game/combat/affinity';
import * as api from '../api';
import { enqueue } from '../shared/lib/queue';

export type DropEntry =
  | { kind:'item'; id:string; min?:number; max?:number; weight?:number }
  | { kind:'gold'; amount:number; weight?:number };

export type DropTable = { seedBase:string; entries: DropEntry[]; pulls:number };

function mulberry32(a:number){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296 } }
const hash32 = (s:string)=>{ let h=2166136261>>>0; for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619) } return h>>>0; };

export function rollDrops(table: DropTable, runKey: string){
  const rng = mulberry32(hash32(table.seedBase + ':' + runKey));
  const bag: Record<string, number> = {};
  for (let p=0; p<table.pulls; p++){
    const pick = weightedPick(table.entries, rng());
    if (!pick) continue;
    if (pick.kind==='item'){
      const n = (pick.min ?? 1) + Math.floor(rng()*(((pick.max ?? pick.min) ?? 1) - (pick.min ?? 1) + 1));
      bag[pick.id] = (bag[pick.id] ?? 0) + n;
    }
    // gold 등 다른 보상 타입은 추후 확장
  }
  return bag; // {itemId: count}
}
function weightedPick(entries: DropEntry[], r:number){
  const ws = entries.map(e=> e.weight ?? 1); const sum = ws.reduce((a,b)=>a+b,0);
  if (sum<=0) return null; let t = r*sum;
  for (let i=0;i<entries.length;i++){ t -= ws[i]; if (t<=0) return entries[i] }
  return entries[entries.length-1];
}

type DropReceipt = {
  key: string;
  type: 'drop';
  runKey: string;
  payload: { id: string; n: number };
  };
const RECEIPT_KEY = 'qd:pendingReceipts';
function stashReceipt(rec: DropReceipt) {
  try {
    const arr: DropReceipt[] = JSON.parse(localStorage.getItem(RECEIPT_KEY) || '[]');
    arr.push(rec);
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(arr));
  } catch {}
  }
async function sendReceipt(rec: DropReceipt) {
    try {
        const fn = (api as any)?.applyReceipt;
        if (typeof fn === 'function') await fn(rec);
        else stashReceipt(rec); // API 미구현/오프라인이면 보관
      } catch {
        stashReceipt(rec);       // 실패 시 보관(재시도)
      }
  }

export async function applyDrops(table: DropTable, runKey: string){
  const bag = rollDrops(table, runKey);
  for (const [id,n] of Object.entries(bag)){
    const rcp = makeReceiptKey('item', { runKey, id, n });
    // 서버 멱등 스텁 호출 위치(선택): apply_receipt(rcp, user, 'drop', {id,n})
    void sendReceipt({ key: rcp, type: 'drop', runKey, payload: { id, n } });
    PlayerOps.grantItem(id, n);
  }
  return bag;
}
