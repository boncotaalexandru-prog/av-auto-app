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
  is_favorit: boolean
  furnizori_ore: { ora: string }[]
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
      .select('id, denumire, cod_fiscal, localitate, telefon, is_favorit, furnizori_ore(ora)')
      .order('is_favorit', { ascending: false })
      .order('denumire')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (search.trim()) {
      query = query.or(`denumire.ilike.%${search}%,cod_fiscal.ilike.%${search}%,localitate.ilike.%${search}%`)
    }

    query.then(({ data }) => {
      setFurnizori((data as Furnizor[]) ?? [])
      setLoading(false)
    })
  }, [page, search, refresh])

  async function toggleFavorit(f: Furnizor) {
    const nou = !f.is_favorit
    setFurnizori(prev => prev.map(x => x.id === f.id ? { ...x, is_favorit: nou } : x))
    await createClient().from('furnizori').update({ is_favorit: nou }).eq('id', f.id)
  }

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
          <p className="text-sm text-gray-600 p-6">Se incarca...</p>
        ) : furnizori.length === 0 ? (
          <p className="text-sm text-gray-600 p-6">
            {search ? 'Niciun rezultat.' : 'Nu exista furnizori. Importa un fisier XLS.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="text-left px-4 py-3 text-gray-700 font-medium">Denumire</th>
                  <th className="text-left px-4 py-3 text-gray-700 font-medium">Cod fiscal</th>
                  <th className="text-left px-4 py-3 text-gray-700 font-medium">Localitate</th>
                  <th className="text-left px-4 py-3 text-gray-700 font-medium">Telefon</th>
                  <th className="text-left px-4 py-3 text-gray-700 font-medium">Ore ridicare</th>
                </tr>
              </thead>
              <tbody>
                {furnizori.map(f => {
                  const ore = [...(f.furnizori_ore ?? [])].sort((a, b) => a.ora.localeCompare(b.ora))
                  return (
                    <tr key={f.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => toggleFavorit(f)}
                          className="text-lg leading-none transition-transform hover:scale-110"
                          title={f.is_favorit ? 'Elimina din favorite' : 'Adauga la favorite'}
                        >
                          <span className={f.is_favorit ? 'text-yellow-400' : 'text-gray-900'}>
                            {f.is_favorit ? '★' : '☆'}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => router.push(`/furnizori/${f.id}`)}
                          className="font-medium text-gray-900 hover:text-blue-600 hover:underline underline-offset-2 active:text-blue-800 transition-colors text-left cursor-pointer"
                        >
                          {f.denumire}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 font-mono text-xs">{f.cod_fiscal || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{f.localitate || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{f.telefon || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="px-2 py-0.5 bg-orange-500 rounded text-xs font-semibold text-white">
                            Stoc CT
                          </span>
                          {ore.map((o, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-600 rounded text-xs font-semibold text-white">
                              {o.ora.slice(0, 5)}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
