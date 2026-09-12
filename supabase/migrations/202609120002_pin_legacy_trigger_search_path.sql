-- The original schema trigger used a caller-mutable search path.
-- This changes resolution only; it does not alter any stored data.
alter function public.tg_set_updated_at() set search_path = pg_catalog;
