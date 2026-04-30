-- Tabel discounturi de la furnizori
create table if not exists public.discounturi_furnizori (
  id uuid primary key default gen_random_uuid(),
  furnizor text not null,
  suma numeric(10,2) not null,
  data_emitere date not null,
  luna_referinta text not null, -- format YYYY-MM
  nr_document text,
  observatii text,
  created_at timestamptz default now()
);

alter table public.discounturi_furnizori enable row level security;

create policy "Admin full access discounturi"
  on public.discounturi_furnizori for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
