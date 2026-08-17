-- Reno Tracker — Supabase schema.
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.

-- 1 · App state: one row per account, whole app state as JSON (last-write-wins).
create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "own state select" on public.app_state
  for select using (auth.uid() = user_id);
create policy "own state insert" on public.app_state
  for insert with check (auth.uid() = user_id);
create policy "own state update" on public.app_state
  for update using (auth.uid() = user_id);
create policy "own state delete" on public.app_state
  for delete using (auth.uid() = user_id);

-- Live sync between devices.
alter publication supabase_realtime add table public.app_state;

-- 2 · Photos & uploaded drawings: private bucket, one folder per account.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "own photos select" on storage.objects
  for select using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own photos insert" on storage.objects
  for insert with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own photos update" on storage.objects
  for update using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own photos delete" on storage.objects
  for delete using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
