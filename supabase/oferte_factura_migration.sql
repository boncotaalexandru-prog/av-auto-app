-- =============================================
-- Legatura oferta → factura
-- =============================================
-- O factura poate cuprinde mai multe oferte (factura cumulata), deci legatura sta pe oferta.
-- Fiecare linie de factura tine minte piesa din oferta de unde vine (necesar pentru storno pe oferta).
-- status oferta nou: in_facturare (are factura nefinalizata; trece pe facturat la emitere)

alter table public.oferte
  add column if not exists factura_id uuid references public.facturi(id) on delete set null;
create index if not exists oferte_factura_idx on public.oferte(factura_id);

alter table public.facturi_produse
  add column if not exists oferta_produs_id uuid references public.oferte_produse(id) on delete set null;
create index if not exists facturi_produse_oferta_produs_idx on public.facturi_produse(oferta_produs_id);

-- emiteStorno marcheaza originala „stornata", dar constrangerea veche o refuza
alter table public.facturi drop constraint if exists facturi_status_check;
alter table public.facturi add constraint facturi_status_check
  check (status = any (array['nefinalizata', 'emisa', 'platita', 'anulata', 'stornata']));
