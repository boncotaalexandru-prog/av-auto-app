-- =============================================
-- Livrat nefacturat — pe fiecare piesa din oferta confirmata
-- =============================================
-- livrat_la != null = piesa a plecat la client, dar oferta nu e inca facturata.
-- Conteaza doar cat oferta e „confirmata"; de la „in_facturare" rezerva factura nefinalizata.

alter table public.oferte_produse
  add column if not exists livrat_la timestamptz,
  add column if not exists livrat_de uuid references public.profiles(id) on delete set null;

create index if not exists oferte_produse_livrat_idx on public.oferte_produse(oferta_id) where livrat_la is not null;
