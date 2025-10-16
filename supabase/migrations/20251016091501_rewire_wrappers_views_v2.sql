-- ─────────────────────────────────────────────────────────────
-- 0) qd_run_summaries(run_id) 유니크 보장 (제약 대신 인덱스로)
--    ※ ADD CONSTRAINT IF NOT EXISTS 미지원 → UNIQUE INDEX 권장
-- ─────────────────────────────────────────────────────────────
create unique index if not exists uq_qd_run_summaries_run_idx
  on public.qd_run_summaries(run_id);

-- ─────────────────────────────────────────────────────────────
-- 1) 기존 public 래퍼 드롭(반환타입/본문 변경 충돌 방지)
-- ─────────────────────────────────────────────────────────────
drop function if exists public.finish_dungeon(uuid,uuid,text,text,int,int,bool);
drop function if exists public.enter_dungeon();
drop function if exists public.auth_login(text);
drop function if exists public.admin_list_recent_runs(int, timestamptz);

-- ─────────────────────────────────────────────────────────────
-- 2) auth_login: qd_users/qd_wallets 업서트 후 user_id 반환
-- ─────────────────────────────────────────────────────────────
create or replace function public.auth_login(nickname text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
v_uid uuid := auth.uid();
begin
  if v_uid is null then
    -- 로컬 테스트용(운영에선 제거 가능)
    v_uid := gen_random_uuid();
end if;

insert into public.qd_users(user_id, nickname, created_at)
values (v_uid, nullif(nickname, ''), now())
  on conflict (user_id) do update
                             set nickname = coalesce(excluded.nickname, public.qd_users.nickname);

insert into public.qd_wallets(user_id, coins, stars, updated_at)
values (v_uid, 0, 0, now())
  on conflict (user_id) do update
                             set updated_at = now();

return v_uid;
end $$;

comment on function public.auth_login(text)
  is '[오늘의 던전] 로그인/회원 생성 + 지갑 초기화 (qd_*)';

-- ─────────────────────────────────────────────────────────────
-- 3) enter_dungeon: qd_runs에 생성 후 run_id 반환
-- ─────────────────────────────────────────────────────────────
create or replace function public.enter_dungeon()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
v_run uuid := gen_random_uuid();
begin
insert into public.qd_runs(run_id, opened_at) values (v_run, now());
return v_run;
end $$;

comment on function public.enter_dungeon()
  is '[오늘의 던전] 런 시작 (qd_runs 삽입)';

-- ─────────────────────────────────────────────────────────────
-- 4) finish_dungeon: 요약 업서트 + 런 종료
-- ─────────────────────────────────────────────────────────────
create or replace function public.finish_dungeon(
  p_run_id uuid,
  p_user_id uuid,
  p_run_token text,
  p_final_hash text,
  p_turns int,
  p_duration int,
  p_cleared bool
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
insert into public.qd_run_summaries
(run_id, user_id, run_token, final_hash, turns, duration_sec, cleared, created_at)
values
  (p_run_id, p_user_id, p_run_token, p_final_hash, p_turns, p_duration, p_cleared, now())
  on conflict (run_id) do update
                            set user_id      = excluded.user_id,
                            run_token    = excluded.run_token,
                            final_hash   = excluded.final_hash,
                            turns        = excluded.turns,
                            duration_sec = excluded.duration_sec,
                            cleared      = excluded.cleared,
                            created_at   = excluded.created_at;

update public.qd_runs
set closed_at = coalesce(closed_at, now())
where run_id = p_run_id;

return;
end $$;

comment on function public.finish_dungeon(uuid,uuid,text,text,int,int,bool)
  is '[오늘의 던전] 런 요약 저장(업서트) + 런 종료';

-- ─────────────────────────────────────────────────────────────
-- 5) 요약 저장 시 런 자동 종료(이중 안전장치)
-- ─────────────────────────────────────────────────────────────
create or replace function public.fn_qd_close_run_on_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
update public.qd_runs
set closed_at = coalesce(closed_at, now())
where run_id = new.run_id;
return new;
end $$;

drop trigger if exists trg_qd_close_run_on_summary on public.qd_run_summaries;

create trigger trg_qd_close_run_on_summary
  after insert or update on public.qd_run_summaries
                    for each row execute function public.fn_qd_close_run_on_summary();

-- ─────────────────────────────────────────────────────────────
-- 6) Admin 뷰/함수 (runs → summaries → users)
-- ─────────────────────────────────────────────────────────────

drop view if exists public.admin_recent_runs_v;

-- 1) 혹시 의존 중인 함수가 있으면 먼저 제거
drop function if exists public.admin_list_recent_runs(int, timestamptz);

-- 2) 기존 뷰 삭제 후 재생성
drop view if exists public.admin_recent_runs_v;

create view public.admin_recent_runs_v as
select
  r.run_id,
  s.user_id,
  u.nickname   as display_name,
  r.opened_at  as run_started_at,
  r.closed_at  as run_closed_at,
  s.turns,
  s.duration_sec,
  s.cleared,
  s.created_at as summary_created_at
from public.qd_runs r
       left join public.qd_run_summaries s on s.run_id = r.run_id
       left join public.qd_users u          on u.user_id = s.user_id
order by r.opened_at desc;

-- 3) 뷰를 참조하는 Admin 리스트 함수 재생성
create or replace function public.admin_list_recent_runs(
  p_limit int default 50,
  p_since timestamptz default null
) returns setof public.admin_recent_runs_v
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise insufficient_privilege using message = 'admin only';
end if;

return query
select *
from public.admin_recent_runs_v
where (p_since is null or run_started_at >= p_since)
order by run_started_at desc
  limit greatest(1, p_limit);
end $$;

comment on function public.admin_list_recent_runs(int, timestamptz)
  is '[오늘의 던전] Admin: 최근 런 목록(화이트리스트 가드)';
