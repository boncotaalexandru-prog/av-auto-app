-- Cheltuieli generale
create table if not exists public.cheltuieli_generale (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  suma numeric(10,2) not null,
  tip text not null check (tip in ('Salarii','Motorina','Benzina','Contabilitate','Rata credit','DIGI','Protocol','Consumabile')),
  descriere text,
  bon_nr text,
  created_at timestamptz default now()
);
alter table public.cheltuieli_generale enable row level security;
create policy "Admin poate gestiona cheltuieli" on public.cheltuieli_generale for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Parc auto - masini
create table if not exists public.parc_masini (
  id uuid primary key default gen_random_uuid(),
  nr_inmatriculare text not null,
  marca text,
  model text,
  an integer,
  sofer text,
  activa boolean default true,
  created_at timestamptz default now()
);
alter table public.parc_masini enable row level security;
create policy "Admin poate gestiona parc" on public.parc_masini for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Alimentari
create table if not exists public.parc_alimentari (
  id uuid primary key default gen_random_uuid(),
  masina_id uuid not null references public.parc_masini(id) on delete cascade,
  data date not null,
  km integer not null,
  litri numeric(8,2) not null,
  total_ron numeric(10,2) not null,
  tip_combustibil text default 'Motorina' check (tip_combustibil in ('Motorina','Benzina','AdBlue')),
  statie text,
  created_at timestamptz default now()
);
alter table public.parc_alimentari enable row level security;
create policy "Admin poate gestiona alimentari" on public.parc_alimentari for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Cheltuieli masini
create table if not exists public.parc_cheltuieli (
  id uuid primary key default gen_random_uuid(),
  masina_id uuid not null references public.parc_masini(id) on delete cascade,
  data date not null,
  km integer,
  descriere text not null,
  suma numeric(10,2) not null,
  categorie text check (categorie in ('ITP','Revizie','Cauciucuri','Piese','Asigurare','Rovinieta','Altele')),
  nr_factura text,
  created_at timestamptz default now()
);
alter table public.parc_cheltuieli enable row level security;
create policy "Admin poate gestiona cheltuieli masini" on public.parc_cheltuieli for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Angajati
create table if not exists public.angajati (
  id uuid primary key default gen_random_uuid(),
  nume text not null,
  tip text not null check (tip in ('fix','fix_plus_comision','comision')),
  suma_fixa numeric(10,2) default 0,
  procent numeric(5,2) default 0,
  activ boolean default true,
  created_at timestamptz default now()
);
alter table public.angajati enable row level security;
create policy "Admin poate gestiona angajati" on public.angajati for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Salarii lunare (override manual)
create table if not exists public.salarii_lunare (
  id uuid primary key default gen_random_uuid(),
  angajat_id uuid not null references public.angajati(id) on delete cascade,
  luna date not null,
  suma_finala numeric(10,2),
  adaos_brut_referinta numeric(10,2),
  editat_manual boolean default false,
  created_at timestamptz default now(),
  unique(angajat_id, luna)
);
alter table public.salarii_lunare enable row level security;
create policy "Admin poate gestiona salarii" on public.salarii_lunare for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
