-- ISOLATED TEST DATABASE ONLY. Minimal audited Supabase schema/roles, not a
-- production bootstrap. Tests intentionally include legacy permissive policies.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema auth to public;
grant execute on function auth.uid() to public;
create table public.briefs(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  status text not null default 'draft' check(status in ('draft','submitted','concepts_ready','purchased')),
  meaning text, placement text, size_cm text, style text, key_elements text, palette text, reference_notes text,
  brief jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.concepts(
  id uuid primary key default gen_random_uuid(), brief_id uuid not null references public.briefs(id) on delete cascade,
  user_id uuid not null references auth.users(id), idx integer not null, prompt text,
  image_url text, thumbnail_url text, meta jsonb, created_at timestamptz not null default now()
);
create table public.orders(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  brief_id uuid not null references public.briefs(id) on delete cascade,
  amount_cents integer not null, currency text not null, status text not null
    check(status in ('pending','paid','failed','refunded','mock_paid')),
  stripe_session_id text, paid_at timestamptz, created_at timestamptz not null default now()
);
alter table public.briefs enable row level security;
alter table public.concepts enable row level security;
alter table public.orders enable row level security;
create policy old_briefs_own on public.briefs for all to authenticated
  using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy old_concepts_own on public.concepts for all to authenticated
  using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy old_orders_own on public.orders for all to authenticated
  using(user_id = auth.uid()) with check(user_id = auth.uid());
grant all on public.briefs, public.concepts, public.orders to anon, authenticated, service_role;
grant update(status) on public.orders to authenticated;
grant insert(image_url), update(image_url) on public.concepts to authenticated;

create schema storage;
grant usage on schema storage to public;
create table storage.buckets(
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects(
  id uuid primary key default gen_random_uuid(), bucket_id text not null references storage.buckets(id),
  name text not null, owner uuid, owner_id text, metadata jsonb,
  unique(bucket_id,name)
);
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
grant select on storage.buckets to anon,authenticated,service_role;
insert into storage.buckets(id,name,public) values('concepts','concepts',true),('unrelated','unrelated',true);
create policy old_public_concepts_read on storage.objects for select to public using(bucket_id='concepts');
create policy old_concepts_authenticated on storage.objects for all to authenticated
  using(bucket_id='concepts') with check(bucket_id='concepts');
create policy old_concepts_demo_insert on storage.objects for insert to anon with check(bucket_id='concepts');
create policy old_concepts_demo_update on storage.objects for update to anon
  using(bucket_id='concepts') with check(bucket_id='concepts');
-- Unknown wildcard policies must not reopen concepts or break other buckets.
create policy legacy_wildcard on storage.objects for all to public using(true) with check(true);

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.briefs(id,user_id,meaning,placement,size_cm,style,key_elements,palette,reference_notes) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
    'A meaningful family tribute','Forearm','10 cm','Fine-line','Tree','Black and grey',''),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',
    'A meaningful personal journey','Calf','12 cm','Illustrative','Mountain','Muted colour','');
insert into public.concepts(id,user_id,brief_id,idx,prompt,image_url) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    0,'old prompt','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/direction-1.png'),
  -- A historical mismatch must be preserved but unreadable to either client.
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    2,'legacy mismatched owner','data:image/png;base64,iVBORw0KGgo=');
insert into public.orders(id,user_id,brief_id,amount_cents,currency,status) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1900,'aud','mock_paid');
insert into storage.objects(bucket_id,name,metadata) values
  ('concepts','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/direction-1.png','{"mimetype":"image/png","size":100}'),
  ('concepts','demo/legacy/direction-1.png','{"mimetype":"image/png","size":100}'),
  ('unrelated','other-file','{}');
