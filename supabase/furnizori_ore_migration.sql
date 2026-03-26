-- Sterge coloana ora_ridicare si is_stoc_ct din furnizori (nu mai sunt necesare)
alter table public.furnizori drop column if exists ora_ridicare;
alter table public.furnizori drop column if exists is_stoc_ct;
alter table public.furnizori drop column if exists are_contract;
alter table public.furnizori drop column if exists termen_plata;

-- Daca exista randul "Stoc CT" ca furnizor separat, il stergem
delete from public.furnizori where denumire = 'Stoc CT';

-- Ore multiple per furnizor
create table if not exists public.furnizori_ore (
  id            uuid primary key default gen_random_uuid(),
  furnizor_id   uuid not null references public.furnizori(id) on delete cascade,
  ora           time not null,
  created_at    timestamptz default now()
);

create index if not exists furnizori_ore_furnizor_idx on public.furnizori_ore(furnizor_id);

alter table public.furnizori_ore enable row level security;

create policy "Autentificati pot citi ore" on public.furnizori_ore for select to authenticated using (true);
create policy "Autentificati pot insera ore" on public.furnizori_ore for insert to authenticated with check (true);
create policy "Autentificati pot sterge ore" on public.furnizori_ore for delete to authenticated using (true);

-- Adauga is_stoc_ct pe ridicari (in loc de ora, se alege stoc CT)
alter table public.ridicari add column if not exists is_stoc_ct boolean default false;
alter table public.ridicari add column if not exists ora_id uuid references public.furnizori_ore(id) on delete set null;
