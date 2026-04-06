'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import ProdusNouModal from './ProdusNouModal'

interface EchivalentProdus {
  id: string
  cod: string | null
  nume: string
  producator: string | null
  unitate: string | null
  stoc: number
}

interface CatalogProdus {
  id: string
  cod: string | null
  nume: string
  producator: string | null
  grup_echivalente_id: string | null
}

interface Props {
  produsId: string | null
  grupEchivalenteId: string | null
  ofertaProdusId: string
  isEditMode: boolean
  onRefresh: () => void
  onGrupChanged: (newGrupId: string) => void
}

function ShuffleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  )
}

export default function EchivalentePopover({
  produsId,
  grupEchivalenteId: initialGrupId,
  ofertaProdusId,
  isEditMode,
  onRefresh,
  onGrupChanged,
}: Props) {
  const [open, setOpen] = useState(false)
  const [localGrupId, setLocalGrupId] = useState<string | null>(initialGrupId)
  const [echivalente, setEchivalente] = useState<EchivalentProdus[]>([])
  const [loadingEch, setLoadingEch] = useState(false)
  const [folosind, setFolosind] = useState<string | null>(null)
  const [cautare, setCautare] = useState('')
  const [cautareResults, setCautareResults] = useState<CatalogProdus[]>([])
  const [adaugand, setAdaugand] = useState<string | null>(null)
  const [modalProdusNou, setModalProdusNou] = useState(false)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const localGrupRef = useRef(localGrupId)
  localGrupRef.current = localGrupId

  useEffect(() => { setLocalGrupId(initialGrupId) }, [initialGrupId])

  const loadEchivalente = useCallback(async (grupId: string | null) => {
    if (!grupId || !produsId) { setEchivalente([]); return }
    setLoadingEch(true)
    const supabase = createClient()
    const { data } = await supabase.from('produse')
      .select('id, cod, nume, producator, unitate')
      .eq('grup_echivalente_id', grupId)
      .neq('id', produsId)

    if (!data?.length) { setEchivalente([]); setLoadingEch(false); return }

    const ids = data.map(p => p.id)
    const cods = data.filter(p => p.cod).map(p => p.cod as string)
    const orParts = [`produs_id.in.(${ids.join(',')})`]
    if (cods.length) orParts.push(`produs_cod.in.(${cods.join(',')})`)
    const { data: stocData } = await supabase.from('stoc')
      .select('produs_id, produs_cod, cantitate').or(orParts.join(','))

    const stocMap: Record<string, number> = {}
    for (const row of stocData ?? []) {
      const key = row.produs_id ?? row.produs_cod ?? ''
      if (key) stocMap[key] = (stocMap[key] ?? 0) + row.cantitate
    }

    setEchivalente(data.map(p => ({
      ...p,
      stoc: stocMap[p.id] ?? (p.cod ? (stocMap[p.cod] ?? 0) : 0),
    })))
    setLoadingEch(false)
  }, [produsId])

  // Initial load for icon color
  useEffect(() => {
    if (localGrupId && produsId) loadEchivalente(localGrupId)
  }, [localGrupId, produsId, loadEchivalente])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Search existing products
  useEffect(() => {
    if (!cautare.trim()) { setCautareResults([]); return }
    const supabase = createClient()
    const excludeIds = new Set([produsId ?? '', ...echivalente.map(e => e.id)])
    supabase.from('produse')
      .select('id, cod, nume, producator, grup_echivalente_id')
      .or(`nume.ilike.%${cautare}%,cod.ilike.%${cautare}%`)
      .limit(10)
      .then(({ data }) =>
        setCautareResults((data ?? []).filter((p: CatalogProdus) => !excludeIds.has(p.id)))
      )
  }, [cautare, produsId, echivalente])

  if (!produsId) return null

  const areInStock = echivalente.some(e => e.stoc > 0)
  const hasEquivalents = echivalente.length > 0

  let btnColor = '#d1d5db' // gray — no equivalents
  if (!loadingEch && hasEquivalents) btnColor = areInStock ? '#16a34a' : '#ea580c'

  function openPopover() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPopoverPos({
        top: rect.bottom + window.scrollY + 4,
        left: Math.min(rect.left + window.scrollX, window.innerWidth - 440),
      })
    }
    setOpen(o => !o)
  }

  async function foloseste(echiv: EchivalentProdus) {
    if (!isEditMode) return
    setFolosind(echiv.id)
    await createClient().from('oferte_produse').update({
      produs_id: echiv.id,
      nume_produs: echiv.nume,
      cod: echiv.cod,
      producator: echiv.producator,
      unitate: echiv.unitate ?? undefined,
    }).eq('id', ofertaProdusId)
    setFolosind(null)
    setOpen(false)
    onRefresh()
  }

  async function adaugaEchivalent(altProdusId: string) {
    if (!produsId) return
    setAdaugand(altProdusId)
    const supabase = createClient()

    const { data: altProds } = await supabase.from('produse')
      .select('grup_echivalente_id').eq('id', altProdusId).single()
    const altGrupId = altProds?.grup_echivalente_id ?? null
    let grupId = localGrupRef.current

    if (!grupId && !altGrupId) {
      const { data: newGrup, error: errGrup } = await supabase.from('echivalente_grupuri')
        .insert({ created_at: new Date().toISOString() }).select('id').single()
      if (errGrup || !newGrup) { setAdaugand(null); return }
      grupId = newGrup.id
      await supabase.from('produse').update({ grup_echivalente_id: grupId }).in('id', [produsId, altProdusId])
    } else if (!grupId) {
      grupId = altGrupId!
      await supabase.from('produse').update({ grup_echivalente_id: grupId }).eq('id', produsId)
    } else if (!altGrupId) {
      await supabase.from('produse').update({ grup_echivalente_id: grupId }).eq('id', altProdusId)
    } else if (altGrupId !== grupId) {
      await supabase.from('produse').update({ grup_echivalente_id: grupId }).eq('grup_echivalente_id', altGrupId)
      await supabase.from('echivalente_grupuri').delete().eq('id', altGrupId)
    }

    setAdaugand(null)
    setCautare('')
    setCautareResults([])

    if (grupId && grupId !== localGrupRef.current) {
      setLocalGrupId(grupId)
      onGrupChanged(grupId)
    }

    await loadEchivalente(grupId)
  }

  async function produsNouSalvat(p: { id: string; cod: string | null; nume: string; producator: string | null; unitate: string | null; pret: number | null }) {
    setModalProdusNou(false)
    await adaugaEchivalent(p.id)
  }

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={openPopover}
        className="p-1 rounded transition-colors hover:bg-gray-100 shrink-0"
        style={{ color: btnColor }}
        title={hasEquivalents
          ? `${echivalente.length} produs${echivalente.length === 1 ? '' : 'e'} echivalente${areInStock ? ' (pe stoc)' : ' (fara stoc)'}`
          : 'Echivalente (niciun grup)'}
      >
        <ShuffleIcon />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{ position: 'absolute', top: popoverPos.top, left: popoverPos.left, zIndex: 9999 }}
          className="bg-white rounded-xl border border-gray-200 shadow-2xl w-96"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Produse echivalente</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm">✕</button>
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {loadingEch ? (
              <p className="px-4 py-3 text-xs text-gray-400">Se incarca...</p>
            ) : echivalente.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-400 italic">Niciun produs echivalent. Adaugă mai jos.</p>
            ) : echivalente.map(e => (
              <div key={e.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{e.nume}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    {e.producator && <span>{e.producator}</span>}
                    {e.cod && <span className="font-mono text-blue-700">{e.cod}</span>}
                    <span style={{ color: e.stoc > 0 ? '#16a34a' : '#9ca3af' }} className="font-medium">
                      {e.stoc > 0 ? `Stoc: ${e.stoc}` : 'Lipsă stoc'}
                    </span>
                  </div>
                </div>
                {isEditMode && (
                  <button
                    onClick={() => foloseste(e)}
                    disabled={!!folosind}
                    className="shrink-0 px-3 py-1 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    {folosind === e.id ? '...' : 'Folosește'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add equivalent */}
          {isEditMode && (
            <div className="px-4 py-3 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-700">Adaugă echivalent din catalog</p>
              <div className="relative">
                <input
                  type="text"
                  value={cautare}
                  onChange={e => setCautare(e.target.value)}
                  placeholder="Caută după nume sau cod..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
                {cautareResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10 max-h-40 overflow-y-auto">
                    {cautareResults.map(r => (
                      <button
                        key={r.id}
                        onClick={() => adaugaEchivalent(r.id)}
                        disabled={adaugand === r.id}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between border-b last:border-b-0 border-gray-100 disabled:opacity-50"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-gray-900 block truncate">
                            {r.nume}
                            {r.cod && <span className="ml-1.5 font-mono text-gray-900 font-normal">{r.cod}</span>}
                          </span>
                          {r.producator && <span className="text-gray-900 text-xs">{r.producator}</span>}
                        </div>
                        <span className="text-blue-600 font-medium shrink-0 ml-2">
                          {adaugand === r.id ? '...' : 'Adaugă'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => { setCautare(''); setOpen(false); setModalProdusNou(true) }}
                className="w-full text-xs text-blue-700 border border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 font-medium transition-colors"
              >
                + Produs nou în catalog
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {modalProdusNou && (
        <ProdusNouModal
          open={modalProdusNou}
          onClose={() => setModalProdusNou(false)}
          onSaved={produsNouSalvat}
        />
      )}
    </div>
  )
}
