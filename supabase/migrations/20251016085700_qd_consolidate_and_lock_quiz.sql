-- ──────────────────────────────────────────────────────────────
-- 1) Admin 화이트리스트 가드
-- ──────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
v_email text := (auth.jwt() ->> 'email');
begin
return exists (select 1 from public.qd_admins a where a.email = v_email);
end;
$$;

comment on function public.is_admin() is '[오늘의 던전] admin 화이트리스트 여부 확인';

-- (참고) 기존 admin용 RPC마다 아래 가드 한 줄을 함수 맨 앞에 추가하세요.
-- if not public.is_admin() then
--   raise insufficient_privilege using message = 'admin only';
-- end if;

-- ──────────────────────────────────────────────────────────────
-- 2) qd_* 직접 접근 봉쇄 (RLS Enable + 권한 회수)
--    - 앱 접근은 모두 SECURITY DEFINER RPC로만 하도록 통일
-- ──────────────────────────────────────────────────────────────
do $$
declare
r record;
begin
for r in
select format('%I.%I', n.nspname, c.relname) as fqtn
from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'  -- table
  and c.relname like 'qd_%'
  loop
    execute format('alter table %s enable row level security;', r.fqtn);
-- 명시적으로 모든 권한 회수(실수로 direct query 방지)
execute format('revoke all on table %s from public, anon, authenticated;', r.fqtn);
-- (정책을 추가하지 않으면 기본 거부됨 → RPC로만 접근)
end loop;
end $$;

-- ──────────────────────────────────────────────────────────────
-- 3) quiz 스키마 “즉시 잠금”(사용 차단) - 완전 제거는 다음 배치에서
-- ──────────────────────────────────────────────────────────────
do $$
begin
  -- 스키마 사용 권한 제거
  if exists (select 1 from pg_namespace where nspname='quiz') then
    revoke usage on schema quiz from public, anon, authenticated;
end if;
end $$;

-- 모든 quiz 함수의 EXECUTE 권한 회수
do $$
declare
f text;
begin
for f in
select 'quiz.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'quiz'
  loop
    execute format('revoke all on function %s from public, anon, authenticated;', f);
end loop;
end $$;

-- ──────────────────────────────────────────────────────────────
-- 4) admin 최근 런 목록 (컬럼 자동 감지 버전)
-- ──────────────────────────────────────────────────────────────
do $$
declare
  -- qd_runs
runs_pk          text;
  runs_user_col    text;
  run_open_col     text;
  run_close_col    text;

  -- qd_users
  users_pk         text;
  users_name_col   text;

  -- qd_run_summaries
  sum_run_fk       text;
  s_correct_col    text;
  s_wrong_col      text;
  s_score_col      text;
  s_closed_col     text;

  join_users_sql   text;
  join_summ_sql    text;

  sel_display_name text;
  sel_correct      text;
  sel_wrong        text;
  sel_score        text;
  sel_sum_closed   text;

  ddl              text;
begin
  -- qd_runs 컬럼 감지
select case
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_runs' and column_name='id') then 'id'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_runs' and column_name='run_id') then 'run_id'
         else null
         end into runs_pk;

select case
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_runs' and column_name='user_id') then 'user_id'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_runs' and column_name='uid') then 'uid'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_runs' and column_name='user_uid') then 'user_uid'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_runs' and column_name='profile_id') then 'profile_id'
         else null
         end into runs_user_col;

select case
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_runs' and column_name='opened_at') then 'opened_at'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_runs' and column_name='created_at') then 'created_at'
         else null
         end into run_open_col;

select case
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_runs' and column_name='closed_at') then 'closed_at'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_runs' and column_name='ended_at') then 'ended_at'
         else null
         end into run_close_col;

if runs_pk is null then
    raise exception 'qd_runs must have id or run_id';
end if;

  -- qd_users 컬럼 감지
select case
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_users' and column_name='id') then 'id'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_users' and column_name='user_id') then 'user_id'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_users' and column_name='uid') then 'uid'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_users' and column_name='profile_id') then 'profile_id'
         else null
         end into users_pk;

select case
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_users' and column_name='display_name') then 'display_name'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_users' and column_name='name') then 'name'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_users' and column_name='nickname') then 'nickname'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_users' and column_name='email') then 'email'
         else null
         end into users_name_col;

-- qd_run_summaries 컬럼 감지
select case
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='run_id') then 'run_id'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='id') then 'id'
         else null
         end into sum_run_fk;

select case
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='correct_count') then 'correct_count'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='correct') then 'correct'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='num_correct') then 'num_correct'
         else null
         end into s_correct_col;

select case
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='wrong_count') then 'wrong_count'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='wrong') then 'wrong'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='num_wrong') then 'num_wrong'
         else null
         end into s_wrong_col;

select case
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='score') then 'score'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='points') then 'points'
         else null
         end into s_score_col;

select case
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='closed_at') then 'closed_at'
         when exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='qd_run_summaries' and column_name='ended_at') then 'ended_at'
         else null
         end into s_closed_col;

-- SELECT 절 표현 준비
sel_display_name := case
                        when users_pk is not null and runs_user_col is not null and users_name_col is not null
                          then format('u.%I as display_name', users_name_col)
                        else 'null::text as display_name'
end;

  sel_correct := case when s_correct_col is not null
                        then format('s.%I as correct_count', s_correct_col)
                      else 'null::int as correct_count' end;

  sel_wrong := case when s_wrong_col is not null
                        then format('s.%I as wrong_count', s_wrong_col)
                    else 'null::int as wrong_count' end;

  sel_score := case when s_score_col is not null
                        then format('s.%I as score', s_score_col)
                    else 'null::numeric as score' end;

  sel_sum_closed := case when s_closed_col is not null
                            then format('s.%I as summary_closed_at', s_closed_col)
                         else 'null::timestamptz as summary_closed_at' end;

  -- JOIN 절
  join_users_sql := case
                      when users_pk is not null and runs_user_col is not null
                        then format('left join public.qd_users u on u.%I = r.%I', users_pk, runs_user_col)
                      else '' end;

  join_summ_sql := case
                      when sum_run_fk is not null
                        then format('left join public.qd_run_summaries s on s.%I = r.%I', sum_run_fk, runs_pk)
                      else '' end;

  -- 뷰 DDL 조립
  ddl := format($SQL$
    create or replace view public.admin_recent_runs_v as
    select
      r.%1$I as run_id,
      %2$s,
      r.%3$I as run_started_at,
      %4$s as run_closed_at,
      %5$s,
      %6$s,
      %7$s,
      %8$s
    from public.qd_runs r
    %9$s
    %10$s
    order by r.%3$I desc;
  $SQL$,
    runs_pk,                          -- %1$I
    sel_display_name,                 -- %2$s
    coalesce(run_open_col, runs_pk),  -- %3$I (정렬 기준: opened_at/created_at)
    coalesce(run_close_col, runs_pk), -- %4$s (실제 컬럼명이므로 식으로 둠)
    sel_correct,                      -- %5$s
    sel_wrong,                        -- %6$s
    sel_score,                        -- %7$s
    sel_sum_closed,                   -- %8$s
    join_users_sql,                   -- %9$s
    join_summ_sql                     -- %10$s
  );

execute ddl;

comment on view public.admin_recent_runs_v
    is '[오늘의 던전] 최근 런 요약 (스키마 차이에 강한 동적 생성 버전)';
end $$;



-- 참고: 기존 public.admin_list_recent_runs(...) 함수가 있다면
-- 함수 맨 앞에 ① 가드 추가 + 본문 SELECT를 위 뷰에서 뽑도록 단순화 권장.
-- 예시(시그니처는 프로젝트에 맞춰 조정):
-- create or replace function public.admin_list_recent_runs(p_limit int default 50)
-- returns setof public.admin_recent_runs_v
-- language sql
-- security definer
-- set search_path = public
-- as $func$
--   select * from public.admin_recent_runs_v limit greatest(1, p_limit);
-- $func$;

-- ──────────────────────────────────────────────────────────────
-- 5) 점검용: 현재 스키마/권한 상태 확인 뷰
-- ──────────────────────────────────────────────────────────────
create or replace view public.qd_tables_rls_status_v as
select
  n.nspname as schema,
  c.relname as table,
  c.relrowsecurity as rls_enabled
from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname like 'qd_%'
order by c.relname;

comment on view public.qd_tables_rls_status_v is '[오늘의 던전] qd_* 테이블 RLS 활성화 상태 점검';

        
-- 예시: quiz.* 함수가 아직 존재한다면 “사용 중단” 예외 발생시켜 추적
create schema if not exists quiz;

create or replace function quiz._deprecated()
returns void
language plpgsql
as $$
begin
  raise feature_not_supported using message = 'quiz.* is deprecated. Use public.qd_* RPC instead.';
end;
$$;
