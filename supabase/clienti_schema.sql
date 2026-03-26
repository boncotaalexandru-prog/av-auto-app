-- =============================================
-- Clienti — ruleaza in Supabase SQL Editor
-- =============================================

create table if not exists public.clienti (
  id            uuid primary key default gen_random_uuid(),
  denumire      text not null,
  cod_fiscal    text,
  reg_com       text,
  cod_client    text,
  adresa        text,
  localitate    text,
  judet         text,
  banca         text,
  iban          text,
  tara          text default 'Romania',
  email         text,
  pers_contact  text,
  telefon       text,
  -- Card client
  are_contract  boolean default false,
  termen_plata  integer, -- zile (ex: 30, 60, 90)
  observatii    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists clienti_denumire_idx on public.clienti(denumire);
create index if not exists clienti_cod_fiscal_idx on public.clienti(cod_fiscal);

-- Parc auto per client
create table if not exists public.clienti_masini (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clienti(id) on delete cascade,
  nr_inmatriculare  text,
  marca             text,
  vin               text,
  created_at        timestamptz default now()
);

create index if not exists clienti_masini_client_idx on public.clienti_masini(client_id);

-- Preturi speciale per client per produs
create table if not exists public.clienti_preturi (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clienti(id) on delete cascade,
  produs_id  uuid not null references public.produse(id) on delete cascade,
  pret       numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(client_id, produs_id)
);

create index if not exists clienti_preturi_client_idx on public.clienti_preturi(client_id);

-- =============================================
-- Row Level Security
-- =============================================

alter table public.clienti enable row level security;
alter table public.clienti_masini enable row level security;
alter table public.clienti_preturi enable row level security;

create policy "Autentificati pot citi clientii" on public.clienti for select to authenticated using (true);
create policy "Autentificati pot insera clienti" on public.clienti for insert to authenticated with check (true);
create policy "Autentificati pot modifica clienti" on public.clienti for update to authenticated using (true);

create policy "Autentificati pot citi masini" on public.clienti_masini for select to authenticated using (true);
create policy "Autentificati pot insera masini" on public.clienti_masini for insert to authenticated with check (true);
create policy "Autentificati pot modifica masini" on public.clienti_masini for update to authenticated using (true);
create policy "Autentificati pot sterge masini" on public.clienti_masini for delete to authenticated using (true);

create policy "Autentificati pot citi preturi speciale" on public.clienti_preturi for select to authenticated using (true);
create policy "Autentificati pot insera preturi speciale" on public.clienti_preturi for insert to authenticated with check (true);
create policy "Autentificati pot modifica preturi speciale" on public.clienti_preturi for update to authenticated using (true);
create policy "Autentificati pot sterge preturi speciale" on public.clienti_preturi for delete to authenticated using (true);
