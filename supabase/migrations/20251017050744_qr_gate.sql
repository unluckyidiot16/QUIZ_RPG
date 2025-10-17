-- extensions
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- QR 토큰 배치/토큰
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.qr_token_batches (
                                                     id           uuid primary key default gen_random_uuid(),
  class_id     uuid,
  created_by   uuid not null,
  expires_at   timestamptz not null,
  note         text,
  created_at   timestamptz not null default now()
  );

create table if not exists public.qr_tokens (
                                              id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references public.qr_token_batches(id) on delete cascade,
  student_id  uuid,
  status      text not null check (status in ('issued','used','revoked')) default 'issued',
  expires_at  timestamptz not null,
  used_at     timestamptz,
  device_fp   text,
  created_at  timestamptz not null default now()
  );

create index if not exists idx_qr_tokens_expires   on public.qr_tokens(expires_at);
create index if not exists idx_qr_tokens_status    on public.qr_tokens(status);
create index if not exists idx_qr_tokens_batch     on public.qr_tokens(batch_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 접속 게이트(차단/시간창) & 점검 플래그 & 감사 로그
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.account_access_rules (
                                                         user_id      uuid primary key,
                                                         status       text not null check (status in ('active','blocked')) default 'active',
  window_start timestamptz,
  window_end   timestamptz,
  reason       text,
  updated_by   uuid,
  updated_at   timestamptz not null default now()
  );

create table if not exists public.sys_flags (
                                              key        text primary key,
                                              value      jsonb not null, -- {"on":true,"message":"서버 점검 중","until":"2025-10-30T00:00:00Z"}
                                              updated_at timestamptz not null default now()
  );

create table if not exists public.access_audit (
                                                 id         bigint generated always as identity primary key,
                                                 user_id    uuid,
                                                 gate       text,
                                                 message    text,
                                                 ip         inet,
                                                 user_agent text,
                                                 created_at timestamptz not null default now()
  );
create index if not exists idx_access_audit_user on public.access_audit(user_id desc, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.qr_token_batches enable row level security;
alter table public.qr_tokens        enable row level security;
alter table public.account_access_rules enable row level security;
alter table public.sys_flags        enable row level security;
alter table public.access_audit     enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qr_token_batches' and policyname='allow_read_own_batches') then
    create policy allow_read_own_batches on public.qr_token_batches
      for select using (created_by = auth.uid());
end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qr_tokens' and policyname='deny_all_direct_rw_tokens') then
    create policy deny_all_direct_rw_tokens on public.qr_tokens
      for all using (false) with check (false);
end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='account_access_rules' and policyname='deny_all_direct_rw_rules') then
    create policy deny_all_direct_rw_rules on public.account_access_rules
      for all using (false) with check (false);
end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sys_flags' and policyname='deny_all_direct_rw_sysflags') then
    create policy deny_all_direct_rw_sysflags on public.sys_flags
      for all using (false) with check (false);
end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='access_audit' and policyname='deny_all_direct_rw_audit') then
    create policy deny_all_direct_rw_audit on public.access_audit
      for all using (false) with check (false);
end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 역할 폴백 테이블(프로필 없을 때 사용)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_roles (
                                               user_id   uuid primary key,
                                               role      text not null check (role in ('student','teacher','admin')),
  updated_at timestamptz not null default now()
  );
alter table public.user_roles enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='deny_all_user_roles'
  ) then
    create policy deny_all_user_roles on public.user_roles for all using (false) with check (false);
end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- is_staff(): 테이블 유무를 런타임에 체크(정적 plpgsql, 컴파일 안전)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_staff(p_user uuid)
returns boolean
language plpgsql
stable
as $$
declare
res boolean := false;
begin
  -- profiles가 있으면 우선 확인
  if to_regclass('public.profiles') is not null then
select exists (
  select 1 from public.profiles p
  where p.id = p_user and coalesce(p.role,'student') in ('teacher','admin')
) into res;
if res then return true; end if;
end if;

  -- user_roles가 있으면 폴백 확인
  if to_regclass('public.user_roles') is not null then
select exists (
  select 1 from public.user_roles ur
  where ur.user_id = p_user and ur.role in ('teacher','admin')
) into res;
if res then return true; end if;
end if;

return false;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 1) issue_qr_tokens: 교사가 N개 토큰 배치 발급
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.issue_qr_tokens(
  p_class_id uuid,
  p_count    int,
  p_expires_at timestamptz,
  p_note     text default null
)
returns setof public.qr_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
v_creator uuid := auth.uid();
  v_batch_id uuid;
begin
  if v_creator is null then
    raise exception 'not authenticated' using errcode = 'P0001';
end if;
  if not public.is_staff(v_creator) then
    raise exception 'only staff can issue tokens' using errcode = 'P0001';
end if;
  if p_count is null or p_count < 1 or p_count > 2000 then
    raise exception 'invalid count (1..2000)' using errcode = 'P0001';
end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'expires_at must be in the future' using errcode = 'P0001';
end if;

insert into public.qr_token_batches (class_id, created_by, expires_at, note)
values (p_class_id, v_creator, p_expires_at, p_note)
  returning id into v_batch_id;

insert into public.qr_tokens (batch_id, expires_at)
select v_batch_id, p_expires_at from generate_series(1, p_count);

return query select t.* from public.qr_tokens t where t.batch_id = v_batch_id;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 1.5) revoke_qr_token: 발행 취소
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.revoke_qr_token(p_token_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'only staff' using errcode='P0001';
end if;
update public.qr_tokens
set status='revoked'
where id=p_token_id and status='issued';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 2) consume_qr_token: 학생 인증 없이도 1회 귀속
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.consume_qr_token(
  p_token_id uuid,
  p_device_fp text default null
)
returns table(ok boolean, user_id uuid)
language plpgsql
security definer
set search_path=public
as $$
declare
v_status   text;
  v_expires  timestamptz;
  v_student  uuid;
begin
select status, expires_at, coalesce(student_id, gen_random_uuid())
into v_status, v_expires, v_student
from public.qr_tokens
where id = p_token_id
  for update;

if not found then
    raise exception 'invalid token' using errcode = 'P0001';
end if;
  if v_status <> 'issued' then
    raise exception 'token already used or revoked' using errcode = 'P0001';
end if;
  if v_expires <= now() then
    raise exception 'token expired' using errcode = 'P0001';
end if;

update public.qr_tokens
set status='used',
    student_id=v_student,
    used_at=now(),
    device_fp=p_device_fp
where id = p_token_id;

return query select true, v_student;
end $$;

comment on function public.consume_qr_token(uuid,text) is
  '학생 인증 없이 토큰을 1회 귀속하고 user_id를 부여/반환';

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 3) get_access_gate: user_id 인자로 게이트 판정 + 감사로그
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_access_gate(
  p_user_id uuid,
  p_user_agent text default null,
  p_ip inet default null
)
returns table(gate text, message text)
language plpgsql
security definer
set search_path=public
as $$
declare
v_gate text := 'ok';
  v_msg  text := '';
  v_flag jsonb;
  v_on   boolean;
  v_until timestamptz;
  v_rules record;
begin
  -- maintenance flag
select value into v_flag from public.sys_flags where key='maintenance';
if v_flag is not null then
    v_on := coalesce((v_flag->>'on')::boolean, false);
    v_until := (v_flag->>'until')::timestamptz;
    if v_on and (v_until is null or v_until > now()) then
      v_gate := 'maintenance';
      v_msg  := coalesce(v_flag->>'message', '서버 점검 중입니다.');
end if;
end if;

  -- account rules
  if v_gate = 'ok' then
select * into v_rules from public.account_access_rules where user_id = p_user_id;
if found then
      if v_rules.status = 'blocked' then
        v_gate := 'blocked';
        v_msg  := coalesce(v_rules.reason, '접속이 차단되었습니다.');
      elsif v_rules.window_start is not null and v_rules.window_end is not null
         and not (now() between v_rules.window_start and v_rules.window_end) then
        v_gate := 'out_of_window';
        v_msg  := format('접속 가능 시간: %s ~ %s', v_rules.window_start, v_rules.window_end);
end if;
end if;
end if;

insert into public.access_audit(user_id, gate, message, ip, user_agent)
values (p_user_id, v_gate, v_msg, p_ip, p_user_agent);

return query select v_gate, v_msg;
end
$$;

comment on function public.get_access_gate(uuid,text,inet) is
  '게이트 판정(점검/차단/시간창) + 감사로그 기록. 반환: (gate, message)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 운영 RPC (교사용): 접속 규칙/점검 토글
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_account_access_rule(
  p_user_id uuid,
  p_status text,              -- 'active'|'blocked'
  p_window_start timestamptz,
  p_window_end   timestamptz,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'only staff' using errcode = 'P0001';
end if;

insert into public.account_access_rules(user_id, status, window_start, window_end, reason, updated_by)
values (p_user_id, p_status, p_window_start, p_window_end, p_reason, auth.uid())
  on conflict (user_id) do update
                             set status=excluded.status,
                             window_start=excluded.window_start,
                             window_end=excluded.window_end,
                             reason=excluded.reason,
                             updated_by=excluded.updated_by,
                             updated_at=now();
end
$$;

create or replace function public.set_maintenance(
  p_on boolean,
  p_message text default '서버 점검 중입니다.',
  p_until timestamptz default null
) returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'only staff' using errcode = 'P0001';
end if;

insert into public.sys_flags(key, value)
values ('maintenance', jsonb_build_object('on', p_on, 'message', p_message, 'until', p_until))
  on conflict (key) do update set
                         value = excluded.value,
                         updated_at = now();
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 관리 뷰(선택): 배치 통계
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.qr_token_batch_stats as
select
  b.id as batch_id,
  b.created_by,
  b.expires_at,
  b.note,
  count(t.*)                                as total,
  count(*) filter (where t.status='issued') as issued,
  count(*) filter (where t.status='used')   as used,
  count(*) filter (where t.status='revoked')as revoked,
  min(t.created_at)                         as created_at
from public.qr_token_batches b
       left join public.qr_tokens t on t.batch_id = b.id
group by 1,2,3,4;
