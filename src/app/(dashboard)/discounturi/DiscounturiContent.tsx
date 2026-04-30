'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Discount {
  id: string
  furnizor: string
  suma: number
  data_emitere: string
  luna_referinta: string
  nr_document: string | null
  observatii: string | null
  created_at: string
}

interface FormState {
  furnizor: string
  suma: string
  data_emitere: string
  luna_referinta: string
  nr_document: string
  observatii: string
}

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmt(n: number) {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DiscounturiContent() {
  const supabase = createClient()
  const luni = useMemo(() => luniDisponibile(), [])

  const [discounturi, setDiscounturi] = useState<Discount[]>([])
  const [loading, setLoading] = useState(true)
  const [eroare, setEroare] = useState<string | null>(null)
  const [filtruLuna, setFiltruLuna] = useState<string>('toate')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    furnizor: '',
    suma: '',
    data_emitere: todayIso(),
    luna_referinta: lunaDefault(),
    nr_document: '',
    observatii: '',
  })

  async function fetchDiscounturi() {
    setLoading(true)
    setEroare(null)
    const { data, error } = await supabase
      .from('discounturi_furnizori')
      .select('*')
      .order('data_emitere', { ascending: false })
    if (error) setEroare(error.message)
    else setDiscounturi((data ?? []) as Discount[])
    setLoading(false)
  }

  useEffect(() => { fetchDiscounturi() }, [])

  const discountiFiltrate = useMemo(() => {
    if (filtruLuna === 'toate') return discounturi
    return discounturi.filter(d => d.luna_referinta === filtruLuna)
  }, [discounturi, filtruLuna])

  const totalFiltrat = useMemo(() =>
    discountiFiltrate.reduce((s, d) => s + d.suma, 0),
    [discountiFiltrate]
  )

  async function handleSave() {
    if (!form.furnizor.trim()) { setEroare('Furnizorul este obligatoriu.'); return }
    if (!form.suma || isNaN(Number(form.suma)) || Number(form.suma) <= 0) { setEroare('Suma invalida.'); return }
    if (!form.data_emitere) { setEroare('Data emiterii este obligatorie.'); return }
    if (!form.luna_referinta) { setEroare('Luna de referinta este obligatorie.'); return }

    setSaving(true)
    setEroare(null)
    const { error } = await supabase.from('discounturi_furnizori').insert({
      furnizor: form.furnizor.trim(),
      suma: Number(form.suma),
      data_emitere: form.data_emitere,
      luna_referinta: form.luna_referinta,
      nr_document: form.nr_document || null,
      observatii: form.observatii || null,
    })
    if (error) {
      setEroare(error.message)
    } else {
      setForm({ furnizor: '', suma: '', data_emitere: todayIso(), luna_referinta: lunaDefault(), nr_document: '', observatii: '' })
      setShowForm(false)
      await fetchDiscounturi()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Stergi acest discount?')) return
    setDeletingId(id)
    const { error } = await supabase.from('discounturi_furnizori').delete().eq('id', id)
    if (error) setEroare(error.message)
    else setDiscounturi(prev => prev.filter(d => d.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discounturi Furnizori</h1>
          <p className="text-sm text-gray-500 mt-0.5">Note de credit / discount de la furnizori</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setEroare(null) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Adauga discount
        </button>
      </div>

      {eroare && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
          {eroare}
          <button onClick={() => setEroare(null)} className="ml-3 underline text-xs">Inchide</button>
        </div>
      )}

      {/* Formular */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Discount nou</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Furnizor *</label>
              <input
                type="text"
                value={form.furnizor}
                onChange={e => setForm(f => ({ ...f, furnizor: e.target.value }))}
                placeholder="ex: MOBIS Parts Europe"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Suma discount (RON) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.suma}
                onChange={e => setForm(f => ({ ...f, suma: e.target.value }))}
                placeholder="ex: 1500.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data emiterii *</label>
              <input
                type="date"
                value={form.data_emitere}
                onChange={e => setForm(f => ({ ...f, data_emitere: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Luna de referință * <span className="text-gray-400 font-normal">(pentru ce lună se aplică)</span></label>
              <select
                value={form.luna_referinta}
                onChange={e => setForm(f => ({ ...f, luna_referinta: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {luni.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nr. document</label>
              <input
                type="text"
                value={form.nr_document}
                onChange={e => setForm(f => ({ ...f, nr_document: e.target.value }))}
                placeholder="ex: NC-2024-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Observații</label>
              <input
                type="text"
                value={form.observatii}
                onChange={e => setForm(f => ({ ...f, observatii: e.target.value }))}
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

      {/* Filtru luna */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Filtru luna referinta:</label>
        <select
          value={filtruLuna}
          onChange={e => setFiltruLuna(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="toate">Toate</option>
          {luni.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        {filtruLuna !== 'toate' && (
          <span className="text-sm text-gray-600">
            Total: <strong className="text-green-700">{fmt(totalFiltrat)} RON</strong>
          </span>
        )}
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Se incarca...</div>
        ) : discountiFiltrate.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {filtruLuna === 'toate' ? 'Nu exista discounturi inregistrate.' : 'Nu exista discounturi pentru luna selectata.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-900">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Furnizor</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Luna referință</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Data emiterii</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Suma (RON)</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Nr. document</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Observații</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {discountiFiltrate.map((d, idx) => {
                    const lunaLabel = luni.find(l => l.value === d.luna_referinta)?.label ?? d.luna_referinta
                    return (
                      <tr key={d.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3 font-medium">{d.furnizor}</td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded font-medium">
                            {lunaLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(d.data_emitere).toLocaleDateString('ro-RO')}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">
                          +{fmt(d.suma)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{d.nr_document ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{d.observatii ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDelete(d.id)}
                            disabled={deletingId === d.id}
                            className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-40 transition-colors"
                          >
                            Sterge
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end items-center gap-2">
              <span className="text-sm text-gray-600">Total{filtruLuna !== 'toate' ? ' luna selectata' : ''}:</span>
              <span className="text-base font-bold text-green-700">+{fmt(totalFiltrat)} RON</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
