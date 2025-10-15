import { createClient } from '@supabase/supabase-js';

export type RunSummary = {
  finalHash: string;
  turns: number;
  durationSec: number;
  cleared: boolean;
  runToken: string;
};

const url = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const sb = createClient(url, anon);

async function authLogin(nickname = 'guest'): Promise<string> {
  const { data, error } = await sb.rpc('auth_login', { nickname });
  if (error) throw error;
  return data as string; // user_id
}

async function enterDungeon(): Promise<string> {
  const { data, error } = await sb.rpc('enter_dungeon');
  if (error) throw error;
  return data as string; // run_id
}

export async function finishDungeon(summary: RunSummary) {
  const { error } = await sb.rpc('finish_dungeon', {
    p_run_id: summary.runToken,     // run_id = runToken(간단 루트)
    p_user_id: await authLogin('web-student'),
    p_run_token: summary.runToken,  // 멱등 키
    p_final_hash: summary.finalHash,
    p_turns: summary.turns,
    p_duration: summary.durationSec,
    p_cleared: summary.cleared,
  });
  if (error) throw error;
  return { ok: true as const };
}

/** 러프하게 runToken을 발급해서 저장하는 헬퍼 */
export async function ensureRunToken(): Promise<string> {
  const key = 'qd:runToken';
  let tok = localStorage.getItem(key);
  if (!tok) {
    tok = await enterDungeon(); // 서버에서 run_id 발급
    localStorage.setItem(key, tok);
  }
  return tok;
}
