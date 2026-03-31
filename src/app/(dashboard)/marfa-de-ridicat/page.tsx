'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Ridicare {
  id: string
  oferta_id: string | null
  client_nume: string | null
  nume_produs: string
  producator: string | null
  cantitate: number
  unitate: string | null
  furnizor_id: string | null
  furnizor_nume: string | null
  ora_ridicare: string | null
  data_livrare: string | null
  ridicat: boolean
  ridicat_la: string | null
  created_at: string
  oferte: { numar: number | null } | null
}

interface Grup {
  cheie: string
  label: string
  subgrupuri: { furnizor: string; items: Ridicare[] }[]
}

function formatData(data: string | null): string {
  if (!data) return 'FARA DATA'
  const d = new Date(data + 'T00:00:00')
  const azi = new Date(); azi.setHours(0,0,0,0)
  const maine = new Date(azi); maine.setDate(maine.getDate() + 1)
  if (d.getTime() === azi.getTime()) return 'AZI'
  if (d.getTime() === maine.getTime()) return 'MÂINE'
  return d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
}

function grupeaza(ridicari: Ridicare[]): Grup[] {
  const map = new Map<string, Map<string, Ridicare[]>>()
  const aziStr = new Date().toISOString().split('T')[0]

  for (const r of ridicari) {
    // Stoc CT fara data = disponibil AZI
    const dataKey = r.data_livrare ?? (r.ora_ridicare === 'Stoc CT' ? aziStr : '__fara__')
    const furnKey = r.furnizor_nume || 'Stoc Propriu'
    if (!map.has(dataKey)) map.set(dataKey, new Map())
    const byF = map.get(dataKey)!
    if (!byF.has(furnKey)) byF.set(furnKey, [])
    byF.get(furnKey)!.push(r)
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === '__fara__') return 1
    if (b === '__fara__') return -1
    return a.localeCompare(b)
  })
  return keys.map(k => ({
    cheie: k,
    label: formatData(k === '__fara__' ? null : k),
    subgrupuri: [...map.get(k)!.entries()].map(([furnizor, items]) => ({ furnizor, items })),
  }))
}

export default function MarfaDeRidicatPage() {
  const [ridicari, setRidicari] = useState<Ridicare[]>([])
  const [loading, setLoading] = useState(true)
  const [afiseazaRidicate, setAfiseazaRidicate] = useState(false)
  const [undoItem, setUndoItem] = useState<Ridicare | null>(null)
  const undoTimer = useState<ReturnType<typeof setTimeout> | null>(null)
  const [modalManual, setModalManual] = useState(false)
  const [formManual, setFormManual] = useState({
    data_livrare: new Date().toISOString().split('T')[0],
    ora_ridicare: '',
    furnizor_nume: '',
    furnizor_id: null as string | null,
    nume_produs: '',
    cantitate: 1,
    unitate: 'buc',
    client_nume: '',
  })
  const [salvandManual, setSalvandManual] = useState(false)
  const [furnizoriManual, setFurnizoriManual] = useState<{id: string; denumire: string}[]>([])
  const [showFurnManual, setShowFurnManual] = useState(false)
  const [furnSearchManual, setFurnSearchManual] = useState('')

  useEffect(() => { incarca() }, [])

  useEffect(() => {
    if (!showFurnManual) return
    let q = createClient().from('furnizori').select('id, denumire').order('denumire').limit(20)
    if (furnSearchManual.trim()) q = q.ilike('denumire', `%${furnSearchManual}%`)
    q.then(({ data }) => setFurnizoriManual((data as {id: string; denumire: string}[]) ?? []))
  }, [furnSearchManual, showFurnManual])

  async function incarca() {
    const { data, error } = await createClient()
      .from('ridicari')
      .select('*, oferte(numar)')
      .or('furnizor_id.not.is.null,oferta_id.is.null')
      .order('data_livrare', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) console.error('[Ridicari] Eroare query:', error)
    setRidicari((data as Ridicare[]) ?? [])
    setLoading(false)
  }

  async function toggleRidicat(r: Ridicare) {
    const nou = !r.ridicat
    await createClient().from('ridicari').update({
      ridicat: nou,
      ridicat_la: nou ? new Date().toISOString() : null,
    }).eq('id', r.id)
    setRidicari(prev => prev.map(x => x.id === r.id
      ? { ...x, ridicat: nou, ridicat_la: nou ? new Date().toISOString() : null }
      : x
    ))

    // Dacă s-a bifat ca "ridicat", arată butonul de undo pentru 6 secunde
    if (nou) {
      setUndoItem({ ...r, ridicat: true })
      if (undoTimer[0]) clearTimeout(undoTimer[0])
      const t = setTimeout(() => setUndoItem(null), 6000)
      undoTimer[1](t as ReturnType<typeof setTimeout>)
    } else {
      setUndoItem(null)
    }
  }

  async function salveazaManual() {
    if (!formManual.nume_produs.trim()) return
    setSalvandManual(true)
    await createClient().from('ridicari').insert({
      oferta_id: null,
      client_nume: formManual.client_nume.trim() || null,
      nume_produs: formManual.nume_produs.trim(),
      cantitate: formManual.cantitate,
      unitate: formManual.unitate || 'buc',
      furnizor_id: formManual.furnizor_id,
      furnizor_nume: formManual.furnizor_nume.trim() || null,
      ora_ridicare: formManual.ora_ridicare.trim() || null,
      data_livrare: formManual.data_livrare || null,
      ridicat: false,
    })
    setSalvandManual(false)
    setModalManual(false)
    setFormManual({
      data_livrare: new Date().toISOString().split('T')[0],
      ora_ridicare: '', furnizor_nume: '', furnizor_id: null,
      nume_produs: '', cantitate: 1, unitate: 'buc', client_nume: '',
    })
    setFurnSearchManual('')
    incarca()
  }

  async function stergeManual(id: string) {
    if (!confirm('Ștergi această ridicare manuală?')) return
    await createClient().from('ridicari').delete().eq('id', id)
    setRidicari(prev => prev.filter(r => r.id !== id))
  }

  async function anuleazaRidicat() {
    if (!undoItem) return
    if (undoTimer[0]) clearTimeout(undoTimer[0])
    setUndoItem(null)
    await createClient().from('ridicari').update({
      ridicat: false,
      ridicat_la: null,
    }).eq('id', undoItem.id)
    setRidicari(prev => prev.map(x => x.id === undoItem.id
      ? { ...x, ridicat: false, ridicat_la: null }
      : x
    ))
  }

  const filtrate = ridicari.filter(r => afiseazaRidicate ? true : !r.ridicat)
  const grupuri = grupeaza(filtrate)
  const totalNeridicate = ridicari.filter(r => !r.ridicat).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Marfă de ridicat</h2>
          {totalNeridicate > 0 && (
            <p className="text-sm text-gray-600 mt-0.5">
              {totalNeridicate} {totalNeridicate === 1 ? 'produs neridcat' : 'produse neridicate'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setModalManual(true)}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ backgroundColor: '#0f172a' }}
          >
            + Adaugă ridicare
          </button>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-900 select-none">
            <input type="checkbox" checked={afiseazaRidicate} onChange={e => setAfiseazaRidicate(e.target.checked)} className="w-4 h-4" />
            Afișează și ridicatele
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Se încarcă...</p>
      ) : grupuri.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-gray-900 font-semibold">Totul a fost ridicat!</p>
          <p className="text-sm text-gray-600 mt-1">Nicio marfă în așteptare.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grupuri.map(grup => (
            <div key={grup.cheie}>
              {/* Separator data */}
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold text-white shrink-0"
                  style={{
                    backgroundColor:
                      grup.label === 'AZI' ? '#dc2626' :
                      grup.label === 'MÂINE' ? '#d97706' :
                      grup.label === 'FARA DATA' ? '#6b7280' : '#2563eb'
                  }}
                >
                  {grup.label}
                </span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <div className="space-y-3">
                {grup.subgrupuri.map(sg => (
                  <div key={sg.furnizor} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">🚚 {sg.furnizor}</span>
                      <span className="text-xs text-gray-600 ml-1">
                        ({sg.items.length} {sg.items.length === 1 ? 'produs' : 'produse'})
                      </span>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {sg.items.map(item => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-4 px-4 py-3 transition-colors ${item.ridicat ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={item.ridicat}
                            onChange={() => toggleRidicat(item)}
                            className="w-5 h-5 cursor-pointer shrink-0"
                            style={{ accentColor: '#16a34a' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm ${item.ridicat ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {item.nume_produs}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {item.cantitate} {item.unitate || 'buc'}
                              {item.producator && <> · <span>{item.producator}</span></>}
                              {item.client_nume && <> · <span className="font-medium">{item.client_nume}</span></>}
                            </p>
                          </div>
                          {item.ora_ridicare && (
                            <span className="text-xs font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded-lg shrink-0">
                              🕐 {item.ora_ridicare}
                            </span>
                          )}
                          {item.oferte?.numar && (
                            <span className="text-xs text-gray-500 shrink-0">
                              #{item.oferte.numar}
                            </span>
                          )}
                          {item.ridicat && item.ridicat_la && (
                            <span className="text-xs text-green-700 font-medium shrink-0">
                              ✓ {new Date(item.ridicat_la).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {!item.oferta_id && !item.ridicat && (
                            <button
                              onClick={() => stergeManual(item.id)}
                              className="text-xs text-red-400 hover:text-red-600 shrink-0"
                              title="Șterge"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal adaugă ridicare manuală */}
      {modalManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Adaugă ridicare manuală</h3>
              <button onClick={() => setModalManual(false)} className="text-gray-600 hover:text-gray-900 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Data + Ora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Când (dată)</label>
                  <input type="date" value={formManual.data_livrare}
                    onChange={e => setFormManual(f => ({ ...f, data_livrare: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ora (opțional)</label>
                  <input type="text" placeholder="ex: 10:00" value={formManual.ora_ridicare}
                    onChange={e => setFormManual(f => ({ ...f, ora_ridicare: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {/* De unde (furnizor) */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">De unde (furnizor) <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Caută sau scrie furnizor..."
                  value={furnSearchManual}
                  onChange={e => { setFurnSearchManual(e.target.value); setFormManual(f => ({ ...f, furnizor_nume: e.target.value, furnizor_id: null })); setShowFurnManual(true) }}
                  onFocus={() => setShowFurnManual(true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showFurnManual && furnizoriManual.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-36 overflow-y-auto">
                    {furnizoriManual.map(f => (
                      <button key={f.id} onClick={() => { setFormManual(fm => ({ ...fm, furnizor_id: f.id, furnizor_nume: f.denumire })); setFurnSearchManual(f.denumire); setShowFurnManual(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                        {f.denumire}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Ce (produs) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ce (produs) <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Denumire produs..." value={formManual.nume_produs}
                  onChange={e => setFormManual(f => ({ ...f, nume_produs: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* Cantitate + UM */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cantitate</label>
                  <input type="number" min="1" step="1" value={formManual.cantitate}
                    onChange={e => setFormManual(f => ({ ...f, cantitate: parseFloat(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">UM</label>
                  <input type="text" value={formManual.unitate}
                    onChange={e => setFormManual(f => ({ ...f, unitate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {/* Pentru cine */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Pentru cine (client)</label>
                <input type="text" placeholder="Nume client..." value={formManual.client_nume}
                  onChange={e => setFormManual(f => ({ ...f, client_nume: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={() => setModalManual(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={salveazaManual} disabled={salvandManual || !formManual.nume_produs.trim() || !formManual.furnizor_nume.trim()}
                className="px-5 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-40"
                style={{ backgroundColor: '#0f172a' }}>
                {salvandManual ? 'Se salvează...' : '+ Adaugă'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Anulează — apare 6 secunde după bifare */}
      {undoItem && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl">
          <span className="text-sm">
            <span className="text-green-400 font-semibold">✓ Ridicat:</span>{' '}
            {undoItem.nume_produs}
          </span>
          <button
            onClick={anuleazaRidicat}
            className="ml-2 px-3 py-1.5 bg-white text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-100 transition-colors"
          >
            ↩ Anulează
          </button>
        </div>
      )}
    </div>
  )
}
