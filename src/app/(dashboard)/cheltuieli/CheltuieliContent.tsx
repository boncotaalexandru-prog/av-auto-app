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

export default function CheltuieliContent() {
  const supabase = createClient()

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

  const luni = useMemo(() => luniDisponibile(), [])

  // ── Fetch ──
  async function fetchCheltuieli(lunaStr: string) {
    setLoading(true)
    setEroare(null)
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

    if (error) {
      setEroare(error.message)
    } else {
      setCheltuieli((data ?? []) as Cheltuiala[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCheltuieli(luna)
  }, [luna])

  // ── Adauga ──
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

  // ── Sterge ──
  async function handleDelete(id: string) {
    if (!confirm('Stergi aceasta cheltuiala?')) return
    setDeletingId(id)
    const { error } = await supabase.from('cheltuieli_generale').delete().eq('id', id)
    if (error) {
      setEroare(error.message)
    } else {
      setCheltuieli((prev) => prev.filter((c) => c.id !== id))
    }
    setDeletingId(null)
  }

  const total = useMemo(() => cheltuieli.reduce((acc, c) => acc + c.suma, 0), [cheltuieli])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cheltuieli</h1>
        <button
          onClick={() => { setShowForm((v) => !v); setEroare(null) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <span>+</span> Adauga Cheltuiala
        </button>
      </div>

      {/* Filtru luna */}
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

      {/* Eroare */}
      {eroare && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {eroare}
        </div>
      )}

      {/* Formular adaugare */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Cheltuiala noua</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tip *</label>
              <select
                value={form.tip}
                onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value as TipCheltuiala }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIPURI_CHELTUIALA.map((t) => (
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
                onChange={(e) => setForm((f) => ({ ...f, suma: e.target.value }))}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Descriere</label>
              <input
                type="text"
                value={form.descriere}
                onChange={(e) => setForm((f) => ({ ...f, descriere: e.target.value }))}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nr. bon / factura</label>
              <input
                type="text"
                value={form.bon_nr}
                onChange={(e) => setForm((f) => ({ ...f, bon_nr: e.target.value }))}
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
              {saving ? 'Se salveaza...' : 'Salveaza'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEroare(null) }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Anuleaza
            </button>
          </div>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Se incarca...</div>
        ) : cheltuieli.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Nu exista cheltuieli pentru luna selectata.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                    <tr
                      key={c.id}
                      className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                    >
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                        {new Date(c.data).toLocaleDateString('ro-RO')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">
                          {c.tip}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {c.suma.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
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
            {/* Total */}
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <span className="text-sm text-gray-600 mr-2">Total:</span>
              <span className="text-base font-bold text-gray-900">
                {total.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
