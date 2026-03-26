'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Furnizor {
  id: string
  denumire: string
  cod_fiscal: string | null
  localitate: string | null
  telefon: string | null
  ora_ridicare: string | null
  is_stoc_ct: boolean
}

export default function TabelFurnizori({ refresh }: { refresh: number }) {
  const [furnizori, setFurnizori] = useState<Furnizor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 50
  const router = useRouter()

  useEffect(() => { setPage(0) }, [search, refresh])

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)

    let query = supabase
      .from('furnizori')
      .select('id, denumire, cod_fiscal, localitate, telefon, ora_ridicare, is_stoc_ct')
      .order('is_stoc_ct', { ascending: false }) // Stoc CT primul
      .order('denumire')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (search.trim()) {
      query = query.or(`denumire.ilike.%${search}%,cod_fiscal.ilike.%${search}%,localitate.ilike.%${search}%`)
    }

    query.then(({ data }) => {
      setFurnizori(data ?? [])
      setLoading(false)
    })
  }, [page, search, refresh])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cauta dupa denumire, cod fiscal sau localitate..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-500 p-6">Se incarca...</p>
        ) : furnizori.length === 0 ? (
          <p className="text-sm text-gray-500 p-6">
            {search ? 'Niciun rezultat.' : 'Nu exista furnizori. Importa un fisier XLS.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Denumire</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Cod fiscal</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Localitate</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Telefon</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Ora ridicare</th>
                </tr>
              </thead>
              <tbody>
                {furnizori.map(f => (
                  <tr key={f.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      {f.is_stoc_ct ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                            Stoc CT
                          </span>
                        </span>
                      ) : (
                        <button
                          onClick={() => router.push(`/furnizori/${f.id}`)}
                          className="font-medium text-gray-900 hover:text-blue-600 hover:underline underline-offset-2 active:text-blue-800 transition-colors text-left cursor-pointer"
                        >
                          {f.denumire}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{f.cod_fiscal || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{f.localitate || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{f.telefon || '—'}</td>
                    <td className="px-4 py-2.5">
                      {f.is_stoc_ct ? (
                        <span className="text-xs text-gray-400 italic">fara ora</span>
                      ) : f.ora_ridicare ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                          🕐 {f.ora_ridicare.slice(0, 5)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && furnizori.length === pageSize && (
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
