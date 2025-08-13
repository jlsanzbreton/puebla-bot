-- Supabase hardening & plumbing (delta)
-- Safe to run multiple times. Applies:
-- - Harden profiles UPDATE policy (no self-role change unless admin)
-- - Auto-create profile row on signup
-- - Ensure touch_updated_at and set BEFORE UPDATE triggers
-- - Add indexes for sync (updated_at, owner)
-- - Set views to security invoker to remove warnings
-- - Re-grant EXECUTE on RPCs

-- 0) Helper: admin checker (stable)
create or replace function public.auth_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- 1) Harden profiles update policy
drop policy if exists "profiles self update" on public.profiles;
create policy if not exists "profiles_update_self_name"
on public.profiles for update
using (id = auth.uid() or public.auth_is_admin())
with check (
  (id = auth.uid() and coalesce(new.role, old.role) = old.role)
  or public.auth_is_admin()
);

-- 2) Auto-create profile on signup (email + display)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, email, display_name)
  values (new.id, new.email, coalesce(new.email, 'usuario'))
  on conflict (id) do nothing;
  return new;
end$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 3) touch_updated_at + triggers
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end$$;

-- participants
drop trigger if exists trg_participants_updated on public.participants;
create trigger trg_participants_updated
before update on public.participants
for each row execute function public.touch_updated_at();

-- registrations
drop trigger if exists trg_registrations_updated on public.registrations;
create trigger trg_registrations_updated
before update on public.registrations
for each row execute function public.touch_updated_at();

-- 4) Indexes for sync performance
create index if not exists idx_participants_owner on public.participants(owner_user_id);
create index if not exists idx_participants_updated on public.participants(updated_at);
create index if not exists idx_regs_updated on public.registrations(updated_at);

-- 5) Views: avoid Security Definer warnings (use invoker)
do $$ begin
  perform 1 from pg_views where schemaname = 'public' and viewname = 'v_participants_live';
  if found then
    execute 'alter view public.v_participants_live set (security_invoker = on)';
  end if;
end $$;

do $$ begin
  perform 1 from pg_views where schemaname = 'public' and viewname = 'v_registrations_live';
  if found then
    execute 'alter view public.v_registrations_live set (security_invoker = on)';
  end if;
end $$;

-- 6) Ensure RPC grants exist (idempotent)
grant execute on function public.api_register(text, uuid, numeric) to authenticated;
grant execute on function public.api_cancel_registration(uuid) to authenticated;
grant execute on function public.api_mark_paid(uuid, text, numeric) to authenticated;
