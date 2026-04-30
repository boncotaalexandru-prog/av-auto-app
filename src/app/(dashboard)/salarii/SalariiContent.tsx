'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipuri ──────────────────────────────────────────────────────────────────

type TipAngajat = 'fix' | 'fix_plus_comision' | 'comision'

const TIP_LABELS: Record<TipAngajat, string> = {
  fix: 'Salariu fix',
  fix_plus_comision: 'Fix + comision',
  comision: 'Numai comision',
}

interface Angajat {
  id: string
  nume: string
  tip: TipAngajat
  suma_fixa: number
  procent: number
  activ: boolean
  created_at: string
}

interface SalariuLunar {
  id: string
  angajat_id: string
  luna: string
  suma_finala: number | null
  adaos_brut_referinta: number | null
  editat_manual: boolean
}

interface FormAngajat {
  nume: string
  tip: TipAngajat
  suma_fixa: string
  procent: string
}

function luniDisponibile(): { value: string; label: string }[] {
  const result: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = d.toISOString().slice(0, 7) // YYYY-MM
    const label = d.toLocaleString('ro-RO', { month: 'long', year: 'numeric' })
    result.push({ value, label })
  }
  return result
}

function lunaDefault(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Calculeaza salariu din formula fara override
function calcSalariu(angajat: Angajat, adaosBrut: number): number {
  if (angajat.tip === 'fix') return angajat.suma_fixa
  if (angajat.tip === 'comision') return (adaosBrut * angajat.procent) / 100
  // fix_plus_comision
  return angajat.suma_fixa + (adaosBrut * angajat.procent) / 100
}

// ─── Componenta principala ────────────────────────────────────────────────────

export default function SalariiContent() {
  const supabase = createClient()

  // ── State angajati ──
  const [angajati, setAngajati] = useState<Angajat[]>([])
  const [loadingAngajati, setLoadingAngajati] = useState(true)
  const [showAddAngajat, setShowAddAngajat] = useState(false)
  const [editingAngajat, setEditingAngajat] = useState<Angajat | null>(null)
  const [formAngajat, setFormAngajat] = useState<FormAngajat>({
    nume: '', tip: 'fix', suma_fixa: '', procent: '',
  })
  const [savingAngajat, setSavingAngajat] = useState(false)

  // ── State calcul salarii ──
  const [luna, setLuna] = useState(lunaDefault())
  const [adaosBrut, setAdaosBrut] = useState<number>(0)
  const [loadingCalc, setLoadingCalc] = useState(false)
  const [salariiLunare, setSalariiLunare] = useState<SalariuLunar[]>([])
  const [overrides, setOverrides] = useState<Record<string, string>>({}) // angajat_id -> valoare string editabila
  const [savingOverride, setSavingOverride] = useState<string | null>(null)

  const [eroare, setEroare] = useState<string | null>(null)

  const luni = useMemo(() => luniDisponibile(), [])

  // ── Fetch angajati ──
  async function fetchAngajati() {
    setLoadingAngajati(true)
    const { data, error } = await supabase
      .from('angajati')
      .select('*')
      .order('nume')
    if (error) setEroare(error.message)
    else setAngajati((data ?? []) as Angajat[])
    setLoadingAngajati(false)
  }

  useEffect(() => { fetchAngajati() }, [])

  // ── Fetch adaos brut + salarii lunare ──
  const fetchCalcDate = useCallback(async (lunaStr: string) => {
    setLoadingCalc(true)
    setEroare(null)
    const [an, luna_nr] = lunaStr.split('-').map(Number)
    const start = `${an}-${String(luna_nr).padStart(2, '0')}-01`
    const nextM = new Date(an, luna_nr, 1)
    const nextMonthStr = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, '0')}-01`

    // Adaos brut: (pret_vanzare - pret_achizitie) * cantitate din facturi_produse
    // joinate cu facturi emisa/platita in luna respectiva
    const [fRaw, fpRaw, slRaw] = await Promise.all([
      supabase
        .from('facturi')
        .select('id')
        .in('status', ['emisa', 'platita'])
        .gte('data_emitere', start)
        .lt('data_emitere', nextMonthStr),
      supabase
        .from('facturi_produse')
        .select('factura_id, pret_vanzare, pret_achizitie, cantitate')
        .limit(20000),
      supabase
        .from('salarii_lunare')
        .select('*')
        .eq('luna', `${start}`),
    ])

    // Calculeaza adaos brut
    const facturaIds = new Set((fRaw.data ?? []).map((f: { id: string }) => f.id))
    const produse = (fpRaw.data ?? []) as Array<{
      factura_id: string; pret_vanzare: number; pret_achizitie: number; cantitate: number
    }>
    const adaos = produse
      .filter((p) => facturaIds.has(p.factura_id))
      .reduce((sum, p) => {
        const cant = p.cantitate ?? 1
        const pv = p.pret_vanzare ?? 0
        const pa = p.pret_achizitie ?? 0
        return sum + cant * (pv - pa)
      }, 0)

    setAdaosBrut(adaos)
    setSalariiLunare((slRaw.data ?? []) as SalariuLunar[])

    // Initializam overrides din salariiLunare deja salvate
    const initOverrides: Record<string, string> = {}
    ;(slRaw.data ?? []).forEach((sl: SalariuLunar) => {
      if (sl.editat_manual && sl.suma_finala != null) {
        initOverrides[sl.angajat_id] = String(sl.suma_finala)
      }
    })
    setOverrides(initOverrides)

    setLoadingCalc(false)
  }, [supabase])

  useEffect(() => { fetchCalcDate(luna) }, [luna, fetchCalcDate])

  // ── Map salarii lunare by angajat_id ──
  const salariuLunarMap = useMemo(() => {
    const m: Record<string, SalariuLunar> = {}
    salariiLunare.forEach((sl) => { m[sl.angajat_id] = sl })
    return m
  }, [salariiLunare])

  // ── Salariu efectiv per angajat ──
  function salariuEfectiv(a: Angajat): number {
    const sl = salariuLunarMap[a.id]
    if (sl?.editat_manual && sl.suma_finala != null) return sl.suma_finala
    // Daca exista override nesalvat in state
    if (overrides[a.id] !== undefined && overrides[a.id] !== '') {
      const v = Number(overrides[a.id])
      if (!isNaN(v)) return v
    }
    return calcSalariu(a, adaosBrut)
  }

  // ── Salveaza override ──
  async function handleSaveOverride(angajat: Angajat) {
    const valStr = overrides[angajat.id]
    if (valStr === undefined || valStr === '') return
    const val = Number(valStr)
    if (isNaN(val)) { setEroare('Suma invalida.'); return }
    setSavingOverride(angajat.id)
    setEroare(null)

    const [an, luna_nr] = luna.split('-').map(Number)
    const lunaDate = `${an}-${String(luna_nr).padStart(2, '0')}-01`

    const existing = salariuLunarMap[angajat.id]
    if (existing) {
      const { error } = await supabase
        .from('salarii_lunare')
        .update({ suma_finala: val, editat_manual: true, adaos_brut_referinta: adaosBrut })
        .eq('id', existing.id)
      if (error) setEroare(error.message)
    } else {
      const { error } = await supabase
        .from('salarii_lunare')
        .insert({
          angajat_id: angajat.id,
          luna: lunaDate,
          suma_finala: val,
          adaos_brut_referinta: adaosBrut,
          editat_manual: true,
        })
      if (error) setEroare(error.message)
    }
    await fetchCalcDate(luna)
    setSavingOverride(null)
  }

  // ── Reset override (revine la formula) ──
  async function handleResetOverride(angajat: Angajat) {
    const existing = salariuLunarMap[angajat.id]
    if (!existing) return
    setSavingOverride(angajat.id)
    const { error } = await supabase
      .from('salarii_lunare')
      .update({ editat_manual: false })
      .eq('id', existing.id)
    if (error) setEroare(error.message)
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[angajat.id]
      return next
    })
    await fetchCalcDate(luna)
    setSavingOverride(null)
  }

  // ── Adauga / editeaza angajat ──
  async function handleSaveAngajat() {
    if (!formAngajat.nume.trim()) { setEroare('Numele este obligatoriu.'); return }
    setSavingAngajat(true)
    setEroare(null)
    const payload = {
      nume: formAngajat.nume.trim(),
      tip: formAngajat.tip,
      suma_fixa: formAngajat.suma_fixa ? Number(formAngajat.suma_fixa) : 0,
      procent: formAngajat.procent ? Number(formAngajat.procent) : 0,
    }
    if (editingAngajat) {
      const { error } = await supabase.from('angajati').update(payload).eq('id', editingAngajat.id)
      if (error) setEroare(error.message)
    } else {
      const { error } = await supabase.from('angajati').insert(payload)
      if (error) setEroare(error.message)
    }
    setFormAngajat({ nume: '', tip: 'fix', suma_fixa: '', procent: '' })
    setShowAddAngajat(false)
    setEditingAngajat(null)
    await fetchAngajati()
    setSavingAngajat(false)
  }

  function startEdit(a: Angajat) {
    setEditingAngajat(a)
    setFormAngajat({
      nume: a.nume,
      tip: a.tip,
      suma_fixa: a.suma_fixa ? String(a.suma_fixa) : '',
      procent: a.procent ? String(a.procent) : '',
    })
    setShowAddAngajat(true)
    setEroare(null)
  }

  async function handleToggleActiv(a: Angajat) {
    const { error } = await supabase.from('angajati').update({ activ: !a.activ }).eq('id', a.id)
    if (error) setEroare(error.message)
    else await fetchAngajati()
  }

  const totalSalarii = useMemo(
    () => angajati.filter((a) => a.activ).reduce((s, a) => s + salariuEfectiv(a), 0),
    [angajati, salariiLunare, overrides, adaosBrut]
  )

  const showSumaFixa = formAngajat.tip === 'fix' || formAngajat.tip === 'fix_plus_comision'
  const showProcent = formAngajat.tip === 'comision' || formAngajat.tip === 'fix_plus_comision'

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Salarii</h1>

      {eroare && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {eroare}
          <button className="ml-3 underline text-xs" onClick={() => setEroare(null)}>Inchide</button>
        </div>
      )}

      {/* ── Sectiunea 1: Angajati ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Angajati</h2>
          <button
            onClick={() => {
              if (showAddAngajat && !editingAngajat) {
                setShowAddAngajat(false)
              } else {
                setEditingAngajat(null)
                setFormAngajat({ nume: '', tip: 'fix', suma_fixa: '', procent: '' })
                setShowAddAngajat(true)
              }
              setEroare(null)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Angajat nou
          </button>
        </div>

        {/* Formular angajat */}
        {showAddAngajat && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingAngajat ? `Editare: ${editingAngajat.nume}` : 'Angajat nou'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nume *</label>
                <input
                  type="text"
                  value={formAngajat.nume}
                  onChange={(e) => setFormAngajat((f) => ({ ...f, nume: e.target.value }))}
                  placeholder="Prenume Nume"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tip salarizare *</label>
                <select
                  value={formAngajat.tip}
                  onChange={(e) => setFormAngajat((f) => ({ ...f, tip: e.target.value as TipAngajat }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(Object.entries(TIP_LABELS) as [TipAngajat, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {showSumaFixa && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Suma fixa (RON)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formAngajat.suma_fixa}
                    onChange={(e) => setFormAngajat((f) => ({ ...f, suma_fixa: e.target.value }))}
                    placeholder="ex: 3500"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              {showProcent && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Procent din adaos brut (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formAngajat.procent}
                    onChange={(e) => setFormAngajat((f) => ({ ...f, procent: e.target.value }))}
                    placeholder="ex: 5"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveAngajat}
                disabled={savingAngajat}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingAngajat ? 'Se salveaza...' : 'Salveaza'}
              </button>
              <button
                onClick={() => { setShowAddAngajat(false); setEditingAngajat(null); setEroare(null) }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Anuleaza
              </button>
            </div>
          </div>
        )}

        {/* Tabel angajati */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingAngajati ? (
            <div className="p-8 text-center text-gray-500 text-sm">Se incarca...</div>
          ) : angajati.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Nu exista angajati. Adaugati primul angajat mai sus.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Nume</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Tip salarizare</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Suma fixa</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Procent</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Activ</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {angajati.map((a, idx) => (
                    <tr
                      key={a.id}
                      className={`border-b border-gray-100 ${!a.activ ? 'opacity-50' : ''} ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{a.nume}</td>
                      <td className="px-4 py-3">
                        <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded">
                          {TIP_LABELS[a.tip]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {a.suma_fixa > 0
                          ? `${a.suma_fixa.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {a.procent > 0 ? `${a.procent}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActiv(a)}
                          className={`text-xs px-2 py-0.5 rounded transition-colors ${
                            a.activ
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {a.activ ? 'Activ' : 'Inactiv'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => startEdit(a)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors"
                        >
                          Editeaza
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Sectiunea 2: Calcul salarii lunar ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Calcul salarii lunar</h2>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Luna:</label>
            <select
              value={luna}
              onChange={(e) => setLuna(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {luni.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Adaos brut */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-6">
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Adaos brut luna selectata</div>
            <div className="text-2xl font-bold text-gray-900">
              {loadingCalc ? '...' : `${adaosBrut.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON`}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              Suma (pret_vanzare - pret_achizitie) × cantitate din facturi emise/platite
            </div>
          </div>
        </div>

        {/* Tabel salarii */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingCalc ? (
            <div className="p-8 text-center text-gray-500 text-sm">Se calculeaza...</div>
          ) : angajati.filter((a) => a.activ).length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Nu exista angajati activi. Adaugati angajati in sectiunea de mai sus.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Angajat</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Formula</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Salariu calculat</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Override manual</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Salariu final</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {angajati
                      .filter((a) => a.activ)
                      .map((a, idx) => {
                        const sl = salariuLunarMap[a.id]
                        const calcAuto = calcSalariu(a, adaosBrut)
                        const esteManual = sl?.editat_manual && sl.suma_finala != null
                        const final = salariuEfectiv(a)
                        const overrideVal = overrides[a.id] ?? ''

                        let formulaLabel = ''
                        if (a.tip === 'fix') formulaLabel = `${a.suma_fixa} RON fix`
                        else if (a.tip === 'comision') formulaLabel = `${a.procent}% din adaos`
                        else formulaLabel = `${a.suma_fixa} RON + ${a.procent}%`

                        return (
                          <tr
                            key={a.id}
                            className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900">{a.nume}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{formulaLabel}</td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {calcAuto.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={overrideVal}
                                  onChange={(e) =>
                                    setOverrides((prev) => ({ ...prev, [a.id]: e.target.value }))
                                  }
                                  placeholder={esteManual ? String(sl!.suma_finala) : 'override...'}
                                  className="w-28 border border-gray-300 rounded px-2 py-1 text-xs text-right text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`font-semibold ${esteManual ? 'text-amber-600' : 'text-gray-900'}`}
                              >
                                {final.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                              </span>
                              {esteManual && (
                                <span className="ml-1 text-xs text-amber-500">(manual)</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => handleSaveOverride(a)}
                                  disabled={savingOverride === a.id || !overrideVal}
                                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
                                >
                                  {savingOverride === a.id ? '...' : 'Salveaza'}
                                </button>
                                {esteManual && (
                                  <button
                                    onClick={() => handleResetOverride(a)}
                                    disabled={savingOverride === a.id}
                                    className="text-xs px-2 py-1 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
                                    title="Revine la calculul automat"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
              {/* Total */}
              <div className="px-4 py-3 border-t border-gray-200 flex justify-end items-center gap-3">
                <span className="text-sm text-gray-600">Total salarii:</span>
                <span className="text-lg font-bold text-gray-900">
                  {totalSalarii.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                </span>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
