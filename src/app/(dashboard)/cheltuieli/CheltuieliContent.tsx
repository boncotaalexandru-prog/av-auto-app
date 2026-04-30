'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipuri ──────────────────────────────────────────────────────────────────

const TIPURI_CHELTUIALA = [
  'Salarii',
  'Motorina',
  'Benzina',
  'Contabilitate',
  'Rata credit',
  'DIGI',
  'Protocol',
  'Consumabile',
] as const

type TipCheltuiala = (typeof TIPURI_CHELTUIALA)[number]

interface Cheltuiala {
  id: string
  data: string
  suma: number
  tip: TipCheltuiala
  descriere: string | null
  bon_nr: string | null
  created_at: string
}

interface FormState {
  data: string
  suma: string
  tip: TipCheltuiala
  descriere: string
  bon_nr: string
}

interface FixTemplate {
  id: string
  denumire: string
  suma_implicita: number
  activa: boolean
}

interface FixLunara {
  id: string
  template_id: string
  luna: string
  suma_efectiva: number
  editata_manual: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function luniDisponibile(): { value: string; label: string }[] {
  const result: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmt(n: number) {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Componenta principala ────────────────────────────────────────────────────

export default function CheltuieliContent() {
  const supabase = createClient()

  // ── State cheltuieli variabile ──
  const [cheltuieli, setCheltuieli] = useState<Cheltuiala[]>([])
  const [loading, setLoading] = useState(true)
  const [eroare, setEroare] = useState<string | null>(null)
  const [luna, setLuna] = useState(lunaDefault())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    data: todayIso(),
    suma: '',
    tip: 'Motorina',
    descriere: '',
    bon_nr: '',
  })

  // ── State cheltuieli fixe ──
  const [templates, setTemplates] = useState<FixTemplate[]>([])
  const [fixLunare, setFixLunare] = useState<FixLunara[]>([])
  const [loadingFix, setLoadingFix] = useState(true)
  const [generandUnu, setGenerandUnu] = useState<string | null>(null)

  // edit inline fix
  const [editFixId, setEditFixId] = useState<string | null>(null)   // lunara id
  const [editFixVal, setEditFixVal] = useState('')
  const [savingFix, setSavingFix] = useState(false)

  // gestionare template-uri
  const [showTemplates, setShowTemplates] = useState(false)
  const [formTpl, setFormTpl] = useState({ denumire: '', suma_implicita: '' })
  const [editTplId, setEditTplId] = useState<string | null>(null)
  const [savingTpl, setSavingTpl] = useState(false)

  const luni = useMemo(() => luniDisponibile(), [])

  // ── Fetch cheltuieli variabile ──
  async function fetchCheltuieli(lunaStr: string) {
    setLoading(true)
    const [an, luna_nr] = lunaStr.split('-').map(Number)
    const start = `${an}-${String(luna_nr).padStart(2, '0')}-01`
    const endDate = new Date(an, luna_nr, 0)
    const end = endDate.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('cheltuieli_generale')
      .select('*')
      .gte('data', start)
      .lte('data', end)
      .order('data', { ascending: false })

    if (error) setEroare(error.message)
    else setCheltuieli((data ?? []) as Cheltuiala[])
    setLoading(false)
  }

  // ── Fetch cheltuieli fixe + auto-generare luna ──
  async function fetchFix(lunaStr: string) {
    setLoadingFix(true)
    const [tplRes, lunRes] = await Promise.all([
      supabase.from('cheltuieli_fixe_template').select('*').order('denumire'),
      supabase.from('cheltuieli_fixe_lunare').select('*').eq('luna', lunaStr),
    ])

    const allTemplates = (tplRes.data ?? []) as FixTemplate[]
    let lunare = (lunRes.data ?? []) as FixLunara[]

    // Auto-genereaza lipsele — fara interactiune din partea utilizatorului
    const existingTplIds = new Set(lunare.map(f => f.template_id))
    const activeTemplates = allTemplates.filter(t => t.activa)
    const deGenerat = activeTemplates.filter(t => !existingTplIds.has(t.id))

    if (deGenerat.length > 0) {
      const rows = deGenerat.map(t => ({
        template_id: t.id,
        luna: lunaStr,
        suma_efectiva: t.suma_implicita,
        editata_manual: false,
      }))
      const { data: newRows } = await supabase
        .from('cheltuieli_fixe_lunare')
        .insert(rows)
        .select()
      lunare = [...lunare, ...((newRows ?? []) as FixLunara[])]
    }

    setTemplates(allTemplates)
    setFixLunare(lunare)
    setLoadingFix(false)
  }

  useEffect(() => {
    setEroare(null)
    fetchCheltuieli(luna)
    fetchFix(luna)
  }, [luna])

  // ── Adauga cheltuiala variabila ──
  async function handleSave() {
    if (!form.suma || isNaN(Number(form.suma)) || !form.data || !form.tip) {
      setEroare('Completati data, tipul si suma.')
      return
    }
    setSaving(true)
    setEroare(null)
    const { error } = await supabase.from('cheltuieli_generale').insert({
      data: form.data,
      suma: Number(form.suma),
      tip: form.tip,
      descriere: form.descriere || null,
      bon_nr: form.bon_nr || null,
    })
    if (error) {
      setEroare(error.message)
    } else {
      setForm({ data: todayIso(), suma: '', tip: 'Motorina', descriere: '', bon_nr: '' })
      setShowForm(false)
      await fetchCheltuieli(luna)
    }
    setSaving(false)
  }

  // ── Sterge cheltuiala variabila ──
  async function handleDelete(id: string) {
    if (!confirm('Stergi aceasta cheltuiala?')) return
    setDeletingId(id)
    const { error } = await supabase.from('cheltuieli_generale').delete().eq('id', id)
    if (error) setEroare(error.message)
    else setCheltuieli(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  // ── Editare suma lunara fixa ──
  function startEditFix(lunara: FixLunara) {
    setEditFixId(lunara.id)
    setEditFixVal(String(lunara.suma_efectiva))
  }

  async function saveEditFix(lunara: FixLunara, template: FixTemplate) {
    const nouaSuma = Number(editFixVal)
    if (isNaN(nouaSuma) || nouaSuma < 0) { setEroare('Suma invalida.'); return }
    setSavingFix(true)
    const { error } = await supabase
      .from('cheltuieli_fixe_lunare')
      .update({
        suma_efectiva: nouaSuma,
        editata_manual: nouaSuma !== template.suma_implicita,
      })
      .eq('id', lunara.id)
    if (error) setEroare(error.message)
    else {
      setFixLunare(prev => prev.map(f =>
        f.id === lunara.id
          ? { ...f, suma_efectiva: nouaSuma, editata_manual: nouaSuma !== template.suma_implicita }
          : f
      ))
    }
    setEditFixId(null)
    setSavingFix(false)
  }

  async function resetFixLa(lunara: FixLunara, template: FixTemplate) {
    setSavingFix(true)
    const { error } = await supabase
      .from('cheltuieli_fixe_lunare')
      .update({ suma_efectiva: template.suma_implicita, editata_manual: false })
      .eq('id', lunara.id)
    if (error) setEroare(error.message)
    else {
      setFixLunare(prev => prev.map(f =>
        f.id === lunara.id
          ? { ...f, suma_efectiva: template.suma_implicita, editata_manual: false }
          : f
      ))
    }
    setSavingFix(false)
  }

  // ── Generare individuala (fallback daca template a fost adaugat in cursul lunii) ──
  async function genereazaUnu(template: FixTemplate) {
    setGenerandUnu(template.id)
    const { error, data } = await supabase
      .from('cheltuieli_fixe_lunare')
      .insert({ template_id: template.id, luna, suma_efectiva: template.suma_implicita, editata_manual: false })
      .select()
      .single()
    if (error) setEroare(error.message)
    else if (data) setFixLunare(prev => [...prev, data as FixLunara])
    setGenerandUnu(null)
  }

  // ── Template CRUD ──
  function startEditTpl(t: FixTemplate) {
    setEditTplId(t.id)
    setFormTpl({ denumire: t.denumire, suma_implicita: String(t.suma_implicita) })
  }

  async function saveTpl() {
    if (!formTpl.denumire.trim()) { setEroare('Denumirea este obligatorie.'); return }
    const suma = Number(formTpl.suma_implicita)
    if (isNaN(suma) || suma < 0) { setEroare('Suma invalida.'); return }
    setSavingTpl(true)
    setEroare(null)

    if (editTplId) {
      const { error } = await supabase
        .from('cheltuieli_fixe_template')
        .update({ denumire: formTpl.denumire.trim(), suma_implicita: suma })
        .eq('id', editTplId)
      if (error) setEroare(error.message)
      else {
        setTemplates(prev => prev.map(t =>
          t.id === editTplId ? { ...t, denumire: formTpl.denumire.trim(), suma_implicita: suma } : t
        ))
        setEditTplId(null)
      }
    } else {
      const { data, error } = await supabase
        .from('cheltuieli_fixe_template')
        .insert({ denumire: formTpl.denumire.trim(), suma_implicita: suma, activa: true })
        .select()
        .single()
      if (error) {
        setEroare(error.message)
      } else if (data) {
        // Re-fetch complet ca sa ruleze si auto-generarea pentru noul template
        await fetchFix(luna)
      }
    }
    setFormTpl({ denumire: '', suma_implicita: '' })
    setSavingTpl(false)
  }

  async function toggleActivaTpl(t: FixTemplate) {
    const { error } = await supabase
      .from('cheltuieli_fixe_template')
      .update({ activa: !t.activa })
      .eq('id', t.id)
    if (error) setEroare(error.message)
    else setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, activa: !x.activa } : x))
  }

  // ── Calcule totale ──
  const totalVariabile = useMemo(() => cheltuieli.reduce((s, c) => s + c.suma, 0), [cheltuieli])
  const totalFixe = useMemo(() => fixLunare.reduce((s, f) => s + f.suma_efectiva, 0), [fixLunare])
  const totalGeneral = totalFixe + totalVariabile

  // template-uri active cu statusul lunii
  const activeTemplates = useMemo(() => templates.filter(t => t.activa), [templates])

  const lunaLabel = luni.find(l => l.value === luna)?.label ?? luna

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cheltuieli</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fixe recurente + variabile — {lunaLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={luna}
            onChange={e => setLuna(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {luni.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <button
            onClick={() => { setShowForm(v => !v); setEroare(null) }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Cheltuiala variabila
          </button>
        </div>
      </div>

      {/* ── Eroare ── */}
      {eroare && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex justify-between items-center">
          {eroare}
          <button onClick={() => setEroare(null)} className="ml-3 underline text-xs">Inchide</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          CHELTUIELI FIXE
      ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
        {/* Header sectiune fixe */}
        <div className="flex items-center justify-between px-5 py-4 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-3">
            <span className="text-base">📌</span>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Cheltuieli Fixe Recurente</h2>
              <p className="text-xs text-gray-500">Prestabilite lunar, editabile per lună</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-900">{fmt(totalFixe)} RON</span>
          </div>
        </div>

        {loadingFix ? (
          <div className="p-6 text-center text-sm text-gray-500">Se încarcă...</div>
        ) : activeTemplates.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            Nu există cheltuieli fixe configurate.{' '}
            <button onClick={() => setShowTemplates(true)} className="underline text-blue-600">Adaugă un template</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-900">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Denumire</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Sumă implicită</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Suma lunii</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {activeTemplates.map(t => {
                  const lunara = fixLunare.find(f => f.template_id === t.id)
                  const isEditing = editFixId === lunara?.id

                  return (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{t.denumire}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(t.suma_implicita)} RON</td>

                      {/* Suma efectiva */}
                      <td className="px-4 py-3 text-right">
                        {!lunara ? (
                          <span className="text-gray-400">{fmt(t.suma_implicita)} RON</span>
                        ) : isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editFixVal}
                            onChange={e => setEditFixVal(e.target.value)}
                            className="w-28 border border-blue-400 rounded px-2 py-1 text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEditFix(lunara, t)
                              if (e.key === 'Escape') setEditFixId(null)
                            }}
                          />
                        ) : (
                          <span className={`font-semibold ${lunara.editata_manual ? 'text-amber-700' : 'text-gray-900'}`}>
                            {fmt(lunara.suma_efectiva)} RON
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {!lunara ? (
                          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full font-medium">
                            — Negenerată
                          </span>
                        ) : lunara.editata_manual ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            ⚠ Modificată
                            <span className="font-normal opacity-75">(implicit: {fmt(t.suma_implicita)})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            ✓ Generată
                          </span>
                        )}
                      </td>

                      {/* Actiuni */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!lunara ? (
                            <button
                              onClick={() => genereazaUnu(t)}
                              disabled={generandUnu === t.id}
                              className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                            >
                              {generandUnu === t.id ? '...' : 'Generează'}
                            </button>
                          ) : isEditing ? (
                            <>
                              <button
                                onClick={() => saveEditFix(lunara, t)}
                                disabled={savingFix}
                                className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                              >
                                Salvează
                              </button>
                              <button
                                onClick={() => setEditFixId(null)}
                                className="px-2 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded hover:bg-gray-300 transition-colors"
                              >
                                Anulează
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditFix(lunara)}
                                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded hover:bg-blue-200 transition-colors"
                              >
                                Editează
                              </button>
                              {lunara.editata_manual && (
                                <button
                                  onClick={() => resetFixLa(lunara, t)}
                                  disabled={savingFix}
                                  className="px-2 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded hover:bg-gray-300 disabled:opacity-50 transition-colors"
                                >
                                  Reset
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-amber-200 bg-amber-50">
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-700">Total fixe</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-800">{fmt(totalFixe)} RON</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Gestionare template-uri (colapsibil) */}
        <div className="border-t border-amber-200">
          <button
            onClick={() => setShowTemplates(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-gray-600 hover:bg-amber-50 transition-colors"
          >
            <span>⚙ Gestionare template-uri cheltuieli fixe</span>
            <span>{showTemplates ? '▲' : '▼'}</span>
          </button>

          {showTemplates && (
            <div className="px-5 pb-5 pt-3 space-y-4 bg-gray-50">
              {/* Lista template-uri */}
              {templates.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-gray-900">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">Denumire</th>
                        <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">Sumă implicită</th>
                        <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map(t => (
                        <tr key={t.id} className="border-b border-gray-100">
                          {editTplId === t.id ? (
                            <>
                              <td className="py-2 pr-4">
                                <input
                                  type="text"
                                  value={formTpl.denumire}
                                  onChange={e => setFormTpl(f => ({ ...f, denumire: e.target.value }))}
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                                />
                              </td>
                              <td className="py-2 pr-4">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={formTpl.suma_implicita}
                                  onChange={e => setFormTpl(f => ({ ...f, suma_implicita: e.target.value }))}
                                  className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-right"
                                />
                              </td>
                              <td className="py-2 pr-4" />
                              <td className="py-2 text-right">
                                <div className="flex justify-end gap-2">
                                  <button onClick={saveTpl} disabled={savingTpl} className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:bg-gray-300 transition-colors">Salvează</button>
                                  <button onClick={() => { setEditTplId(null); setFormTpl({ denumire: '', suma_implicita: '' }) }} className="px-3 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded hover:bg-gray-300 transition-colors">Anulează</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className={`py-2 pr-4 font-medium ${!t.activa ? 'text-gray-400 line-through' : ''}`}>{t.denumire}</td>
                              <td className="py-2 pr-4 text-right text-gray-700">{fmt(t.suma_implicita)} RON</td>
                              <td className="py-2 pr-4">
                                {t.activa
                                  ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Activ</span>
                                  : <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium">Inactiv</span>
                                }
                              </td>
                              <td className="py-2 text-right">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => startEditTpl(t)} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded hover:bg-blue-200 transition-colors">Editează</button>
                                  <button onClick={() => toggleActivaTpl(t)} className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${t.activa ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                                    {t.activa ? 'Dezactivează' : 'Activează'}
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Adauga template nou */}
              {!editTplId && (
                <div className="border-t border-gray-200 pt-4 mt-2">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Adaugă cheltuială fixă nouă</p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Denumire *</label>
                      <input
                        type="text"
                        value={formTpl.denumire}
                        onChange={e => setFormTpl(f => ({ ...f, denumire: e.target.value }))}
                        placeholder="ex: Rata credit"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Sumă implicită (RON) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formTpl.suma_implicita}
                        onChange={e => setFormTpl(f => ({ ...f, suma_implicita: e.target.value }))}
                        placeholder="0.00"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                      />
                    </div>
                    <button
                      onClick={saveTpl}
                      disabled={savingTpl}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
                    >
                      {savingTpl ? 'Se salvează...' : '+ Adaugă'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          FORMULAR CHELTUIALA VARIABILA
      ══════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Cheltuiala variabilă nouă</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tip *</label>
              <select
                value={form.tip}
                onChange={e => setForm(f => ({ ...f, tip: e.target.value as TipCheltuiala }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIPURI_CHELTUIALA.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Suma (RON) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.suma}
                onChange={e => setForm(f => ({ ...f, suma: e.target.value }))}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Descriere</label>
              <input
                type="text"
                value={form.descriere}
                onChange={e => setForm(f => ({ ...f, descriere: e.target.value }))}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nr. bon / factură</label>
              <input
                type="text"
                value={form.bon_nr}
                onChange={e => setForm(f => ({ ...f, bon_nr: e.target.value }))}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEroare(null) }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          CHELTUIELI VARIABILE
      ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-900">💸 Cheltuieli Variabile</h2>
          <span className="text-sm font-bold text-gray-900">{fmt(totalVariabile)} RON</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Se încarcă...</div>
        ) : cheltuieli.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Nu există cheltuieli variabile pentru luna selectată.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-900">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Data</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Tip</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Suma (RON)</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Descriere</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Nr. bon</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {cheltuieli.map((c, idx) => (
                    <tr key={c.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                        {new Date(c.data).toLocaleDateString('ro-RO')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">
                          {c.tip}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(c.suma)}</td>
                      <td className="px-4 py-3 text-gray-600">{c.descriere ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.bon_nr ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-40 transition-colors"
                        >
                          Sterge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end items-center gap-2">
              <span className="text-sm text-gray-600">Total variabile:</span>
              <span className="text-base font-bold text-gray-900">{fmt(totalVariabile)} RON</span>
            </div>
          </>
        )}
      </div>

      {/* ── TOTAL GENERAL ── */}
      <div className="bg-gray-900 text-white rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total cheltuieli — {lunaLabel}</p>
          <p className="text-xs text-gray-500 mt-0.5">Fixe {fmt(totalFixe)} + Variabile {fmt(totalVariabile)}</p>
        </div>
        <p className="text-2xl font-bold">{fmt(totalGeneral)} RON</p>
      </div>

    </div>
  )
}
