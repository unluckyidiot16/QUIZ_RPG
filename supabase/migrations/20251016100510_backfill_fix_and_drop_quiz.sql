-- ─────────────────────────────────────────────────────────────
-- quiz → public.qd_* 백필(안전/중복 무해) + quiz 스키마 정리
-- (앞선 백필 실패를 재시도해도 ON CONFLICT로 중복없이 들어갑니다)
-- ─────────────────────────────────────────────────────────────

-- users
do $$
begin
  perform 1 from information_schema.tables where table_schema='quiz' and table_name='users';
  if found then
    insert into public.qd_users(user_id, nickname, created_at)
select user_id, nickname, coalesce(created_at, now())
from quiz.users
  on conflict (user_id) do nothing;
end if;
exception when undefined_table then
  raise notice 'quiz.users not found, skip';
end $$;

-- wallets
do $$
begin
  perform 1 from information_schema.tables where table_schema='quiz' and table_name='wallets';
  if found then
    insert into public.qd_wallets(user_id, coins, stars, updated_at)
select user_id, coins, stars, coalesce(updated_at, now())
from quiz.wallets
  on conflict (user_id) do nothing;
end if;
exception when undefined_table then
  raise notice 'quiz.wallets not found, skip';
end $$;

-- runs
do $$
begin
  perform 1 from information_schema.tables where table_schema='quiz' and table_name='runs';
  if found then
    insert into public.qd_runs(run_id, opened_at, closed_at)
select run_id, opened_at, closed_at
from quiz.runs
  on conflict (run_id) do nothing;
end if;
exception when undefined_table then
  raise notice 'quiz.runs not found, skip';
end $$;

-- run_summaries (duration or duration_sec 자동 감지)
do $$
declare
dur_col text;
  dur_sel text;
sql text;
begin
  perform 1 from information_schema.tables where table_schema='quiz' and table_name='run_summaries';
  if not found then
    raise notice 'quiz.run_summaries not found, skip';
    return;
end if;

select case
         when exists (select 1 from information_schema.columns
                      where table_schema='quiz' and table_name='run_summaries' and column_name='duration_sec')
           then 'duration_sec'
         when exists (select 1 from information_schema.columns
                      where table_schema='quiz' and table_name='run_summaries' and column_name='duration')
           then 'duration'
         else null
         end
into dur_col;

dur_sel := coalesce(format('%I', dur_col), 'null::int4');

sql := format($Q$
    insert into public.qd_run_summaries
      (run_id, user_id, run_token, final_hash, turns, duration_sec, cleared, created_at)
    select run_id, user_id, run_token, final_hash, turns, %s, cleared, coalesce(created_at, now())
    from quiz.run_summaries
    on conflict (run_id) do nothing;
  $Q$, dur_sel);

execute sql;
end $$;

-- 모든 public.* 래퍼가 quiz.*를 더 이상 참조하지 않는지 최종 가드(있으면 드롭 중단)
do $$
declare uses_quiz boolean;
begin
select exists (
  select 1
  from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public'
    and p.proname in ('auth_login','enter_dungeon','finish_dungeon','admin_list_recent_runs')
    and pg_get_functiondef(p.oid) ilike '%quiz.%'
) into uses_quiz;

if uses_quiz then
    raise exception 'public.* functions still reference quiz.* — abort dropping.';
end if;
end $$;

-- 이제 quiz 스키마 제거
drop schema if exists quiz cascade;
