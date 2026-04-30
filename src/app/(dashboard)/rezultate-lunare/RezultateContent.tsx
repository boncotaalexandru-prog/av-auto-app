'use client'

import { useEffect, useState, useMemo, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipuri ──────────────────────────────────────────────────────────────────

interface Factura {
  id: string
  data_emitere: string
  status: string
  tip: string
}

interface FacturaProdus {
  factura_id: string
  nume_produs: string
  cod: string | null
  cantitate: number
  pret_vanzare: number
  pret_achizitie: number
}

interface StocItem {
  produs_cod: string | null
  furnizor_nume: string | null
}

type TipAngajat = 'fix' | 'fix_plus_comision' | 'comision'

interface Angajat {
  id: string
  nume: string
  tip: TipAngajat
  suma_fixa: number
  procent: number
  activ: boolean
}

interface SalariuLunar {
  angajat_id: string
  luna: string
  suma_finala: number | null
  editat_manual: boolean
}

interface Masina {
  id: string
  nr_inmatriculare: string
  marca: string | null
  model: string | null
}

interface ParcAlimentare {
  masina_id: string
  data: string
  total_ron: number
}

interface ParcCheltuiala {
  masina_id: string
  data: string
  suma: number
  categorie: string | null
  descriere: string
  furnizor: string | null
}

interface CheltuialaGen {
  data: string
  suma: number
  tip: string
  descriere: string | null
}

interface FixTemplate {
  id: string
  denumire: string
  suma_implicita: number
}

interface FixLunara {
  template_id: string
  suma_efectiva: number
  editata_manual: boolean
}

interface Discount {
  id: string
  furnizor: string
  suma: number
  luna_referinta: string
  nr_document: string | null
  data_emitere: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function luniDisponibile(): { value: string; label: string }[] {
  const result: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('ro-RO', { month: 'long', year: 'numeric' })
    result.push({ value, label })
  }
  return result
}

function lunaDefault(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function fmt(n: number) {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ro-RO')
}

// ─── Sub-component: Sectiune pliabila ────────────────────────────────────────

function Section({
  title,
  total,
  color = 'gray',
  children,
  defaultOpen = true,
}: {
  title: string
  total: number
  color?: 'green' | 'red' | 'blue' | 'gray' | 'yellow'
  children?: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const colorMap = {
    green: 'text-green-700 bg-green-50 border-green-200',
    red: 'text-red-700 bg-red-50 border-red-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    gray: 'text-gray-700 bg-gray-50 border-gray-200',
    yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  }

  return (
    <div className={`rounded-xl border ${colorMap[color]} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:opacity-80 transition-opacity"
      >
        <span className="font-semibold text-base">{title}</span>
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg">{fmt(total)} RON</span>
          <span className="text-sm opacity-60">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && children && (
        <div className="border-t border-current border-opacity-20 bg-white px-5 py-4">
          {children}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, sub = false }: { label: string; value: number; sub?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${sub ? 'pl-4 text-sm text-gray-600' : 'text-gray-800 font-medium'}`}>
      <span>{label}</span>
      <span className={sub ? 'text-gray-700' : 'font-semibold text-gray-900'}>{fmt(value)} RON</span>
    </div>
  )
}

// ─── Componenta principala ────────────────────────────────────────────────────

export default function RezultateContent() {
  const supabase = createClient()
  const luni = useMemo(() => luniDisponibile(), [])

  const [luna, setLuna] = useState(lunaDefault())
  const [loading, setLoading] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)

  // Date brute
  const [facturi, setFacturi] = useState<Factura[]>([])
  const [facturiProduse, setFacturiProduse] = useState<FacturaProdus[]>([])
  const [stoc, setStoc] = useState<StocItem[]>([])
  const [angajati, setAngajati] = useState<Angajat[]>([])
  const [salariiLunare, setSalariiLunare] = useState<SalariuLunar[]>([])
  const [masini, setMasini] = useState<Masina[]>([])
  const [parcAlimentari, setParcAlimentari] = useState<ParcAlimentare[]>([])
  const [parcCheltuieli, setParcCheltuieli] = useState<ParcCheltuiala[]>([])
  const [cheltuieliGen, setCheltuieliGen] = useState<CheltuialaGen[]>([])
  const [discounturi, setDiscounturi] = useState<Discount[]>([])
  const [fixTemplates, setFixTemplates] = useState<FixTemplate[]>([])
  const [fixLunare, setFixLunare] = useState<FixLunara[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setEroare(null)

      const [
        fRes, fpRes, sRes,
        angRes, salRes,
        masRes, alRes, pcRes,
        chRes, discRes,
        fixTplRes, fixLunRes,
      ] = await Promise.all([
        // Facturi luna curenta (emisa + platita)
        supabase
          .from('facturi')
          .select('id, data_emitere, status, tip')
          .gte('data_emitere', luna + '-01')
          .lt('data_emitere', nextMonth(luna))
          .in('status', ['emisa', 'platita']),

        // Produse din toate facturile (filtram dupa factura_id mai jos)
        supabase
          .from('facturi_produse')
          .select('factura_id, nume_produs, cod, cantitate, pret_vanzare, pret_achizitie')
          .limit(20000),

        // Stoc pentru furnizori
        supabase
          .from('stoc')
          .select('produs_cod, furnizor_nume'),

        // Angajati cu formula de calcul
        supabase.from('angajati').select('id, nume, tip, suma_fixa, procent, activ').eq('activ', true),

        // Salarii lunare (luna stocata ca YYYY-MM-01)
        supabase
          .from('salarii_lunare')
          .select('angajat_id, luna, suma_finala, editat_manual')
          .eq('luna', luna + '-01'),

        // Masini active
        supabase.from('masini').select('id, nr_inmatriculare, marca, model').eq('activa', true),

        // Alimentari luna
        supabase
          .from('parc_alimentari')
          .select('masina_id, data, total_ron')
          .gte('data', luna + '-01')
          .lt('data', nextMonth(luna)),

        // Cheltuieli parc luna
        supabase
          .from('parc_cheltuieli')
          .select('masina_id, data, suma, categorie, descriere, furnizor')
          .gte('data', luna + '-01')
          .lt('data', nextMonth(luna)),

        // Cheltuieli generale luna
        supabase
          .from('cheltuieli_generale')
          .select('data, suma, tip, descriere')
          .gte('data', luna + '-01')
          .lt('data', nextMonth(luna)),

        // Discounturi furnizori luna
        supabase
          .from('discounturi_furnizori')
          .select('id, furnizor, suma, luna_referinta, nr_document, data_emitere')
          .eq('luna_referinta', luna),

        // Cheltuieli fixe template
        supabase.from('cheltuieli_fixe_template').select('id, denumire, suma_implicita').eq('activa', true),

        // Cheltuieli fixe lunare
        supabase.from('cheltuieli_fixe_lunare').select('template_id, suma_efectiva, editata_manual').eq('luna', luna),
      ])

      if (fRes.error) { setEroare(fRes.error.message); setLoading(false); return }

      setFacturi((fRes.data ?? []) as Factura[])
      setFacturiProduse((fpRes.data ?? []) as FacturaProdus[])
      setStoc((sRes.data ?? []) as StocItem[])
      setAngajati((angRes.data ?? []) as Angajat[])
      setSalariiLunare((salRes.data ?? []) as SalariuLunar[])
      setMasini((masRes.data ?? []) as Masina[])
      setParcAlimentari((alRes.data ?? []) as ParcAlimentare[])
      setParcCheltuieli((pcRes.data ?? []) as ParcCheltuiala[])
      setCheltuieliGen((chRes.data ?? []) as CheltuialaGen[])
      setDiscounturi((discRes.data ?? []) as Discount[])
      setFixTemplates((fixTplRes.data ?? []) as FixTemplate[])
      setFixLunare((fixLunRes.data ?? []) as FixLunara[])

      setLoading(false)
    }
    load()
  }, [luna])

  // ─── Calcule Venituri ───────────────────────────────────────────────────────

  const facturiIds = useMemo(() => new Set(facturi.map(f => f.id)), [facturi])

  const fpLuna = useMemo(
    () => facturiProduse.filter(fp => facturiIds.has(fp.factura_id)),
    [facturiProduse, facturiIds]
  )

  const valoareFacturata = useMemo(
    () => fpLuna.reduce((s, p) => s + p.pret_vanzare * p.cantitate, 0),
    [fpLuna]
  )

  const costMarfa = useMemo(
    () => fpLuna.reduce((s, p) => s + p.pret_achizitie * p.cantitate, 0),
    [fpLuna]
  )

  const adaosBrut = valoareFacturata - costMarfa

  // Cost marfa pe furnizori (join cu stoc)
  const costPeFurnizori = useMemo(() => {
    const codToFurnizor: Record<string, string> = {}
    stoc.forEach(s => {
      if (s.produs_cod) codToFurnizor[s.produs_cod] = s.furnizor_nume ?? 'Necunoscut'
    })
    const map: Record<string, number> = {}
    fpLuna.forEach(p => {
      const furnizor = (p.cod && codToFurnizor[p.cod]) ? codToFurnizor[p.cod] : 'Necunoscut'
      map[furnizor] = (map[furnizor] ?? 0) + p.pret_achizitie * p.cantitate
    })
    return Object.entries(map)
      .map(([furnizor, cost]) => ({ furnizor, cost }))
      .sort((a, b) => b.cost - a.cost)
  }, [fpLuna, stoc])

  // ─── Calcule Discounturi ────────────────────────────────────────────────────

  const totalDiscounturi = useMemo(
    () => discounturi.reduce((s, d) => s + d.suma, 0),
    [discounturi]
  )

  // ─── Calcule Salarii ────────────────────────────────────────────────────────

  // ─── Calcul salarii (formula identica cu pagina Salarii) ────────────────────

  function calcSalariu(angajat: Angajat, adaosBrutRef: number): number {
    if (angajat.tip === 'fix') return angajat.suma_fixa
    if (angajat.tip === 'comision') return (adaosBrutRef * angajat.procent) / 100
    return angajat.suma_fixa + (adaosBrutRef * angajat.procent) / 100
  }

  const salariiDetaliat = useMemo(() => {
    // Map angajat_id -> override manual din DB
    const overrideMap: Record<string, number> = {}
    salariiLunare.forEach(s => {
      if (s.editat_manual && s.suma_finala !== null) {
        overrideMap[s.angajat_id] = s.suma_finala
      }
    })

    return angajati.map(a => {
      // Foloseste override manual daca exista, altfel calculeaza din formula
      const suma = overrideMap[a.id] !== undefined
        ? overrideMap[a.id]
        : calcSalariu(a, adaosBrut)
      return {
        nume: a.nume,
        suma,
        manual: overrideMap[a.id] !== undefined,
      }
    }).sort((a, b) => b.suma - a.suma)
  }, [angajati, salariiLunare, adaosBrut])

  const totalSalarii = useMemo(
    () => salariiDetaliat.reduce((s, a) => s + a.suma, 0),
    [salariiDetaliat]
  )

  // ─── Calcule Parc ───────────────────────────────────────────────────────────

  const masinaMap = useMemo(() => {
    const m: Record<string, string> = {}
    masini.forEach(ma => {
      m[ma.id] = `${ma.nr_inmatriculare}${ma.marca ? ' ' + ma.marca : ''}${ma.model ? ' ' + ma.model : ''}`
    })
    return m
  }, [masini])

  const totalAlimentari = useMemo(
    () => parcAlimentari.reduce((s, a) => s + a.total_ron, 0),
    [parcAlimentari]
  )

  const totalParcCheltuieli = useMemo(
    () => parcCheltuieli.reduce((s, c) => s + c.suma, 0),
    [parcCheltuieli]
  )

  // Alimentari pe masina
  const alimentariPeMasina = useMemo(() => {
    const map: Record<string, number> = {}
    parcAlimentari.forEach(a => {
      map[a.masina_id] = (map[a.masina_id] ?? 0) + a.total_ron
    })
    return Object.entries(map)
      .map(([id, total]) => ({ masina: masinaMap[id] ?? id, total }))
      .sort((a, b) => b.total - a.total)
  }, [parcAlimentari, masinaMap])

  // Cheltuieli parc pe categorie
  const parcCheltuieliPeCategorie = useMemo(() => {
    const map: Record<string, number> = {}
    parcCheltuieli.forEach(c => {
      const cat = c.categorie ?? 'Altele'
      map[cat] = (map[cat] ?? 0) + c.suma
    })
    return Object.entries(map)
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total)
  }, [parcCheltuieli])

  // ─── Calcule Cheltuieli Generale ────────────────────────────────────────────

  const totalCheltuieliGen = useMemo(
    () => cheltuieliGen.reduce((s, c) => s + c.suma, 0),
    [cheltuieliGen]
  )

  const cheltuieliPeTip = useMemo(() => {
    const map: Record<string, number> = {}
    cheltuieliGen.forEach(c => {
      map[c.tip] = (map[c.tip] ?? 0) + c.suma
    })
    return Object.entries(map)
      .map(([tip, total]) => ({ tip, total }))
      .sort((a, b) => b.total - a.total)
  }, [cheltuieliGen])

  // ─── Calcule Cheltuieli Fixe ────────────────────────────────────────────────

  const fixTplMap = useMemo(() => {
    const m: Record<string, string> = {}
    fixTemplates.forEach(t => { m[t.id] = t.denumire })
    return m
  }, [fixTemplates])

  const totalCheltuieliFixe = useMemo(
    () => fixLunare.reduce((s, f) => s + f.suma_efectiva, 0),
    [fixLunare]
  )

  const fixeDetaliat = useMemo(
    () => fixLunare.map(f => ({
      denumire: fixTplMap[f.template_id] ?? f.template_id,
      suma: f.suma_efectiva,
      modificata: f.editata_manual,
    })).sort((a, b) => b.suma - a.suma),
    [fixLunare, fixTplMap]
  )

  // ─── Totale finale ──────────────────────────────────────────────────────────

  const totalCheltuieli = totalSalarii + totalAlimentari + totalParcCheltuieli + totalCheltuieliGen + totalCheltuieliFixe

  const rezultatNet = adaosBrut + totalDiscounturi - totalCheltuieli

  const lunaLabel = luni.find(l => l.value === luna)?.label ?? luna

  // ─── Print ──────────────────────────────────────────────────────────────────

  function handlePrint() {
    const salariiRows = salariiDetaliat
      .map(s => `<tr><td style="padding:4px 8px">${s.nume}${s.manual ? ' <span style="font-size:9px;color:#1d4ed8">(override)</span>' : ''}</td><td style="padding:4px 8px;text-align:right">${fmt(s.suma)} RON</td></tr>`)
      .join('')

    const fixeRows = fixeDetaliat
      .map(f => `<tr><td style="padding:4px 8px">${f.denumire}${f.modificata ? ' <span style="font-size:9px;color:#b45309">(modificată)</span>' : ''}</td><td style="padding:4px 8px;text-align:right">${fmt(f.suma)} RON</td></tr>`)
      .join('')

    const alimentariRows = alimentariPeMasina
      .map(a => `<tr><td style="padding:4px 8px">${a.masina}</td><td style="padding:4px 8px;text-align:right">${fmt(a.total)} RON</td></tr>`)
      .join('')

    const parcChRows = parcCheltuieliPeCategorie
      .map(c => `<tr><td style="padding:4px 8px">${c.cat}</td><td style="padding:4px 8px;text-align:right">${fmt(c.total)} RON</td></tr>`)
      .join('')

    const chGenRows = cheltuieliPeTip
      .map(c => `<tr><td style="padding:4px 8px">${c.tip}</td><td style="padding:4px 8px;text-align:right">${fmt(c.total)} RON</td></tr>`)
      .join('')

    const discRows = discounturi
      .map(d => `<tr><td style="padding:4px 8px">${d.furnizor}</td><td style="padding:4px 8px">${fmtDate(d.data_emitere)}</td><td style="padding:4px 8px">${d.nr_document ?? '—'}</td><td style="padding:4px 8px;text-align:right;color:#15803d">+${fmt(d.suma)} RON</td></tr>`)
      .join('')

    const costFurnRows = costPeFurnizori
      .map(c => `<tr><td style="padding:4px 8px">${c.furnizor}</td><td style="padding:4px 8px;text-align:right">${fmt(c.cost)} RON</td></tr>`)
      .join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Rezultate Lunare — ${lunaLabel}</title>
<style>
  @page { size: A4 portrait; margin: 16mm; }
  * { box-sizing: border-box; font-family: Arial, sans-serif; color: #111; }
  body { font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px 0; }
  h2 { font-size: 14px; margin: 16px 0 6px 0; border-bottom: 1px solid #ccc; padding-bottom: 4px; color: #1e40af; }
  h3 { font-size: 12px; margin: 10px 0 4px 0; color: #374151; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #f1f5f9; text-align: left; padding: 5px 8px; font-size: 11px; color: #374151; border-bottom: 1px solid #e2e8f0; }
  td { padding: 4px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #111; }
  .total-row td { font-weight: bold; background: #f8fafc; border-top: 2px solid #cbd5e1; }
  .result-box { background: ${rezultatNet >= 0 ? '#dcfce7' : '#fee2e2'}; border: 2px solid ${rezultatNet >= 0 ? '#16a34a' : '#dc2626'}; border-radius: 8px; padding: 12px 16px; margin-top: 20px; text-align: center; }
  .result-label { font-size: 14px; font-weight: bold; color: #374151; }
  .result-value { font-size: 24px; font-weight: bold; color: ${rezultatNet >= 0 ? '#15803d' : '#dc2626'}; margin-top: 4px; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
  .summary-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
  .summary-card .label { font-size: 10px; color: #6b7280; }
  .summary-card .val { font-size: 14px; font-weight: bold; }
  .green { color: #15803d; }
  .red { color: #dc2626; }
  .blue { color: #1d4ed8; }
</style>
</head><body>
<h1>Rezultate Lunare</h1>
<p style="color:#6b7280;margin:0 0 16px 0">${lunaLabel} &nbsp;·&nbsp; Generat: ${new Date().toLocaleDateString('ro-RO')}</p>

<div class="summary-grid">
  <div class="summary-card"><div class="label">Valoare facturată (ex TVA)</div><div class="val blue">${fmt(valoareFacturata)} RON</div></div>
  <div class="summary-card"><div class="label">Cost marfă</div><div class="val red">${fmt(costMarfa)} RON</div></div>
  <div class="summary-card"><div class="label">Adaos brut</div><div class="val ${adaosBrut >= 0 ? 'green' : 'red'}">${fmt(adaosBrut)} RON</div></div>
  <div class="summary-card"><div class="label">Discounturi furnizori</div><div class="val green">+${fmt(totalDiscounturi)} RON</div></div>
  <div class="summary-card"><div class="label">Total cheltuieli</div><div class="val red">${fmt(totalCheltuieli)} RON</div></div>
  <div class="summary-card"><div class="label">Facturi emise</div><div class="val">${facturi.length}</div></div>
</div>

<h2>VENITURI</h2>
<table>
  <thead><tr><th>Indicator</th><th style="text-align:right">Valoare</th></tr></thead>
  <tbody>
    <tr><td>Valoare facturată (ex TVA)</td><td style="text-align:right">${fmt(valoareFacturata)} RON</td></tr>
    <tr><td>Cost marfă</td><td style="text-align:right">${fmt(costMarfa)} RON</td></tr>
    <tr class="total-row"><td>Adaos brut</td><td style="text-align:right;color:${adaosBrut >= 0 ? '#15803d' : '#dc2626'}">${fmt(adaosBrut)} RON</td></tr>
  </tbody>
</table>

${costPeFurnizori.length > 0 ? `<h3>Cost marfă pe furnizori</h3>
<table>
  <thead><tr><th>Furnizor</th><th style="text-align:right">Cost (RON)</th></tr></thead>
  <tbody>${costFurnRows}<tr class="total-row"><td>TOTAL</td><td style="text-align:right">${fmt(costMarfa)} RON</td></tr></tbody>
</table>` : ''}

${discounturi.length > 0 ? `<h2>DISCOUNTURI FURNIZORI</h2>
<table>
  <thead><tr><th>Furnizor</th><th>Data emiterii</th><th>Nr. document</th><th style="text-align:right">Suma</th></tr></thead>
  <tbody>${discRows}<tr class="total-row"><td colspan="3">TOTAL DISCOUNTURI</td><td style="text-align:right;color:#15803d">+${fmt(totalDiscounturi)} RON</td></tr></tbody>
</table>` : ''}

<h2>CHELTUIELI</h2>

${fixeDetaliat.length > 0 ? `<h3>Cheltuieli Fixe</h3>
<table>
  <thead><tr><th>Denumire</th><th style="text-align:right">Suma</th></tr></thead>
  <tbody>${fixeRows}<tr class="total-row"><td>TOTAL FIXE</td><td style="text-align:right">${fmt(totalCheltuieliFixe)} RON</td></tr></tbody>
</table>` : ''}

${salariiDetaliat.length > 0 ? `<h3>Salarii</h3>
<table>
  <thead><tr><th>Angajat</th><th style="text-align:right">Salariu net</th></tr></thead>
  <tbody>${salariiRows}<tr class="total-row"><td>TOTAL SALARII</td><td style="text-align:right">${fmt(totalSalarii)} RON</td></tr></tbody>
</table>` : ''}

${parcAlimentari.length > 0 ? `<h3>Parc Auto — Combustibil</h3>
<table>
  <thead><tr><th>Mașina</th><th style="text-align:right">Total (RON)</th></tr></thead>
  <tbody>${alimentariRows}<tr class="total-row"><td>TOTAL COMBUSTIBIL</td><td style="text-align:right">${fmt(totalAlimentari)} RON</td></tr></tbody>
</table>` : ''}

${parcCheltuieli.length > 0 ? `<h3>Parc Auto — Întreținere</h3>
<table>
  <thead><tr><th>Categorie</th><th style="text-align:right">Total (RON)</th></tr></thead>
  <tbody>${parcChRows}<tr class="total-row"><td>TOTAL ÎNTREȚINERE</td><td style="text-align:right">${fmt(totalParcCheltuieli)} RON</td></tr></tbody>
</table>` : ''}

${cheltuieliGen.length > 0 ? `<h3>Cheltuieli Generale</h3>
<table>
  <thead><tr><th>Categorie</th><th style="text-align:right">Total (RON)</th></tr></thead>
  <tbody>${chGenRows}<tr class="total-row"><td>TOTAL CHELTUIELI GENERALE</td><td style="text-align:right">${fmt(totalCheltuieliGen)} RON</td></tr></tbody>
</table>` : ''}

<div class="result-box">
  <div class="result-label">REZULTAT NET</div>
  <div class="result-value">${rezultatNet >= 0 ? '+' : ''}${fmt(rezultatNet)} RON</div>
  <div style="font-size:10px;color:#6b7280;margin-top:4px">Adaos brut ${fmt(adaosBrut)} RON + Discounturi ${fmt(totalDiscounturi)} RON − Cheltuieli ${fmt(totalCheltuieli)} RON</div>
</div>

</body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 600)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rezultate Lunare</h1>
          <p className="text-sm text-gray-500 mt-0.5">Raport P&amp;L complet — venituri, costuri, cheltuieli, rezultat net</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={luna}
            onChange={e => setLuna(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {luni.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <button
            onClick={handlePrint}
            disabled={loading}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
          >
            🖨️ Printează
          </button>
        </div>
      </div>

      {eroare && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {eroare}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500 text-sm">Se încarcă datele...</div>
      ) : (
        <>
          {/* Sumar rapid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Valoare facturată', value: valoareFacturata, color: 'text-blue-700' },
              { label: 'Cost marfă', value: costMarfa, color: 'text-red-700' },
              { label: 'Adaos brut', value: adaosBrut, color: adaosBrut >= 0 ? 'text-green-700' : 'text-red-700' },
              { label: 'Discounturi', value: totalDiscounturi, color: 'text-green-700', prefix: '+' },
              { label: 'Cheltuieli totale', value: totalCheltuieli, color: 'text-red-700' },
              { label: 'Rezultat net', value: rezultatNet, color: rezultatNet >= 0 ? 'text-green-700' : 'text-red-700' },
            ].map(card => (
              <div key={card.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className={`text-sm font-bold ${card.color}`}>
                  {card.prefix ?? ''}{fmt(card.value)}
                </p>
              </div>
            ))}
          </div>

          {/* VENITURI */}
          <Section title="VENITURI" total={adaosBrut} color="blue">
            <div className="space-y-1">
              <Row label={`Valoare facturată (ex TVA) — ${facturi.length} facturi`} value={valoareFacturata} />
              <Row label="Cost marfă (achiziție)" value={costMarfa} sub />
              <div className="border-t border-gray-200 pt-2 mt-2">
                <Row label="Adaos brut" value={adaosBrut} />
              </div>
              {costPeFurnizori.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cost marfă pe furnizori</p>
                  {costPeFurnizori.map(c => (
                    <Row key={c.furnizor} label={c.furnizor} value={c.cost} sub />
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* DISCOUNTURI */}
          {discounturi.length > 0 && (
            <Section title="DISCOUNTURI FURNIZORI" total={totalDiscounturi} color="green">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-900">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">Furnizor</th>
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">Data emiterii</th>
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">Nr. document</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Suma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discounturi.map(d => (
                      <tr key={d.id} className="border-b border-gray-100">
                        <td className="py-2 pr-4 font-medium">{d.furnizor}</td>
                        <td className="py-2 pr-4 text-gray-600">{fmtDate(d.data_emitere)}</td>
                        <td className="py-2 pr-4 text-gray-600">{d.nr_document ?? '—'}</td>
                        <td className="py-2 text-right font-semibold text-green-700">+{fmt(d.suma)} RON</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="pt-3 pb-1 font-bold text-gray-700">TOTAL</td>
                      <td className="pt-3 pb-1 text-right font-bold text-green-700">+{fmt(totalDiscounturi)} RON</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>
          )}

          {/* CHELTUIELI */}
          <Section title="CHELTUIELI" total={totalCheltuieli} color="red">
            <div className="space-y-4">
              {/* Cheltuieli Fixe */}
              {fixeDetaliat.length > 0 && (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-semibold text-gray-700">📌 Cheltuieli Fixe</p>
                      <p className="text-sm font-bold text-gray-900">{fmt(totalCheltuieliFixe)} RON</p>
                    </div>
                    <div className="space-y-1">
                      {fixeDetaliat.map(f => (
                        <div key={f.denumire} className="flex items-center justify-between pl-4 py-1.5">
                          <span className="text-sm text-gray-600">
                            {f.denumire}
                            {f.modificata && (
                              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">modificată</span>
                            )}
                          </span>
                          <span className="text-sm text-gray-700">{fmt(f.suma)} RON</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-gray-100" />
                </>
              )}

              {/* Salarii */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold text-gray-700">👥 Salarii</p>
                  <p className="text-sm font-bold text-gray-900">{fmt(totalSalarii)} RON</p>
                </div>
                {salariiDetaliat.length > 0 ? (
                  <div className="space-y-1">
                    {salariiDetaliat.map(s => (
                      <div key={s.nume} className="flex items-center justify-between pl-4 py-1.5">
                        <span className="text-sm text-gray-600">
                          {s.nume}
                          {s.manual && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">override</span>
                          )}
                        </span>
                        <span className="text-sm text-gray-700">{fmt(s.suma)} RON</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 pl-4">Nu există salarii înregistrate pentru această lună.</p>
                )}
              </div>

              <div className="border-t border-gray-100" />

              {/* Parc - Combustibil */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold text-gray-700">⛽ Parc Auto — Combustibil</p>
                  <p className="text-sm font-bold text-gray-900">{fmt(totalAlimentari)} RON</p>
                </div>
                {alimentariPeMasina.length > 0 ? (
                  <div className="space-y-1">
                    {alimentariPeMasina.map(a => (
                      <Row key={a.masina} label={a.masina} value={a.total} sub />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 pl-4">Nu există alimentări pentru această lună.</p>
                )}
              </div>

              <div className="border-t border-gray-100" />

              {/* Parc - Intretinere */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold text-gray-700">🔧 Parc Auto — Întreținere</p>
                  <p className="text-sm font-bold text-gray-900">{fmt(totalParcCheltuieli)} RON</p>
                </div>
                {parcCheltuieliPeCategorie.length > 0 ? (
                  <div className="space-y-1">
                    {parcCheltuieliPeCategorie.map(c => (
                      <Row key={c.cat} label={c.cat} value={c.total} sub />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 pl-4">Nu există cheltuieli de întreținere pentru această lună.</p>
                )}
              </div>

              <div className="border-t border-gray-100" />

              {/* Cheltuieli Generale */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold text-gray-700">💸 Cheltuieli Generale</p>
                  <p className="text-sm font-bold text-gray-900">{fmt(totalCheltuieliGen)} RON</p>
                </div>
                {cheltuieliPeTip.length > 0 ? (
                  <div className="space-y-1">
                    {cheltuieliPeTip.map(c => (
                      <Row key={c.tip} label={c.tip} value={c.total} sub />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 pl-4">Nu există cheltuieli generale pentru această lună.</p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-3">
                <Row label="TOTAL CHELTUIELI" value={totalCheltuieli} />
              </div>
            </div>
          </Section>

          {/* REZULTAT NET */}
          <div className={`rounded-xl border-2 p-6 text-center ${
            rezultatNet >= 0
              ? 'bg-green-50 border-green-400'
              : 'bg-red-50 border-red-400'
          }`}>
            <p className="text-sm font-semibold text-gray-600 mb-1">REZULTAT NET — {lunaLabel}</p>
            <p className={`text-4xl font-bold ${rezultatNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {rezultatNet >= 0 ? '+' : ''}{fmt(rezultatNet)} RON
            </p>
            <p className="text-xs text-gray-500 mt-3">
              Adaos brut <strong className="text-gray-700">{fmt(adaosBrut)} RON</strong>
              {totalDiscounturi > 0 && (
                <> + Discounturi <strong className="text-green-600">{fmt(totalDiscounturi)} RON</strong></>
              )}
              {' − '}Cheltuieli <strong className="text-gray-700">{fmt(totalCheltuieli)} RON</strong>
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Helper: luna urmatoare ───────────────────────────────────────────────────

function nextMonth(luna: string): string {
  const [y, m] = luna.split('-').map(Number)
  const d = new Date(y, m, 1) // luna+1 (m is already 1-indexed, Date uses 0-indexed so m = next month)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
