'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Produs {
  id: string
  cod: string | null
  nume: string
  unitate: string | null
  producator: string | null
}

interface StocBatch {
  id: string
  cantitate: number
  pret_achizitie: number
  pret_lista: number | null
  furnizor_nume: string | null
  updated_at: string
}

type EventTip = 'nir' | 'oferta' | 'factura' | 'storno'

interface FeedEvent {
  _key: string
  tip: EventTip
  timestamp: string   // ISO cu timp, pentru sortare + afișare
  numar?: number
  entitate?: string
  cantitate: number
  pret_vanzare?: number
  pret_achizitie?: number
  link?: string
}

function formatData(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  const date = d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  // Dacă ora e 00:00, probabil e doar dată fără timp real
  return time === '00:00' ? date : `${date} · ${time}`
}

const TIP_CONFIG: Record<EventTip, { label: string; color: string; icon: string }> = {
  nir:     { label: 'Intrare stoc',  color: 'bg-emerald-100 text-emerald-800', icon: '📦' },
  oferta:  { label: 'Ofertă',        color: 'bg-blue-100 text-blue-800',       icon: '📋' },
  factura: { label: 'Facturat',      color: 'bg-gray-100 text-gray-800',       icon: '🧾' },
  storno:  { label: 'Stornat',       color: 'bg-purple-100 text-purple-800',   icon: '↩' },
}

export default function ProdusDetaliuPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [produs, setProdus] = useState<Produs | null>(null)
  const [stocBatches, setStocBatches] = useState<StocBatch[]>([])
  const [feed, setFeed] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const supabase = createClient()

    // Produs
    const { data: p } = await supabase.from('produse')
      .select('id, cod, nume, unitate, producator')
      .eq('id', id).single()
    if (!p) { setLoading(false); return }
    setProdus(p)

    // Filtre combinare: produs_id + cod (pentru nir_produse/stoc) și cod (pentru oferte/facturi)
    const orPartsNir = [`produs_id.eq.${id}`, ...(p.cod ? [`produs_cod.eq.${p.cod}`] : [])]
    const orPartsCod = [`produs_id.eq.${id}`, ...(p.cod ? [`cod.eq.${p.cod}`] : [])]

    // Toate query-urile în paralel — produs_id/cod + fallback pe nume
    const NIR_SEL  = 'id, created_at, cantitate, pret_achizitie, nir(id, numar, data_intrare, furnizor_nume)'
    const OF_SEL   = 'id, created_at, cantitate, pret_vanzare, oferte(id, numar, clienti(denumire))'
    const FP_SEL   = 'id, created_at, cantitate, pret_vanzare, pret_achizitie, facturi(id, numar, data_emitere, tip, clienti(denumire))'

    const [stocRes, nirA, nirB, ofA, ofB, fpA, fpB] = await Promise.all([
      // Stoc curent
      supabase.from('stoc').select('id, cantitate, pret_achizitie, pret_lista, furnizor_nume, updated_at')
        .or(orPartsNir.join(',')).gt('cantitate', 0).order('updated_at', { ascending: false }),
      // NIR — prin produs_id / cod
      supabase.from('nir_produse').select(NIR_SEL).or(orPartsNir.join(',')),
      // NIR — fallback prin nume produs
      supabase.from('nir_produse').select(NIR_SEL).eq('produs_nume', p.nume),
      // Oferte — prin produs_id / cod
      supabase.from('oferte_produse').select(OF_SEL).or(orPartsCod.join(',')),
      // Oferte — fallback prin nume produs
      supabase.from('oferte_produse').select(OF_SEL).eq('nume_produs', p.nume),
      // Facturi — prin produs_id / cod
      supabase.from('facturi_produse').select(FP_SEL).or(orPartsCod.join(',')),
      // Facturi — fallback prin nume produs
      supabase.from('facturi_produse').select(FP_SEL).eq('nume_produs', p.nume),
    ])

    setStocBatches((stocRes.data ?? []) as StocBatch[])

    // Merge + deduplicare pe id pentru fiecare tabel
    function mergeUnique<T extends { id: string }>(a: T[] | null, b: T[] | null): T[] {
      const seen = new Set<string>()
      return [...(a ?? []), ...(b ?? [])].filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
    }

    const nirRows = mergeUnique(nirA.data, nirB.data)
    const ofRows  = mergeUnique(ofA.data, ofB.data)
    const fpRows  = mergeUnique(fpA.data, fpB.data)

    const events: FeedEvent[] = []

    // NIR intrări
    for (const np of nirRows) {
      const nir = Array.isArray(np.nir) ? np.nir[0] : (np.nir as { id: string; numar: number; data_intrare: string; furnizor_nume: string | null } | null)
      events.push({
        _key: `nir-${np.id}`,
        tip: 'nir',
        timestamp: np.created_at ?? nir?.data_intrare ?? '',
        numar: nir?.numar,
        entitate: nir?.furnizor_nume ?? undefined,
        cantitate: np.cantitate,
        pret_achizitie: np.pret_achizitie,
        link: nir?.id ? `/gestiune/nir/${nir.id}` : undefined,
      })
    }

    // Oferte
    for (const op of ofRows) {
      const of = Array.isArray(op.oferte) ? op.oferte[0] : (op.oferte as { id: string; numar: number; clienti: { denumire: string } | { denumire: string }[] | null } | null)
      const client = of?.clienti ? (Array.isArray(of.clienti) ? of.clienti[0] : of.clienti) : null
      events.push({
        _key: `oferta-${op.id}`,
        tip: 'oferta',
        timestamp: op.created_at ?? '',
        numar: of?.numar,
        entitate: (client as { denumire: string } | null)?.denumire,
        cantitate: op.cantitate,
        pret_vanzare: op.pret_vanzare,
        link: of?.id ? `/oferte/${of.id}` : undefined,
      })
    }

    // Facturi (normale + storno)
    for (const fp of fpRows) {
      const f = Array.isArray(fp.facturi) ? fp.facturi[0] : (fp.facturi as { id: string; numar: number; data_emitere: string; tip: string; clienti: { denumire: string } | { denumire: string }[] | null } | null)
      const client = f?.clienti ? (Array.isArray(f.clienti) ? f.clienti[0] : f.clienti) : null
      const isStorno = f?.tip === 'storno'
      events.push({
        _key: `factura-${fp.id}`,
        tip: isStorno ? 'storno' : 'factura',
        timestamp: fp.created_at ?? f?.data_emitere ?? '',
        numar: f?.numar,
        entitate: (client as { denumire: string } | null)?.denumire,
        cantitate: Math.abs(fp.cantitate),
        pret_vanzare: fp.pret_vanzare,
        pret_achizitie: fp.pret_achizitie,
        link: f?.id ? `/facturare/${f.id}` : undefined,
      })
    }

    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    setFeed(events)
    setLoading(false)
  }

  if (loading) return <div className="text-sm text-gray-600 p-8">Se încarcă...</div>
  if (!produs) return <div className="text-sm text-red-700 p-8">Produsul nu a fost găsit.</div>

  const stocTotal = stocBatches.reduce((s, b) => s + b.cantitate, 0)
  const valoareStoc = stocBatches.reduce((s, b) => s + b.cantitate * b.pret_achizitie, 0)

  const nrOferte  = feed.filter(e => e.tip === 'oferta').length
  const nrFacturi = feed.filter(e => e.tip === 'factura').length
  const nrNir     = feed.filter(e => e.tip === 'nir').length
  const totalVandut = feed.filter(e => e.tip === 'factura').reduce((s, e) => s + e.cantitate, 0)
  const totalIntrat = feed.filter(e => e.tip === 'nir').reduce((s, e) => s + e.cantitate, 0)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/produse')} className="text-sm text-gray-700 hover:text-gray-900 font-medium">
          ← Înapoi la produse
        </button>
        <span className="text-gray-300">|</span>
        <h2 className="text-2xl font-bold text-gray-900">{produs.nume}</h2>
        {produs.cod && (
          <span className="font-mono text-sm bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{produs.cod}</span>
        )}
      </div>

      {/* Card produs */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 md:grid-cols-4 gap-5">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Producător</p>
          <p className="font-semibold text-gray-900">{produs.producator || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Unitate măsură</p>
          <p className="font-semibold text-gray-900">{produs.unitate || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Preț listă</p>
          <p className="font-bold text-gray-900">{produs.pret != null ? `${produs.pret} RON` : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Stoc disponibil</p>
          <p className={`font-bold text-xl ${stocTotal > 0 ? 'text-green-700' : 'text-red-600'}`}>
            {stocTotal} <span className="text-sm font-normal text-gray-500">{produs.unitate || 'buc'}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Valoare stoc</p>
          <p className="font-bold text-gray-900">{valoareStoc.toFixed(2)} <span className="text-xs font-normal text-gray-500">RON</span></p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Total intrat (NIR)</p>
          <p className="font-semibold text-gray-900">{totalIntrat} {produs.unitate || 'buc'} · {nrNir} NIR</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Total vândut</p>
          <p className="font-semibold text-gray-900">{totalVandut} {produs.unitate || 'buc'} · {nrFacturi} facturi</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Oferte emise</p>
          <p className="font-semibold text-gray-900">{nrOferte} oferte</p>
        </div>
      </div>

      {/* Loturi stoc */}
      {stocBatches.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Loturi în stoc ({stocBatches.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-700">Furnizor</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Cantitate</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Preț achiziție</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Preț listă</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Valoare lot</th>
              </tr>
            </thead>
            <tbody>
              {stocBatches.map(b => (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 text-gray-900">{b.furnizor_nume || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{b.cantitate} {produs.unitate || 'buc'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-900">{b.pret_achizitie.toFixed(2)} RON</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{b.pret_lista != null ? `${b.pret_lista.toFixed(2)} RON` : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{(b.cantitate * b.pret_achizitie).toFixed(2)} RON</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Feed activitate */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            Activitate
            {feed.length > 0 && <span className="ml-2 font-normal text-gray-500">({feed.length} evenimente)</span>}
          </h3>
        </div>

        {feed.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-500">
            <p className="text-3xl mb-2">📭</p>
            <p>Nicio activitate înregistrată pentru acest produs.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {feed.map(ev => {
              const cfg = TIP_CONFIG[ev.tip]
              const total = ev.pret_vanzare != null ? ev.cantitate * ev.pret_vanzare : null
              const adaos = ev.tip === 'factura' && ev.pret_achizitie && ev.pret_vanzare && ev.pret_achizitie > 0
                ? ((ev.pret_vanzare - ev.pret_achizitie) / ev.pret_achizitie) * 100
                : null

              return (
                <div key={ev._key} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                  {/* Badge tip */}
                  <div className="flex-shrink-0 pt-0.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  {/* Detalii */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ev.numar != null && (
                        <span className="font-mono font-bold text-gray-900">#{ev.numar}</span>
                      )}
                      {ev.entitate && (
                        <span className="text-sm text-gray-800 font-medium">{ev.entitate}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-sm">
                      <span className={`font-semibold ${ev.tip === 'storno' ? 'text-purple-700' : 'text-gray-900'}`}>
                        {ev.tip === 'storno' ? '-' : '+'}{ev.cantitate} {produs.unitate || 'buc'}
                      </span>

                      {ev.tip === 'nir' && ev.pret_achizitie != null && (
                        <span className="text-gray-600">
                          ach: <strong className="text-gray-900">{ev.pret_achizitie.toFixed(2)} RON/buc</strong>
                          {' '}· total: <strong>{(ev.cantitate * ev.pret_achizitie).toFixed(2)} RON</strong>
                        </span>
                      )}

                      {(ev.tip === 'oferta' || ev.tip === 'factura' || ev.tip === 'storno') && ev.pret_vanzare != null && (
                        <span className="text-gray-600">
                          preț: <strong className="text-gray-900">{ev.pret_vanzare.toFixed(2)} RON/buc</strong>
                          {total != null && <> · total: <strong>{total.toFixed(2)} RON</strong></>}
                        </span>
                      )}

                      {adaos != null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${adaos >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {adaos >= 0 ? '+' : ''}{adaos.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Data + link */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    {ev.timestamp && (
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatData(ev.timestamp)}
                      </span>
                    )}
                    {ev.link && (
                      <button onClick={() => router.push(ev.link!)}
                        className="text-xs text-blue-600 hover:underline font-medium">
                        Vezi →
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
