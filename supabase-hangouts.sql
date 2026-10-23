-- TravelWithSilentMonk hangouts. Run once in Supabase > SQL Editor,
-- AFTER supabase-setup.sql and supabase-auto-approve.sql.
--
-- Safety design:
--   * Every hangout is reviewed first. Only admins, or people who already have an approved hangout, skip review.
--   * The group chat link is stored in a separate table that only signed-in people can read.
--   * Past hangouts disappear from public view automatically.

create table if not exists public.hangouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  host_name text not null check (char_length(host_name) between 1 and 40),
  country text not null check (char_length(country) between 2 and 60),
  city text not null check (char_length(city) between 1 and 80),
  title text not null check (char_length(title) between 5 and 80),
  starts_at timestamptz not null,
  place text not null check (char_length(place) between 3 and 120),
  description text not null check (char_length(description) between 20 and 500),
  max_people int check (max_people between 2 and 50),
  status text not null default 'pending' check (status in ('pending','approved','rejected'))
);
create index if not exists hangouts_status_start_idx on public.hangouts (status, starts_at);

create table if not exists public.hangout_links (
  hangout_id uuid primary key references public.hangouts(id) on delete cascade,
  group_link text not null check (group_link ~ '^https://(chat\.whatsapp\.com|t\.me|signal\.group|discord\.gg)/' and char_length(group_link) <= 300)
);

create table if not exists public.hangout_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text check (char_length(reason) <= 300)
);

alter table public.hangouts enable row level security;
alter table public.hangout_links enable row level security;
alter table public.hangout_reports enable row level security;

-- Status and date rules, applied by the database.
create or replace function public.set_hangout_status()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.starts_at <= now() then raise exception 'The hangout date must be in the future'; end if;
  if new.starts_at > now() + interval '120 days' then raise exception 'The hangout date is too far ahead'; end if;
  if exists (select 1 from public.admins where user_id = new.user_id) then
    new.status := 'approved';
  elsif exists (select 1 from public.hangouts where user_id = new.user_id and status = 'rejected')
     or exists (select 1 from public.tips where user_id = new.user_id and status = 'rejected') then
    new.status := 'pending';
  elsif exists (select 1 from public.hangouts where user_id = new.user_id and status = 'approved') then
    new.status := 'approved';
  else
    new.status := 'pending';
  end if;
  return new;
end
$$;
drop trigger if exists hangouts_set_status on public.hangouts;
create trigger hangouts_set_status before insert on public.hangouts
  for each row execute function public.set_hangout_status();

-- Hangouts: anyone can read approved upcoming ones; people see their own; max 3 new per day (admins unlimited).
drop policy if exists "read approved hangouts" on public.hangouts;
create policy "read approved hangouts" on public.hangouts for select
  using (status = 'approved' and starts_at > now() - interval '6 hours');
drop policy if exists "read own hangouts" on public.hangouts;
create policy "read own hangouts" on public.hangouts for select to authenticated using (user_id = auth.uid());
drop policy if exists "insert own hangouts" on public.hangouts;
create policy "insert own hangouts" on public.hangouts for insert to authenticated
  with check (
    user_id = auth.uid()
    and (public.is_admin() or (select count(*) from public.hangouts h
         where h.user_id = auth.uid() and h.created_at > now() - interval '1 day') < 3)
  );
drop policy if exists "delete own hangouts" on public.hangouts;
create policy "delete own hangouts" on public.hangouts for delete to authenticated using (user_id = auth.uid());

-- Group links: only signed-in people can read the link of an approved hangout (or their own).
drop policy if exists "read links when signed in" on public.hangout_links;
create policy "read links when signed in" on public.hangout_links for select to authenticated
  using (exists (select 1 from public.hangouts h
                 where h.id = hangout_id and (h.status = 'approved' or h.user_id = auth.uid())));
drop policy if exists "add own link" on public.hangout_links;
create policy "add own link" on public.hangout_links for insert to authenticated
  with check (exists (select 1 from public.hangouts h where h.id = hangout_id and h.user_id = auth.uid()));

-- Reports.
drop policy if exists "report hangouts" on public.hangout_reports;
create policy "report hangouts" on public.hangout_reports for insert to authenticated with check (user_id = auth.uid());
