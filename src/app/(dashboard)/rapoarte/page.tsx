'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipuri ──────────────────────────────────────────────────────────────────

interface OfertaRow {
  id: string
  status: string
  created_at: string
  preluat_de: string | null
  client_denumire: string
  user_label: string
}

interface OfertaProdus {
  oferta_id: string
  pret_vanzare: number
  pret_achizitie: number
  cantitate: number
  produs_nume: string
  // adaugate la join in JS:
  oferta_status?: string
  client_denumire?: string
}

interface StocItem {
  produs_nume: string
  produs_cod: string | null
  cantitate: number
  pret_achizitie: number
  pret_lista: number | null
  furnizor_nume: string | null
}

interface NirRow {
  id: string
  numar: number
  data_intrare: string
  furnizor_nume: string | null
  total_fara_tva: number
  total_cu_tva: number
}

type Tab = 'oferte' | 'vanzari' | 'profit' | 'stoc' | 'achizitii'

interface ProfitRand {
  produs: string
  cantitate: number
  vanzari_nete: number
  cost_achizitie: number
  profit: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function MiniBar({ value, max, color = '#2563eb' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0
  return (
    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:      { label: 'Ofertă nouă', color: '#16a34a' },
  in_lucru:   { label: 'În lucru',    color: '#2563eb' },
  finalizata: { label: 'Finalizată',  color: '#059669' },
  confirmata: { label: 'Confirmată',  color: '#7c3aed' },
  facturat:   { label: 'Facturat',    color: '#0f172a' },
  anulata:    { label: 'Anulată',     color: '#dc2626' },
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RapoartePage() {
  const [tab, setTab] = useState<Tab>('oferte')
  const [loading, setLoading] = useState(true)

  // Date brute
  const [oferte, setOferte] = useState<OfertaRow[]>([])
  const [produse, setProduse] = useState<OfertaProdus[]>([])
  const [stoc, setStoc] = useState<StocItem[]>([])
  const [nir, setNir] = useState<NirRow[]>([])
  const [facturiProduse, setFacturiProduse] = useState<(ProfitRand & { data_emitere: string })[]>([])

  // Filtru perioadă
  const [perioada, setPerioada] = useState<'30' | '90' | '365' | 'toate'>('30')

  // Filtru perioadă custom pentru profit pe produs
  const nowStr = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(); firstOfMonth.setDate(1)
  const [profitDe, setProfitDe] = useState(firstOfMonth.toISOString().slice(0, 10))
  const [profitPana, setProfitPana] = useState(nowStr)
  const [profitSort, setProfitSort] = useState<'profit' | 'vanzari' | 'produs'>('profit')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()

      // Query-uri separate, join în JS — evităm problemele cu FK-urile Supabase
      const [oRaw, pRaw, clientiRaw, profilRaw, sRaw, nRaw, fRaw, fpRaw] = await Promise.all([
        supabase.from('oferte').select('id, status, created_at, preluat_de, client_id').order('created_at', { ascending: false }).limit(500),
        supabase.from('oferte_produse').select('oferta_id, pret_vanzare, pret_achizitie, cantitate, produs_nume').limit(5000),
        supabase.from('clienti').select('id, denumire'),
        supabase.from('profiles').select('id, full_name, email'),
        supabase.from('stoc').select('produs_nume, produs_cod, cantitate, pret_achizitie, pret_lista, furnizor_nume').order('produs_nume'),
        supabase.from('nir').select('id, numar, data_intrare, furnizor_nume, total_fara_tva, total_cu_tva').order('data_intrare', { ascending: false }).limit(200),
        supabase.from('facturi').select('id, data_emitere').order('data_emitere', { ascending: false }).limit(1000),
        supabase.from('facturi_produse').select('factura_id, nume_produs, cantitate, pret_vanzare, pret_achizitie').limit(10000),
      ])

      // Mapuri pentru join rapid
      const clientMap: Record<string, string> = {}
      ;(clientiRaw.data ?? []).forEach((c: { id: string; denumire: string }) => { clientMap[c.id] = c.denumire })

      const userMap: Record<string, string> = {}
      ;(profilRaw.data ?? []).forEach((p: { id: string; full_name: string | null; email: string | null }) => {
        userMap[p.id] = p.full_name ?? p.email ?? 'Necunoscut'
      })

      // Construim OfertaRow cu datele joined
      const oferteJoined: OfertaRow[] = (oRaw.data ?? []).map((o: { id: string; status: string; created_at: string; preluat_de: string | null; client_id: string | null }) => ({
        id: o.id,
        status: o.status,
        created_at: o.created_at,
        preluat_de: o.preluat_de,
        client_denumire: o.client_id ? (clientMap[o.client_id] ?? '(fără client)') : '(fără client)',
        user_label: o.preluat_de ? (userMap[o.preluat_de] ?? 'Necunoscut') : 'Neatribuit',
      }))

      // Mapă ofertă → status + client pentru produse
      const ofertaStatusMap: Record<string, { status: string; client: string }> = {}
      oferteJoined.forEach(o => { ofertaStatusMap[o.id] = { status: o.status, client: o.client_denumire } })

      // Produse cu status din ofertă
      const produseJoined: OfertaProdus[] = (pRaw.data ?? []).map((p: { oferta_id: string; pret_vanzare: number; pret_achizitie: number; cantitate: number; produs_nume: string }) => ({
        ...p,
        oferta_status: ofertaStatusMap[p.oferta_id]?.status,
        client_denumire: ofertaStatusMap[p.oferta_id]?.client,
      }))

      // Mapă factura_id → data_emitere
      const facturaDateMap: Record<string, string> = {}
      ;(fRaw.data ?? []).forEach((f: { id: string; data_emitere: string }) => { facturaDateMap[f.id] = f.data_emitere })

      // Construim randuri pentru profit pe produs
      const fpJoined = (fpRaw.data ?? []).map((p: { factura_id: string; nume_produs: string; cantitate: number; pret_vanzare: number; pret_achizitie: number }) => ({
        produs: p.nume_produs ?? '',
        cantitate: p.cantitate ?? 1,
        vanzari_nete: (p.cantitate ?? 1) * (p.pret_vanzare ?? 0),
        cost_achizitie: (p.cantitate ?? 1) * (p.pret_achizitie ?? 0),
        profit: (p.cantitate ?? 1) * ((p.pret_vanzare ?? 0) - (p.pret_achizitie ?? 0)),
        data_emitere: facturaDateMap[p.factura_id] ?? '',
      }))

      setOferte(oferteJoined)
      setProduse(produseJoined)
      setStoc((sRaw.data ?? []) as StocItem[])
      setNir((nRaw.data ?? []) as NirRow[])
      setFacturiProduse(fpJoined)
      setLoading(false)
    }
    load()
  }, [])

  // Filtrare după perioadă
  const cutoff = useMemo(() => {
    if (perioada === 'toate') return null
    const d = new Date()
    d.setDate(d.getDate() - parseInt(perioada))
    return d.toISOString()
  }, [perioada])

  const oferteFiltered = useMemo(() =>
    cutoff ? oferte.filter(o => o.created_at >= cutoff) : oferte
  , [oferte, cutoff])

  // ── KPI Cards ────────────────────────────────────────────────────────────

  const kpi = useMemo(() => {
    const active = oferteFiltered.filter(o => !['draft', 'anulata'].includes(o.status))
    const facturate = oferteFiltered.filter(o => o.status === 'facturat')
    const prodFact = produse.filter(p => p.oferta_status === 'facturat')
    const valFact = prodFact.reduce((s, p) => s + p.pret_vanzare * p.cantitate, 0)
    const profitFact = prodFact.reduce((s, p) => s + (p.pret_vanzare - p.pret_achizitie) * p.cantitate, 0)
    const valStoc = stoc.reduce((s, i) => s + i.cantitate * i.pret_achizitie, 0)
    const anulate = oferteFiltered.filter(o => o.status === 'anulata').length
    const total = oferteFiltered.length
    return { active: active.length, facturate: facturate.length, valFact, profitFact, valStoc, anulate, total }
  }, [oferteFiltered, produse, stoc])

  // ── Tab: Oferte ──────────────────────────────────────────────────────────

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {}
    oferteFiltered.forEach(o => { map[o.status] = (map[o.status] ?? 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [oferteFiltered])

  const byClient = useMemo(() => {
    const map: Record<string, { count: number; facturate: number }> = {}
    oferteFiltered.forEach(o => {
      const c = o.client_denumire
      if (!map[c]) map[c] = { count: 0, facturate: 0 }
      map[c].count++
      if (o.status === 'facturat') map[c].facturate++
    })
    return Object.entries(map).map(([client, v]) => ({ client, ...v })).sort((a, b) => b.count - a.count)
  }, [oferteFiltered])

  const byUser = useMemo(() => {
    const map: Record<string, number> = {}
    oferteFiltered.forEach(o => {
      map[o.user_label] = (map[o.user_label] ?? 0) + 1
    })
    return Object.entries(map).map(([user, count]) => ({ user, count })).sort((a, b) => b.count - a.count)
  }, [oferteFiltered])

  // ── Tab: Vânzări ─────────────────────────────────────────────────────────

  const prodFact = useMemo(() =>
    produse.filter(p => p.oferta_status === 'facturat')
  , [produse])

  const topProduse = useMemo(() => {
    const map: Record<string, { cantitate: number; valoare: number; profit: number }> = {}
    prodFact.forEach(p => {
      if (!map[p.produs_nume]) map[p.produs_nume] = { cantitate: 0, valoare: 0, profit: 0 }
      map[p.produs_nume].cantitate += p.cantitate
      map[p.produs_nume].valoare += p.pret_vanzare * p.cantitate
      map[p.produs_nume].profit += (p.pret_vanzare - p.pret_achizitie) * p.cantitate
    })
    return Object.entries(map).map(([produs, v]) => ({ produs, ...v })).sort((a, b) => b.valoare - a.valoare).slice(0, 20)
  }, [prodFact])

  const topClientiValoare = useMemo(() => {
    const map: Record<string, { valoare: number; profit: number; nrFacturi: number }> = {}
    prodFact.forEach(p => {
      const c = p.client_denumire ?? '(fără client)'
      if (!map[c]) map[c] = { valoare: 0, profit: 0, nrFacturi: 0 }
      map[c].valoare += p.pret_vanzare * p.cantitate
      map[c].profit += (p.pret_vanzare - p.pret_achizitie) * p.cantitate
    })
    oferteFiltered.filter(o => o.status === 'facturat').forEach(o => {
      const c = o.client_denumire
      if (map[c]) map[c].nrFacturi++
    })
    return Object.entries(map).map(([client, v]) => ({ client, ...v })).sort((a, b) => b.valoare - a.valoare)
  }, [prodFact, oferteFiltered])

  // ── Tab: Profit pe produs ────────────────────────────────────────────────

  const profitPerProdus = useMemo(() => {
    const filtered = facturiProduse.filter(p =>
      p.data_emitere >= profitDe && p.data_emitere <= profitPana
    )
    const map: Record<string, ProfitRand> = {}
    filtered.forEach(p => {
      if (!map[p.produs]) map[p.produs] = { produs: p.produs, cantitate: 0, vanzari_nete: 0, cost_achizitie: 0, profit: 0 }
      map[p.produs].cantitate += p.cantitate
      map[p.produs].vanzari_nete += p.vanzari_nete
      map[p.produs].cost_achizitie += p.cost_achizitie
      map[p.produs].profit += p.profit
    })
    const rows = Object.values(map)
    if (profitSort === 'profit') return rows.sort((a, b) => b.profit - a.profit)
    if (profitSort === 'vanzari') return rows.sort((a, b) => b.vanzari_nete - a.vanzari_nete)
    return rows.sort((a, b) => a.produs.localeCompare(b.produs))
  }, [facturiProduse, profitDe, profitPana, profitSort])

  const profitTotal = useMemo(() => profitPerProdus.reduce((acc, r) => ({
    vanzari_nete: acc.vanzari_nete + r.vanzari_nete,
    cost_achizitie: acc.cost_achizitie + r.cost_achizitie,
    profit: acc.profit + r.profit,
  }), { vanzari_nete: 0, cost_achizitie: 0, profit: 0 }), [profitPerProdus])

  // ── Tab: Stoc ────────────────────────────────────────────────────────────

  const stocActiv = useMemo(() => stoc.filter(s => s.cantitate > 0), [stoc])
  const valStocTotal = useMemo(() => stocActiv.reduce((s, i) => s + i.cantitate * i.pret_achizitie, 0), [stocActiv])
  const valListaTotal = useMemo(() => stocActiv.reduce((s, i) => s + i.cantitate * (i.pret_lista ?? i.pret_achizitie * 1.3), 0), [stocActiv])

  const topStoc = useMemo(() =>
    [...stocActiv].sort((a, b) => (b.cantitate * b.pret_achizitie) - (a.cantitate * a.pret_achizitie)).slice(0, 20)
  , [stocActiv])

  // ── Tab: Achiziții ───────────────────────────────────────────────────────

  const byFurnizor = useMemo(() => {
    const map: Record<string, { nrNir: number; valoare: number }> = {}
    nir.forEach(n => {
      const f = n.furnizor_nume ?? '(fără furnizor)'
      if (!map[f]) map[f] = { nrNir: 0, valoare: 0 }
      map[f].nrNir++
      map[f].valoare += n.total_cu_tva
    })
    return Object.entries(map).map(([furnizor, v]) => ({ furnizor, ...v })).sort((a, b) => b.valoare - a.valoare)
  }, [nir])

  const nirRecente = useMemo(() => nir.slice(0, 10), [nir])

  // ─── Render ──────────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'oferte',    label: 'Oferte',          icon: '📋' },
    { key: 'vanzari',   label: 'Vânzări',          icon: '💰' },
    { key: 'profit',    label: 'Profit pe produs', icon: '📊' },
    { key: 'stoc',      label: 'Stoc',             icon: '🏪' },
    { key: 'achizitii', label: 'Achiziții',        icon: '📦' },
  ]

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Rapoarte</h2>
          <p className="text-sm text-gray-500 mt-0.5">Statistici și analize</p>
        </div>

        {/* Filtru perioadă */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1">
          {([['30', 'Ultima lună'], ['90', '3 luni'], ['365', 'Acest an'], ['toate', 'Toate']] as [string, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPerioada(val as typeof perioada)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                perioada === val ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Oferte active', value: kpi.active, sub: `din ${kpi.total} total`, color: '#2563eb', icon: '📋' },
          { label: 'Facturi emise', value: kpi.facturate, sub: `${kpi.anulate} anulate`, color: '#0f172a', icon: '🧾' },
          { label: 'Valoare facturată', value: fmt(kpi.valFact) + ' RON', sub: `Profit: ${fmt(kpi.profitFact)} RON`, color: '#059669', icon: '💰' },
          { label: 'Valoare stoc', value: fmt(kpi.valStoc) + ' RON', sub: `${stocActiv.length} articole`, color: '#7c3aed', icon: '🏪' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
              <span className="text-lg">{card.icon}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="text-center">
            <div className="text-3xl mb-3 animate-spin">⟳</div>
            <p className="text-sm">Se încarcă datele...</p>
          </div>
        </div>
      ) : (

        <div className="space-y-6">

          {/* ════ TAB: OFERTE ═══════════════════════════════════════════════ */}
          {tab === 'oferte' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Distribuție status */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribuție după status</h3>
                  <div className="space-y-3">
                    {byStatus.map(([status, count]) => {
                      const s = STATUS_LABEL[status]
                      const pct = kpi.total > 0 ? Math.round((count / kpi.total) * 100) : 0
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: s?.color ?? '#9ca3af' }}
                          />
                          <span className="text-sm text-gray-700 flex-1">{s?.label ?? status}</span>
                          <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                          <div className="w-20 h-2 bg-gray-100 rounded-full">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s?.color ?? '#9ca3af' }} />
                          </div>
                          <span className="text-xs font-medium text-gray-900 w-8 text-right">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Top clienți */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Top clienți după oferte</h3>
                  <div className="space-y-2.5">
                    {byClient.slice(0, 8).map(row => (
                      <div key={row.client} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 flex-1 truncate">{row.client}</span>
                        <MiniBar value={row.count} max={byClient[0]?.count ?? 1} color="#2563eb" />
                        <span className="text-sm font-semibold text-gray-900 w-6 text-right">{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per utilizator */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Oferte per utilizator</h3>
                  <div className="space-y-2.5">
                    {byUser.map(row => (
                      <div key={row.user} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-blue-700">{row.user.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-sm text-gray-700 flex-1 truncate">{row.user}</span>
                        <span className="text-sm font-bold text-gray-900">{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabel clienți detaliat */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Clienți — detaliu oferte</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-gray-600 font-medium">Client</th>
                      <th className="text-right px-5 py-3 text-gray-600 font-medium">Total oferte</th>
                      <th className="text-right px-5 py-3 text-gray-600 font-medium">Facturate</th>
                      <th className="text-right px-5 py-3 text-gray-600 font-medium">Rată conversie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byClient.map((row, i) => (
                      <tr key={row.client} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-5 py-3 font-medium text-gray-900">{row.client}</td>
                        <td className="px-5 py-3 text-right text-gray-700">{row.count}</td>
                        <td className="px-5 py-3 text-right text-gray-700">{row.facturate}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-semibold ${row.count > 0 && row.facturate / row.count > 0.5 ? 'text-green-600' : 'text-gray-500'}`}>
                            {row.count > 0 ? Math.round((row.facturate / row.count) * 100) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ════ TAB: VÂNZĂRI ══════════════════════════════════════════════ */}
          {tab === 'vanzari' && (
            <>
              {/* Top clienți după valoare */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Top clienți după valoare facturată</h3>
                </div>
                {topClientiValoare.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-gray-400 text-center">Nicio factură emisă în perioada selectată.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-5 py-3 text-gray-600 font-medium">#</th>
                        <th className="text-left px-5 py-3 text-gray-600 font-medium">Client</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-medium">Nr. facturi</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-medium">Valoare</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-medium">Profit</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-medium">Marjă</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topClientiValoare.map((row, i) => {
                        const marja = row.valoare > 0 ? (row.profit / row.valoare) * 100 : 0
                        return (
                          <tr key={row.client} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                            <td className="px-5 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                            <td className="px-5 py-3 font-medium text-gray-900">{row.client}</td>
                            <td className="px-5 py-3 text-right text-gray-700">{row.nrFacturi}</td>
                            <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(row.valoare)} RON</td>
                            <td className="px-5 py-3 text-right font-semibold text-green-700">{fmt(row.profit)} RON</td>
                            <td className="px-5 py-3 text-right">
                              <span className={`font-bold text-sm ${marja >= 20 ? 'text-green-600' : marja >= 10 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {marja.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={3} className="px-5 py-3 font-semibold text-gray-700">TOTAL</td>
                        <td className="px-5 py-3 text-right font-bold text-gray-900">{fmt(kpi.valFact)} RON</td>
                        <td className="px-5 py-3 text-right font-bold text-green-700">{fmt(kpi.profitFact)} RON</td>
                        <td className="px-5 py-3 text-right font-bold text-gray-900">
                          {kpi.valFact > 0 ? ((kpi.profitFact / kpi.valFact) * 100).toFixed(1) : '0.0'}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Top produse vândute */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Top produse vândute (după valoare)</h3>
                </div>
                {topProduse.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-gray-400 text-center">Niciun produs facturat în perioada selectată.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-5 py-3 text-gray-600 font-medium">#</th>
                        <th className="text-left px-5 py-3 text-gray-600 font-medium">Produs</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-medium">Cant.</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-medium">Valoare</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProduse.map((row, i) => (
                        <tr key={row.produs} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                          <td className="px-5 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                          <td className="px-5 py-3 font-medium text-gray-900">{row.produs}</td>
                          <td className="px-5 py-3 text-right text-gray-700">{row.cantitate}</td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(row.valoare)} RON</td>
                          <td className="px-5 py-3 text-right font-semibold text-green-700">{fmt(row.profit)} RON</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ════ TAB: PROFIT PE PRODUS ════════════════════════════════════ */}
          {tab === 'profit' && (
            <>
              {/* Filtru perioadă + sortare */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">De la:</label>
                  <input type="date" value={profitDe} onChange={e => setProfitDe(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Până la:</label>
                  <input type="date" value={profitPana} onChange={e => setProfitPana(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900" />
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <label className="text-sm font-medium text-gray-700">Sortare:</label>
                  <select value={profitSort} onChange={e => setProfitSort(e.target.value as typeof profitSort)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900">
                    <option value="profit">Profit ↓</option>
                    <option value="vanzari">Vânzări ↓</option>
                    <option value="produs">Produs A-Z</option>
                  </select>
                </div>
              </div>

              {/* Tabel */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {profitPerProdus.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-gray-400 text-center">Nicio factură în perioada selectată.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-5 py-3 text-gray-700 font-semibold">#</th>
                        <th className="text-left px-5 py-3 text-gray-700 font-semibold">Produs</th>
                        <th className="text-right px-5 py-3 text-gray-700 font-semibold">Cant.</th>
                        <th className="text-right px-5 py-3 text-gray-700 font-semibold">Vânzări nete</th>
                        <th className="text-right px-5 py-3 text-gray-700 font-semibold">Cost achiziție</th>
                        <th className="text-right px-5 py-3 text-gray-700 font-semibold">Profit</th>
                        <th className="text-right px-5 py-3 text-gray-700 font-semibold">Marjă</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitPerProdus.map((row, i) => {
                        const marja = row.vanzari_nete > 0 ? (row.profit / row.vanzari_nete) * 100 : 0
                        return (
                          <tr key={row.produs} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                            <td className="px-5 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                            <td className="px-5 py-3 font-medium text-gray-900">{row.produs}</td>
                            <td className="px-5 py-3 text-right text-gray-700">{row.cantitate}</td>
                            <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(row.vanzari_nete)} RON</td>
                            <td className="px-5 py-3 text-right text-gray-600">{fmt(row.cost_achizitie)} RON</td>
                            <td className="px-5 py-3 text-right font-bold" style={{ color: row.profit >= 0 ? '#16a34a' : '#dc2626' }}>
                              {fmt(row.profit)} RON
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className={`font-bold text-sm ${marja >= 20 ? 'text-green-600' : marja >= 10 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {marja.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                      <tr>
                        <td colSpan={3} className="px-5 py-3 font-bold text-gray-800 text-sm">TOTAL</td>
                        <td className="px-5 py-3 text-right font-bold text-gray-900">{fmt(profitTotal.vanzari_nete)} RON</td>
                        <td className="px-5 py-3 text-right font-bold text-gray-700">{fmt(profitTotal.cost_achizitie)} RON</td>
                        <td className="px-5 py-3 text-right font-bold" style={{ color: profitTotal.profit >= 0 ? '#16a34a' : '#dc2626' }}>
                          {fmt(profitTotal.profit)} RON
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-gray-900">
                          {profitTotal.vanzari_nete > 0 ? ((profitTotal.profit / profitTotal.vanzari_nete) * 100).toFixed(1) : '0.0'}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ════ TAB: STOC ═════════════════════════════════════════════════ */}
          {tab === 'stoc' && (
            <>
              {/* Cards stoc */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Articole în stoc', value: stocActiv.length, icon: '📦', color: '#2563eb' },
                  { label: 'Profit potențial stoc', value: fmt(valListaTotal - valStocTotal) + ' RON', icon: '📈', color: '#059669' },
                  { label: 'Val. la cost', value: fmt(valStocTotal) + ' RON', icon: '🏷️', color: '#059669' },
                  { label: 'Val. la preț listă', value: fmt(valListaTotal) + ' RON', icon: '💶', color: '#7c3aed' },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.label}</p>
                      <span className="text-lg">{c.icon}</span>
                    </div>
                    <p className="text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Top produse după valoare stoc */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Top produse după valoare stoc</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-gray-600 font-medium">#</th>
                      <th className="text-left px-5 py-3 text-gray-600 font-medium">Produs</th>
                      <th className="text-right px-5 py-3 text-gray-600 font-medium">Cant.</th>
                      <th className="text-right px-5 py-3 text-gray-600 font-medium">Cost / buc</th>
                      <th className="text-right px-5 py-3 text-gray-600 font-medium">Preț listă</th>
                      <th className="text-right px-5 py-3 text-gray-600 font-medium">Val. stoc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topStoc.map((row, i) => (
                      <tr key={i} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-5 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">{row.produs_nume}</p>
                          {row.produs_cod && <p className="text-xs text-gray-400 font-mono">{row.produs_cod}</p>}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">{row.cantitate}</td>
                        <td className="px-5 py-3 text-right text-gray-700">{fmt(row.pret_achizitie)} RON</td>
                        <td className="px-5 py-3 text-right text-blue-600 font-medium">{row.pret_lista ? fmt(row.pret_lista) + ' RON' : '—'}</td>
                        <td className="px-5 py-3 text-right font-bold text-gray-900">{fmt(row.cantitate * row.pret_achizitie)} RON</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </>
          )}

          {/* ════ TAB: ACHIZIȚII ════════════════════════════════════════════ */}
          {tab === 'achizitii' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Top furnizori */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Top furnizori după valoare NIR</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-5 py-3 text-gray-600 font-medium">Furnizor</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-medium">Nr. NIR</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-medium">Valoare (cu TVA)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byFurnizor.map((row, i) => (
                        <tr key={row.furnizor} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                          <td className="px-5 py-3 font-medium text-gray-900">{row.furnizor}</td>
                          <td className="px-5 py-3 text-right text-gray-700">{row.nrNir}</td>
                          <td className="px-5 py-3 text-right font-bold text-gray-900">{fmt(row.valoare)} RON</td>
                        </tr>
                      ))}
                      {byFurnizor.length === 0 && (
                        <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400 text-sm">Niciun NIR înregistrat.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* NIR-uri recente */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Ultimele 10 NIR-uri</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-5 py-3 text-gray-600 font-medium">NIR #</th>
                        <th className="text-left px-5 py-3 text-gray-600 font-medium">Furnizor</th>
                        <th className="text-left px-5 py-3 text-gray-600 font-medium">Dată</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-medium">Valoare</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nirRecente.map((row, i) => (
                        <tr key={row.id} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                          <td className="px-5 py-3 font-mono text-gray-900">#{row.numar}</td>
                          <td className="px-5 py-3 text-gray-700 truncate max-w-[140px]">{row.furnizor_nume ?? '—'}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{new Date(row.data_intrare).toLocaleDateString('ro-RO')}</td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(row.total_cu_tva)} RON</td>
                        </tr>
                      ))}
                      {nirRecente.length === 0 && (
                        <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">Niciun NIR înregistrat.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  )
}
