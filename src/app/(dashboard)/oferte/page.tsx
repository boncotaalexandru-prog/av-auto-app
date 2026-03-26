'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OfertaNoua from '@/components/oferte/OfertaNoua'

interface Oferta {
  id: string
  status: string
  necesar_piese: string | null
  created_at: string
  clienti: { denumire: string } | null
  clienti_masini: { nr_inmatriculare: string | null; marca: string | null } | null
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft:       { label: 'Draft',       cls: 'bg-gray-100 text-gray-700' },
  trimisa:     { label: 'Trimisa',     cls: 'bg-blue-100 text-blue-700' },
  confirmata:  { label: 'Confirmata',  cls: 'bg-green-100 text-green-700' },
  finalizata:  { label: 'Finalizata',  cls: 'bg-purple-100 text-purple-700' },
  anulata:     { label: 'Anulata',     cls: 'bg-red-100 text-red-700' },
}

export default function OferteP() {
  const [oferte, setOferte] = useState<Oferta[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const router = useRouter()

  useEffect(() => {
    createClient()
      .from('oferte')
      .select('id, status, necesar_piese, created_at, clienti(denumire), clienti_masini(nr_inmatriculare, marca)')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setOferte((data as Oferta[]) ?? [])
        setLoading(false)
      })
  }, [refresh])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Oferte</h2>
        <OfertaNoua onCreated={() => setRefresh(r => r + 1)} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-600 p-6">Se incarca...</p>
        ) : oferte.length === 0 ? (
          <p className="text-sm text-gray-600 p-6">Nicio oferta. Apasa &quot;Oferta noua&quot; pentru a incepe.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-700 font-medium">Client</th>
                <th className="text-left px-4 py-3 text-gray-700 font-medium">Masina</th>
                <th className="text-left px-4 py-3 text-gray-700 font-medium">Necesar</th>
                <th className="text-left px-4 py-3 text-gray-700 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-700 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {oferte.map(o => {
                const s = STATUS_LABEL[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-700' }
                return (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/oferte/${o.id}`)}
                    className="border-t border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {o.clienti?.denumire ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {o.clienti_masini
                        ? `${o.clienti_masini.nr_inmatriculare || ''}${o.clienti_masini.marca ? ' · ' + o.clienti_masini.marca : ''}`
                        : <span className="text-gray-600">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                      {o.necesar_piese || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {new Date(o.created_at).toLocaleDateString('ro-RO')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
