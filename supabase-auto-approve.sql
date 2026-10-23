-- TravelWithSilentMonk community: auto-approval rules. Run once in Supabase > SQL Editor,
-- AFTER supabase-setup.sql. Replace YOUR_GMAIL@gmail.com in the last line first.
--
-- Rules (applied by the database, the website cannot override them):
--   1. Posts from admins (you) are approved immediately.
--   2. A person's first post is always reviewed (pending).
--   3. After one of their posts is approved, their later posts are approved immediately.
--   4. If any of their posts was ever rejected, all their posts go back to review.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;  -- no policies: not readable from the website

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

create or replace function public.set_tip_status()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.admins where user_id = new.user_id) then
    new.status := 'approved';
  elsif exists (select 1 from public.tips where user_id = new.user_id and status = 'rejected') then
    new.status := 'pending';
  elsif exists (select 1 from public.tips where user_id = new.user_id and status = 'approved') then
    new.status := 'approved';
  else
    new.status := 'pending';
  end if;
  return new;
end
$$;

drop trigger if exists tips_set_status on public.tips;
create trigger tips_set_status before insert on public.tips
  for each row execute function public.set_tip_status();

-- The trigger now decides the status, so the insert rule no longer requires 'pending'.
-- Everyone except admins is still limited to 5 posts a day.
drop policy if exists "insert own pending tips" on public.tips;
drop policy if exists "insert own tips" on public.tips;
create policy "insert own tips" on public.tips for insert to authenticated
  with check (
    user_id = auth.uid()
    and (public.is_admin() or (select count(*) from public.tips t
         where t.user_id = auth.uid() and t.created_at > now() - interval '1 day') < 5)
  );

-- Make yourself an admin (use the Gmail you sign in to the website with):
insert into public.admins (user_id)
select id from auth.users where email = 'YOUR_GMAIL@gmail.com'
on conflict do nothing;
