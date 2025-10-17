// apps/student/src/core/bootstrap.ts
// 최초 1회 서버 동기화 + 기본 인벤토리 세팅 + 내부 큐/프루프 준비

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// === 타입(필요 슬롯만 남겨 사용) ===
export type Slot =
  | 'body'
  | 'eyes'
  | 'mouth'
  | 'frame'
  | 'hat'
  | 'badge'
  | 'bg';

export type Equip = Partial<Record<Slot, string>>;

export type WearableItem = {
  id: string;
  slot: Slot;
  name?: string;
  src: string;
  z?: number;
  default?: boolean;
  isDefault?: boolean;
  rarity?: string;
};

export type CatalogMap = Record<string, WearableItem>;
export type InventoryState = {
  equipped?: Equip;
  // 필요한 필드 있으면 추가
};

let _booting = false;
let _booted = false;

function getSb(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!url || !key) throw new Error('Missing Supabase env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
  return createClient(url, key);
}

// ---- 카탈로그 로드(프로젝트 기존 로더 대체/호출) ----
async function loadCatalog(): Promise<CatalogMap> {
  // 프로젝트의 기존 구현이 있으면 그걸 임포트해서 사용하세요.
  // 여기서는 공개 정적 JSON 경로 기준 예시:
  const res = await fetch('/data/catalog.json').catch(() => null);
  if (!res || !res.ok) return {};
  const arr = (await res.json()) as WearableItem[];
  const map: CatalogMap = {};
  for (const it of arr) map[it.id] = it;
  return map;
}

// ---- 기본 아이템 선택 ----
function pickDefaultId(catalog: CatalogMap, slot: Slot) {
  const items = Object.values(catalog).filter(i => i.slot === slot);
  return (
    items.find(i => i.default || i.isDefault)?.id ??
    items.find(i => i.rarity === 'common')?.id ??
    items[0]?.id
  );
}

function makeDefaultEquip(catalog: CatalogMap): Equip {
  const slots: Slot[] = ['body', 'eyes', 'mouth', 'frame', 'hat', 'badge', 'bg'];
  const eq: Equip = {};
  for (const s of slots) {
    const id = pickDefaultId(catalog, s);
    if (id) eq[s] = id;
  }
  return eq;
}

// ---- 로컬 스토리지 Fallback ----
const LS_KEY = 'qrpg.inv.v2';

function loadInvLocal(): InventoryState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveInvLocal(inv: InventoryState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(inv));
  } catch {}
}

// ---- 서버(슈파베이스) 인벤토리 (테이블명은 필요시 수정) ----
async function loadInvServer(sb: SupabaseClient): Promise<InventoryState | null> {
  try {
    const { data: session } = await sb.auth.getSession();
    const uid = session?.session?.user?.id;
    if (!uid) return null;

    // 예시: inventories 테이블에 user_id, data(JSON) 컬럼이 있다고 가정
    const { data, error } = await sb
      .from('inventories')
      .select('data')
      .eq('user_id', uid)
      .single();
    if (error) return null;
    return (data?.data ?? null) as InventoryState | null;
  } catch {
    return null;
  }
}

async function saveInvServer(sb: SupabaseClient, inv: InventoryState): Promise<boolean> {
  try {
    const { data: session } = await sb.auth.getSession();
    const uid = session?.session?.user?.id;
    if (!uid) return false;

    const { error } = await sb
      .from('inventories')
      .upsert({ user_id: uid, data: inv }, { onConflict: 'user_id' });
    return !error;
  } catch {
    return false;
  }
}

// ---- Auth 보장(익명 로그인) ----
async function ensureAuth(sb: SupabaseClient) {
  const { data } = await sb.auth.getSession();
  if (data.session) return;
  // supabase-js v2.7+ 익명 로그인 지원 (2.75.0 사용 로그 확인됨)
  const { error } = await sb.auth.signInAnonymously();
  if (error) throw error;
}

// ---- (선택) 전투에서 하던 초기화 미리 실행 ----
async function initProofOrQueues() {
  // 전투 진입시 1회 하던 초기화가 있다면 이곳으로 이동 (안전하게 no-op)
  // ex) await proof.init(); await queue.init();
}

// ---- 부트스트랩 본체 ----
export async function bootstrapApp(): Promise<void> {
  if (_booted || _booting) return;
  _booting = true;

  try {
    const sb = getSb();
    await ensureAuth(sb);

    // 카탈로그/인벤토리 로드
    const [catalog, invServer, invLocal] = await Promise.all([
      loadCatalog(),
      loadInvServer(sb),
      Promise.resolve(loadInvLocal()),
    ]);

    // 우선순위: 서버 > 로컬 > 빈값
    let inv: InventoryState = invServer ?? invLocal ?? {};

    // 기본 착용 보장
    const needs = !inv?.equipped || Object.keys(inv.equipped!).length === 0;
    if (needs) {
      inv = { ...inv, equipped: makeDefaultEquip(catalog) };
    }

    // 저장: 서버 시도 → 실패 시 로컬
    const ok = await saveInvServer(sb, inv);
    if (!ok) saveInvLocal(inv);

    // (선택) 프로필 초기 마킹
    try {
      const { data: session } = await sb.auth.getSession();
      const uid = session?.session?.user?.id;
      if (uid) {
        await sb.from('profiles').upsert({ user_id: uid, init_done: true }, { onConflict: 'user_id' });
      }
    } catch {
      /* ignore */
    }

    await initProofOrQueues();
    _booted = true;
  } finally {
    _booting = false;
  }
}

// === 라우터에서 쓰기 좋게 기존 API도 내보내기 ===
export async function bootstrapFirstRun() {
  // 기존 파일에서 이 함수를 이미 사용 중이었으므로, 내부에서 bootstrapApp을 호출
  await bootstrapApp();
}
