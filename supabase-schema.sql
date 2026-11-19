-- Run this SQL in your Supabase SQL Editor
create table if not exists public.finmate_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  recent jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finmate_states enable row level security;

create policy "Users manage own FinMate data"
  on public.finmate_states
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
