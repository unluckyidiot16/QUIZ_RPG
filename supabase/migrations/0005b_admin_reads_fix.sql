create or replace function public.admin_list_recent_runs(
  p_limit int default 50,
  p_only_open boolean default false,
  p_only_closed boolean default false,
  p_since timestamptz default null
) returns table(
  run_id uuid,
  user_id uuid,
  nickname text,
  cleared boolean,
  turns int,
  duration_sec int,
  created_at timestamptz,
  closed_at timestamptz,
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
  -- 호출자 이메일
begin
    v_email := coalesce(
      (auth.jwt() ->> 'email'),
      (current_setting('request.jwt.claims', true))::jsonb ->> 'email'
    );
exception when others then
    v_email := null;
end;

select exists(select 1 from public.qd_admins a where a.email = v_email)
into v_is_admin;
if not v_is_admin then
    raise exception 'admin only' using errcode = '28000';
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
    join public.qd_runs r   on r.run_id   = rs.run_id
    join public.qd_users u  on u.user_id  = rs.user_id
    left join public.qd_wallets w on w.user_id = rs.user_id
    where (p_since is null or rs.created_at >= p_since)
  )
select
  b.run_id, b.user_id, b.nickname, b.cleared, b.turns, b.duration_sec,
  b.created_at, b.closed_at, b.coins, b.stars
from base b
where (not p_only_open   or b.closed_at is null)
  and (not p_only_closed or b.closed_at is not null)
order by b.created_at desc
  limit greatest(p_limit, 1);
end;
$$;
