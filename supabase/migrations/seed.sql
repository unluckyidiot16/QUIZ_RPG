-- 로컬/테스트 기본 관리자 계정 (원하면 수정)
insert into public.qd_admins(email) values
  ('unluckyidiot16@gmail.com')
  on conflict (email) do nothing;
