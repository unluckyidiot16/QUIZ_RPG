// ---- Mock 구현 (프론트 선개발용) ----
const rnd = () => crypto.randomUUID();
const now = () => new Date();
const addMin = (d, m) => new Date(d.getTime() + m * 60000);
class MockAccessService {
    constructor() {
        this.store = new Map();
    }
    async guestLogin(token) {
        const t = this.store.get(token);
        if (!t || t.revoked)
            throw new Error('invalid-token');
        const nowTs = now().toISOString();
        if (nowTs < t.validFrom || nowTs > t.validUntil)
            throw new Error('expired-token');
        return t.userId;
    }
    async issueTempId({ userId, nickname, ttlMin = 90, validFrom }) {
        const uid = userId ?? rnd();
        const vf = (validFrom ?? now()).toISOString();
        const vu = addMin(validFrom ?? now(), ttlMin).toISOString();
        const tok = { token: rnd(), userId: uid, validFrom: vf, validUntil: vu, revoked: false };
        this.store.set(tok.token, tok);
        // nickname은 Mock에선 저장하지 않지만 UI 라벨로는 전달 가능
        return tok;
    }
    async revoke(token) {
        const t = this.store.get(token);
        if (t) {
            t.revoked = true;
            this.store.set(token, t);
        }
    }
    async extend(token, minutes) {
        const t = this.store.get(token);
        if (t) {
            t.validUntil = addMin(new Date(t.validUntil), minutes).toISOString();
            this.store.set(token, t);
        }
    }
}
// ---- Supabase 구현(백 준비되면 이쪽으로 전환) ----
import { supabase } from "./supabaseClient";
class SupabaseAccessService {
    async guestLogin(token) {
        const { data, error } = await supabase.rpc('guest_login', { p_token: token });
        if (error)
            throw error;
        return data;
    }
    async issueTempId({ userId, nickname, ttlMin = 90, validFrom }) {
        const { data, error } = await supabase.rpc('admin_issue_temp_id', {
            p_user_id: userId ?? null,
            p_nickname: nickname ?? null,
            p_ttl_minutes: ttlMin,
            p_valid_from: (validFrom ?? new Date()).toISOString()
        });
        if (error)
            throw error;
        const [row] = Array.isArray(data) ? data : [data];
        return { userId: row.user_id, token: row.token, validFrom: row.valid_from, validUntil: row.valid_until };
    }
    async revoke(token) {
        const { error } = await supabase.rpc('admin_revoke_temp_id', { p_token: token });
        if (error)
            throw error;
    }
    async extend(token, minutes) {
        const { error } = await supabase.rpc('admin_extend_temp_id', { p_token: token, p_ttl_minutes: minutes });
        if (error)
            throw error;
    }
}
// ---- DI 스위치 ----
const MODE = import.meta.env?.VITE_ACCESS_MODE ?? 'mock';
export const accessService = MODE === 'supabase' ? new SupabaseAccessService() : new MockAccessService();
