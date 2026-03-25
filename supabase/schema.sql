-- =============================================
-- AV Auto - Piese Camioane
-- Ruleaza in Supabase SQL Editor
-- =============================================

-- Tabela profiluri utilizatori (legata de auth.users)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

-- Creeaza automat profilul cand un user nou se inregistreaza
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'user')
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- Row Level Security
-- =============================================

alter table public.profiles enable row level security;

-- Utilizatorii isi vad doar propriul profil
create policy "Utilizatorul isi vede propriul profil"
  on public.profiles for select
  using (auth.uid() = id);

-- Adminul vede toate profilele
create policy "Admin vede toate profilele"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =============================================
-- Seteaza primul admin (ruleaza dupa primul login)
-- Inlocuieste 'email@tau.com' cu emailul tau
-- =============================================

-- update public.profiles set role = 'admin' where email = 'email@tau.com';
