'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OfertaNoua from '@/components/oferte/OfertaNoua'

interface Oferta {
  id: string
  status: string
  necesar_piese: string | null
  created_at: string
  preluat_de: string | null
  clienti: { denumire: string } | null
  clienti_masini: { nr_inmatriculare: string | null; marca: string | null } | null
}

const STATUS_LABEL: Record<string, { label: string; cls: string; style: React.CSSProperties }> = {
  draft:      { label: 'Oferta noua', cls: 'text-white font-semibold', style: { backgroundColor: '#16a34a' } },
  in_lucru:   { label: 'In lucru',    cls: 'text-white font-semibold', style: { backgroundColor: '#2563eb' } },
  finalizata: { label: 'Finalizata',  cls: 'text-white font-semibold', style: { backgroundColor: '#059669' } },
  confirmata: { label: 'Confirmata',  cls: 'text-white font-semibold', style: { backgroundColor: '#7c3aed' } },
  facturat:   { label: 'Facturat',    cls: 'text-white font-semibold', style: { backgroundColor: '#0f172a' } },
  anulata:    { label: 'Anulata',     cls: 'text-white font-semibold', style: { backgroundColor: '#dc2626' } },
}

// Cache la nivel de modul — persista intre navigari in aceeasi sesiune
let _cache: Oferta[] = []

export default function OferteP() {
  const [oferte, setOferte] = useState<Oferta[]>(_cache)
  const [loading, setLoading] = useState(_cache.length === 0)
  const [refresh, setRefresh] = useState(0)
  const [preluand, setPreluand] = useState<string | null>(null)

  // Filtre
  const [filtruStatus, setFiltruStatus] = useState<string>('toate')
  const [filtruClient, setFiltruClient] = useState<string>('')

  const router = useRouter()

  useEffect(() => {
    createClient()
      .from('oferte')
      .select('id, status, necesar_piese, created_at, preluat_de, clienti(denumire), clienti_masini(nr_inmatriculare, marca)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        const list = (data as Oferta[]) ?? []
        _cache = list
        setOferte(list)
        setLoading(false)
      })
  }, [refresh])

  // Lista unica de clienti pentru dropdown
  const clientiUnici = useMemo(() => {
    const set = new Map<string, string>()
    oferte.forEach(o => {
      if (o.clienti?.denumire) set.set(o.clienti.denumire, o.clienti.denumire)
    })
    return Array.from(set.values()).sort()
  }, [oferte])

  // Aplicare filtre
  const oferteAfisate = useMemo(() => {
    return oferte.filter(o => {
      const matchStatus = filtruStatus === 'toate' || o.status === filtruStatus
      const matchClient = !filtruClient || o.clienti?.denumire === filtruClient
      return matchStatus && matchClient
    })
  }, [oferte, filtruStatus, filtruClient])

  async function preiaOferta(e: React.MouseEvent, ofertaId: string) {
    e.stopPropagation()
    setPreluand(ofertaId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPreluand(null); return }

    await supabase.from('oferte').update({
      status: 'in_lucru',
      preluat_de: user.id,
      preluat_la: new Date().toISOString(),
    }).eq('id', ofertaId)

    setPreluand(null)
    router.push(`/oferte/${ofertaId}`)
  }

  const filtreleActive = filtruStatus !== 'toate' || filtruClient !== ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Oferte</h2>
        <OfertaNoua onCreated={() => setRefresh(r => r + 1)} />
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filtru status */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Status:</label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFiltruStatus('toate')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                filtruStatus === 'toate'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              Toate
            </button>
            {Object.entries(STATUS_LABEL).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setFiltruStatus(key === filtruStatus ? 'toate' : key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  filtruStatus === key ? 'border-transparent' : 'border-gray-200 opacity-60 hover:opacity-90'
                }`}
                style={filtruStatus === key ? { ...val.style, color: '#fff', borderColor: 'transparent' } : { backgroundColor: '#f3f4f6', color: '#374151' }}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtru client */}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Client:</label>
          <select
            value={filtruClient}
            onChange={e => setFiltruClient(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
          >
            <option value="">Toți clienții</option>
            {clientiUnici.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {filtreleActive && (
            <button
              onClick={() => { setFiltruStatus('toate'); setFiltruClient('') }}
              className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              ✕ Resetează
            </button>
          )}
        </div>
      </div>

      {/* Contor rezultate */}
      {filtreleActive && (
        <p className="text-sm text-gray-500">
          {oferteAfisate.length} {oferteAfisate.length === 1 ? 'ofertă' : 'oferte'} din {oferte.length} total
        </p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-600 p-6">Se incarca...</p>
        ) : oferteAfisate.length === 0 ? (
          <p className="text-sm text-gray-600 p-6">
            {filtreleActive ? 'Nicio ofertă cu filtrele selectate.' : 'Nicio oferta. Apasa "Oferta noua" pentru a incepe.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-700 font-medium">Client</th>
                <th className="text-left px-4 py-3 text-gray-700 font-medium">Masina</th>
                <th className="text-left px-4 py-3 text-gray-700 font-medium">Necesar</th>
                <th className="text-left px-4 py-3 text-gray-700 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-700 font-medium">Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {oferteAfisate.map(o => {
                const s = STATUS_LABEL[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-900', style: {} }
                return (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/oferte/${o.id}`)}
                    className="border-t border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {o.clienti?.denumire ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {o.clienti_masini
                        ? `${o.clienti_masini.nr_inmatriculare || ''}${o.clienti_masini.marca ? ' · ' + o.clienti_masini.marca : ''}`
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-900 max-w-xs truncate">
                      {o.necesar_piese || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}
                        style={s.style ?? {}}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 text-xs">
                      {new Date(o.created_at).toLocaleDateString('ro-RO')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.status === 'draft' && (
                        <button
                          onClick={e => preiaOferta(e, o.id)}
                          disabled={preluand === o.id}
                          className="px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 whitespace-nowrap transition-colors"
                        >
                          {preluand === o.id ? '...' : 'Preia oferta'}
                        </button>
                      )}
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
