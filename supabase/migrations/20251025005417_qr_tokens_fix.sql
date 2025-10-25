begin;

-- 기존 오버로드/옛 시그니처 제거
drop function if exists public.issue_qr_tokens(uuid, int, timestamptz, text);
drop function if exists public.revoke_qr_token(uuid);

-- 토큰 발급: 배치 1개 생성 후, 요청 개수만큼 qr_tokens 발급
create function public.issue_qr_tokens(
  p_class_id   uuid,
  p_count      int,
  p_expires_at timestamptz,
  p_note       text
)
  returns table (
                  id uuid,
                  status text,
                  expires_at timestamptz
                )
  language plpgsql
security definer
set search_path = public
as $$
declare
v_batch_id uuid;
  v_count int := greatest(coalesce(p_count, 1), 1);
begin
  -- 배치 생성
insert into public.qr_token_batches (class_id, created_by, expires_at, note)
values (p_class_id, auth.uid(), p_expires_at, p_note)
  returning id into v_batch_id;

-- 토큰들 발급
insert into public.qr_tokens (id, batch_id, status, expires_at)
select gen_random_uuid(), v_batch_id, 'issued', p_expires_at
from generate_series(1, v_count);

-- AdminTokens.tsx가 기대하는 필드만 반환
return query
select t.id, t.status, t.expires_at
from public.qr_tokens t
where t.batch_id = v_batch_id
order by t.created_at asc;
end
$$;

-- 토큰 회수: 상태를 revoked로
create function public.revoke_qr_token(p_token_id uuid)
  returns boolean
  language plpgsql
security definer
set search_path = public
as $$
begin
update public.qr_tokens
set status = 'revoked',
    used_at = coalesce(used_at, now())
where id = p_token_id;

return found; -- 1개 이상 갱신되면 true
end
$$;

-- 실행 권한 (관리 화면에서 호출)
grant execute on function public.issue_qr_tokens(uuid,int,timestamptz,text) to authenticated, service_role;
grant execute on function public.revoke_qr_token(uuid)                  to authenticated, service_role;

commit;
