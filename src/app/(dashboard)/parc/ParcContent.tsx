'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import FisaPrintModal from './FisaPrintModal'

// ─── Tipuri ──────────────────────────────────────────────────────────────────

interface Masina {
  id: string
  nr_inmatriculare: string
  marca: string | null
  model: string | null
  an: number | null
  sofer: string | null
  activa: boolean
  created_at: string
}

interface Alimentare {
  id: string
  masina_id: string
  data: string
  km: number
  litri: number
  total_ron: number
  tip_combustibil: string
  statie: string | null
}

interface CheltuialaMasina {
  id: string
  masina_id: string
  data: string
  km: number | null
  descriere: string
  suma: number
  categorie: string | null
  nr_factura: string | null
  furnizor: string | null
}

type TabMasina = 'alimentari' | 'cheltuieli'

const CATEGORII_CHELTUIALA = ['ITP', 'Revizie', 'Cauciucuri', 'Piese', 'Asigurare', 'Rovinieta', 'Altele'] as const
const TIP_COMBUSTIBIL = ['Motorina', 'Benzina', 'AdBlue'] as const

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function lunaDefault() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function luniDisponibile(): { value: string; label: string }[] {
  const result: { value: string; label: string }[] = [{ value: 'toate', label: 'Toate' }]
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('ro-RO', { month: 'long', year: 'numeric' })
    result.push({ value, label })
  }
  return result
}

// ─── Formular masina noua ─────────────────────────────────────────────────────

interface FormMasina {
  nr_inmatriculare: string
  marca: string
  model: string
  an: string
  sofer: string
}

// ─── Componenta principala ────────────────────────────────────────────────────

export default function ParcContent() {
  const supabase = createClient()

  const [masini, setMasini] = useState<Masina[]>([])
  const [loading, setLoading] = useState(true)
  const [eroare, setEroare] = useState<string | null>(null)
  const [selectedMasina, setSelectedMasina] = useState<Masina | null>(null)
  const [tabMasina, setTabMasina] = useState<TabMasina>('alimentari')

  // Date pentru masina selectata
  const [alimentari, setAlimentari] = useState<Alimentare[]>([])
  const [cheltuieliMasina, setCheltuieliMasina] = useState<CheltuialaMasina[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [lunaAlimentari, setLunaAlimentari] = useState<string>(lunaDefault())
  const luni = useMemo(() => luniDisponibile(), [])

  // Formulare
  const [showAddMasina, setShowAddMasina] = useState(false)
  const [showAddAlimentare, setShowAddAlimentare] = useState(false)
  const [showAddCheltuiala, setShowAddCheltuiala] = useState(false)

  const [formMasina, setFormMasina] = useState<FormMasina>({
    nr_inmatriculare: '', marca: '', model: '', an: '', sofer: '',
  })

  const [formAlimentare, setFormAlimentare] = useState({
    data: todayIso(), km: '', litri: '', total_ron: '', tip_combustibil: 'Motorina', statie: '',
  })

  const [formCheltuiala, setFormCheltuiala] = useState({
    data: todayIso(), km: '', descriere: '', suma: '', categorie: 'Altele', nr_factura: '', furnizor: '',
  })
  const [showFisa, setShowFisa] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Fetch masini ──
  async function fetchMasini() {
    setLoading(true)
    const { data, error } = await supabase
      .from('parc_masini')
      .select('*')
      .order('nr_inmatriculare')
    if (error) setEroare(error.message)
    else setMasini((data ?? []) as Masina[])
    setLoading(false)
  }

  useEffect(() => { fetchMasini() }, [])

  // ── Fetch detalii masina ──
  async function fetchDetaliiMasina(masinaId: string) {
    setLoadingDetail(true)
    const [alRaw, chRaw] = await Promise.all([
      supabase.from('parc_alimentari').select('*').eq('masina_id', masinaId).order('data', { ascending: false }),
      supabase.from('parc_cheltuieli').select('*').eq('masina_id', masinaId).order('data', { ascending: false }),
    ])
    setAlimentari((alRaw.data ?? []) as Alimentare[])
    setCheltuieliMasina((chRaw.data ?? []) as CheltuialaMasina[])
    setLoadingDetail(false)
  }

  function selectMasina(m: Masina) {
    setSelectedMasina(m)
    setTabMasina('alimentari')
    setShowAddAlimentare(false)
    setShowAddCheltuiala(false)
    setEroare(null)
    fetchDetaliiMasina(m.id)
  }

  // ── Adauga masina ──
  async function handleAddMasina() {
    if (!formMasina.nr_inmatriculare.trim()) {
      setEroare('Nr. de inmatriculare este obligatoriu.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('parc_masini').insert({
      nr_inmatriculare: formMasina.nr_inmatriculare.trim().toUpperCase(),
      marca: formMasina.marca || null,
      model: formMasina.model || null,
      an: formMasina.an ? Number(formMasina.an) : null,
      sofer: formMasina.sofer || null,
    })
    if (error) setEroare(error.message)
    else {
      setFormMasina({ nr_inmatriculare: '', marca: '', model: '', an: '', sofer: '' })
      setShowAddMasina(false)
      await fetchMasini()
    }
    setSaving(false)
  }

  // ── Adauga alimentare ──
  async function handleAddAlimentare() {
    if (!selectedMasina) return
    if (!formAlimentare.data || !formAlimentare.km || !formAlimentare.litri || !formAlimentare.total_ron) {
      setEroare('Completati data, km, litri si total RON.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('parc_alimentari').insert({
      masina_id: selectedMasina.id,
      data: formAlimentare.data,
      km: Number(formAlimentare.km),
      litri: Number(formAlimentare.litri),
      total_ron: Number(formAlimentare.total_ron),
      tip_combustibil: formAlimentare.tip_combustibil,
      statie: formAlimentare.statie || null,
    })
    if (error) setEroare(error.message)
    else {
      setFormAlimentare({ data: todayIso(), km: '', litri: '', total_ron: '', tip_combustibil: 'Motorina', statie: '' })
      setShowAddAlimentare(false)
      await fetchDetaliiMasina(selectedMasina.id)
    }
    setSaving(false)
  }

  // ── Adauga cheltuiala masina ──
  async function handleAddCheltuiala() {
    if (!selectedMasina) return
    if (!formCheltuiala.data || !formCheltuiala.descriere || !formCheltuiala.suma) {
      setEroare('Completati data, descriere si suma.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('parc_cheltuieli').insert({
      masina_id: selectedMasina.id,
      data: formCheltuiala.data,
      km: formCheltuiala.km ? Number(formCheltuiala.km) : null,
      descriere: formCheltuiala.descriere,
      suma: Number(formCheltuiala.suma),
      categorie: formCheltuiala.categorie || null,
      nr_factura: formCheltuiala.nr_factura || null,
      furnizor: formCheltuiala.furnizor || null,
    })
    if (error) setEroare(error.message)
    else {
      setFormCheltuiala({ data: todayIso(), km: '', descriere: '', suma: '', categorie: 'Altele', nr_factura: '', furnizor: '' })
      setShowAddCheltuiala(false)
      await fetchDetaliiMasina(selectedMasina.id)
    }
    setSaving(false)
  }

  // ── Sterge alimentare ──
  async function handleDeleteAlimentare(id: string) {
    if (!selectedMasina || !confirm('Stergi aceasta alimentare?')) return
    setDeletingId(id)
    const { error } = await supabase.from('parc_alimentari').delete().eq('id', id)
    if (error) setEroare(error.message)
    else setAlimentari((prev) => prev.filter((a) => a.id !== id))
    setDeletingId(null)
  }

  // ── Sterge cheltuiala masina ──
  async function handleDeleteCheltuiala(id: string) {
    if (!selectedMasina || !confirm('Stergi aceasta cheltuiala?')) return
    setDeletingId(id)
    const { error } = await supabase.from('parc_cheltuieli').delete().eq('id', id)
    if (error) setEroare(error.message)
    else setCheltuieliMasina((prev) => prev.filter((c) => c.id !== id))
    setDeletingId(null)
  }

  // ── Alimentari filtrate pe luna selectata ──
  const alimentariFiltrate = useMemo(() => {
    if (lunaAlimentari === 'toate') return alimentari
    return alimentari.filter((a) => a.data.startsWith(lunaAlimentari))
  }, [alimentari, lunaAlimentari])

  // ── Statistici masina (pe perioada filtrata) ──
  const stats = useMemo(() => {
    if (!alimentariFiltrate.length) return null
    const totalLitri = alimentariFiltrate.reduce((s, a) => s + a.litri, 0)
    const totalRon = alimentariFiltrate.reduce((s, a) => s + a.total_ron, 0)
    const kms = alimentariFiltrate.map((a) => a.km).filter(Boolean)
    const kmMin = Math.min(...kms)
    const kmMax = Math.max(...kms)
    const kmParcursi = kmMax - kmMin
    const consumMediu = kmParcursi > 0 ? (totalLitri / kmParcursi) * 100 : null
    const totalCheltuieli = cheltuieliMasina.reduce((s, c) => s + c.suma, 0)
    const costPerKm = kmParcursi > 0 ? (totalRon + totalCheltuieli) / kmParcursi : null
    return { totalLitri, totalRon, consumMediu, totalCheltuieli, costPerKm, kmParcursi }
  }, [alimentariFiltrate, cheltuieliMasina])

  // ── Pret litru calculat ──
  const pretLitruCalc = useMemo(() => {
    const l = Number(formAlimentare.litri)
    const t = Number(formAlimentare.total_ron)
    if (l > 0 && t > 0) return (t / l).toFixed(3)
    return null
  }, [formAlimentare.litri, formAlimentare.total_ron])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Parc Auto</h1>

      {eroare && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {eroare}
          <button className="ml-3 underline text-xs" onClick={() => setEroare(null)}>Inchide</button>
        </div>
      )}

      <div className="flex gap-6 items-start">
        {/* Coloana stanga: lista masini */}
        <div className="w-72 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Masini</h2>
            <button
              onClick={() => { setShowAddMasina((v) => !v); setEroare(null) }}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              + Adauga
            </button>
          </div>

          {/* Form masina noua */}
          {showAddMasina && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Masina noua</p>
              {[
                { key: 'nr_inmatriculare', label: 'Nr. inmatriculare *', placeholder: 'B 123 ABC' },
                { key: 'marca', label: 'Marca', placeholder: 'ex: Volvo' },
                { key: 'model', label: 'Model', placeholder: 'ex: FH 500' },
                { key: 'an', label: 'An', placeholder: '2020' },
                { key: 'sofer', label: 'Sofer', placeholder: 'Nume sofer' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-600 mb-0.5">{label}</label>
                  <input
                    type={key === 'an' ? 'number' : 'text'}
                    value={formMasina[key as keyof FormMasina]}
                    onChange={(e) => setFormMasina((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAddMasina}
                  disabled={saving}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? '...' : 'Salveaza'}
                </button>
                <button
                  onClick={() => setShowAddMasina(false)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 transition-colors"
                >
                  Anuleaza
                </button>
              </div>
            </div>
          )}

          {/* Lista masini */}
          {loading ? (
            <div className="text-sm text-gray-500 py-4 text-center">Se incarca...</div>
          ) : masini.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center">Nicio masina adaugata.</div>
          ) : (
            <div className="space-y-2">
              {masini.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectMasina(m)}
                  className={`w-full text-left bg-white rounded-xl border px-4 py-3 transition-colors ${
                    selectedMasina?.id === m.id
                      ? 'border-blue-500 ring-1 ring-blue-200'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 text-sm">{m.nr_inmatriculare}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[m.marca, m.model].filter(Boolean).join(' ') || 'Fara detalii'}
                  </div>
                  {m.sofer && <div className="text-xs text-blue-600 mt-0.5">{m.sofer}</div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Coloana dreapta: detalii masina selectata */}
        {selectedMasina ? (
          <div className="flex-1 space-y-4 min-w-0">
            {/* Header masina */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedMasina.nr_inmatriculare}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[selectedMasina.marca, selectedMasina.model, selectedMasina.an ? String(selectedMasina.an) : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                  {selectedMasina.sofer && (
                    <p className="text-sm text-blue-600 mt-0.5">Sofer: {selectedMasina.sofer}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowFisa(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-900 transition-colors"
                >
                  🖨️ Fișă lună
                </button>
              </div>

              {/* Filtru luna + Stats */}
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Perioada:</span>
                <select
                  value={lunaAlimentari}
                  onChange={(e) => setLunaAlimentari(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {luni.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              {stats ? (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    {
                      label: 'KM parcurși',
                      value: stats.kmParcursi > 0
                        ? `${stats.kmParcursi.toLocaleString('ro-RO')} km`
                        : 'N/A',
                      highlight: true,
                    },
                    {
                      label: 'Consum mediu',
                      value: stats.consumMediu != null
                        ? `${stats.consumMediu.toFixed(1)} L/100km`
                        : 'N/A',
                    },
                    {
                      label: 'Total combustibil',
                      value: `${stats.totalLitri.toFixed(1)} L`,
                    },
                    {
                      label: 'Total cheltuieli',
                      value: `${(stats.totalRon + stats.totalCheltuieli).toLocaleString('ro-RO', { maximumFractionDigits: 0 })} RON`,
                    },
                    {
                      label: 'Cost / km',
                      value: stats.costPerKm != null
                        ? `${stats.costPerKm.toFixed(2)} RON`
                        : 'N/A',
                    },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-lg px-3 py-2 ${s.highlight ? 'bg-blue-50' : 'bg-gray-50'}`}>
                      <div className="text-xs text-gray-500">{s.label}</div>
                      <div className={`text-sm font-semibold mt-0.5 ${s.highlight ? 'text-blue-700' : 'text-gray-900'}`}>{s.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-gray-400 italic">Nicio alimentare în perioada selectată.</div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {(['alimentari', 'cheltuieli'] as TabMasina[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTabMasina(t); setShowAddAlimentare(false); setShowAddCheltuiala(false) }}
                  className={`px-4 py-1.5 rounded text-sm font-medium transition-colors capitalize ${
                    tabMasina === t
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t === 'alimentari' ? 'Alimentari' : 'Cheltuieli masina'}
                </button>
              ))}
            </div>

            {loadingDetail ? (
              <div className="text-sm text-gray-500 py-6 text-center">Se incarca detalii...</div>
            ) : (
              <>
                {/* ── Tab Alimentari ── */}
                {tabMasina === 'alimentari' && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">Alimentari</h3>
                      <button
                        onClick={() => { setShowAddAlimentare((v) => !v); setEroare(null) }}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        + Adauga
                      </button>
                    </div>

                    {showAddAlimentare && (
                      <div className="px-5 py-4 border-b border-gray-100 bg-blue-50/30 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Data *</label>
                            <input type="date" value={formAlimentare.data}
                              onChange={(e) => setFormAlimentare((f) => ({ ...f, data: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">KM *</label>
                            <input type="number" value={formAlimentare.km} placeholder="ex: 125000"
                              onChange={(e) => setFormAlimentare((f) => ({ ...f, km: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Litri *</label>
                            <input type="number" step="0.01" value={formAlimentare.litri} placeholder="ex: 80.5"
                              onChange={(e) => setFormAlimentare((f) => ({ ...f, litri: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Total RON *</label>
                            <input type="number" step="0.01" value={formAlimentare.total_ron} placeholder="ex: 600.00"
                              onChange={(e) => setFormAlimentare((f) => ({ ...f, total_ron: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Tip combustibil</label>
                            <select value={formAlimentare.tip_combustibil}
                              onChange={(e) => setFormAlimentare((f) => ({ ...f, tip_combustibil: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
                              {TIP_COMBUSTIBIL.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Statie (optional)</label>
                            <input type="text" value={formAlimentare.statie} placeholder="ex: Petrom"
                              onChange={(e) => setFormAlimentare((f) => ({ ...f, statie: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        </div>
                        {pretLitruCalc && (
                          <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded inline-block">
                            Pret/litru calculat: <strong>{pretLitruCalc} RON</strong>
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button onClick={handleAddAlimentare} disabled={saving}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {saving ? '...' : 'Salveaza'}
                          </button>
                          <button onClick={() => setShowAddAlimentare(false)}
                            className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 transition-colors">
                            Anuleaza
                          </button>
                        </div>
                      </div>
                    )}

                    {alimentariFiltrate.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-500">
                        {alimentari.length === 0
                          ? 'Nicio alimentare inregistrata.'
                          : 'Nicio alimentare în luna selectată.'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-gray-900">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="text-left px-4 py-2 font-semibold text-gray-600">Data</th>
                              <th className="text-right px-4 py-2 font-semibold text-gray-600">KM</th>
                              <th className="text-right px-4 py-2 font-semibold text-gray-600">Litri</th>
                              <th className="text-right px-4 py-2 font-semibold text-gray-600">Total RON</th>
                              <th className="text-right px-4 py-2 font-semibold text-gray-600">Pret/L</th>
                              <th className="text-left px-4 py-2 font-semibold text-gray-600">Tip</th>
                              <th className="text-left px-4 py-2 font-semibold text-gray-600">Statie</th>
                              <th className="px-4 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {alimentariFiltrate.map((a, idx) => (
                              <tr key={a.id} className={`border-b border-gray-50 ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  {new Date(a.data).toLocaleDateString('ro-RO')}
                                </td>
                                <td className="px-4 py-2 text-right">{a.km.toLocaleString('ro-RO')}</td>
                                <td className="px-4 py-2 text-right">{a.litri.toFixed(2)}</td>
                                <td className="px-4 py-2 text-right font-medium">{a.total_ron.toFixed(2)}</td>
                                <td className="px-4 py-2 text-right text-gray-500">
                                  {a.litri > 0 ? (a.total_ron / a.litri).toFixed(3) : '—'}
                                </td>
                                <td className="px-4 py-2">{a.tip_combustibil}</td>
                                <td className="px-4 py-2 text-gray-500">{a.statie ?? '—'}</td>
                                <td className="px-4 py-2 text-right">
                                  <button
                                    onClick={() => handleDeleteAlimentare(a.id)}
                                    disabled={deletingId === a.id}
                                    className="text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                                  >
                                    Sterge
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab Cheltuieli masina ── */}
                {tabMasina === 'cheltuieli' && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">Cheltuieli masina</h3>
                      <button
                        onClick={() => { setShowAddCheltuiala((v) => !v); setEroare(null) }}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        + Adauga
                      </button>
                    </div>

                    {showAddCheltuiala && (
                      <div className="px-5 py-4 border-b border-gray-100 bg-blue-50/30 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Data *</label>
                            <input type="date" value={formCheltuiala.data}
                              onChange={(e) => setFormCheltuiala((f) => ({ ...f, data: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Categorie</label>
                            <select value={formCheltuiala.categorie}
                              onChange={(e) => setFormCheltuiala((f) => ({ ...f, categorie: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
                              {CATEGORII_CHELTUIALA.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Suma (RON) *</label>
                            <input type="number" step="0.01" value={formCheltuiala.suma} placeholder="0.00"
                              onChange={(e) => setFormCheltuiala((f) => ({ ...f, suma: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-600 mb-0.5">Descriere *</label>
                            <input type="text" value={formCheltuiala.descriere} placeholder="ex: Schimb ulei + filtre"
                              onChange={(e) => setFormCheltuiala((f) => ({ ...f, descriere: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">KM (optional)</label>
                            <input type="number" value={formCheltuiala.km} placeholder="ex: 130000"
                              onChange={(e) => setFormCheltuiala((f) => ({ ...f, km: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Nr. factura (optional)</label>
                            <input type="text" value={formCheltuiala.nr_factura} placeholder="ex: FAC-0001"
                              onChange={(e) => setFormCheltuiala((f) => ({ ...f, nr_factura: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Furnizor (optional)</label>
                            <input type="text" value={formCheltuiala.furnizor} placeholder="ex: Service Auto"
                              onChange={(e) => setFormCheltuiala((f) => ({ ...f, furnizor: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleAddCheltuiala} disabled={saving}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {saving ? '...' : 'Salveaza'}
                          </button>
                          <button onClick={() => setShowAddCheltuiala(false)}
                            className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 transition-colors">
                            Anuleaza
                          </button>
                        </div>
                      </div>
                    )}

                    {cheltuieliMasina.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-500">Nicio cheltuiala inregistrata.</div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-gray-900">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-4 py-2 font-semibold text-gray-600">Data</th>
                                <th className="text-left px-4 py-2 font-semibold text-gray-600">Categorie</th>
                                <th className="text-left px-4 py-2 font-semibold text-gray-600">Descriere</th>
                                <th className="text-left px-4 py-2 font-semibold text-gray-600">Furnizor</th>
                                <th className="text-right px-4 py-2 font-semibold text-gray-600">KM</th>
                                <th className="text-right px-4 py-2 font-semibold text-gray-600">Suma (RON)</th>
                                <th className="text-left px-4 py-2 font-semibold text-gray-600">Nr. factura</th>
                                <th className="px-4 py-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {cheltuieliMasina.map((c, idx) => (
                                <tr key={c.id} className={`border-b border-gray-50 ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    {new Date(c.data).toLocaleDateString('ro-RO')}
                                  </td>
                                  <td className="px-4 py-2">
                                    {c.categorie ? (
                                      <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-xs">
                                        {c.categorie}
                                      </span>
                                    ) : '—'}
                                  </td>
                                  <td className="px-4 py-2 text-gray-700">{c.descriere}</td>
                                  <td className="px-4 py-2 text-gray-600">{c.furnizor ?? '—'}</td>
                                  <td className="px-4 py-2 text-right">
                                    {c.km != null ? c.km.toLocaleString('ro-RO') : '—'}
                                  </td>
                                  <td className="px-4 py-2 text-right font-medium">
                                    {c.suma.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-2 text-gray-500">{c.nr_factura ?? '—'}</td>
                                  <td className="px-4 py-2 text-right">
                                    <button
                                      onClick={() => handleDeleteCheltuiala(c.id)}
                                      disabled={deletingId === c.id}
                                      className="text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                                    >
                                      Sterge
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
                          <span className="text-xs text-gray-500 mr-2">Total cheltuieli:</span>
                          <span className="text-sm font-bold text-gray-900">
                            {cheltuieliMasina.reduce((s, c) => s + c.suma, 0).toLocaleString('ro-RO', {
                              minimumFractionDigits: 2, maximumFractionDigits: 2,
                            })} RON
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-24">
            <div className="text-center text-gray-400">
              <div className="text-4xl mb-3">🚛</div>
              <p className="text-sm">Selecteaza o masina din stanga pentru a vedea detaliile.</p>
            </div>
          </div>
        )}
      </div>

      {/* Fisa print modal */}
      {showFisa && selectedMasina && (
        <FisaPrintModal
          masina={selectedMasina}
          luna={lunaAlimentari}
          lunaLabel={luni.find(l => l.value === lunaAlimentari)?.label ?? lunaAlimentari}
          alimentari={alimentari}
          cheltuieli={cheltuieliMasina}
          onClose={() => setShowFisa(false)}
        />
      )}
    </div>
  )
}
