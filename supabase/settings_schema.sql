-- =============================================
-- Setari firma — ruleaza in Supabase SQL Editor
-- =============================================

create table if not exists public.settings (
  id           integer primary key default 1,
  company_name text,
  address      text,
  phone        text,
  email        text,
  cui          text,
  reg_com      text,
  logo_url     text,
  updated_at   timestamptz default now(),
  constraint   single_row check (id = 1)
);

-- Insereaza randul implicit daca nu exista
insert into public.settings (id) values (1) on conflict do nothing;

-- Row Level Security
alter table public.settings enable row level security;

-- Toti utilizatorii autentificati pot citi setarile (necesar pentru logo in sidebar/favicon)
create policy "Toti pot citi setarile"
  on public.settings for select
  using (true);

-- Doar adminul poate modifica
create policy "Doar admin poate modifica setarile"
  on public.settings for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =============================================
-- Storage bucket pentru logo
-- Ruleaza separat dupa ce creezi bucket-ul
-- =============================================

-- In Supabase: Storage → New bucket → nume: "logos" → Public: ON
-- Apoi ruleaza:

-- insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict do nothing;

-- create policy "Logo public read" on storage.objects for select using (bucket_id = 'logos');
-- create policy "Admin poate uploada logo" on storage.objects for insert
--   with check (bucket_id = 'logos' and exists (
--     select 1 from public.profiles where id = auth.uid() and role = 'admin'
--   ));
-- create policy "Admin poate sterge logo" on storage.objects for delete
--   using (bucket_id = 'logos' and exists (
--     select 1 from public.profiles where id = auth.uid() and role = 'admin'
--   ));
