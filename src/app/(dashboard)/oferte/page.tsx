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
  client_id: string | null
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

function defaultDeLa() {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  return d.toISOString().slice(0, 10)
}
function defaultPanaLa() {
  return new Date().toISOString().slice(0, 10)
}

export default function OferteP() {
  const [oferte, setOferte] = useState<Oferta[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [preluand, setPreluand] = useState<string | null>(null)
  const [selectate, setSelectate] = useState<Set<string>>(new Set())
  const [ofertePregate, setOfertePregate] = useState<Set<string>>(new Set())

  // Filtre
  const [filtruStatus, setFiltruStatus] = useState<string>('toate')
  const [filtruClient, setFiltruClient] = useState<string>('')
  const [filtruDeLa, setFiltruDeLa] = useState(defaultDeLa())
  const [filtruPanaLa, setFiltruPanaLa] = useState(defaultPanaLa())
  const [shortcutActiv, setShortcutActiv] = useState<string>('30 zile')

  const router = useRouter()

  useEffect(() => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('oferte')
      .select('id, status, necesar_piese, created_at, preluat_de, client_id, clienti(denumire), clienti_masini(nr_inmatriculare, marca)')
      .gte('created_at', filtruDeLa + 'T00:00:00')
      .lte('created_at', filtruPanaLa + 'T23:59:59')
      .order('created_at', { ascending: false })

    query.then(({ data }) => {
      const list = (data as unknown as Oferta[]) ?? []
      setOferte(list)
      setLoading(false)

      // Verificare stoc pentru ofertele confirmate
      const confirmate = list.filter(o => o.status === 'confirmata').map(o => o.id)
      if (!confirmate.length) { setOfertePregate(new Set()); return }

      supabase
        .from('oferte_produse')
        .select('oferta_id, produs_id, cod, cantitate')
        .in('oferta_id', confirmate)
        .then(async ({ data: produse }) => {
          if (!produse?.length) { setOfertePregate(new Set()); return }

          // Aduna toti produs_id si cod-uri unice
          const toateProdusIds = [...new Set(produse.filter(p => p.produs_id).map(p => p.produs_id as string))]
          const toateCoduri = [...new Set(produse.filter(p => !p.produs_id && p.cod).map(p => p.cod as string))]

          const orParts: string[] = []
          if (toateProdusIds.length) orParts.push(`produs_id.in.(${toateProdusIds.join(',')})`)
          if (toateCoduri.length) orParts.push(`produs_cod.in.(${toateCoduri.join(',')})`)
          if (!orParts.length) { setOfertePregate(new Set()); return }

          const { data: stocRows } = await supabase
            .from('stoc')
            .select('produs_id, produs_cod, cantitate')
            .or(orParts.join(','))

          // Construieste map stoc: produs_id sau cod → cantitate totala
          const stocMap: Record<string, number> = {}
          for (const row of stocRows ?? []) {
            const key = row.produs_id ?? row.produs_cod ?? ''
            if (key) stocMap[key] = (stocMap[key] ?? 0) + row.cantitate
          }

          // Per oferta: verifica daca TOATE produsele sunt acoperite de stoc
          const pregatite = new Set<string>()
          const perOferta: Record<string, typeof produse> = {}
          for (const p of produse) {
            if (!perOferta[p.oferta_id]) perOferta[p.oferta_id] = []
            perOferta[p.oferta_id].push(p)
          }

          for (const [ofertaId, linii] of Object.entries(perOferta)) {
            const toateAcoperite = linii.every(linie => {
              const key = linie.produs_id ?? linie.cod ?? ''
              return key && (stocMap[key] ?? 0) >= linie.cantitate
            })
            if (toateAcoperite) pregatite.add(ofertaId)
          }

          setOfertePregate(pregatite)
        })
    })
  }, [refresh, filtruDeLa, filtruPanaLa])

  // Aplicare filtre client + status (client-side dupa fetch)
  const oferteAfisate = useMemo(() => {
    return oferte.filter(o => {
      const matchStatus = filtruStatus === 'toate' || o.status === filtruStatus
      const matchClient = !filtruClient || o.clienti?.denumire?.toLowerCase().includes(filtruClient.toLowerCase())
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

  // Selectie cumulata
  const oferteSelectate = oferteAfisate.filter(o => selectate.has(o.id))
  const clientIdsSelectate = new Set(oferteSelectate.map(o => o.client_id))
  const acelsiClient = clientIdsSelectate.size <= 1
  const poateGeneraCumulat = oferteSelectate.length >= 2 && acelsiClient

  function toggleSelectie(id: string) {
    setSelectate(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function genereazaFacturaCumulata() {
    const ids = Array.from(selectate).join(',')
    router.push(`/facturare?oferta_ids=${ids}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Oferte</h2>
        <OfertaNoua onCreated={() => setRefresh(r => r + 1)} />
      </div>

      {/* Filtre */}
      <div className="space-y-3">
        {/* Perioada */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Perioadă:</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filtruDeLa}
              onChange={e => { setFiltruDeLa(e.target.value); setShortcutActiv('') }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">—</span>
            <input
              type="date"
              value={filtruPanaLa}
              onChange={e => { setFiltruPanaLa(e.target.value); setShortcutActiv('') }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* Scurtaturi perioada */}
          <div className="flex gap-1.5">
            {[
              { label: 'Azi', fn: () => { const t = new Date().toISOString().slice(0,10); setFiltruDeLa(t); setFiltruPanaLa(t) } },
              { label: '30 zile', fn: () => { const t = new Date(); const s = new Date(t); s.setDate(s.getDate()-29); setFiltruDeLa(s.toISOString().slice(0,10)); setFiltruPanaLa(t.toISOString().slice(0,10)) } },
              { label: 'Luna aceasta', fn: () => { const t = new Date(); const s = new Date(t.getFullYear(), t.getMonth(), 1); setFiltruDeLa(s.toISOString().slice(0,10)); setFiltruPanaLa(t.toISOString().slice(0,10)) } },
              { label: 'Luna trecută', fn: () => { const t = new Date(); const s = new Date(t.getFullYear(), t.getMonth()-1, 1); const e = new Date(t.getFullYear(), t.getMonth(), 0); setFiltruDeLa(s.toISOString().slice(0,10)); setFiltruPanaLa(e.toISOString().slice(0,10)) } },
            ].map(({ label, fn }) => (
              <button key={label} onClick={() => { fn(); setShortcutActiv(label) }}
                className={`px-2.5 py-1 text-xs border rounded-lg whitespace-nowrap transition-colors ${
                  shortcutActiv === label
                    ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                    : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Status + Client */}
        <div className="flex flex-wrap items-center gap-3">
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

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Client:</label>
            <input
              type="text"
              value={filtruClient}
              onChange={e => setFiltruClient(e.target.value)}
              placeholder="Caută client..."
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
            />
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
      </div>

      {/* Toolbar selectie cumulata */}
      {selectate.size > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl">
          <span className="text-sm font-medium text-purple-800">
            {selectate.size} {selectate.size === 1 ? 'ofertă selectată' : 'oferte selectate'}
          </span>
          {!acelsiClient && selectate.size >= 2 && (
            <span className="text-xs text-red-600 font-medium">⚠ Ofertele trebuie să fie de la același client</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSelectate(new Set())}
              className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Deselectează
            </button>
            <button
              onClick={genereazaFacturaCumulata}
              disabled={!poateGeneraCumulat}
              className="px-4 py-1.5 text-xs font-bold text-white rounded-lg disabled:opacity-40"
              style={{ backgroundColor: '#0f172a' }}
            >
              🧾 Generează factură cumulată
            </button>
          </div>
        </div>
      )}

      {/* Contor rezultate */}
      <p className="text-sm text-gray-500">
        {oferteAfisate.length} {oferteAfisate.length === 1 ? 'ofertă' : 'oferte'}
        {filtreleActive ? ` din ${oferte.length} în perioadă` : ' în perioadă'}
      </p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-600 p-6">Se incarca...</p>
        ) : oferteAfisate.length === 0 ? (
          <p className="text-sm text-gray-600 p-6">
            {filtreleActive ? 'Nicio ofertă cu filtrele selectate.' : 'Nicio ofertă în perioada selectată.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-4 py-3" />
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
                const ePregatita = o.status === 'confirmata' && ofertePregate.has(o.id)
                return (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/oferte/${o.id}`)}
                    className={`border-t border-gray-200 cursor-pointer transition-colors ${
                      ePregatita
                        ? 'bg-green-50 hover:bg-green-100'
                        : selectate.has(o.id)
                          ? 'bg-purple-50 hover:bg-purple-100'
                          : 'hover:bg-blue-50'
                    }`}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {o.status === 'confirmata' && (
                        <input
                          type="checkbox"
                          checked={selectate.has(o.id)}
                          onChange={() => toggleSelectie(o.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 accent-purple-600 cursor-pointer"
                        />
                      )}
                    </td>
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
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}
                          style={s.style ?? {}}
                        >
                          {s.label}
                        </span>
                        {ePregatita && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-600 text-white">
                            ✓ Pregătit
                          </span>
                        )}
                      </div>
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
