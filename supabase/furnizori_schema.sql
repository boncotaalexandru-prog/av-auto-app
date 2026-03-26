-- =============================================
-- Furnizori
-- =============================================

create table if not exists public.furnizori (
  id              uuid primary key default gen_random_uuid(),
  denumire        text not null,
  cod_fiscal      text,
  reg_com         text,
  cod_furnizor    text,
  adresa          text,
  localitate      text,
  judet           text,
  banca           text,
  iban            text,
  tara            text default 'Romania',
  email           text,
  pers_contact    text,
  telefon         text,
  -- Ridicari
  ora_ridicare    time,                    -- null = Stoc CT sau fara ora fixa
  is_stoc_ct      boolean default false,   -- furnizor special "Stoc CT"
  -- Date comerciale
  are_contract    boolean default false,
  termen_plata    integer,
  observatii      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists furnizori_denumire_idx on public.furnizori(denumire);
create index if not exists furnizori_cod_fiscal_idx on public.furnizori(cod_fiscal);

-- =============================================
-- Lista de ridicari
-- =============================================

create table if not exists public.ridicari (
  id              uuid primary key default gen_random_uuid(),
  furnizor_id     uuid not null references public.furnizori(id) on delete cascade,
  data_ridicare   date,                    -- null doar pentru Stoc CT
  ora_ridicare    time,                    -- preia ora furnizorului, editabil per ridicare
  status          text default 'planificat', -- planificat | ridicat | anulat
  observatii      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists ridicari_furnizor_idx on public.ridicari(furnizor_id);
create index if not exists ridicari_data_idx on public.ridicari(data_ridicare);

-- Produse per ridicare
create table if not exists public.ridicari_produse (
  id              uuid primary key default gen_random_uuid(),
  ridicare_id     uuid not null references public.ridicari(id) on delete cascade,
  produs_id       uuid references public.produse(id) on delete set null,
  denumire_liber  text,                    -- fallback daca produsul nu e in catalog
  cantitate       numeric not null default 1,
  unitate         text,
  ridicat         boolean default false,
  created_at      timestamptz default now()
);

create index if not exists ridicari_produse_ridicare_idx on public.ridicari_produse(ridicare_id);

-- =============================================
-- Seed: Stoc CT (creat automat, nu se importa)
-- =============================================
insert into public.furnizori (denumire, is_stoc_ct, ora_ridicare)
values ('Stoc CT', true, null)
on conflict do nothing;

-- =============================================
-- Row Level Security
-- =============================================

alter table public.furnizori enable row level security;
alter table public.ridicari enable row level security;
alter table public.ridicari_produse enable row level security;

create policy "Autentificati pot citi furnizorii" on public.furnizori for select to authenticated using (true);
create policy "Autentificati pot insera furnizori" on public.furnizori for insert to authenticated with check (true);
create policy "Autentificati pot modifica furnizori" on public.furnizori for update to authenticated using (true);

create policy "Autentificati pot citi ridicari" on public.ridicari for select to authenticated using (true);
create policy "Autentificati pot insera ridicari" on public.ridicari for insert to authenticated with check (true);
create policy "Autentificati pot modifica ridicari" on public.ridicari for update to authenticated using (true);
create policy "Autentificati pot sterge ridicari" on public.ridicari for delete to authenticated using (true);

create policy "Autentificati pot citi produse ridicari" on public.ridicari_produse for select to authenticated using (true);
create policy "Autentificati pot insera produse ridicari" on public.ridicari_produse for insert to authenticated with check (true);
create policy "Autentificati pot modifica produse ridicari" on public.ridicari_produse for update to authenticated using (true);
create policy "Autentificati pot sterge produse ridicari" on public.ridicari_produse for delete to authenticated using (true);
