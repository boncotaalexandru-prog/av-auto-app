'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OblioFactura {
  id: string
  seriesName: string
  number: string
  issueDate: string
  dueDate: string
  total: string        // string in Oblio
  totalVat: string
  collected: string    // "0" = neplătit, "1" = plătit
  canceled: string
  storno: string
  link: string
  client: {
    name: string
    cif?: string
  }
}

function isPaid(f: OblioFactura) { return f.collected === '1' }
function totalNum(f: OblioFactura) { return parseFloat(f.total) || 0 }

interface ClientSold {
  name: string
  total: number
  platit: number
  neplatit: number
  restant: number // neplatit + scadenta trecuta
  facturi: OblioFactura[]
}

function zile(dateStr: string) {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

export default function IncasariPage() {
  const [loading, setLoading] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)
  const [facturi, setFacturi] = useState<OblioFactura[]>([])
  const [obligSettings, setOblioSettings] = useState<{ oblio_email: string; oblio_secret: string; cui: string } | null>(null)
  const [issuedAfter, setIssuedAfter] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().slice(0, 10)
  })
  const [issuedBefore, setIssuedBefore] = useState(new Date().toISOString().slice(0, 10))
  const [filtruStatus, setFiltruStatus] = useState<'toate' | 'neplatite' | 'platite' | 'restante'>('neplatite')
  const [groupClient, setGroupClient] = useState(false)

  useEffect(() => {
    createClient()
      .from('settings')
      .select('oblio_email, oblio_secret, cui')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) setOblioSettings(data as { oblio_email: string; oblio_secret: string; cui: string })
      })
  }, [])

  const incarca = useCallback(async () => {
    if (!obligSettings?.oblio_email || !obligSettings?.oblio_secret || !obligSettings?.cui) {
      setEroare('Configurează credențialele Oblio în Setări (email + secret + CUI).')
      return
    }
    setLoading(true)
    setEroare(null)
    try {
      const res = await fetch('/api/oblio/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oblioEmail: obligSettings.oblio_email,
          oblioSecret: obligSettings.oblio_secret,
          cui: obligSettings.cui,
          issuedAfter,
          issuedBefore,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEroare((data.error ?? 'Eroare Oblio') + (data.details ? ': ' + JSON.stringify(data.details) : ''))
        setLoading(false)
        return
      }
      // Oblio returnează { data: [...] } sau direct array — protejăm mereu
      let raw: unknown[] = []
      if (Array.isArray(data)) raw = data
      else if (Array.isArray(data?.data)) raw = data.data
      else if (Array.isArray(data?.invoices)) raw = data.invoices
      else {
        setEroare('Format neașteptat Oblio: ' + JSON.stringify(data).slice(0, 300))
        setLoading(false)
        return
      }
      // Filtrăm null/undefined și normalizăm câmpurile
      const list: OblioFactura[] = raw
        .filter(Boolean)
        .map((item: unknown) => {
          const f = (item ?? {}) as Record<string, unknown>
          const cl = (f.client ?? {}) as Record<string, unknown>
          return {
            id: String(f.id ?? ''),
            seriesName: String(f.seriesName ?? ''),
            number: String(f.number ?? ''),
            issueDate: String(f.issueDate ?? ''),
            dueDate: String(f.dueDate ?? ''),
            total: String(f.total ?? '0'),
            totalVat: String(f.totalVat ?? '0'),
            collected: String(f.collected ?? '0'),
            canceled: String(f.canceled ?? '0'),
            storno: String(f.storno ?? '0'),
            link: String(f.link ?? ''),
            client: { name: String(cl.name ?? '—'), cif: String(cl.cif ?? '') },
          } as OblioFactura
        })
      setFacturi(list)
    } catch (e) {
      setEroare('Eroare conexiune: ' + String(e))
    }
    setLoading(false)
  }, [obligSettings, issuedAfter, issuedBefore])

  // filtrare
  const azi = new Date().toISOString().slice(0, 10)
  const facturiFiltrate = facturi.filter(f => {
    if (filtruStatus === 'platite') return isPaid(f)
    if (filtruStatus === 'neplatite') return !isPaid(f)
    if (filtruStatus === 'restante') return !isPaid(f) && f.dueDate && f.dueDate < azi
    return true
  })

  // KPIs
  const totalEmis = facturi.reduce((s, f) => s + totalNum(f), 0)
  const totalNeplatit = facturi.filter(f => !isPaid(f)).reduce((s, f) => s + totalNum(f), 0)
  const totalRestant = facturi.filter(f => !isPaid(f) && f.dueDate && f.dueDate < azi).reduce((s, f) => s + totalNum(f), 0)
  const nrRestante = facturi.filter(f => !isPaid(f) && f.dueDate && f.dueDate < azi).length

  // Group by client
  const clientMap: Record<string, ClientSold> = {}
  facturiFiltrate.forEach(f => {
    const key = f.client?.name ?? '—'
    if (!clientMap[key]) clientMap[key] = { name: key, total: 0, platit: 0, neplatit: 0, restant: 0, facturi: [] }
    clientMap[key].total += totalNum(f)
    if (isPaid(f)) clientMap[key].platit += totalNum(f)
    else {
      clientMap[key].neplatit += totalNum(f)
      if (f.dueDate && f.dueDate < azi) clientMap[key].restant += totalNum(f)
    }
    clientMap[key].facturi.push(f)
  })
  const clienti = Object.values(clientMap).sort((a, b) => b.neplatit - a.neplatit)

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Situație Încasări</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Sursa: Oblio</span>
      </div>

      {/* Filtre */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">De la</label>
          <input type="date" value={issuedAfter} onChange={e => setIssuedAfter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Până la</label>
          <input type="date" value={issuedBefore} onChange={e => setIssuedBefore(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="block text-xs font-semibold text-gray-600">Preset</label>
          <div className="flex gap-2">
            <button onClick={() => { const t = new Date().toISOString().slice(0, 10); setIssuedAfter(t); setIssuedBefore(t) }}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
              Azi
            </button>
            <button onClick={() => {
              const now = new Date()
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
              setIssuedAfter(firstDay)
              setIssuedBefore(now.toISOString().slice(0, 10))
            }}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
              Luna curentă
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
          <select value={filtruStatus} onChange={e => setFiltruStatus(e.target.value as typeof filtruStatus)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="toate">Toate</option>
            <option value="neplatite">Neplatite</option>
            <option value="platite">Platite</option>
            <option value="restante">Restante (scadenta depasita)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600">Grup pe client</label>
          <input type="checkbox" checked={groupClient} onChange={e => setGroupClient(e.target.checked)}
            className="w-4 h-4 rounded" />
        </div>
        <button onClick={incarca} disabled={loading}
          className="ml-auto px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {loading ? '⏳ Se încarcă...' : '🔄 Actualizează'}
        </button>
      </div>

      {eroare && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ {eroare}
        </div>
      )}

      {!eroare && facturi.length === 0 && !loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          Apasă <strong>Actualizează</strong> pentru a prelua datele din Oblio.
        </div>
      )}

      {facturi.length > 0 && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total emis</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalEmis.toFixed(0)} <span className="text-sm font-normal text-gray-500">RON</span></p>
              <p className="text-xs text-gray-400 mt-1">{facturi.length} facturi</p>
            </div>
            <div className="bg-white rounded-xl border border-orange-200 p-4">
              <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide">Neîncasat</p>
              <p className="text-2xl font-bold text-orange-700 mt-1">{totalNeplatit.toFixed(0)} <span className="text-sm font-normal text-orange-400">RON</span></p>
              <p className="text-xs text-orange-400 mt-1">{facturi.filter(f => !isPaid(f)).length} facturi</p>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Restante</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{totalRestant.toFixed(0)} <span className="text-sm font-normal text-red-400">RON</span></p>
              <p className="text-xs text-red-400 mt-1">{nrRestante} facturi scadente</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4">
              <p className="text-xs font-semibold text-green-500 uppercase tracking-wide">Încasat</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{(totalEmis - totalNeplatit).toFixed(0)} <span className="text-sm font-normal text-green-400">RON</span></p>
              <p className="text-xs text-green-400 mt-1">{facturi.filter(f => isPaid(f)).length} facturi platite</p>
            </div>
          </div>

          {/* Grupat pe client */}
          {groupClient ? (
            <div className="space-y-3">
              {clienti.map(c => (
                <details key={c.name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <summary className="px-5 py-4 cursor-pointer flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="font-semibold text-gray-900 truncate">{c.name}</span>
                      {c.restant > 0 && <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">RESTANT</span>}
                    </div>
                    <div className="flex items-center gap-6 text-sm shrink-0">
                      {c.neplatit > 0 && <span className="font-bold text-orange-600">{c.neplatit.toFixed(0)} RON neplatit</span>}
                      {c.restant > 0 && <span className="font-bold text-red-600">{c.restant.toFixed(0)} RON restant</span>}
                      <span className="text-gray-500">{c.facturi.length} facturi</span>
                    </div>
                  </summary>
                  <div className="overflow-x-auto border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">Factură</th>
                          <th className="px-4 py-2 text-left">Data</th>
                          <th className="px-4 py-2 text-left">Scadentă</th>
                          <th className="px-4 py-2 text-right">Total</th>
                          <th className="px-4 py-2 text-center">Status</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {c.facturi.map((f, i) => {
                          const zileRamase = f.dueDate ? zile(f.dueDate) : null
                          const restanta = !isPaid(f) && f.dueDate && f.dueDate < azi
                          return (
                            <tr key={i} className={restanta ? 'bg-red-50' : ''}>
                              <td className="px-4 py-2 font-mono font-semibold">{f.seriesName}{f.number}</td>
                              <td className="px-4 py-2 text-gray-600">{f.issueDate}</td>
                              <td className="px-4 py-2">
                                {f.dueDate ? (
                                  <span className={restanta ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                                    {f.dueDate}
                                    {!isPaid(f) && zileRamase !== null && (
                                      <span className="ml-1 text-xs">
                                        {zileRamase < 0 ? `(${Math.abs(zileRamase)}z întârziere)` : `(${zileRamase}z)`}
                                      </span>
                                    )}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-2 text-right font-bold">{totalNum(f).toFixed(2)}</td>
                              <td className="px-4 py-2 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${isPaid(f) ? 'bg-green-100 text-green-700' : restanta ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {isPaid(f) ? 'Plătit' : restanta ? 'Restant' : 'Neplatit'}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                {f.link && <a href={f.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">PDF</a>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            /* Lista plata */
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3 text-left">Factură</th>
                      <th className="px-5 py-3 text-left">Client</th>
                      <th className="px-5 py-3 text-left">Data</th>
                      <th className="px-5 py-3 text-left">Scadentă</th>
                      <th className="px-5 py-3 text-right">Total RON</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {facturiFiltrate.map((f, i) => {
                      const zileRamase = f.dueDate ? zile(f.dueDate) : null
                      const restanta = !isPaid(f) && f.dueDate && f.dueDate < azi
                      return (
                        <tr key={i} className={`hover:bg-gray-50 transition-colors ${restanta ? 'bg-red-50 hover:bg-red-100' : ''}`}>
                          <td className="px-5 py-3 font-mono font-semibold text-gray-900">{f.seriesName}{f.number}</td>
                          <td className="px-5 py-3 font-medium text-gray-900">{f.client?.name ?? '—'}</td>
                          <td className="px-5 py-3 text-gray-600">{f.issueDate}</td>
                          <td className="px-5 py-3">
                            {f.dueDate ? (
                              <span className={restanta ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                                {f.dueDate}
                                {!isPaid(f) && zileRamase !== null && (
                                  <span className="ml-1 text-xs text-gray-400">
                                    {zileRamase < 0 ? `(${Math.abs(zileRamase)}z întârziere)` : `(${zileRamase}z)`}
                                  </span>
                                )}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-gray-900">{totalNum(f).toFixed(2)}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isPaid(f) ? 'bg-green-100 text-green-700' : restanta ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {isPaid(f) ? '✓ Plătit' : restanta ? '⚠ Restant' : '○ Neplatit'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {f.link && (
                              <a href={f.link} target="_blank" rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline">
                                PDF →
                              </a>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {facturiFiltrate.length === 0 && (
                  <p className="text-center text-gray-400 py-8 text-sm">Nicio factură pentru filtrul selectat.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
