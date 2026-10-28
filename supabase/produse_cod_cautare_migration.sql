-- =============================================
-- Cheie de cautare pentru coduri de produs (aplicata 2026-10-28)
-- „HU 719/7 X" = „HU719/7X", „EL136790" = „136.790" (Elring), „LMI26772" = „26772" (Lemforder)
-- Aceeasi regula e in src/lib/cautareCod.ts — modifica-le impreuna.
-- =============================================

create or replace function public.cheie_cod(t text) returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(upper(coalesce(t, '')), '[^A-Z0-9]', '', 'g'),
             '^EL([0-9]{6})$', '\1'),
           '^LMI([0-9])', '\1')
$$;

alter table public.produse add column if not exists cod_cautare text generated always as (public.cheie_cod(cod)) stored;
alter table public.stoc    add column if not exists cod_cautare text generated always as (public.cheie_cod(produs_cod)) stored;

create index if not exists produse_cod_cautare_idx on public.produse(cod_cautare);
create index if not exists stoc_cod_cautare_idx    on public.stoc(cod_cautare);
