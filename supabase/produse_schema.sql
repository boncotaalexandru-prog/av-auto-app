-- =============================================
-- Produse — ruleaza in Supabase SQL Editor
-- =============================================

create table if not exists public.produse (
  id          uuid primary key default gen_random_uuid(),
  cod         text unique,
  nume        text not null,
  pret        numeric,
  unitate     text,
  producator  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Index pentru cautare rapida dupa cod
create index if not exists produse_cod_idx on public.produse(cod);

-- Row Level Security
alter table public.produse enable row level security;

-- Toti utilizatorii autentificati pot citi
create policy "Autentificati pot citi produsele"
  on public.produse for select
  to authenticated
  using (true);

-- Toti utilizatorii autentificati pot insera (import)
create policy "Autentificati pot insera produse"
  on public.produse for insert
  to authenticated
  with check (true);

-- Toti utilizatorii autentificati pot modifica
create policy "Autentificati pot modifica produse"
  on public.produse for update
  to authenticated
  using (true);
