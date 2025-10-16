drop trigger if exists "trg_qd_close_run_on_summary" on "public"."qd_run_summaries";

revoke delete on table "public"."qd_admins" from "service_role";

revoke insert on table "public"."qd_admins" from "service_role";

revoke references on table "public"."qd_admins" from "service_role";

revoke select on table "public"."qd_admins" from "service_role";

revoke trigger on table "public"."qd_admins" from "service_role";

revoke truncate on table "public"."qd_admins" from "service_role";

revoke update on table "public"."qd_admins" from "service_role";

revoke delete on table "public"."qd_run_summaries" from "service_role";

revoke insert on table "public"."qd_run_summaries" from "service_role";

revoke references on table "public"."qd_run_summaries" from "service_role";

revoke select on table "public"."qd_run_summaries" from "service_role";

revoke trigger on table "public"."qd_run_summaries" from "service_role";

revoke truncate on table "public"."qd_run_summaries" from "service_role";

revoke update on table "public"."qd_run_summaries" from "service_role";

revoke delete on table "public"."qd_runs" from "service_role";

revoke insert on table "public"."qd_runs" from "service_role";

revoke references on table "public"."qd_runs" from "service_role";

revoke select on table "public"."qd_runs" from "service_role";

revoke trigger on table "public"."qd_runs" from "service_role";

revoke truncate on table "public"."qd_runs" from "service_role";

revoke update on table "public"."qd_runs" from "service_role";

revoke delete on table "public"."qd_users" from "service_role";

revoke insert on table "public"."qd_users" from "service_role";

revoke references on table "public"."qd_users" from "service_role";

revoke select on table "public"."qd_users" from "service_role";

revoke trigger on table "public"."qd_users" from "service_role";

revoke truncate on table "public"."qd_users" from "service_role";

revoke update on table "public"."qd_users" from "service_role";

revoke delete on table "public"."qd_wallets" from "service_role";

revoke insert on table "public"."qd_wallets" from "service_role";

revoke references on table "public"."qd_wallets" from "service_role";

revoke select on table "public"."qd_wallets" from "service_role";

revoke trigger on table "public"."qd_wallets" from "service_role";

revoke truncate on table "public"."qd_wallets" from "service_role";

revoke update on table "public"."qd_wallets" from "service_role";

drop function if exists "public"."admin_list_recent_runs"(p_limit integer, p_only_open boolean, p_only_closed boolean, p_since timestamp with time zone);

drop function if exists "public"."admin_list_recent_runs"(p_limit integer, p_since timestamp with time zone);

drop function if exists "public"."fn_qd_close_run_on_summary"();

drop view if exists "public"."admin_recent_runs_v";

drop index if exists "public"."uq_qd_run_summaries_run_idx";

set check_function_bodies = off;

create or replace view "public"."admin_recent_runs_v" as  SELECT r.run_id,
    NULL::text AS display_name,
    r.opened_at AS run_started_at,
    r.closed_at AS run_closed_at,
    NULL::integer AS correct_count,
    NULL::integer AS wrong_count,
    NULL::numeric AS score,
    NULL::timestamp with time zone AS summary_closed_at
   FROM (qd_runs r
     LEFT JOIN qd_run_summaries s ON ((s.run_id = r.run_id)))
  ORDER BY r.opened_at DESC;


CREATE OR REPLACE FUNCTION public.auth_login(nickname text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_user uuid;
begin
insert into public.qd_users(nickname) values (nickname) returning user_id into v_user;
insert into public.qd_wallets(user_id) values (v_user) on conflict (user_id) do nothing;
return v_user;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enter_dungeon()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.qd_runs default values returning run_id;
$function$
;

CREATE OR REPLACE FUNCTION public.finish_dungeon(p_run_id uuid, p_user_id uuid, p_run_token text, p_final_hash text, p_turns integer, p_duration integer, p_cleared boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_exists bool;
begin
select true into v_exists from public.qd_run_summaries where run_token = p_run_token;
if v_exists then
    return json_build_object('ok', true, 'idempotent', true);
end if;

insert into public.qd_run_summaries(run_id,user_id,run_token,final_hash,turns,duration_sec,cleared)
values (p_run_id,p_user_id,p_run_token,p_final_hash,p_turns,p_duration,p_cleared);

if p_cleared then
update public.qd_wallets set stars = stars + 1, updated_at = now() where user_id = p_user_id;
end if;

return json_build_object('ok', true, 'idempotent', false);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
v_email text := (auth.jwt() ->> 'email');
begin
return exists (select 1 from public.qd_admins a where a.email = v_email);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.qd_close_run_on_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
update public.qd_runs
set closed_at = coalesce(closed_at, now())
where run_id = NEW.run_id;
return NEW;
end;
$function$
;

CREATE TRIGGER trg_qd_close_run_on_summary AFTER INSERT ON public.qd_run_summaries FOR EACH ROW EXECUTE FUNCTION qd_close_run_on_summary();


create schema if not exists "quiz";

create sequence "quiz"."run_summaries_id_seq";

create table "quiz"."run_summaries" (
    "id" bigint not null default nextval('quiz.run_summaries_id_seq'::regclass),
    "run_id" uuid not null,
    "user_id" uuid not null,
    "run_token" text not null,
    "final_hash" text not null,
    "turns" integer not null,
    "duration_sec" integer not null,
    "cleared" boolean not null,
    "created_at" timestamp with time zone not null default now()
);


create table "quiz"."runs" (
    "run_id" uuid not null default gen_random_uuid(),
    "opened_at" timestamp with time zone not null default now(),
    "closed_at" timestamp with time zone
);


create table "quiz"."users" (
    "user_id" uuid not null default gen_random_uuid(),
    "nickname" text not null,
    "created_at" timestamp with time zone not null default now()
);


create table "quiz"."wallets" (
    "user_id" uuid not null,
    "coins" integer not null default 0,
    "stars" integer not null default 0,
    "updated_at" timestamp with time zone not null default now()
);


alter sequence "quiz"."run_summaries_id_seq" owned by "quiz"."run_summaries"."id";

CREATE UNIQUE INDEX run_summaries_pkey ON quiz.run_summaries USING btree (id);

CREATE UNIQUE INDEX run_summaries_run_token_key ON quiz.run_summaries USING btree (run_token);

CREATE UNIQUE INDEX runs_pkey ON quiz.runs USING btree (run_id);

CREATE UNIQUE INDEX users_pkey ON quiz.users USING btree (user_id);

CREATE UNIQUE INDEX wallets_pkey ON quiz.wallets USING btree (user_id);

alter table "quiz"."run_summaries" add constraint "run_summaries_pkey" PRIMARY KEY using index "run_summaries_pkey";

alter table "quiz"."runs" add constraint "runs_pkey" PRIMARY KEY using index "runs_pkey";

alter table "quiz"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "quiz"."wallets" add constraint "wallets_pkey" PRIMARY KEY using index "wallets_pkey";

alter table "quiz"."run_summaries" add constraint "run_summaries_run_id_fkey" FOREIGN KEY (run_id) REFERENCES quiz.runs(run_id) not valid;

alter table "quiz"."run_summaries" validate constraint "run_summaries_run_id_fkey";

alter table "quiz"."run_summaries" add constraint "run_summaries_run_token_key" UNIQUE using index "run_summaries_run_token_key";

alter table "quiz"."run_summaries" add constraint "run_summaries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES quiz.users(user_id) not valid;

alter table "quiz"."run_summaries" validate constraint "run_summaries_user_id_fkey";

alter table "quiz"."wallets" add constraint "wallets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES quiz.users(user_id) ON DELETE CASCADE not valid;

alter table "quiz"."wallets" validate constraint "wallets_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION quiz._deprecated()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  raise feature_not_supported using message = 'quiz.* is deprecated. Use public.qd_* RPC instead.';
end;
$function$
;



