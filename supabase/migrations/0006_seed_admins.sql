-- 1) 관리자 화이트리스트 테이블 생성
create table if not exists public.qd_admins (
                                              email text primary key,
                                              created_at timestamptz not null default now()
  );

-- 2) (권장) RLS 활성화 + 모든 직접 접근 차단
alter table public.qd_admins enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='qd_admins' and policyname='qd_admins_no_select'
  ) then
    create policy qd_admins_no_select on public.qd_admins
      for select to public using (false);
end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='qd_admins' and policyname='qd_admins_no_write'
  ) then
    create policy qd_admins_no_write on public.qd_admins
      for all to public using (false) with check (false);
end if;
end $$;

-- 3) 관리자 이메일 등록(원하는 주소로 바꿔서 실행)
insert into public.qd_admins(email) values
                                      ('teacher@example.com'),
                                      ('ops@example.com')
  on conflict (email) do nothing;
