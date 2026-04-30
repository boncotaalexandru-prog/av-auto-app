-- ════════════════════════════════════════════════════════════
-- CHELTUIELI FIXE (template + instante lunare)
-- ════════════════════════════════════════════════════════════

-- Template-uri (lista master a cheltuielilor recurente)
CREATE TABLE IF NOT EXISTS public.cheltuieli_fixe_template (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  denumire       text          NOT NULL,
  suma_implicita numeric(10,2) NOT NULL DEFAULT 0,
  activa         boolean       DEFAULT true,
  created_at     timestamptz   DEFAULT now()
);

ALTER TABLE public.cheltuieli_fixe_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access fixe template" ON public.cheltuieli_fixe_template;
CREATE POLICY "Admin full access fixe template"
  ON public.cheltuieli_fixe_template FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Instante lunare (o inregistrare per template per luna)
CREATE TABLE IF NOT EXISTS public.cheltuieli_fixe_lunare (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    uuid          NOT NULL REFERENCES public.cheltuieli_fixe_template(id) ON DELETE CASCADE,
  luna           text          NOT NULL, -- YYYY-MM
  suma_efectiva  numeric(10,2) NOT NULL,
  editata_manual boolean       DEFAULT false,
  created_at     timestamptz   DEFAULT now(),
  UNIQUE(template_id, luna)
);

ALTER TABLE public.cheltuieli_fixe_lunare ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access fixe lunare" ON public.cheltuieli_fixe_lunare;
CREATE POLICY "Admin full access fixe lunare"
  ON public.cheltuieli_fixe_lunare FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ─── Verificare ───────────────────────────────────────────
SELECT
  'tabel cheltuieli_fixe_template' AS element,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cheltuieli_fixe_template'
  ) THEN '✅ EXISTA' ELSE '❌ LIPSESTE' END AS status
UNION ALL
SELECT
  'tabel cheltuieli_fixe_lunare',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cheltuieli_fixe_lunare'
  ) THEN '✅ EXISTA' ELSE '❌ LIPSESTE' END;
