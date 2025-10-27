// /game/quiz/loadPack.ts
import { SUBJECTS, type Subject } from '../../core/char.types';

type PackIndex = {
  packId: string;
  version: number;
  subjects: Record<Subject,string>;
  general?: string;
  counts?: Partial<Record<Subject| 'GEN', number>>;
};

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

export async function loadPackItems(packId: string, needed: readonly Subject[], signal?: AbortSignal){
  const base = `/packs/${packId}`;
  // 1) 구버전 단일 파일 시도
  try {
    const one = await fetchJSON<any[]>(`${base}.json`, { signal });
    if (Array.isArray(one)) return one;
  } catch { /* ignore */ }

  // 2) 신버전 index.json 사용
  const idx = await fetchJSON<PackIndex>(`${base}/index.json`, { signal });

  // 필요 과목 + GEN(일반) 동시 로드
  const want = new Set<Subject>(needed as Subject[]);
  const urls: string[] = [];
  for (const s of want) {
    const f = idx.subjects[s];
    if (f) urls.push(`${base}/${f}`);
  }
  if (idx.general) urls.push(`${base}/${idx.general}`);

  const chunks = await Promise.all(urls.map(u => fetchJSON<any[]>(u, { signal })));
  return chunks.flat();
}
