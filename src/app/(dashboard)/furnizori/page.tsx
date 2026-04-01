'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ImportFurnizori from '@/components/furnizori/ImportFurnizori'
import TabelFurnizori from '@/components/furnizori/TabelFurnizori'

const FIELDS: { key: string; label: string; type?: string; full?: boolean }[] = [
  { key: 'denumire',    label: 'Denumire *',        full: true },
  { key: 'cod_fiscal',  label: 'Cod fiscal / CUI' },
  { key: 'reg_com',     label: 'Reg. com.' },
  { key: 'cod_furnizor',label: 'Cod furnizor intern' },
  { key: 'adresa',      label: 'Adresă',             full: true },
  { key: 'localitate',  label: 'Localitate' },
  { key: 'judet',       label: 'Județ' },
  { key: 'tara',        label: 'Țară' },
  { key: 'telefon',     label: 'Telefon' },
  { key: 'email',       label: 'Email', type: 'email' },
  { key: 'pers_contact',label: 'Persoană contact' },
  { key: 'banca',       label: 'Bancă' },
  { key: 'iban',        label: 'IBAN',                full: true },
]

type FormData = Record<string, string>

const emptyForm = (): FormData => Object.fromEntries(FIELDS.map(f => [f.key, '']))

export default function FurnizoriPage() {
  const router = useRouter()
  const [refresh, setRefresh] = useState(0)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm())
  const [observatii, setObservatii] = useState('')
  const [favorit, setFavorit] = useState(false)
  const [salvand, setSalvand] = useState(false)
  const [eroare, setEroare] = useState('')

  function deschideModal() {
    setForm(emptyForm())
    setObservatii('')
    setFavorit(false)
    setEroare('')
    setModal(true)
  }

  async function salveaza() {
    if (!form.denumire.trim()) { setEroare('Denumirea este obligatorie.'); return }
    setSalvand(true)
    setEroare('')
    const supabase = createClient()
    const payload: Record<string, string | boolean | null> = { is_favorit: favorit }
    for (const f of FIELDS) {
      payload[f.key] = form[f.key].trim() || null
    }
    payload.observatii = observatii.trim() || null

    const { data, error } = await supabase.from('furnizori').insert(payload).select('id').single()
    setSalvand(false)
    if (error) { setEroare('Eroare: ' + error.message); return }
    setModal(false)
    if (data?.id) router.push(`/furnizori/${data.id}`)
    else setRefresh(r => r + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Furnizori</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={deschideModal}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800">
            + Furnizor nou
          </button>
          <ImportFurnizori onDone={() => setRefresh(r => r + 1)} />
        </div>
      </div>

      <TabelFurnizori refresh={refresh} />

      {/* Modal furnizor nou */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Furnizor nou</h3>
              <button onClick={() => setModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 font-bold">
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
              {/* Grid câmpuri */}
              <div className="grid grid-cols-2 gap-4">
                {FIELDS.map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                    <input
                      type={f.type ?? 'text'}
                      value={form[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={f.label.replace(' *', '')}
                    />
                  </div>
                ))}
              </div>

              {/* Observatii */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Observații</label>
                <textarea
                  value={observatii}
                  onChange={e => setObservatii(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Observații interne..."
                />
              </div>

              {/* Favorit */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="favorit" checked={favorit}
                  onChange={e => setFavorit(e.target.checked)}
                  className="w-4 h-4 rounded accent-yellow-500" />
                <label htmlFor="favorit" className="text-sm font-medium text-gray-700">
                  ★ Marchează ca furnizor favorit
                </label>
              </div>

              {eroare && (
                <p className="text-sm text-red-600 font-medium">{eroare}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button onClick={() => setModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={salveaza} disabled={salvand}
                className="px-6 py-2 text-sm font-bold text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {salvand ? 'Se salvează...' : 'Salvează furnizor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
