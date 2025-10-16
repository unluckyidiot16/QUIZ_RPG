-- 1) 임시 접속 토큰 테이블 (최소 필드)
create table if not exists public.qd_access_tokens (
                                                     token        uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.qd_users(user_id) on delete cascade,
  valid_from   timestamptz not null default now(),
  valid_until  timestamptz not null,
  revoked      boolean not null default false,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
  );

-- 조회/만료 체크에 필요한 가벼운 인덱스
create index if not exists idx_qd_tokens_user          on public.qd_access_tokens(user_id);
create index if not exists idx_qd_tokens_valid_window  on public.qd_access_tokens(revoked, valid_until);

comment on table public.qd_access_tokens is
  '교사가 발급하는 임시 로그인 토큰. 유효시간/차단만 제공(최소 기능).';

-- 2) 토큰 발급 (교사 전용)
create or replace function public.admin_issue_temp_id(
  p_user_id uuid default null,         -- 지정 없으면 새 유저 생성
  p_nickname text default null,        -- 새 유저일 때만 반영
  p_ttl_minutes int default 120,       -- 유효 시간(분)
  p_valid_from timestamptz default now()
) returns table(user_id uuid, token uuid, valid_from timestamptz, valid_until timestamptz)
language plpgsql security definer set search_path=public as $$
declare
v_user uuid;
  v_token uuid;
begin
  if not public.is_admin() then
    raise insufficient_privilege using message = 'admin only';
end if;

  -- 유저 준비(있으면 사용, 없으면 생성)
  if p_user_id is not null then
    v_user := p_user_id;
else
    v_user := gen_random_uuid();
insert into public.qd_users(user_id, nickname)
values (v_user, nullif(p_nickname,''))
  on conflict (user_id) do nothing;
end if;

  -- 토큰 발급
insert into public.qd_access_tokens(user_id, valid_from, valid_until)
values (v_user, coalesce(p_valid_from, now()), coalesce(p_valid_from, now()) + make_interval(mins => coalesce(p_ttl_minutes, 120)))
  returning token, user_id, valid_from, valid_until
into v_token, v_user, valid_from, valid_until;

return query select v_user, v_token, valid_from, valid_until;
end $$;

comment on function public.admin_issue_temp_id(uuid, text, int, timestamptz)
  is '교사 전용: 임시 로그인 토큰 발급(새 유저 생성 가능).';

-- 3) 토큰 로그인 (클라이언트/익명 허용)
create or replace function public.guest_login(p_token uuid)
returns uuid
language plpgsql security definer set search_path=public as $$
declare
v_user uuid;
begin
select t.user_id
into v_user
from public.qd_access_tokens t
where t.token = p_token
  and t.revoked = false
  and now() >= t.valid_from
  and now() <= t.valid_until;

if v_user is null then
    raise invalid_authorization_specification using message = 'invalid or expired token';
end if;

update public.qd_access_tokens
set last_used_at = now()
where token = p_token;

return v_user;
end $$;

comment on function public.guest_login(uuid)
  is '익명 클라이언트: 토큰으로 user_id 획득(간편 로그인).';

-- 4) 토큰 차단/연장(교사 전용)
create or replace function public.admin_revoke_temp_id(p_token uuid)
returns void
language sql security definer set search_path=public as $$
update public.qd_access_tokens set revoked = true where token = p_token;
$$;

create or replace function public.admin_extend_temp_id(p_token uuid, p_ttl_minutes int)
returns void
language sql security definer set search_path=public as $$
update public.qd_access_tokens
set valid_until = greatest(now(), valid_until) + make_interval(mins => p_ttl_minutes)
where token = p_token and revoked = false;
$$;

-- 권한: 토큰 테이블은 직접 접근 금지(기본값 유지), 함수만 열어줌
grant execute on function public.guest_login(uuid)            to anon, authenticated;
grant execute on function public.admin_issue_temp_id(uuid,text,int,timestamptz) to authenticated;
grant execute on function public.admin_revoke_temp_id(uuid)   to authenticated;
grant execute on function public.admin_extend_temp_id(uuid,int) to authenticated;
