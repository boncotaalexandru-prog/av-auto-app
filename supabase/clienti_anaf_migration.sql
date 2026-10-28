-- =============================================
-- Clienti — date ANAF (ruleaza in Supabase SQL Editor)
-- Nu modifica datele existente, doar adauga coloane si indexul de unicitate.
-- =============================================

-- PAS 1 (verificare): CUI-uri duplicate. Daca apar randuri, NU rula pasul 3 — trimite-le intai.
-- select regexp_replace(upper(cod_fiscal), '^RO|[[:space:].]', '', 'g') as cui, count(*), string_agg(denumire, ' | ')
-- from public.clienti
-- where coalesce(trim(cod_fiscal), '') <> ''
-- group by 1 having count(*) > 1;

-- PAS 2: coloane noi
alter table public.clienti add column if not exists strada          text;
alter table public.clienti add column if not exists numar           text;
alter table public.clienti add column if not exists cod_postal      text;
alter table public.clienti add column if not exists anaf_state      text not null default 'neverificat'
  check (anaf_state in ('activa', 'inactiva', 'inexistent', 'eroare', 'neverificat'));
alter table public.clienti add column if not exists anaf_checked_at timestamptz;
alter table public.clienti add column if not exists anaf_raw        jsonb;

-- platitor_tva: null = necunoscut (ANAF nu a trimis scpTVA)
alter table public.clienti add column if not exists platitor_tva boolean;
alter table public.clienti alter column platitor_tva drop not null;
alter table public.clienti alter column platitor_tva drop default;

-- PAS 3: un CUI = un singur client (indiferent daca e salvat cu „RO" sau fara)
create unique index if not exists clienti_cui_unic
  on public.clienti ((regexp_replace(upper(cod_fiscal), '^RO|[[:space:].]', '', 'g')))
  where coalesce(trim(cod_fiscal), '') <> '';
