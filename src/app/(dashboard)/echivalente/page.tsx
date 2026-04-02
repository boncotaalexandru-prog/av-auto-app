'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProdusNouModal from '@/components/produse/ProdusNouModal'

interface ProdusInGrup {
  id: string
  cod: string | null
  nume: string
  producator: string | null
  unitate: string | null
  stoc: number
}

interface Grup {
  id: string
  produse: ProdusInGrup[]
}

interface CatalogProdus {
  id: string
  cod: string | null
  nume: string
  producator: string | null
  grup_echivalente_id: string | null
}

export default function EchivalentePage() {
  const [grupuri, setGrupuri] = useState<Grup[]>([])
  const [loading, setLoading] = useState(true)
  const [cautare, setCautare] = useState('')
  const [cautareResults, setCautareResults] = useState<CatalogProdus[]>([])
  const [cautareNouGrup, setCautareNouGrup] = useState('')
  const [cautareNouGrupResults, setCautareNouGrupResults] = useState<CatalogProdus[]>([])
  const [selectateNouGrup, setSelectateNouGrup] = useState<CatalogProdus[]>([])
  const [creandGrup, setCreandGrup] = useState(false)
  const [adaugandLaGrup, setAdaugandLaGrup] = useState<string | null>(null)
  const [cautareAdauga, setCautareAdauga] = useState<Record<string, string>>({})
  const [cautareAdaugaResults, setCautareAdaugaResults] = useState<Record<string, CatalogProdus[]>>({})
  const [stergand, setStergand] = useState<string | null>(null)
  const [modalProdusNou, setModalProdusNou] = useState<string | null>(null) // grupId sau 'nou'

  const loadGrupuri = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: produse } = await supabase
      .from('produse')
      .select('id, cod, nume, producator, unitate, grup_echivalente_id')
      .not('grup_echivalente_id', 'is', null)
      .order('nume')

    if (!produse?.length) { setGrupuri([]); setLoading(false); return }

    // Stoc
    const ids = produse.map(p => p.id)
    const cods = produse.filter(p => p.cod).map(p => p.cod as string)
    const orParts = [`produs_id.in.(${ids.join(',')})`]
    if (cods.length) orParts.push(`produs_cod.in.(${cods.join(',')})`)
    const { data: stocData } = await supabase.from('stoc')
      .select('produs_id, produs_cod, cantitate').or(orParts.join(','))
    const stocMap: Record<string, number> = {}
    for (const row of stocData ?? []) {
      const key = row.produs_id ?? row.produs_cod ?? ''
      if (key) stocMap[key] = (stocMap[key] ?? 0) + row.cantitate
    }

    // Group by grup_echivalente_id
    const map = new Map<string, ProdusInGrup[]>()
    for (const p of produse) {
      const gid = p.grup_echivalente_id!
      if (!map.has(gid)) map.set(gid, [])
      map.get(gid)!.push({
        id: p.id,
        cod: p.cod,
        nume: p.nume,
        producator: p.producator,
        unitate: p.unitate,
        stoc: stocMap[p.id] ?? (p.cod ? (stocMap[p.cod] ?? 0) : 0),
      })
    }

    setGrupuri(Array.from(map.entries()).map(([id, ps]) => ({ id, produse: ps })))
    setLoading(false)
  }, [])

  useEffect(() => { loadGrupuri() }, [loadGrupuri])

  // Search for adding to existing group
  useEffect(() => {
    if (!cautare.trim() || !adaugandLaGrup) { setCautareResults([]); return }
    const grupCurent = grupuri.find(g => g.id === adaugandLaGrup)
    const excludeIds = new Set(grupCurent?.produse.map(p => p.id) ?? [])
    createClient().from('produse')
      .select('id, cod, nume, producator, grup_echivalente_id')
      .or(`nume.ilike.%${cautare}%,cod.ilike.%${cautare}%`)
      .limit(10)
      .then(({ data }) => setCautareResults((data ?? []).filter((p: CatalogProdus) => !excludeIds.has(p.id))))
  }, [cautare, adaugandLaGrup, grupuri])

  // Search for new group
  useEffect(() => {
    if (!cautareNouGrup.trim()) { setCautareNouGrupResults([]); return }
    const excludeIds = new Set(selectateNouGrup.map(p => p.id))
    createClient().from('produse')
      .select('id, cod, nume, producator, grup_echivalente_id')
      .or(`nume.ilike.%${cautareNouGrup}%,cod.ilike.%${cautareNouGrup}%`)
      .limit(10)
      .then(({ data }) => setCautareNouGrupResults((data ?? []).filter((p: CatalogProdus) => !excludeIds.has(p.id))))
  }, [cautareNouGrup, selectateNouGrup])

  // Search for adding to existing group (per-group search)
  useEffect(() => {
    const entries = Object.entries(cautareAdauga)
    if (!entries.length) return
    for (const [grupId, q] of entries) {
      if (!q.trim()) { setCautareAdaugaResults(prev => ({ ...prev, [grupId]: [] })); continue }
      const grupCurent = grupuri.find(g => g.id === grupId)
      const excludeIds = new Set(grupCurent?.produse.map(p => p.id) ?? [])
      createClient().from('produse')
        .select('id, cod, nume, producator, grup_echivalente_id')
        .or(`nume.ilike.%${q}%,cod.ilike.%${q}%`)
        .limit(8)
        .then(({ data }) => setCautareAdaugaResults(prev => ({
          ...prev,
          [grupId]: (data ?? []).filter((p: CatalogProdus) => !excludeIds.has(p.id)),
        })))
    }
  }, [cautareAdauga, grupuri])

  async function scoateDinGrup(produsId: string, grupId: string) {
    setStergand(produsId)
    const supabase = createClient()
    const grup = grupuri.find(g => g.id === grupId)

    await supabase.from('produse').update({ grup_echivalente_id: null }).eq('id', produsId)

    // Dacă rămâne un singur produs, îl scoatem și pe el și ștergem grupul
    if (grup && grup.produse.length <= 2) {
      const ramas = grup.produse.find(p => p.id !== produsId)
      if (ramas) await supabase.from('produse').update({ grup_echivalente_id: null }).eq('id', ramas.id)
      await supabase.from('echivalente_grupuri').delete().eq('id', grupId)
    }

    setStergand(null)
    await loadGrupuri()
  }

  async function adaugaLaGrupExistent(produs: CatalogProdus, grupId: string) {
    const supabase = createClient()
    const altGrupId = produs.grup_echivalente_id

    if (!altGrupId) {
      await supabase.from('produse').update({ grup_echivalente_id: grupId }).eq('id', produs.id)
    } else if (altGrupId !== grupId) {
      // Merge: muta toate produsele din altGrupId in grupId
      await supabase.from('produse').update({ grup_echivalente_id: grupId }).eq('grup_echivalente_id', altGrupId)
      await supabase.from('echivalente_grupuri').delete().eq('id', altGrupId)
    }

    setCautareAdauga(prev => ({ ...prev, [grupId]: '' }))
    setCautareAdaugaResults(prev => ({ ...prev, [grupId]: [] }))
    await loadGrupuri()
  }

  async function creeazaGrupNou() {
    if (selectateNouGrup.length < 2) return
    setCreandGrup(true)
    const supabase = createClient()

    // Gasim daca vreunul are deja un grup
    const cuGrup = selectateNouGrup.find(p => p.grup_echivalente_id)
    let grupId: string

    if (cuGrup?.grup_echivalente_id) {
      grupId = cuGrup.grup_echivalente_id
    } else {
      const { data, error } = await supabase.from('echivalente_grupuri')
        .insert({ created_at: new Date().toISOString() }).select('id').single()
      if (error || !data) {
        alert('Eroare creare grup: ' + (error?.message ?? 'null data'))
        setCreandGrup(false)
        return
      }
      grupId = data.id
    }

    const ids = selectateNouGrup.map(p => p.id)
    await supabase.from('produse').update({ grup_echivalente_id: grupId }).in('id', ids)

    // Merge alte grupuri dacă există
    const alteGrupuri = selectateNouGrup
      .filter(p => p.grup_echivalente_id && p.grup_echivalente_id !== grupId)
      .map(p => p.grup_echivalente_id!)
    for (const gid of alteGrupuri) {
      await supabase.from('produse').update({ grup_echivalente_id: grupId }).eq('grup_echivalente_id', gid)
      await supabase.from('echivalente_grupuri').delete().eq('id', gid)
    }

    setSelectateNouGrup([])
    setCautareNouGrup('')
    setCreandGrup(false)
    await loadGrupuri()
  }

  const grupuriFiltrate = cautare && !adaugandLaGrup
    ? grupuri.filter(g => g.produse.some(p =>
        p.nume.toLowerCase().includes(cautare.toLowerCase()) ||
        (p.cod && p.cod.toLowerCase().includes(cautare.toLowerCase()))
      ))
    : grupuri

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Echivalente produse</h2>
        <span className="text-sm text-gray-500">{grupuri.length} grupuri</span>
      </div>

      {/* Creare grup nou */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm">Grup echivalente nou</h3>
        <div className="relative">
          <input
            type="text"
            value={cautareNouGrup}
            onChange={e => setCautareNouGrup(e.target.value)}
            placeholder="Caută produs după nume sau cod..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {cautareNouGrupResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
              {cautareNouGrupResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectateNouGrup(prev => [...prev, p]); setCautareNouGrup(''); setCautareNouGrupResults([]) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0 border-gray-100"
                >
                  <span className="font-medium text-gray-900">{p.nume}</span>
                  {p.producator && <span className="text-gray-400 text-xs ml-2">{p.producator}</span>}
                  {p.cod && <span className="font-mono text-xs text-blue-600 ml-2">{p.cod}</span>}
                  {p.grup_echivalente_id && <span className="text-xs text-orange-500 ml-2">(are grup — va fuziona)</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setModalProdusNou('nou')}
          className="text-xs text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 font-medium"
        >
          + Produs nou în catalog
        </button>

        {selectateNouGrup.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {selectateNouGrup.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 rounded-lg text-xs font-medium text-white">
                  {p.nume}{p.cod && <span className="opacity-75">({p.cod})</span>}
                  <button onClick={() => setSelectateNouGrup(prev => prev.filter(x => x.id !== p.id))} className="opacity-60 hover:opacity-100">✕</button>
                </span>
              ))}
            </div>
            <button
              onClick={creeazaGrupNou}
              disabled={selectateNouGrup.length < 2 || creandGrup}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40"
              style={{ backgroundColor: '#2563eb' }}
            >
              {creandGrup ? 'Se creează...' : `Creează grup (${selectateNouGrup.length} produse)`}
            </button>
          </div>
        )}
      </div>

      {/* Filtrare */}
      <input
        type="text"
        value={cautare}
        onChange={e => setCautare(e.target.value)}
        placeholder="Filtrează grupuri după nume sau cod..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Lista grupuri */}
      {loading ? (
        <p className="text-sm text-gray-500">Se incarca...</p>
      ) : grupuri.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">Niciun grup de echivalente. Creează primul grup mai sus.</p>
      ) : (
        <div className="space-y-3">
          {grupuriFiltrate.map((grup, gi) => (
            <div key={grup.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Grup #{gi + 1} — {grup.produse.length} produse
                </span>
              </div>

              <table className="w-full text-sm">
                <tbody>
                  {grup.produse.map(p => (
                    <tr key={p.id} className="border-b last:border-b-0 border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{p.nume}</td>
                      <td className="px-4 py-2.5 text-gray-900 text-xs">{p.producator || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-blue-700">{p.cod || '—'}</td>
                      <td className="px-4 py-2.5 text-xs font-medium" style={{ color: p.stoc > 0 ? '#16a34a' : '#374151' }}>
                        {p.stoc > 0 ? `Stoc: ${p.stoc}` : 'Lipsă stoc'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => scoateDinGrup(p.id, grup.id)}
                          disabled={stergand === p.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                          title="Scoate din grup"
                        >
                          {stergand === p.id ? '...' : 'Scoate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Adauga la acest grup */}
              <div className="px-4 py-3 border-t border-gray-100 space-y-2 relative">
                <div className="relative">
                  <input
                    type="text"
                    value={cautareAdauga[grup.id] ?? ''}
                    onChange={e => setCautareAdauga(prev => ({ ...prev, [grup.id]: e.target.value }))}
                    placeholder="Adaugă produs la acest grup..."
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                  {(cautareAdaugaResults[grup.id] ?? []).length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                      {cautareAdaugaResults[grup.id].map(r => (
                        <button
                          key={r.id}
                          onClick={() => adaugaLaGrupExistent(r, grup.id)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b last:border-b-0 border-gray-100"
                        >
                          <span className="font-medium text-gray-900">{r.nume}</span>
                          {r.producator && <span className="text-gray-700 ml-2">{r.producator}</span>}
                          {r.cod && <span className="font-mono text-blue-600 ml-2">{r.cod}</span>}
                          {r.grup_echivalente_id && r.grup_echivalente_id !== grup.id && (
                            <span className="text-orange-500 ml-2">(are grup — va fuziona)</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setModalProdusNou(grup.id)}
                  className="text-xs text-blue-700 border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-50 font-medium"
                >
                  + Produs nou în catalog
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalProdusNou && (
        <ProdusNouModal
          open={!!modalProdusNou}
          onClose={() => setModalProdusNou(null)}
          onSaved={async (p) => {
            const grupId = modalProdusNou
            setModalProdusNou(null)
            if (grupId === 'nou') {
              setSelectateNouGrup(prev => [...prev, { id: p.id, cod: p.cod, nume: p.nume, producator: p.producator, grup_echivalente_id: null }])
            } else {
              await adaugaLaGrupExistent({ id: p.id, cod: p.cod, nume: p.nume, producator: p.producator, grup_echivalente_id: null }, grupId)
            }
          }}
        />
      )}
    </div>
  )
}
