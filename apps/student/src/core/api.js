// apps/student/src/core/api.ts
import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
let sb = null;
function getClient() { return sb ?? (sb = createClient(url, anon)); }
const K_USER = 'qd:userId';
const K_RUN = 'qd:runToken';
export async function guestLogin(token) {
    const { data, error } = await getClient().rpc('guest_login', { p_token: token });
    if (error)
        throw new Error(error.message);
    const userId = String(data);
    localStorage.setItem(K_USER, userId);
    return userId;
}
export function getUserId() {
    return localStorage.getItem(K_USER);
}
export async function enterDungeon() {
    const { data, error } = await getClient().rpc('enter_dungeon');
    if (error)
        throw new Error(error.message);
    const runId = String(data);
    localStorage.setItem(K_RUN, runId);
    return runId;
}
export async function ensureRunToken() {
    const existing = localStorage.getItem(K_RUN);
    if (existing)
        return existing;
    return await enterDungeon();
}
