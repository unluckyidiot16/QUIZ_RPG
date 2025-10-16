import type { RunSummary } from '../api';

const KEY = 'qd:finishQueue';

type Job = { id: string; summary: RunSummary; retries: number; nextAt: number };

function load(): Job[] { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function save(q: Job[]){ localStorage.setItem(KEY, JSON.stringify(q)); }
function now(){ return Date.now(); }
function backoff(r: number){ return Math.min(30_000, [1000, 3000, 7000, 15000][r] ?? 30000); }

export function enqueue(summary: RunSummary){
  const q = load();
  q.push({ id: crypto.randomUUID(), summary, retries: 0, nextAt: now() });
  save(q);
}

export function initQueue(submit: (s: RunSummary)=>Promise<unknown>){
  async function drain(){
    const q = load();
    const rest: Job[] = [];
    for (const job of q){
      if (job.nextAt > now()) { rest.push(job); continue; }
      try { await submit(job.summary); }
      catch {
        job.retries += 1;
        job.nextAt = now() + backoff(job.retries);
        rest.push(job);
      }
    }
    save(rest);
  }
  window.addEventListener('online', drain);
  setInterval(drain, 5000);
  // 첫 호출
  drain().catch(()=>{});
}
