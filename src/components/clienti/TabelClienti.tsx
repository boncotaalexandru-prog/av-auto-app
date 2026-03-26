'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Client {
  id: string
  denumire: string
  cod_fiscal: string | null
  localitate: string | null
  judet: string | null
  telefon: string | null
  email: string | null
  are_contract: boolean
}

export default function TabelClienti({ refresh }: { refresh: number }) {
  const [clienti, setClienti] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 50
  const router = useRouter()

  useEffect(() => {
    setPage(0)
  }, [search, refresh])

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)

    let query = supabase
      .from('clienti')
      .select('id, denumire, cod_fiscal, localitate, judet, telefon, email, are_contract')
      .order('denumire')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (search.trim()) {
      query = query.or(
        `denumire.ilike.%${search}%,cod_fiscal.ilike.%${search}%,localitate.ilike.%${search}%`
      )
    }

    query.then(({ data }) => {
      setClienti(data ?? [])
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
        ) : clienti.length === 0 ? (
          <p className="text-sm text-gray-500 p-6">
            {search ? 'Niciun rezultat.' : 'Nu exista clienti. Importa un fisier XLS.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Denumire</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Cod fiscal</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Localitate</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Judet</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Telefon</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Contract</th>
                </tr>
              </thead>
              <tbody>
                {clienti.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/clienti/${c.id}`)}
                    className="border-t border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 text-gray-900 font-medium">{c.denumire}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{c.cod_fiscal || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{c.localitate || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{c.judet || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{c.telefon || '—'}</td>
                    <td className="px-4 py-2.5">
                      {c.are_contract ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Da
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Nu
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && clienti.length === pageSize && (
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
