-- 남은 참조가 있으면 드롭 중단(안전가드) — UNION 없이 단계평가
do $$
declare
uses_quiz boolean := false;
begin
  -- 1) public 함수가 quiz.*를 부르는지
select exists (
  select 1
  from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and pg_get_functiondef(p.oid) ilike '%quiz.%'
) into uses_quiz;

-- 2) 뷰가 quiz.*를 참조하는지
if not uses_quiz then
select exists (
  select 1
  from information_schema.views
  where view_definition ilike '%quiz.%'
) into uses_quiz;
end if;

  -- 3) 트리거 대상 함수가 quiz 스키마인지
  if not uses_quiz then
select exists (
  select 1
  from pg_trigger t
         join pg_proc f on f.oid = t.tgfoid
         join pg_namespace n2 on n2.oid = f.pronamespace
  where n2.nspname = 'quiz'
) into uses_quiz;
end if;

  if uses_quiz then
    raise exception 'quiz.* 참조가 남아 있어 드롭을 중단합니다. 참조를 제거하고 다시 실행하세요.';
end if;
end $$;

-- 실제 드롭
drop schema if exists quiz cascade;
