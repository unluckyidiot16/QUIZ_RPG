-- public 스키마에 게임 테이블/함수 생성 (quiz 스키마 불필요)
create extension if not exists "pgcrypto";

-- 테이블: 접두어 qd_* 로 충돌 회피
create table if not exists public.qd_users (
                                             user_id uuid primary key default gen_random_uuid(),
  nickname text not null,
  created_at timestamptz not null default now()
  );

create table if not exists public.qd_wallets (
                                               user_id uuid primary key references public.qd_users(user_id) on delete cascade,
  coins int not null default 0,
  stars int not null default 0,
  updated_at timestamptz not null default now()
  );

create table if not exists public.qd_runs (
                                            run_id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
  );

create table if not exists public.qd_run_summaries (
                                                     id bigserial primary key,
                                                     run_id uuid not null references public.qd_runs(run_id),
  user_id uuid not null references public.qd_users(user_id),
  run_token text not null,
  final_hash text not null,
  turns int not null,
  duration_sec int not null,
  cleared bool not null,
  created_at timestamptz not null default now(),
  unique (run_token)
  );

-- RPC: 로그인(가명)
create or replace function public.auth_login(nickname text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid;
begin
insert into public.qd_users(nickname) values (nickname) returning user_id into v_user;
insert into public.qd_wallets(user_id) values (v_user) on conflict (user_id) do nothing;
return v_user;
end;
$$;

-- RPC: 런 시작
create or replace function public.enter_dungeon()
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into public.qd_runs default values returning run_id;
$$;

-- RPC: 종료(멱등)
create or replace function public.finish_dungeon(
  p_run_id uuid, p_user_id uuid, p_run_token text,
  p_final_hash text, p_turns int, p_duration int, p_cleared bool
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_exists bool;
begin
select true into v_exists from public.qd_run_summaries where run_token = p_run_token;
if v_exists then
    return json_build_object('ok', true, 'idempotent', true);
end if;

insert into public.qd_run_summaries(run_id,user_id,run_token,final_hash,turns,duration_sec,cleared)
values (p_run_id,p_user_id,p_run_token,p_final_hash,p_turns,p_duration,p_cleared);

if p_cleared then
update public.qd_wallets set stars = stars + 1, updated_at = now() where user_id = p_user_id;
end if;

return json_build_object('ok', true, 'idempotent', false);
end;
$$;

-- 최소 권한: RPC는 SECURITY DEFINER라 이거면 충분
grant execute on function public.auth_login(text) to anon, authenticated;
grant execute on function public.enter_dungeon() to anon, authenticated;
grant execute on function public.finish_dungeon(uuid,uuid,text,text,int,int,bool) to anon, authenticated;
