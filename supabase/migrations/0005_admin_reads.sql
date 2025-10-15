-- 관리용 이메일 화이트리스트
create table if not exists public.qd_admins (
                                              email text primary key,
                                              created_at timestamptz not null default now()
  );

-- 조회 성능 보조 인덱스
create index if not exists qd_run_summaries_created_idx on public.qd_run_summaries(created_at desc);
create index if not exists qd_runs_closed_idx on public.qd_runs(closed_at desc nulls last);

-- 최근 런 목록: admin 전용
create or replace function public.admin_list_recent_runs(
  p_limit int default 50,
  p_only_open boolean default false,     -- 닫히지 않은 런만
  p_only_closed boolean default false,   -- 닫힌 런만
  p_since timestamptz default null       -- 이 시각 이후만
) returns table(
  run_id uuid,
  user_id uuid,
  nickname text,
  cleared boolean,
  turns int,
  duration_sec int,
  created_at timestamptz,  -- 제출 시각(요약 적재 시각)
  closed_at timestamptz,   -- 런 마감 시각
  coins int,
  stars int
)
language plpgsql
security definer
set search_path = public
as $$
declare
v_email text;
  v_is_admin boolean;
begin
  -- 호출자 이메일 추출 (Supabase Auth JWT 필요)
begin
    v_email := coalesce(
      (auth.jwt() ->> 'email'),
      (current_setting('request.jwt.claims', true))::jsonb ->> 'email'
    );
exception when others then
    v_email := null;
end;

select exists(select 1 from public.qd_admins a where a.email = v_email) into v_is_admin;

if not v_is_admin then
    raise exception 'admin only' using errcode = '28000'; -- invalid_authorization_specification
end if;

return query
  with base as (
    select
      rs.run_id,
      rs.user_id,
      u.nickname,
      rs.cleared,
      rs.turns,
      rs.duration_sec,
      rs.created_at,
      r.closed_at,
      w.coins,
      w.stars
    from public.qd_run_summaries rs
    join public.qd_runs r   on r.run_id = rs.run_id
    join public.qd_users u  on u.user_id = rs.user_id
    left join public.qd_wallets w on w.user_id = rs.user_id
    where (p_since is null or rs.created_at >= p_since)
  )
select *
from base
where (not p_only_open   or closed_at is null)
  and (not p_only_closed or closed_at is not null)
order by created_at desc
  limit greatest(p_limit, 1);

end;
$$;

-- 권한: 로그인 사용자만 가능 (anon 금지)
revoke all on function public.admin_list_recent_runs(int, boolean, boolean, timestamptz) from public;
grant execute on function public.admin_list_recent_runs(int, boolean, boolean, timestamptz) to authenticated;
