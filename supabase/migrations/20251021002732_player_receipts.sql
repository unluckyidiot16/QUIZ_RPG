-- 멱등 지급(서버 스텁): 최소 테이블만. 클라에서 생성한 idempotency key로 기록.
create table if not exists public.qd_receipts (
                                                id text primary key, -- rcp_xxx (클라 생성)
                                                user_id uuid not null, -- 소유자
                                                reason text,
                                                payload jsonb not null,
                                                created_at timestamptz not null default now()
  );

-- (선택) XP 추적용 요약: 서버가 참조만, 계산은 클라/서버 어느쪽이든 가능
create table if not exists public.qd_player (
                                              user_id uuid primary key,
                                              total_xp int not null default 0,
                                              base_hp int not null default 100,
                                              base_atk int not null default 10,
                                              base_def int not null default 0,
                                              updated_at timestamptz not null default now()
  );

-- 간단 RPC: id가 이미 있으면 멱등 처리
create or replace function public.apply_receipt(p_id text, p_user uuid, p_reason text, p_payload jsonb)
returns json language plpgsql security definer set search_path = public as $$
begin
insert into public.qd_receipts(id, user_id, reason, payload)
values (p_id, p_user, p_reason, p_payload)
  on conflict (id) do nothing;
return json_build_object('ok', true, 'idempotent', (select exists(select 1 from public.qd_receipts r where r.id = p_id)));
end $$;

grant execute on function public.apply_receipt(text,uuid,text,jsonb) to anon, authenticated;

