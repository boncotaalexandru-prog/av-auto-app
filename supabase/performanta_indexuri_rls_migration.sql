-- Audit viteza 28.10.2026: indexuri pe cheile straine + reguli RLS evaluate o singura data.
-- Nu schimba date si nici ce vede fiecare utilizator.

-- 1. Indexuri pe cheile straine semnalate de Supabase (unindexed_foreign_keys)
create index if not exists clienti_masini_client_id_idx              on public.clienti_masini (client_id);
create index if not exists clienti_preturi_produs_id_idx             on public.clienti_preturi (produs_id);
create index if not exists facturi_client_id_idx                     on public.facturi (client_id);
create index if not exists facturi_created_by_idx                    on public.facturi (created_by);
create index if not exists facturi_oferta_id_idx                     on public.facturi (oferta_id);
create index if not exists facturi_referinta_id_idx                  on public.facturi (referinta_id);
create index if not exists facturi_produse_factura_id_idx            on public.facturi_produse (factura_id);
create index if not exists facturi_produse_produs_id_idx             on public.facturi_produse (produs_id);
create index if not exists facturi_produse_referinta_linie_id_idx    on public.facturi_produse (referinta_linie_id);
create index if not exists facturi_produse_stoc_id_idx               on public.facturi_produse (stoc_id);
create index if not exists furnizori_ore_furnizor_id_idx             on public.furnizori_ore (furnizor_id);
create index if not exists nir_furnizor_id_idx                       on public.nir (furnizor_id);
create index if not exists nir_produse_nir_id_idx                    on public.nir_produse (nir_id);
create index if not exists nir_produse_produs_id_idx                 on public.nir_produse (produs_id);
create index if not exists oferte_masina_id_idx                      on public.oferte (masina_id);
create index if not exists oferte_oferta_partial_ref_idx             on public.oferte (oferta_partial_ref);
create index if not exists oferte_preluat_de_idx                     on public.oferte (preluat_de);
create index if not exists oferte_produse_furnizor_id_idx            on public.oferte_produse (furnizor_id);
create index if not exists oferte_produse_oferta_id_idx              on public.oferte_produse (oferta_id);
create index if not exists oferte_produse_produs_id_idx              on public.oferte_produse (produs_id);
create index if not exists oferte_produse_stoc_id_idx                on public.oferte_produse (stoc_id);
create index if not exists oferte_produse_livrat_de_idx              on public.oferte_produse (livrat_de);
create index if not exists parc_alimentari_masina_id_idx             on public.parc_alimentari (masina_id);
create index if not exists parc_cheltuieli_masina_id_idx             on public.parc_cheltuieli (masina_id);
create index if not exists produse_grup_echivalente_id_idx           on public.produse (grup_echivalente_id);
create index if not exists ridicari_oferta_id_idx                    on public.ridicari (oferta_id);
create index if not exists ridicari_produse_produs_id_idx            on public.ridicari_produse (produs_id);
create index if not exists stoc_furnizor_id_idx                      on public.stoc (furnizor_id);
create index if not exists stoc_produs_id_idx                        on public.stoc (produs_id);

-- 2. Reguli doar-admin: (select auth.uid()) se calculeaza o data pe interogare, nu pe fiecare rand
alter policy "Admin poate gestiona angajati"          on public.angajati                 using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));
alter policy "Admin full access fixe lunare"          on public.cheltuieli_fixe_lunare   using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));
alter policy "Admin full access fixe template"        on public.cheltuieli_fixe_template using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));
alter policy "Admin poate gestiona cheltuieli"        on public.cheltuieli_generale      using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));
alter policy "Admin full access discounturi"          on public.discounturi_furnizori    using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));
alter policy "Admin poate gestiona alimentari"        on public.parc_alimentari          using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));
alter policy "Admin poate gestiona cheltuieli masini" on public.parc_cheltuieli          using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));
alter policy "Admin poate gestiona parc"              on public.parc_masini              using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));
alter policy "Admin poate gestiona salarii"           on public.salarii_lunare           using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));
alter policy "Doar admin poate modifica setarile"     on public.settings                 using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));
