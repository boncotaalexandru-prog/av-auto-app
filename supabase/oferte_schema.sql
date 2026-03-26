-- =============================================
-- Oferte
-- =============================================

create table if not exists public.oferte (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clienti(id) on delete restrict,
  masina_id       uuid references public.clienti_masini(id) on delete set null,
  necesar_piese   text,
  status          text not null default 'draft',
  -- status: draft | trimisa | confirmata | finalizata | anulata
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists oferte_client_idx on public.oferte(client_id);
create index if not exists oferte_status_idx on public.oferte(status);

alter table public.oferte enable row level security;

create policy "Autentificati pot citi oferte" on public.oferte for select to authenticated using (true);
create policy "Autentificati pot insera oferte" on public.oferte for insert to authenticated with check (true);
create policy "Autentificati pot modifica oferte" on public.oferte for update to authenticated using (true);
