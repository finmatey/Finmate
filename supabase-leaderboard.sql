-- FinMate leaderboard migration. Run ONCE in Supabase -> SQL Editor (safe to re-run).
-- Does not touch public.finmate_states or auth. Day boundaries use Vietnam time.

-- 1) Tables ---------------------------------------------------------------
create table if not exists public.lb_profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  username    text not null,                      -- pseudonym, lowercase
  participate boolean not null default false,     -- opt-in
  school_key  text,                               -- normalized (lowercase) for matching only
  class_key   text,                               -- normalized (uppercase)
  updated_at  timestamptz not null default now(),
  constraint lb_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);
create unique index if not exists lb_profiles_username_uq on public.lb_profiles (username);
create index if not exists lb_profiles_scope_idx on public.lb_profiles (school_key, class_key) where participate;

-- Append-only points ledger. Clients can never insert: only the functions below.
create table if not exists public.point_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('checkin','goal_complete','budget_week')),
  ref_key    text not null,                       -- day / goal id / ISO week => idempotent
  points     int  not null check (points > 0 and points <= 100),
  event_date date not null,                       -- Vietnam local date
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_key)
);
create index if not exists point_events_date_idx on public.point_events (event_date, user_id);
create index if not exists point_events_user_idx on public.point_events (user_id, kind);

create table if not exists public.lb_totals (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  total_points   bigint not null default 0,
  best_streak    int not null default 0,
  current_streak int not null default 0,
  last_checkin   date
);

-- 2) Triggers -------------------------------------------------------------
create or replace function public.trg_event_totals() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into lb_totals (user_id, total_points) values (new.user_id, new.points)
  on conflict (user_id) do update set total_points = lb_totals.total_points + excluded.total_points;
  return new;
end $$;
drop trigger if exists point_events_totals on public.point_events;
create trigger point_events_totals after insert on public.point_events
  for each row execute function public.trg_event_totals();

create or replace function public.trg_event_immutable() returns trigger
language plpgsql as $$ begin raise exception 'point_events is append-only'; end $$;
drop trigger if exists point_events_no_update on public.point_events;
create trigger point_events_no_update before update on public.point_events
  for each row execute function public.trg_event_immutable();

-- 3) RLS: users may only READ their own rows; no direct writes at all ------
alter table public.lb_profiles  enable row level security;
alter table public.point_events enable row level security;
alter table public.lb_totals    enable row level security;

revoke all on public.lb_profiles, public.point_events, public.lb_totals from anon, authenticated;
grant select on public.lb_profiles, public.point_events, public.lb_totals to authenticated;

drop policy if exists lb_profiles_own  on public.lb_profiles;
drop policy if exists point_events_own on public.point_events;
drop policy if exists lb_totals_own    on public.lb_totals;
create policy lb_profiles_own  on public.lb_profiles  for select to authenticated using (user_id = auth.uid());
create policy point_events_own on public.point_events for select to authenticated using (user_id = auth.uid());
create policy lb_totals_own    on public.lb_totals    for select to authenticated using (user_id = auth.uid());

-- 4) Helpers --------------------------------------------------------------
create or replace function public.vn_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;

-- Internal ranking (NOT callable by clients). Ranks participants only, computed server-side.
create or replace function public.lb_ranked(p_period text, p_scope text)
returns table (r_user_id uuid, r_username text, r_points bigint, r_rank bigint, r_prev_rank bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := vn_today();
  v_from date; v_pfrom date; v_pto date;
  v_school text; v_class text;
begin
  if p_period = 'daily' then v_from := v_today; v_pfrom := v_today - 1; v_pto := v_today - 1;
  elsif p_period = 'weekly'  then v_from := date_trunc('week',  v_today)::date; v_pfrom := v_from; v_pto := v_today - 1;
  elsif p_period = 'monthly' then v_from := date_trunc('month', v_today)::date; v_pfrom := v_from; v_pto := v_today - 1;
  elsif p_period = 'alltime' then v_from := date '2000-01-01'; v_pfrom := v_from; v_pto := v_today - 1;
  else raise exception 'invalid_period'; end if;

  if p_scope not in ('all','school','class') then raise exception 'invalid_scope'; end if;
  if p_scope <> 'all' then
    select school_key, class_key into v_school, v_class from lb_profiles where user_id = auth.uid();
    if v_school is null or (p_scope = 'class' and v_class is null) then raise exception 'set_school_first'; end if;
  end if;

  return query
  with elig as (
    select p.user_id, p.username from lb_profiles p
    where p.participate
      and (p_scope = 'all'
           or (p.school_key = v_school and (p_scope = 'school' or p.class_key = v_class)))
  ),
  cur as (
    select e.user_id, sum(e.points)::bigint pts from point_events e
    join elig using (user_id) where e.event_date between v_from and v_today group by e.user_id
  ),
  prv as (
    select e.user_id, sum(e.points)::bigint pts from point_events e
    join elig using (user_id) where e.event_date between v_pfrom and v_pto group by e.user_id
  ),
  prv_r as (select user_id, rank() over (order by pts desc) pr from prv)
  select elig.user_id, elig.username, cur.pts,
         rank() over (order by cur.pts desc), prv_r.pr
  from cur join elig using (user_id) left join prv_r using (user_id);
end $$;
revoke all on function public.lb_ranked(text, text) from public, anon, authenticated;

-- 5) Public RPCs (authenticated only) -------------------------------------
-- Pseudonymous profile + opt-in. Real names/emails are never stored or returned here.
create or replace function public.set_my_leaderboard_profile(
  p_username text, p_participate boolean, p_school text default null, p_class text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_user text := lower(trim(coalesce(p_username, '')));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_user !~ '^[a-z0-9_]{3,20}$' then raise exception 'bad_username'; end if;
  insert into lb_profiles (user_id, username, participate, school_key, class_key)
  values (auth.uid(), v_user, coalesce(p_participate, false),
          nullif(left(lower(trim(coalesce(p_school,''))), 60), ''),
          nullif(left(upper(trim(coalesce(p_class,''))), 10), ''))
  on conflict (user_id) do update set username = excluded.username, participate = excluded.participate,
    school_key = excluded.school_key, class_key = excluded.class_key, updated_at = now();
exception when unique_violation then raise exception 'username_taken';
end $$;

create or replace function public.claim_checkin() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_today date := vn_today(); v_d date; v_streak int := 0; v_new int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  insert into point_events (user_id, kind, ref_key, points, event_date)
  values (v_uid, 'checkin', v_today::text, 15, v_today) on conflict do nothing;
  get diagnostics v_new = row_count;
  v_d := v_today;
  while v_streak < 400 and exists (select 1 from point_events where user_id = v_uid and kind = 'checkin' and ref_key = v_d::text) loop
    v_streak := v_streak + 1; v_d := v_d - 1;
  end loop;
  insert into lb_totals (user_id, current_streak, best_streak, last_checkin) values (v_uid, v_streak, v_streak, v_today)
  on conflict (user_id) do update set current_streak = v_streak,
    best_streak = greatest(lb_totals.best_streak, v_streak), last_checkin = v_today;
  return jsonb_build_object('awarded', v_new > 0, 'points', case when v_new > 0 then 15 else 0 end, 'streak', v_streak);
end $$;

-- Goal completion is checked against the user's synced finmate_states row.
create or replace function public.claim_goal(p_goal_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_goal jsonb; v_saved numeric; v_new int := 0; v_month int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select g into v_goal from finmate_states s, jsonb_array_elements(s.state->'goals') g
   where s.user_id = v_uid and g->>'id' = p_goal_id limit 1;
  if v_goal is null then return jsonb_build_object('awarded', false, 'reason', 'goal_not_synced'); end if;
  select coalesce(sum((c->>'amount')::numeric), 0) into v_saved from jsonb_array_elements(v_goal->'contributions') c;
  if coalesce((v_goal->>'target')::numeric, 0) < 50000 or v_saved < (v_goal->>'target')::numeric then
    return jsonb_build_object('awarded', false, 'reason', 'goal_not_complete');
  end if;
  select count(*) into v_month from point_events
   where user_id = v_uid and kind = 'goal_complete' and event_date >= date_trunc('month', vn_today())::date;
  if v_month >= 3 then return jsonb_build_object('awarded', false, 'reason', 'monthly_cap'); end if;
  insert into point_events (user_id, kind, ref_key, points, event_date)
  values (v_uid, 'goal_complete', p_goal_id, 50, vn_today()) on conflict do nothing;
  get diagnostics v_new = row_count;
  return jsonb_build_object('awarded', v_new > 0, 'points', case when v_new > 0 then 50 else 0 end);
end $$;

-- Weekly budget discipline: overall budget set, month spending within it, and logging on 3+ days this week.
create or replace function public.claim_budget_week() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_today date := vn_today(); v_state jsonb; v_limit numeric;
  v_spent numeric; v_days int; v_new int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select state into v_state from finmate_states where user_id = v_uid;
  if v_state is null then return jsonb_build_object('awarded', false, 'reason', 'not_synced'); end if;
  select (b->>'limit')::numeric into v_limit from jsonb_array_elements(v_state->'budgets') b
   where b->'categoryId' = 'null'::jsonb limit 1;
  if coalesce(v_limit, 0) <= 0 then return jsonb_build_object('awarded', false, 'reason', 'no_budget'); end if;
  select coalesce(sum((t->>'amount')::numeric), 0) into v_spent from jsonb_array_elements(v_state->'transactions') t
   where t->>'type' = 'expense' and coalesce((t->>'transfer')::boolean, false) = false
     and left(t->>'date', 7) = to_char(v_today, 'YYYY-MM');
  select count(distinct t->>'date') into v_days from jsonb_array_elements(v_state->'transactions') t
   where (t->>'date') between (v_today - 6)::text and v_today::text;
  if v_spent > v_limit then return jsonb_build_object('awarded', false, 'reason', 'over_budget'); end if;
  if v_days < 3 then return jsonb_build_object('awarded', false, 'reason', 'log_more_days'); end if;
  insert into point_events (user_id, kind, ref_key, points, event_date)
  values (v_uid, 'budget_week', to_char(v_today, 'IYYY-"W"IW'), 50, v_today) on conflict do nothing;
  get diagnostics v_new = row_count;
  return jsonb_build_object('awarded', v_new > 0, 'points', case when v_new > 0 then 50 else 0 end);
end $$;

create or replace function public.get_leaderboard(
  p_period text, p_scope text default 'all', p_search text default '', p_page int default 0, p_page_size int default 20)
returns table (rank bigint, username text, points bigint, movement int, is_me boolean, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_size int := least(greatest(coalesce(p_page_size, 20), 1), 50);
        v_off int := greatest(coalesce(p_page, 0), 0) * least(greatest(coalesce(p_page_size, 20), 1), 50);
        v_like text := replace(replace(replace(lower(trim(coalesce(p_search, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return query
  select r.r_rank, r.r_username, r.r_points,
         case when r.r_prev_rank is null then null else (r.r_prev_rank - r.r_rank)::int end,
         r.r_user_id = auth.uid(), count(*) over ()
  from lb_ranked(p_period, p_scope) r
  where r.r_username like v_like
  order by r.r_rank, r.r_username
  limit v_size offset v_off;
end $$;

create or replace function public.get_my_rank(p_period text, p_scope text default 'all')
returns table (rank bigint, points bigint, movement int, participants bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return query
  select r.r_rank, r.r_points, case when r.r_prev_rank is null then null else (r.r_prev_rank - r.r_rank)::int end,
         (select count(*) from lb_ranked(p_period, p_scope))
  from lb_ranked(p_period, p_scope) r where r.r_user_id = auth.uid();
end $$;

-- My own profile, totals and badges (badges are derived from verified events; nothing to forge).
create or replace function public.get_my_leaderboard_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); p lb_profiles; t lb_totals; v_streak int; v_badges text[] := '{}';
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into p from lb_profiles where user_id = v_uid;
  select * into t from lb_totals where user_id = v_uid;
  v_streak := case when t.last_checkin >= vn_today() - 1 then coalesce(t.current_streak, 0) else 0 end;
  if t.last_checkin is not null then v_badges := v_badges || 'first_checkin'; end if;
  if coalesce(t.best_streak, 0) >= 7  then v_badges := v_badges || 'streak_7';  end if;
  if coalesce(t.best_streak, 0) >= 30 then v_badges := v_badges || 'streak_30'; end if;
  if coalesce(t.total_points, 0) >= 100  then v_badges := v_badges || 'points_100';  end if;
  if coalesce(t.total_points, 0) >= 500  then v_badges := v_badges || 'points_500';  end if;
  if coalesce(t.total_points, 0) >= 1000 then v_badges := v_badges || 'points_1000'; end if;
  if exists (select 1 from point_events where user_id = v_uid and kind = 'goal_complete')  then v_badges := v_badges || 'goal_1';   end if;
  if exists (select 1 from point_events where user_id = v_uid and kind = 'budget_week')    then v_badges := v_badges || 'budget_1'; end if;
  return jsonb_build_object(
    'has_profile', p.user_id is not null, 'username', p.username, 'participate', coalesce(p.participate, false),
    'school', p.school_key, 'class_name', p.class_key,
    'checked_in_today', coalesce(t.last_checkin = vn_today(), false),
    'week_claimed', exists (select 1 from point_events where user_id = v_uid and kind = 'budget_week'
                            and ref_key = to_char(vn_today(), 'IYYY-"W"IW')),
    'total_points', coalesce(t.total_points, 0), 'streak', v_streak, 'best_streak', coalesce(t.best_streak, 0),
    'badges', to_jsonb(v_badges));
end $$;

revoke all on function public.set_my_leaderboard_profile(text, boolean, text, text),
  public.claim_checkin(), public.claim_goal(text), public.claim_budget_week(),
  public.get_leaderboard(text, text, text, int, int), public.get_my_rank(text, text),
  public.get_my_leaderboard_summary() from public, anon;
grant execute on function public.set_my_leaderboard_profile(text, boolean, text, text),
  public.claim_checkin(), public.claim_goal(text), public.claim_budget_week(),
  public.get_leaderboard(text, text, text, int, int), public.get_my_rank(text, text),
  public.get_my_leaderboard_summary() to authenticated;
