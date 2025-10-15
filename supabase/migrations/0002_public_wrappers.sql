-- public 래퍼: quiz.*를 그대로 호출
create or replace function public.auth_login(nickname text)
returns uuid language sql security definer set search_path=quiz, public as
$$ select quiz.auth_login(nickname) $$;

create or replace function public.enter_dungeon()
returns uuid language sql security definer set search_path=quiz, public as
$$ select quiz.enter_dungeon() $$;

create or replace function public.finish_dungeon(
  p_run_id uuid, p_user_id uuid, p_run_token text,
  p_final_hash text, p_turns int, p_duration int, p_cleared bool
) returns json language sql security definer set search_path=quiz, public as
$$ select quiz.finish_dungeon(p_run_id, p_user_id, p_run_token, p_final_hash, p_turns, p_duration, p_cleared) $$;

grant execute on function public.auth_login(text) to anon, authenticated;
grant execute on function public.enter_dungeon() to anon, authenticated;
grant execute on function public.finish_dungeon(uuid,uuid,text,text,int,int,bool) to anon, authenticated;
