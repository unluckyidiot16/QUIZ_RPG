
create extension if not exists "pgcrypto";
create schema if not exists quiz;

create table if not exists quiz.users (
  user_id uuid primary key default gen_random_uuid(),
  nickname text not null,
  created_at timestamptz not null default now()
);

create table if not exists quiz.wallets (
  user_id uuid primary key references quiz.users(user_id) on delete cascade,
  coins int not null default 0,
  stars int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists quiz.runs (
  run_id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists quiz.run_summaries (
  id bigserial primary key,
  run_id uuid not null references quiz.runs(run_id),
  user_id uuid not null references quiz.users(user_id),
  run_token text not null,
  final_hash text not null,
  turns int not null,
  duration_sec int not null,
  cleared bool not null,
  created_at timestamptz not null default now(),
  unique (run_token)
);

create or replace function quiz.auth_login(nickname text)
returns uuid
language plpgsql
security definer
set search_path = quiz, public
as $$
declare v_user uuid;
begin
  insert into users(nickname) values (nickname) returning user_id into v_user;
  insert into wallets(user_id) values (v_user) on conflict (user_id) do nothing;
  return v_user;
end;
$$;

create or replace function quiz.enter_dungeon()
returns uuid
language sql
security definer
set search_path = quiz, public
as $$
  insert into runs default values returning run_id;
$$;

create or replace function quiz.finish_dungeon(
  p_run_id uuid, p_user_id uuid, p_run_token text,
  p_final_hash text, p_turns int, p_duration int, p_cleared bool
) returns json
language plpgsql
security definer
set search_path = quiz, public
as $$
declare v_exists bool;
begin
  select true into v_exists from run_summaries where run_token = p_run_token;
  if v_exists then
    return json_build_object('ok', true, 'idempotent', true);
  end if;

  insert into run_summaries(run_id,user_id,run_token,final_hash,turns,duration_sec,cleared)
  values (p_run_id,p_user_id,p_run_token,p_final_hash,p_turns,p_duration,p_cleared);

  if p_cleared then
    update wallets set stars = stars + 1, updated_at = now() where user_id = p_user_id;
  end if;

  return json_build_object('ok', true, 'idempotent', false);
end;
$$;

grant usage on schema quiz to anon, authenticated;
grant select, insert, update on table quiz.users to anon, authenticated;
grant select, insert, update on table quiz.wallets to anon, authenticated;
grant select, insert on table quiz.runs to anon, authenticated;
grant select, insert on table quiz.run_summaries to anon, authenticated;

grant execute on function quiz.auth_login(text) to anon, authenticated;
grant execute on function quiz.enter_dungeon() to anon, authenticated;
grant execute on function quiz.finish_dungeon(uuid, uuid, text, text, int, int, bool) to anon, authenticated;
