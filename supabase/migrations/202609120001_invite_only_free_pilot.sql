-- REVIEW / STAGING FIRST. This migration is NOT applied by the application.
-- Retains existing briefs, concepts, orders and storage objects. Bucket privacy
-- changes immediately invalidate previously public concept URLs.
begin;

create table public.pilot_config (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  per_user_daily_limit integer not null default 6 check (per_user_daily_limit between 1 and 100),
  global_daily_limit integer not null default 30 check (global_daily_limit between 1 and 1000),
  lease_seconds integer not null default 300 check (lease_seconds between 120 and 900),
  updated_at timestamptz not null default now()
);
insert into public.pilot_config (id, enabled) values (true, false);

create table public.pilot_members (
  user_id uuid primary key references auth.users(id),
  allowlisted boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- No refund/reuse of a spend reservation: failed, abandoned and expired work all
-- count for a rolling 24 hours. Retain at least 24h of rows if archiving manually.
create table public.pilot_generation_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  brief_id uuid not null references public.briefs(id),
  idx integer not null check (idx between 0 and 2),
  state text not null default 'reserved' check (state in ('reserved','completed','failed','expired')),
  brief_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  concept_id uuid references public.concepts(id)
);
create index pilot_reservations_user_window on public.pilot_generation_reservations(user_id, created_at);
create index pilot_reservations_global_window on public.pilot_generation_reservations(created_at);
create unique index pilot_one_active_direction
  on public.pilot_generation_reservations(brief_id, idx) where state = 'reserved';

-- The current concept row can be replaced only by a successful, owned lease.
-- Archive its previous complete row before replacement; never discard old art.
create table public.pilot_concept_history (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null,
  user_id uuid not null,
  previous_row jsonb not null,
  archived_at timestamptz not null default now()
);

alter table public.pilot_config enable row level security;
alter table public.pilot_members enable row level security;
alter table public.pilot_generation_reservations enable row level security;
alter table public.pilot_concept_history enable row level security;
revoke all on public.pilot_config, public.pilot_members,
  public.pilot_generation_reservations, public.pilot_concept_history from public, anon, authenticated;
-- Explicit operator access only. The web application never uses this role.
grant all on public.pilot_config, public.pilot_members,
  public.pilot_generation_reservations, public.pilot_concept_history to service_role;

-- Cross-table ownership: enforce new writes without rewriting or rejecting
-- legacy bad rows. The read policies below hide any mismatched legacy rows.
create unique index if not exists briefs_id_user_pilot_key on public.briefs(id, user_id);
alter table public.concepts add constraint concepts_brief_owner_pilot_fk
  foreign key (brief_id, user_id) references public.briefs(id, user_id) not valid;
alter table public.orders add constraint orders_brief_owner_pilot_fk
  foreign key (brief_id, user_id) references public.briefs(id, user_id) not valid;
alter table public.pilot_generation_reservations add constraint reservations_brief_owner_pilot_fk
  foreign key (brief_id, user_id) references public.briefs(id, user_id);

-- Replace every client data policy, including any forgotten permissive policy.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('briefs','concepts','orders')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;
alter table public.briefs enable row level security;
alter table public.concepts enable row level security;
alter table public.orders enable row level security;

-- Remove both table-level AND previously granted column-level write privileges.
revoke all on public.briefs, public.concepts, public.orders from public, anon, authenticated;
do $$
declare t text; col record;
begin
  foreach t in array array['briefs','concepts','orders'] loop
    for col in select column_name from information_schema.columns
      where table_schema = 'public' and table_name = t
    loop
      execute format('revoke all (%I) on public.%I from public, anon, authenticated', col.column_name, t);
    end loop;
  end loop;
end $$;
grant select on public.briefs, public.concepts, public.orders to authenticated;
grant insert (id,user_id,status,meaning,placement,size_cm,style,key_elements,palette,reference_notes,brief)
  on public.briefs to authenticated;
grant update (status,meaning,placement,size_cm,style,key_elements,palette,reference_notes,brief,updated_at)
  on public.briefs to authenticated;
-- No client DELETE on briefs: cascading deletes could otherwise bypass the
-- immutable order/concept boundary. No client concept/order writes at all.
create policy pilot_briefs_select on public.briefs for select to authenticated
  using (user_id = (select auth.uid()));
create policy pilot_briefs_insert on public.briefs for insert to authenticated
  with check (user_id = (select auth.uid()) and status in ('draft','submitted'));
create policy pilot_briefs_update on public.briefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy pilot_concepts_select on public.concepts for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.briefs b where b.id = concepts.brief_id and b.user_id = (select auth.uid())
  ));
create policy pilot_orders_select on public.orders for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.briefs b where b.id = orders.brief_id and b.user_id = (select auth.uid())
  ));

-- A client can edit draft fields and submit, but cannot self-award purchased or
-- concepts_ready. SECURITY DEFINER completion runs as the migration owner.
create function public.pilot_guard_brief_status() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if current_user in ('anon','authenticated') then
    if tg_op = 'INSERT' and new.status not in ('draft','submitted') then
      raise exception 'pilot_status_forbidden' using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status
      and new.status not in ('draft','submitted') then
      raise exception 'pilot_status_forbidden' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.pilot_guard_brief_status() from public, anon, authenticated;
create trigger pilot_guard_brief_status before insert or update on public.briefs
  for each row execute function public.pilot_guard_brief_status();

create function public.pilot_brief_is_valid(p_brief jsonb) returns boolean
language plpgsql immutable set search_path = pg_catalog, public as $$
declare
  k text; v text; n integer; total integer := 0; max_length integer;
  -- ECMAScript String.trim whitespace, matching the shared TypeScript helper.
  trim_chars text := E' \t\n\r\f' || chr(11) || chr(160) || chr(5760) ||
    chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) ||
    chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) ||
    chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279);
begin
  if jsonb_typeof(p_brief) is distinct from 'object' then return false; end if;
  foreach k in array array['meaning','placement','size_cm','style','key_elements','palette','reference_notes'] loop
    if k = 'reference_notes' and (p_brief->k is null or p_brief->k = 'null'::jsonb) then
      v := '';
    else
      if jsonb_typeof(p_brief->k) is distinct from 'string' then return false; end if;
      v := btrim(p_brief->>k, trim_chars);
    end if;
    if translate(v, E'\t\n\r', '') ~ '[[:cntrl:]]' then return false; end if;
    n := char_length(v);
    max_length := case when k in ('meaning','key_elements','reference_notes') then 2000 else 120 end;
    if n > max_length or n < (case when k = 'meaning' then 10 when k = 'reference_notes' then 0 else 1 end) then
      return false;
    end if;
    total := total + n;
  end loop;
  return total <= 6000;
end $$;
revoke all on function public.pilot_brief_is_valid(jsonb) from public, anon, authenticated;

-- All prepare/reserve/complete operations acquire this row FIRST. This single
-- lock serializes global quota decisions across users and serverless instances.
create function public.pilot_lock_and_authorize(p_brief_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare cfg public.pilot_config%rowtype; b public.briefs%rowtype; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'pilot_unauthorized' using errcode = '42501'; end if;
  select * into cfg from public.pilot_config where id = true for update;
  if not found or not cfg.enabled then raise exception 'pilot_disabled' using errcode = '42501'; end if;
  if not exists (select 1 from public.pilot_members m where m.user_id = uid and m.allowlisted
    and (m.expires_at is null or m.expires_at > clock_timestamp())) then
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

create function public.pilot_prepare_brief(p_brief_id uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.pilot_lock_and_authorize(p_brief_id);
  update public.briefs set status = 'submitted', updated_at = clock_timestamp()
    where id = p_brief_id and user_id = auth.uid();
  return true;
end $$;
revoke all on function public.pilot_prepare_brief(uuid) from public, anon, authenticated;
grant execute on function public.pilot_prepare_brief(uuid) to authenticated;

create function public.pilot_reserve_generation(p_brief_id uuid, p_idx integer) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  snapshot jsonb; cfg public.pilot_config%rowtype; ts timestamptz; rid uuid := gen_random_uuid();
  uid uuid := auth.uid(); user_count bigint; global_count bigint;
begin
  if p_idx is null or p_idx not between 0 and 2 then
    raise exception 'pilot_invalid_index' using errcode = '22023';
  end if;
  snapshot := public.pilot_lock_and_authorize(p_brief_id);
  select * into cfg from public.pilot_config where id = true;
  ts := clock_timestamp(); -- sample AFTER acquiring the global lock
  update public.pilot_generation_reservations set state = 'expired'
    where brief_id = p_brief_id and idx = p_idx and state = 'reserved' and expires_at <= ts;
  if exists (select 1 from public.pilot_generation_reservations
    where brief_id = p_brief_id and idx = p_idx and state = 'reserved') then
    raise exception 'pilot_busy' using errcode = '55000';
  end if;
  select count(*), count(*) filter (where user_id = uid)
    into global_count, user_count from public.pilot_generation_reservations
    where created_at > ts - interval '24 hours';
  if user_count >= cfg.per_user_daily_limit or global_count >= cfg.global_daily_limit then
    raise exception 'pilot_quota' using errcode = '54000';
  end if;
  insert into public.pilot_generation_reservations
    (id,user_id,brief_id,idx,brief_snapshot,created_at,expires_at)
    values (rid,uid,p_brief_id,p_idx,snapshot,ts,ts + make_interval(secs => cfg.lease_seconds));
  update public.briefs set status = 'submitted', updated_at = ts where id = p_brief_id and user_id = uid;
  return jsonb_build_object('reservation_id',rid,'brief',snapshot,'expires_at',ts + make_interval(secs => cfg.lease_seconds));
end $$;
revoke all on function public.pilot_reserve_generation(uuid,integer) from public, anon, authenticated;
grant execute on function public.pilot_reserve_generation(uuid,integer) to authenticated;

create function public.pilot_fail_generation(p_reservation_id uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then raise exception 'pilot_unauthorized' using errcode = '42501'; end if;
  update public.pilot_generation_reservations set state = 'failed'
    where id = p_reservation_id and user_id = auth.uid() and state = 'reserved';
  return found;
end $$;
revoke all on function public.pilot_fail_generation(uuid) from public, anon, authenticated;
grant execute on function public.pilot_fail_generation(uuid) to authenticated;

create function public.pilot_complete_generation(p_reservation_id uuid, p_prompt text, p_meta jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  r public.pilot_generation_reservations%rowtype; c public.concepts%rowtype;
  bid uuid; path text; ts timestamptz; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'pilot_unauthorized' using errcode = '42501'; end if;
  select brief_id into bid from public.pilot_generation_reservations
    where id = p_reservation_id and user_id = uid;
  if not found then raise exception 'pilot_lease' using errcode = '42501'; end if;
  perform public.pilot_lock_and_authorize(bid);
  select * into r from public.pilot_generation_reservations
    where id = p_reservation_id and user_id = uid for update;
  -- Network retries may read a completed result; they cannot overwrite it.
  if r.state = 'completed' then
    select * into c from public.concepts where id = r.concept_id and user_id = uid;
    return to_jsonb(c);
  end if;
  ts := clock_timestamp();
  if r.state <> 'reserved' or r.expires_at <= ts then
    raise exception 'pilot_lease' using errcode = '42501';
  end if;
  if p_prompt is null or char_length(p_prompt) not between 1 and 10000
    or jsonb_typeof(p_meta) is distinct from 'object' or octet_length(p_meta::text) > 4096 then
    raise exception 'pilot_invalid_result' using errcode = '22023';
  end if;
  path := uid::text || '/' || r.brief_id::text || '/' || r.id::text || '.png';
  if not exists (select 1 from storage.objects o where o.bucket_id = 'concepts' and o.name = path
    and o.metadata->>'mimetype' = 'image/png'
    and case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::numeric between 1 and 8388608 else false end) then
    raise exception 'pilot_image_missing' using errcode = '22023';
  end if;
  -- Preserve all pre-existing duplicate rows; replace only the newest canonical
  -- slot. New writes are serialized by the config lock and direction lease.
  select * into c from public.concepts where brief_id = r.brief_id and user_id = uid and idx = r.idx
    order by created_at desc, id desc limit 1 for update;
  if found then
    insert into public.pilot_concept_history(concept_id,user_id,previous_row) values(c.id,uid,to_jsonb(c));
    update public.concepts set prompt = p_prompt, image_url = path, thumbnail_url = path,
      meta = p_meta || jsonb_build_object('pilot_reservation_id', r.id)
      where id = c.id returning * into c;
  else
    insert into public.concepts(brief_id,user_id,idx,prompt,image_url,thumbnail_url,meta)
      values(r.brief_id,uid,r.idx,p_prompt,path,path,p_meta || jsonb_build_object('pilot_reservation_id',r.id))
      returning * into c;
  end if;
  update public.pilot_generation_reservations set state = 'completed', completed_at = ts, concept_id = c.id where id = r.id;
  if (select count(distinct idx) from public.concepts
      where brief_id = r.brief_id and user_id = uid and idx between 0 and 2 and image_url is not null) = 3 then
    update public.briefs set status = 'concepts_ready', updated_at = ts where id = r.brief_id and user_id = uid;
  end if;
  return to_jsonb(c);
end $$;
revoke all on function public.pilot_complete_generation(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.pilot_complete_generation(uuid,text,jsonb) to authenticated;

-- Private bucket with raster-only, 8 MiB uploads. Existing objects are retained.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('concepts','concepts',false,8388608,array['image/png','image/jpeg','image/webp'])
  on conflict(id) do update set public = false, file_size_limit = 8388608,
    allowed_mime_types = array['image/png','image/jpeg','image/webp'];

-- Remove all policies explicitly referring to the concepts bucket (including
-- anonymous demo writes), irrespective of their old names.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and (coalesce(qual,'') ilike '%concepts%' or coalesce(with_check,'') ilike '%concepts%')
  loop execute format('drop policy %I on storage.objects', p.policyname); end loop;
end $$;

create function public.pilot_can_read_object(p_name text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select auth.uid() is not null
    and split_part(p_name,'/',1) = auth.uid()::text
    and exists (select 1 from public.briefs b where b.id::text = split_part(p_name,'/',2) and b.user_id = auth.uid());
$$;
create function public.pilot_can_upload_object(p_name text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select auth.uid() is not null and exists (
    select 1 from public.pilot_generation_reservations r
      join public.pilot_config cfg on cfg.id = true
      join public.pilot_members m on m.user_id = r.user_id
      join public.briefs b on b.id = r.brief_id and b.user_id = r.user_id
    where r.user_id = auth.uid() and r.state = 'reserved' and r.expires_at > now()
      and cfg.enabled and m.allowlisted and (m.expires_at is null or m.expires_at > now())
      and p_name = r.user_id::text || '/' || r.brief_id::text || '/' || r.id::text || '.png'
  );
$$;
revoke all on function public.pilot_can_read_object(text), public.pilot_can_upload_object(text) from public, anon, authenticated;
grant execute on function public.pilot_can_read_object(text), public.pilot_can_upload_object(text) to authenticated, anon;

create policy pilot_concepts_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'concepts' and public.pilot_can_read_object(name));
create policy pilot_concepts_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'concepts' and public.pilot_can_upload_object(name));
-- Restrictive guards also close bucket-agnostic wildcard policies without
-- removing other buckets' policies. No UPDATE/DELETE for ANY client role.
create policy pilot_concepts_storage_read_guard on storage.objects as restrictive for select to public
  using (bucket_id <> 'concepts' or public.pilot_can_read_object(name));
create policy pilot_concepts_storage_insert_guard on storage.objects as restrictive for insert to public
  with check (bucket_id <> 'concepts' or public.pilot_can_upload_object(name));
create policy pilot_concepts_storage_update_guard on storage.objects as restrictive for update to public
  using (bucket_id <> 'concepts') with check (bucket_id <> 'concepts');
create policy pilot_concepts_storage_delete_guard on storage.objects as restrictive for delete to public
  using (bucket_id <> 'concepts');

comment on table public.pilot_config is 'Operator-only pilot kill switch and rolling 24h image quotas. Application environment gate is separately required.';
comment on table public.pilot_generation_reservations is 'Every reservation counts, including failed/expired ones. No application refunds or deletes.';
comment on table public.pilot_concept_history is 'Operator-only snapshots preserve replaced concept records and their private image paths.';

commit;
