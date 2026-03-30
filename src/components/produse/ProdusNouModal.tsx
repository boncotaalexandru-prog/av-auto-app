'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ProdusNou {
  id: string
  cod: string | null
  nume: string
  producator: string | null
  unitate: string | null
  pret: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (produs: ProdusNou) => void
  // Daca e apelat din oferta, pre-completam cautarea
  numeInitial?: string
}

const EMPTY = {
  cod: '',
  nume: '',
  producator: '',
  unitate: '',
  pret: '',
}

export default function ProdusNouModal({ open, onClose, onSaved, numeInitial }: Props) {
  const [form, setForm] = useState({ ...EMPTY, nume: numeInitial ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resetare la deschidere
  function handleOpen() {
    setForm({ ...EMPTY, nume: numeInitial ?? '' })
    setError(null)
  }

  if (!open) return null

  async function handleSave() {
    if (!form.nume.trim()) { setError('Denumirea este obligatorie.'); return }
    setSaving(true)
    setError(null)
    const { data, error: err } = await createClient()
      .from('produse')
      .insert({
        cod: form.cod.trim() || null,
        nume: form.nume.trim(),
        producator: form.producator.trim() || null,
        unitate: form.unitate.trim() || null,
        pret: form.pret ? parseFloat(form.pret) : null,
      })
      .select('id, cod, nume, producator, unitate, pret')
      .single()
    setSaving(false)
    if (err) { setError('Eroare: ' + err.message); return }
    onSaved(data as ProdusNou)
    onClose()
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Produs nou in catalog</h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Denumire */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              Denumire <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.nume}
              onChange={e => setForm(f => ({ ...f, nume: e.target.value }))}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cod + UM */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Cod / SKU</label>
              <input
                type="text"
                value={form.cod}
                onChange={e => setForm(f => ({ ...f, cod: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ex: 882200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">UM</label>
              <input
                type="text"
                value={form.unitate}
                onChange={e => setForm(f => ({ ...f, unitate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ex: buc, set, l"
              />
            </div>
          </div>

          {/* Producator */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Producator</label>
            <input
              type="text"
              value={form.producator}
              onChange={e => setForm(f => ({ ...f, producator: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ex: VALEO, BOSCH, MANN..."
            />
          </div>

          {/* Pret lista */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Pret lista (RON)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.pret}
              onChange={e => setForm(f => ({ ...f, pret: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleSave}
            disabled={saving || !form.nume.trim()}
            className="w-full py-3 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-lg disabled:opacity-40 transition-colors"
          >
            {saving ? 'Se salveaza...' : 'Salveaza produs'}
          </button>
        </div>
      </div>
    </div>
  )
}
