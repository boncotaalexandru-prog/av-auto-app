-- =============================================
-- Piesa scoasa din oferta confirmata (ex. piesa gresita, returnata)
-- =============================================
-- Piesa nu se sterge: ramane pe oferta, taiata, cu motivul. Nu intra in factura,
-- nu rezerva stoc, nu conteaza la total si la „Pregatit". Se poate pune inapoi.

alter table public.oferte_produse
  add column if not exists scos_la timestamptz,
  add column if not exists scos_de uuid references public.profiles(id) on delete set null,
  add column if not exists scos_motiv text;
