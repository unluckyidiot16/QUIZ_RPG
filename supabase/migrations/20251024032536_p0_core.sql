-- P0 Core (merged): 멱등 영수증 + 런 수명주기 RPC + FK/인덱스 + RLS
begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) 함수 충돌 방지: 기존 시그니처를 반환타입 불문 드롭 후 재생성
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.finish_dungeon(uuid, uuid, text, text, integer, integer, boolean);
drop function if exists public.apply_receipt(text, uuid, text, jsonb);
drop function if exists public.enter_dungeon();
drop function if exists public.auth_login(text);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) 로그인(upsert) : auth.uid() → qd_users 보장, user_id 반환
-- ─────────────────────────────────────────────────────────────────────────────
create function public.auth_login(nickname text default 'web-student')
  returns uuid
  language plpgsql
as $$
declare
uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'auth.uid() is null; only authenticated clients may call this';
end if;

insert into public.qd_users(user_id, nickname)
values (uid, coalesce(nullif(nickname, ''), 'web-student'))
  on conflict (user_id) do update
                             set nickname = excluded.nickname
                           where public.qd_users.nickname is distinct from excluded.nickname;

return uid;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) 런 발급 : qd_runs에 run_id 생성 후 반환
-- ─────────────────────────────────────────────────────────────────────────────
create function public.enter_dungeon()
  returns uuid
  language plpgsql
as $$
declare
rid uuid;
begin
  rid := gen_random_uuid();
insert into public.qd_runs(run_id) values (rid);
return rid;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) 런 종료 : run_token 멱등 기반 요약 저장, jsonb 결과 반환
-- ─────────────────────────────────────────────────────────────────────────────
create function public.finish_dungeon(
  p_run_id     uuid,
  p_user_id    uuid,
  p_run_token  text,
  p_final_hash text,
  p_turns      integer,
  p_duration   integer,
  p_cleared    boolean
) returns jsonb
  language plpgsql
as $$
declare
existed boolean;
begin
select exists(
  select 1 from public.qd_run_summaries where run_token = p_run_token
) into existed;

if not existed then
    insert into public.qd_run_summaries(
      run_id, user_id, run_token, final_hash, turns, duration_sec, cleared
    ) values (
      p_run_id, p_user_id, p_run_token, p_final_hash, p_turns, p_duration, p_cleared
    );
end if;

return jsonb_build_object('ok', true, 'idempotent', existed);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) 영수증 멱등 기록 : key 기반 no-op, jsonb 결과 반환
-- ─────────────────────────────────────────────────────────────────────────────
create function public.apply_receipt(
  p_id      text,
  p_user    uuid,
  p_reason  text,
  p_payload jsonb
) returns jsonb
  language plpgsql
as $$
declare
existed boolean;
begin
select exists(
  select 1 from public.qd_receipts where id = p_id
) into existed;

if not existed then
    insert into public.qd_receipts(id, user_id, reason, payload)
    values (p_id, p_user, p_reason, coalesce(p_payload, '{}'::jsonb));
    -- TODO: p_reason 별 지갑/인벤 반영 로직을 여기에 추가 가능
end if;

return jsonb_build_object('ok', true, 'idempotent', existed);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) 권한 : 클라이언트에서 RPC 호출 가능하도록 GRANT
-- ─────────────────────────────────────────────────────────────────────────────
grant execute on function public.auth_login(text) to anon, authenticated, service_role;
grant execute on function public.enter_dungeon() to anon, authenticated, service_role;
grant execute on function public.finish_dungeon(uuid, uuid, text, text, integer, integer, boolean)
  to anon, authenticated, service_role;
grant execute on function public.apply_receipt(text, uuid, text, jsonb)
  to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) FK/인덱스 보강
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'qd_receipts_user_id_fkey') then
alter table public.qd_receipts
  add constraint qd_receipts_user_id_fkey
    foreign key (user_id) references public.qd_users(user_id);
end if;
end $$;

create index if not exists idx_qd_run_summaries_userid_created
  on public.qd_run_summaries(user_id, created_at desc);

create index if not exists idx_qd_receipts_userid_created
  on public.qd_receipts(user_id, created_at desc);

create index if not exists idx_qr_tokens_batch_status_exp
  on public.qr_tokens(batch_id, status, expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) RLS(본인 것만 접근) — service_role은 자동 우회
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.qd_users          enable row level security;
alter table public.qd_wallets        enable row level security;
alter table public.qd_run_summaries  enable row level security;
alter table public.qd_receipts       enable row level security;
alter table public.qd_runs           enable row level security;

-- qd_users
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qd_users' and policyname='own-user-read') then
    create policy "own-user-read"   on public.qd_users for select using (user_id = auth.uid());
end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qd_users' and policyname='own-user-insert') then
    create policy "own-user-insert" on public.qd_users for insert with check (user_id = auth.uid());
end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qd_users' and policyname='own-user-update') then
    create policy "own-user-update" on public.qd_users for update using (user_id = auth.uid()) with check (user_id = auth.uid());
end if;
end $$;

-- qd_wallets
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qd_wallets' and policyname='own-wallet-read') then
    create policy "own-wallet-read"   on public.qd_wallets for select using (user_id = auth.uid());
end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qd_wallets' and policyname='own-wallet-update') then
    create policy "own-wallet-update" on public.qd_wallets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
end if;
end $$;

-- qd_run_summaries
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qd_run_summaries' and policyname='own-summary-read') then
    create policy "own-summary-read"   on public.qd_run_summaries for select using (user_id = auth.uid());
end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qd_run_summaries' and policyname='own-summary-insert') then
    create policy "own-summary-insert" on public.qd_run_summaries for insert with check (user_id = auth.uid());
end if;
end $$;

-- qd_receipts
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qd_receipts' and policyname='own-receipt-read') then
    create policy "own-receipt-read"   on public.qd_receipts for select using (user_id = auth.uid());
end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qd_receipts' and policyname='own-receipt-insert') then
    create policy "own-receipt-insert" on public.qd_receipts for insert with check (user_id = auth.uid());
end if;
end $$;

-- qd_runs : user_id 컬럼이 없으므로, 본인 요약이 존재하는 run만 열람 허용
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qd_runs' and policyname='owned-run-read') then
    create policy "owned-run-read" on public.qd_runs for select
                                                                using (
                                                                exists (
                                                                select 1 from public.qd_run_summaries s
                                                                where s.run_id = qd_runs.run_id and s.user_id = auth.uid()
                                                                )
                                                                );
end if;
end $$;

commit;
