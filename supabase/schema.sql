-- Reno Tracker — Supabase schema (no-login shared sync).
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- Safe to re-run, and safe to run on a project that had the older auth-based schema.
--
-- NOTE: this makes the app's data writable by anyone who has the app's URL
-- (the publishable key ships inside the public app bundle). That is the
-- deliberate trade-off for login-free sync.

-- 1 · One shared state row for all devices (last-write-wins).
create table if not exists public.shared_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shared_state enable row level security;

drop policy if exists "open select" on public.shared_state;
drop policy if exists "open insert" on public.shared_state;
drop policy if exists "open update" on public.shared_state;
create policy "open select" on public.shared_state for select using (true);
create policy "open insert" on public.shared_state for insert with check (true);
create policy "open update" on public.shared_state for update using (true);

-- Live sync between devices.
do $$
begin
  alter publication supabase_realtime add table public.shared_state;
exception when duplicate_object then null;
end $$;

-- 2 · Photos & uploaded drawings.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "open storage select" on storage.objects;
drop policy if exists "open storage insert" on storage.objects;
drop policy if exists "open storage update" on storage.objects;
create policy "open storage select" on storage.objects
  for select using (bucket_id = 'photos');
create policy "open storage insert" on storage.objects
  for insert with check (bucket_id = 'photos');
create policy "open storage update" on storage.objects
  for update using (bucket_id = 'photos');
