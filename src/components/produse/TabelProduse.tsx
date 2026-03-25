'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Produs {
  id: string
  cod: string | null
  nume: string
  pret: number | null
  unitate: string | null
  producator: string | null
}

interface EditRow {
  id: string
  pret: string
  producator: string
}

export default function TabelProduse({ refresh }: { refresh: number }) {
  const [produse, setProduse] = useState<Produs[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EditRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)
  const pageSize = 50

  useEffect(() => {
    setPage(0)
  }, [search, refresh])

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)

    let query = supabase
      .from('produse')
      .select('id, cod, nume, pret, unitate, producator', { count: 'exact' })
      .order('nume')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (search.trim()) {
      query = query.or(`nume.ilike.%${search}%,cod.ilike.%${search}%,producator.ilike.%${search}%`)
    }

    query.then(({ data }) => {
      setProduse(data ?? [])
      setLoading(false)
    })
  }, [page, search, refresh])

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('produse').update({
      pret: editing.pret ? parseFloat(editing.pret) : null,
      producator: editing.producator || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editing.id)
    setSaving(false)
    setEditing(null)
    // Refresh row
    const { data } = await supabase.from('produse').select('id,cod,nume,pret,unitate,producator').eq('id', editing.id).single()
    if (data) setProduse(prev => prev.map(p => p.id === data.id ? data : p))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cauta dupa nume, cod sau producator..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-500 p-6">Se incarca...</p>
        ) : produse.length === 0 ? (
          <p className="text-sm text-gray-500 p-6">
            {search ? 'Niciun rezultat.' : 'Nu exista produse. Importa un fisier XLS.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Cod</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Denumire</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Producator</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">UM</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Pret</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {produse.map(p => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{p.cod || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-900">{p.nume}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {editing?.id === p.id ? (
                        <input
                          type="text"
                          value={editing.producator}
                          onChange={e => setEditing({ ...editing, producator: e.target.value })}
                          className="w-full px-2 py-1 border border-blue-400 rounded text-sm text-gray-900"
                          placeholder="Producator"
                        />
                      ) : (
                        p.producator || <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{p.unitate || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {editing?.id === p.id ? (
                        <input
                          type="number"
                          value={editing.pret}
                          onChange={e => setEditing({ ...editing, pret: e.target.value })}
                          className="w-24 px-2 py-1 border border-blue-400 rounded text-sm text-gray-900"
                          placeholder="0.00"
                          step="0.01"
                        />
                      ) : (
                        p.pret != null ? `${p.pret} RON` : <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editing?.id === p.id ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving ? '...' : 'Salveaza'}
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="text-xs border border-gray-300 px-3 py-1 rounded text-gray-600 hover:bg-gray-50"
                          >
                            Anuleaza
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditing({ id: p.id, pret: p.pret?.toString() ?? '', producator: p.producator ?? '' })}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Editeaza
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && produse.length === pageSize && (
        <div className="flex justify-center gap-3">
          {page > 0 && (
            <button onClick={() => setPage(p => p - 1)} className="text-sm text-blue-600 hover:underline">
              ← Anterioara
            </button>
          )}
          <button onClick={() => setPage(p => p + 1)} className="text-sm text-blue-600 hover:underline">
            Urmatoarea →
          </button>
        </div>
      )}
    </div>
  )
}
