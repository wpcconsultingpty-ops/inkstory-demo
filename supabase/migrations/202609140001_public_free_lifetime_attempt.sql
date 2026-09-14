-- STAGING REVIEW ONLY. Additive to the invite-only pilot; does NOT enable public
-- generation, alter memberships, change quotas, or modify existing artwork.
begin;

alter table public.pilot_config
  add column public_free_enabled boolean not null default false;

-- Permanent consumption tombstones: no expiry, no brief/concept foreign key and
-- no cascading account delete. Retain independently of reservation archival.
-- Account identity is auth.users.id, not a user-editable email or JWT claim.
create table public.pilot_lifetime_attempts (
  user_id uuid primary key,
  first_attempt_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp()
);
alter table public.pilot_lifetime_attempts enable row level security;
revoke all on public.pilot_lifetime_attempts from public, anon, authenticated, service_role;
grant select, insert on public.pilot_lifetime_attempts to service_role;

-- ALTER above holds the config lock through commit, serializing this backfill
-- against the existing reserve/complete RPCs. Count ALL historical states and
-- dates, including prior allowlisted attempts and pre-reservation artwork.
insert into public.pilot_lifetime_attempts(user_id, first_attempt_at)
select user_id, min(attempted_at) from (
  select user_id, created_at as attempted_at from public.pilot_generation_reservations
  union all
  select user_id, created_at from public.concepts
  union all
  select user_id, archived_at from public.pilot_concept_history
) history group by user_id;

create function public.pilot_record_lifetime_attempt() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  insert into public.pilot_lifetime_attempts(user_id, first_attempt_at)
    values (new.user_id, new.created_at) on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.pilot_record_lifetime_attempt() from public, anon, authenticated;
create trigger pilot_record_lifetime_attempt after insert on public.pilot_generation_reservations
  for each row execute function public.pilot_record_lifetime_attempt();

-- Private, parameterless account classifier shared by reservation authorization,
-- completion authorization, Storage INSERT and the read-only entitlement RPC.
-- A membership row is an explicit operator decision: false OR expired is DENIED,
-- never silently downgraded to the public tier. Do not delete revoked memberships.
-- All generating accounts (including allowlisted owners) must have a verified
-- email in auth.users; JWT/user_metadata email claims are not authoritative.
create function public.pilot_generation_tier() returns text
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare uid uuid := auth.uid(); m public.pilot_members%rowtype;
begin
  if uid is null then return 'anonymous'; end if;
  select * into m from public.pilot_members where user_id = uid;
  if found and (not m.allowlisted or
      (m.expires_at is not null and m.expires_at <= clock_timestamp())) then
    return 'blocked';
  end if;
  if not exists (select 1 from auth.users u where u.id = uid
    and nullif(btrim(u.email), '') is not null and u.email_confirmed_at is not null
    and u.is_anonymous is false
    and (u.banned_until is null or u.banned_until <= clock_timestamp())) then
    return 'unverified';
  end if;
  if m.user_id is not null then return 'allowlisted'; end if;
  return 'public_free';
end $$;
revoke all on function public.pilot_generation_tier() from public, anon, authenticated;

-- Eligibility here deliberately does NOT test unused lifetime allowance:
-- completion must still authorize a public account whose attempt was consumed
-- by reservation. Only reserve enforces a NEW spend, under the same global lock.
create or replace function public.pilot_lock_and_authorize(p_brief_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare cfg public.pilot_config%rowtype; b public.briefs%rowtype;
  uid uuid := auth.uid(); tier text;
begin
  if uid is null then raise exception 'pilot_unauthorized' using errcode = '42501'; end if;
  select * into cfg from public.pilot_config where id = true for update;
  if not found or not cfg.enabled then raise exception 'pilot_disabled' using errcode = '42501'; end if;
  tier := public.pilot_generation_tier();
  if tier = 'blocked' then raise exception 'pilot_access_revoked' using errcode = '42501'; end if;
  if tier = 'unverified' then raise exception 'pilot_email_unverified' using errcode = '42501'; end if;
  if tier <> 'allowlisted' and (tier <> 'public_free' or not cfg.public_free_enabled) then
    raise exception 'pilot_not_invited' using errcode = '42501';
  end if;
  select * into b from public.briefs where id = p_brief_id and user_id = uid for share;
  if not found then raise exception 'pilot_not_found' using errcode = '42501'; end if;
  if not public.pilot_brief_is_valid(to_jsonb(b)) then
    raise exception 'pilot_invalid_brief' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'meaning', b.meaning, 'placement', b.placement, 'size_cm', b.size_cm,
    'style', b.style, 'key_elements', b.key_elements, 'palette', b.palette, 'reference_notes', b.reference_notes
  );
end $$;
revoke all on function public.pilot_lock_and_authorize(uuid) from public, anon, authenticated;

create or replace function public.pilot_reserve_generation(p_brief_id uuid, p_idx integer) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  snapshot jsonb; cfg public.pilot_config%rowtype; ts timestamptz; rid uuid := gen_random_uuid();
  uid uuid := auth.uid(); user_count bigint; global_count bigint; tier text;
begin
  if p_idx is null or p_idx not between 0 and 2 then
    raise exception 'pilot_invalid_index' using errcode = '22023';
  end if;
  snapshot := public.pilot_lock_and_authorize(p_brief_id);
  select * into cfg from public.pilot_config where id = true;
  ts := clock_timestamp(); -- AFTER acquiring the existing global config lock
  tier := public.pilot_generation_tier();
  if tier not in ('allowlisted', 'public_free') then
    raise exception 'pilot_access_revoked' using errcode = '42501';
  end if;
  if tier = 'public_free' and exists (
    select 1 from public.pilot_lifetime_attempts where user_id = uid
  ) then raise exception 'pilot_lifetime_used' using errcode = '54000'; end if;
  update public.pilot_generation_reservations set state = 'expired'
    where brief_id = p_brief_id and idx = p_idx and state = 'reserved' and expires_at <= ts;
  if exists (select 1 from public.pilot_generation_reservations
    where brief_id = p_brief_id and idx = p_idx and state = 'reserved') then
    raise exception 'pilot_busy' using errcode = '55000';
  end if;
  select count(*), count(*) filter (where user_id = uid)
    into global_count, user_count from public.pilot_generation_reservations
    where created_at > ts - interval '24 hours';
  if global_count >= cfg.global_daily_limit then
    raise exception 'pilot_global_quota' using errcode = '54000';
  end if;
  if tier = 'allowlisted' and user_count >= cfg.per_user_daily_limit then
    raise exception 'pilot_quota' using errcode = '54000';
  end if;
  insert into public.pilot_generation_reservations
    (id,user_id,brief_id,idx,brief_snapshot,created_at,expires_at)
    values (rid,uid,p_brief_id,p_idx,snapshot,ts,ts + make_interval(secs => cfg.lease_seconds));
  -- The INSERT trigger consumes the lifetime marker for EVERY tier atomically.
  update public.briefs set status = 'submitted', updated_at = ts where id = p_brief_id and user_id = uid;
  return jsonb_build_object('reservation_id',rid,'brief',snapshot,'expires_at',ts + make_interval(secs => cfg.lease_seconds));
end $$;
revoke all on function public.pilot_reserve_generation(uuid,integer) from public, anon, authenticated;
grant execute on function public.pilot_reserve_generation(uuid,integer) to authenticated;

-- Existing permissive AND restrictive Storage policies call this helper.
-- No membership INNER JOIN: public users have no membership row. Do not check
-- lifetime availability here: the live, owned lease already consumed it.
create or replace function public.pilot_can_upload_object(p_name text) returns boolean
language sql volatile security definer set search_path = pg_catalog, public as $$
  select auth.uid() is not null and exists (
    select 1 from public.pilot_generation_reservations r
      join public.pilot_config cfg on cfg.id = true
      join public.briefs b on b.id = r.brief_id and b.user_id = r.user_id
    where r.user_id = auth.uid() and r.state = 'reserved' and r.expires_at > clock_timestamp()
      and cfg.enabled
      and (public.pilot_generation_tier() = 'allowlisted'
        or (cfg.public_free_enabled and public.pilot_generation_tier() = 'public_free'))
      and p_name = r.user_id::text || '/' || r.brief_id::text || '/' || r.id::text || '.png'
  );
$$;
revoke all on function public.pilot_can_upload_object(text) from public, anon, authenticated;
grant execute on function public.pilot_can_upload_object(text) to authenticated, anon;

-- Read only, current caller only. No emails, IDs, member lists, raw history,
-- global usage counts, paths, prompt text or credentials leave this RPC.
-- Advisory snapshot only: reserve ALWAYS rechecks under the global lock.
create function public.pilot_generation_entitlement() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare cfg public.pilot_config%rowtype; tier text; reason text;
  uid uuid := auth.uid(); used boolean; user_count bigint; global_count bigint;
  remaining integer := 0; allowance_limit integer := 0; ts timestamptz := clock_timestamp();
begin
  if uid is null then raise exception 'pilot_unauthorized' using errcode = '42501'; end if;
  tier := public.pilot_generation_tier();
  select * into cfg from public.pilot_config where id = true;
  select exists(select 1 from public.pilot_lifetime_attempts where user_id = uid) into used;
  select count(*), count(*) filter (where user_id = uid)
    into global_count, user_count from public.pilot_generation_reservations
    where created_at > ts - interval '24 hours';
  if tier = 'allowlisted' then
    allowance_limit := coalesce(cfg.per_user_daily_limit, 0);
    remaining := greatest(0, allowance_limit - user_count);
  elsif tier = 'public_free' then
    allowance_limit := 1;
    remaining := case when used then 0 else 1 end;
  end if;
  reason := case
    when tier in ('blocked','unverified','anonymous') then tier
    when tier = 'public_free' and used then 'used'
    when cfg.id is null or not cfg.enabled then 'paused'
    when tier = 'public_free' and not cfg.public_free_enabled then 'not_enabled'
    when global_count >= cfg.global_daily_limit then 'global_quota'
    when remaining = 0 then 'quota'
    else 'available' end;
  return jsonb_build_object('tier',tier,'reason',reason,'remaining',remaining,
    'limit',allowance_limit,'can_generate',reason = 'available');
end $$;
revoke all on function public.pilot_generation_entitlement() from public, anon, authenticated;
grant execute on function public.pilot_generation_entitlement() to authenticated;

comment on column public.pilot_config.public_free_enabled is
  'Explicit opt-in only. Verified email accounts without any membership get one lifetime attempt. Existing enabled/environment gates also required.';
comment on table public.pilot_lifetime_attempts is
  'Permanent per-auth-account consumption markers, including all prior attempts and legacy artwork. No expiry/refund/reset. Retain across reservation archival.';
comment on function public.pilot_generation_tier() is
  'Private DB-verified identity classifier. False/expired memberships block public fallback; retain revoked membership rows.';
notify pgrst, 'reload schema';
commit;
