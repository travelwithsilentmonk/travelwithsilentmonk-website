-- TravelWithSilentMonk community: run this once in Supabase > SQL Editor.
-- Posts are hidden until you set status = 'approved' (Table Editor > tips).

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  country text not null check (char_length(country) between 2 and 60),
  city text not null check (char_length(city) between 1 and 80),
  type text not null check (type in ('stay','food','nightlife','hidden','tip')),
  place text not null check (char_length(place) between 2 and 100),
  rating int check (rating between 1 and 5),
  body text not null check (char_length(body) between 20 and 700),
  status text not null default 'pending' check (status in ('pending','approved','rejected'))
);
create index if not exists tips_country_status_idx on public.tips (country, status, created_at desc);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tip_id uuid not null references public.tips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text check (char_length(reason) <= 300)
);

alter table public.tips enable row level security;
alter table public.reports enable row level security;

-- Anyone can read approved tips.
create policy "read approved tips" on public.tips for select using (status = 'approved');
-- Signed-in people can read their own tips (so they see pending ones).
create policy "read own tips" on public.tips for select to authenticated using (user_id = auth.uid());
-- Signed-in people can add tips for themselves, always pending, max 5 per day.
create policy "insert own pending tips" on public.tips for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'pending'
    and (select count(*) from public.tips t where t.user_id = auth.uid() and t.created_at > now() - interval '1 day') < 5
  );
-- People can delete their own tips.
create policy "delete own tips" on public.tips for delete to authenticated using (user_id = auth.uid());

-- Signed-in people can report tips; only the owner of the project (dashboard) can read reports.
create policy "insert reports" on public.reports for insert to authenticated with check (user_id = auth.uid());
