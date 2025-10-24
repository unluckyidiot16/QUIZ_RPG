begin;
create table if not exists public.profiles (
                                             user_id uuid primary key,
                                             nickname text not null default 'Adventurer',
                                             avatar_id text not null default 'base_mage',  -- 기본 아바타 id
                                             tint int not null default 0,                  -- 0~359(H), or 0=none
                                             updated_at timestamptz not null default now()
  );

-- RLS
alter table public.profiles enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profile-self-select') then
    create policy "profile-self-select" on public.profiles for select using (user_id = auth.uid());
end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profile-self-upsert') then
    create policy "profile-self-upsert" on public.profiles for insert with check (user_id = auth.uid());
end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profile-self-update') then
    create policy "profile-self-update" on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
end if;
end $$;

-- upsert RPC
create or replace function public.upsert_profile(p jsonb)
returns jsonb
language plpgsql
as $$
declare
uid uuid := auth.uid();
  r public.profiles;
begin
  if uid is null then raise exception 'auth required'; end if;

insert into public.profiles as pr (user_id, nickname, avatar_id, tint, updated_at)
values (
  uid,
  coalesce(p->>'nickname',  'Adventurer'),
  coalesce(p->>'avatar_id', 'base_mage'),
  coalesce((p->>'tint')::int, 0),
  now()
  )
on conflict (user_id) do update set
  nickname  = excluded.nickname,
                           avatar_id = excluded.avatar_id,
                           tint      = excluded.tint,
                           updated_at= excluded.updated_at
                           returning * into r;

return jsonb_build_object(
  'user_id', r.user_id, 'nickname', r.nickname,
  'avatar_id', r.avatar_id, 'tint', r.tint, 'updated_at', r.updated_at
       );
end $$;

grant execute on function public.upsert_profile(jsonb) to anon, authenticated, service_role;
commit;
