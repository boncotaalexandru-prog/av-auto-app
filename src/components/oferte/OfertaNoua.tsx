'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Client {
  id: string
  denumire: string
}

interface Masina {
  id: string
  nr_inmatriculare: string | null
  marca: string | null
}

export default function OfertaNoua({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [clienti, setClienti] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [clientSelectat, setClientSelectat] = useState<Client | null>(null)
  const [showClientList, setShowClientList] = useState(false)
  const [masini, setMasini] = useState<Masina[]>([])
  const [masinaId, setMasinaId] = useState('')
  const [necesar, setNecesar] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clientRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Incarca clientii la cautare
  useEffect(() => {
    if (!clientSearch.trim()) { setClienti([]); return }
    const supabase = createClient()
    supabase
      .from('clienti')
      .select('id, denumire')
      .ilike('denumire', `%${clientSearch}%`)
      .order('denumire')
      .limit(20)
      .then(({ data }) => setClienti(data ?? []))
  }, [clientSearch])

  // Incarca masinile clientului selectat
  useEffect(() => {
    setMasinaId('')
    setMasini([])
    if (!clientSelectat) return
    createClient()
      .from('clienti_masini')
      .select('id, nr_inmatriculare, marca')
      .eq('client_id', clientSelectat.id)
      .order('created_at')
      .then(({ data }) => setMasini(data ?? []))
  }, [clientSelectat])

  // Inchide dropdown-ul la click afara
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setShowClientList(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function resetForm() {
    setClientSearch('')
    setClientSelectat(null)
    setClienti([])
    setMasini([])
    setMasinaId('')
    setNecesar('')
    setError(null)
  }

  function handleClose() {
    resetForm()
    setOpen(false)
  }

  async function handleSave() {
    if (!clientSelectat) { setError('Selecteaza un client.'); return }
    if (!necesar.trim()) { setError('Completeaza necesarul de piese.'); return }
    setSaving(true)
    setError(null)
    const { data, error: err } = await createClient()
      .from('oferte')
      .insert({
        client_id: clientSelectat.id,
        masina_id: masinaId || null,
        necesar_piese: necesar.trim(),
        status: 'draft',
      })
      .select('id')
      .single()

    setSaving(false)
    if (err) { setError('Eroare la salvare: ' + err.message); return }
    handleClose()
    onCreated()
    if (data?.id) router.push(`/oferte/${data.id}`)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + Oferta noua
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Oferta noua</h2>
              <button
                onClick={handleClose}
                className="text-gray-600 hover:text-gray-900 text-xl leading-none font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Client */}
              <div ref={clientRef}>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Client <span className="text-red-500">*</span>
                </label>
                {clientSelectat ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-blue-500 rounded-lg bg-blue-50">
                    <span className="text-sm font-medium text-gray-900">{clientSelectat.denumire}</span>
                    <button
                      onClick={() => { setClientSelectat(null); setClientSearch('') }}
                      className="text-xs text-blue-600 hover:underline ml-3"
                    >
                      Schimba
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setShowClientList(true) }}
                      onFocus={() => setShowClientList(true)}
                      placeholder="Cauta client..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {showClientList && clienti.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {clienti.map(c => (
                          <button
                            key={c.id}
                            onClick={() => { setClientSelectat(c); setClientSearch(c.denumire); setShowClientList(false) }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 hover:text-blue-700"
                          >
                            {c.denumire}
                          </button>
                        ))}
                      </div>
                    )}
                    {showClientList && clientSearch.trim() && clienti.length === 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow px-3 py-2 text-sm text-gray-600">
                        Niciun client gasit.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Masina — doar daca clientul are masini */}
              {clientSelectat && masini.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">
                    Masina (optional)
                  </label>
                  <select
                    value={masinaId}
                    onChange={e => setMasinaId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Fara masina specificata —</option>
                    {masini.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.nr_inmatriculare || '—'}{m.marca ? ` · ${m.marca}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Necesar piese */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Necesar de piese <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={necesar}
                  onChange={e => setNecesar(e.target.value)}
                  rows={8}
                  placeholder="Ex: filtru ulei x2, curea distributie, kit ambreiaj..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Anuleaza
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {saving ? 'Se salveaza...' : 'Creeaza oferta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
