// 공통 타입
export type UUID = string;

export interface TempToken {
  token: UUID;
  userId: UUID;
  validFrom: string;   // ISO
  validUntil: string;  // ISO
  revoked?: boolean;
}

export interface AccessService {
  guestLogin(token: UUID): Promise<UUID>;                          // token -> userId
  issueTempId(opts: { userId?: UUID; nickname?: string; ttlMin?: number; validFrom?: Date }): Promise<TempToken>;
  revoke(token: UUID): Promise<void>;
  extend(token: UUID, minutes: number): Promise<void>;
}

// ---- Mock 구현 (프론트 선개발용) ----
const rnd = () => crypto.randomUUID();
const now = () => new Date();
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

class MockAccessService implements AccessService {
  private store = new Map<UUID, TempToken>();

  async guestLogin(token: UUID): Promise<UUID> {
    const t = this.store.get(token);
    if (!t || t.revoked) throw new Error('invalid-token');
    const nowTs = now().toISOString();
    if (nowTs < t.validFrom || nowTs > t.validUntil) throw new Error('expired-token');
    return t.userId;
  }

  async issueTempId({ userId, nickname, ttlMin = 90, validFrom }: { userId?: UUID; nickname?: string; ttlMin?: number; validFrom?: Date; }): Promise<TempToken> {
    const uid = userId ?? rnd();
    const vf = (validFrom ?? now()).toISOString();
    const vu = addMin(validFrom ?? now(), ttlMin).toISOString();
    const tok: TempToken = { token: rnd(), userId: uid, validFrom: vf, validUntil: vu, revoked: false };
    this.store.set(tok.token, tok);
    // nickname은 Mock에선 저장하지 않지만 UI 라벨로는 전달 가능
    return tok;
  }

  async revoke(token: UUID): Promise<void> {
    const t = this.store.get(token); if (t) { t.revoked = true; this.store.set(token, t); }
  }
  async extend(token: UUID, minutes: number): Promise<void> {
    const t = this.store.get(token); if (t) { t.validUntil = addMin(new Date(t.validUntil), minutes).toISOString(); this.store.set(token, t); }
  }
}

// ---- Supabase 구현(백 준비되면 이쪽으로 전환) ----
import { supabase } from "./supabaseClient";

class SupabaseAccessService implements AccessService {
  async guestLogin(token: UUID): Promise<UUID> {
    const { data, error } = await supabase.rpc('guest_login', { p_token: token });
    if (error) throw error;
    return data as UUID;
  }
  async issueTempId({ userId, nickname, ttlMin = 90, validFrom }: { userId?: UUID; nickname?: string; ttlMin?: number; validFrom?: Date; }): Promise<TempToken> {
    const { data, error } = await supabase.rpc('admin_issue_temp_id', {
      p_user_id: userId ?? null,
      p_nickname: nickname ?? null,
      p_ttl_minutes: ttlMin,
      p_valid_from: (validFrom ?? new Date()).toISOString()
    });
    if (error) throw error;
    const [row] = Array.isArray(data) ? data : [data];
    return { userId: row.user_id, token: row.token, validFrom: row.valid_from, validUntil: row.valid_until };
  }
  async revoke(token: UUID): Promise<void> {
    const { error } = await supabase.rpc('admin_revoke_temp_id', { p_token: token });
    if (error) throw error;
  }
  async extend(token: UUID, minutes: number): Promise<void> {
    const { error } = await supabase.rpc('admin_extend_temp_id', { p_token: token, p_ttl_minutes: minutes });
    if (error) throw error;
  }
}

// ---- DI 스위치 ----
const MODE = (import.meta as any).env?.VITE_ACCESS_MODE ?? 'mock';
export const accessService: AccessService = MODE === 'supabase' ? new SupabaseAccessService() : new MockAccessService();
