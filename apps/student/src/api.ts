// apps/student/src/api.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type RunSummary = {
  finalHash: string;
  turns: number;
  durationSec: number;
  cleared: boolean;
  runToken: string; // 서버의 run_id 를 그대로 사용
};

let sb: SupabaseClient | null = null;
const url  = import.meta.env.VITE_SUPABASE_URL?.trim();
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const SUPABASE_READY =
  !!url && /^https?:\/\//i.test(url) && !!anon;

function getClient(): SupabaseClient {
  if (!SUPABASE_READY) throw new Error('[env] Supabase not configured');
  if (!sb) sb = createClient(url!, anon!);
  return sb;
}

// 1) 로그인 → user_id 반환, 로컬 캐시
export async function authLogin(nickname = 'web-student'): Promise<string> {
  const { data, error } = await getClient().rpc('auth_login', { nickname });
  if (error) throw error;
  return data as string;
}

export async function getUserId(): Promise<string> {
  const K = 'qd:userId';
  let id = localStorage.getItem(K);
  if (!id) {
    id = await authLogin();
    localStorage.setItem(K, id);
  }
  return id;
}

// 2) run_id 발급 및 저장
export async function enterDungeon(): Promise<string> {
  const { data, error } = await getClient().rpc('enter_dungeon');
  if (error) throw error;
  return data as string;
}

export async function ensureRunToken(): Promise<string> {
  const K = 'qd:runToken';
  let tok = localStorage.getItem(K);
  if (!tok) {
    tok = await enterDungeon();
    localStorage.setItem(K, tok);
  }
  return tok;
}

// 3) 종료 제출(멱등): 서버 응답(JSON) 그대로 반환
export async function finishDungeon(s: RunSummary): Promise<{ ok: true; idempotent: boolean }> {
  const { data, error } = await getClient().rpc('finish_dungeon', {
    p_run_id: s.runToken,
    p_user_id: await getUserId(),
    p_run_token: s.runToken,
    p_final_hash: s.finalHash,
    p_turns: s.turns,
    p_duration: s.durationSec,
    p_cleared: s.cleared,
  });
  if (error) throw error;
  return data as { ok: true; idempotent: boolean };
}

export async function newRunToken(): Promise<string> {
  const tok = await enterDungeon();             // 서버에서 새 run_id 발급
  localStorage.setItem('qd:runToken', tok);     // 다음 제출에 사용
  return tok;
}

export function resetLocalRunState() {
  // 이전 결과/표시 상태는 깨끗하게 비웁니다 (큐에는 영향 X)
  localStorage.removeItem('qd:lastResult');
}
