-- 1) 인덱스(조회/리포팅 성능 보조)
create index if not exists qd_run_summaries_run_idx on public.qd_run_summaries(run_id);

-- 2) 트리거 함수: 요약이 적재되면 런 마감
create or replace function public.qd_close_run_on_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
update public.qd_runs
set closed_at = coalesce(closed_at, now())
where run_id = NEW.run_id;
return NEW;
end;
$$;

-- 3) 트리거 등록
drop trigger if exists trg_qd_close_run_on_summary on public.qd_run_summaries;
create trigger trg_qd_close_run_on_summary
  after insert on public.qd_run_summaries
  for each row execute function public.qd_close_run_on_summary();
