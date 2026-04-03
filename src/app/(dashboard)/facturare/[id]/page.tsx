'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface FacturaDetaliu {
  id: string
  numar: number
  data_emitere: string
  data_scadenta: string | null
  status: string
  tip: string
  observatii: string | null
  nota_interna: string | null
  client_id: string
  client_denumire: string
  referinta_id: string | null
}

interface OblioSettings {
  oblio_email: string
  oblio_secret: string
  cui: string
  serie_factura: string
}

interface ProdusFactura {
  id: string
  produs_id: string | null
  stoc_id: string | null
  nume_produs: string
  cod: string | null
  producator: string | null
  unitate: string
  cantitate: number
  pret_achizitie: number
  pret_vanzare: number
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  nefinalizata: { label: 'Nefinalizată', color: 'bg-orange-100 text-orange-800' },
  emisa:        { label: 'Emisă',        color: 'bg-blue-100 text-blue-800' },
  platita:      { label: 'Plătită',      color: 'bg-green-100 text-green-800' },
  anulata:      { label: 'Anulată',      color: 'bg-red-100 text-red-800' },
  stornata:     { label: 'Stornată',     color: 'bg-purple-100 text-purple-800' },
}

export default function FacturaDetaliuPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [factura, setFactura] = useState<FacturaDetaliu | null>(null)
  const [produse, setProduse] = useState<ProdusFactura[]>([])
  const [oblioSettings, setOblioSettings] = useState<OblioSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvandStatus, setSalvandStatus] = useState(false)
  const [observatiiEdit, setObservatiiEdit] = useState('')
  const [notaInternaEdit, setNotaInternaEdit] = useState('')
  const [salvandNote, setSalvandNote] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const supabase = createClient()

    const { data: f } = await supabase.from('facturi')
      .select('id, numar, data_emitere, data_scadenta, status, tip, observatii, nota_interna, client_id, referinta_id, clienti(denumire)')
      .eq('id', id).single()

    if (!f) { setLoading(false); return }

    const client = Array.isArray(f.clienti) ? f.clienti[0] : (f.clienti as { denumire: string } | null)
    setFactura({ ...f, tip: f.tip ?? 'normala', client_denumire: client?.denumire ?? '—' })
    setObservatiiEdit(f.observatii ?? '')
    setNotaInternaEdit(f.nota_interna ?? '')

    const { data: p } = await supabase.from('facturi_produse')
      .select('id, produs_id, stoc_id, nume_produs, cod, producator, unitate, cantitate, pret_achizitie, pret_vanzare')
      .eq('factura_id', id)
    setProduse(p ?? [])

    // Incarca setarile Oblio
    const { data: set } = await supabase.from('setari').select('oblio_email, oblio_secret, cui, serie_factura').single()
    if (set?.oblio_email && set?.oblio_secret && set?.cui && set?.serie_factura) {
      setOblioSettings(set as OblioSettings)
    }

    setLoading(false)
  }

  async function salveazaNote() {
    if (!factura) return
    setSalvandNote(true)
    await createClient().from('facturi').update({
      observatii: observatiiEdit.trim() || null,
      nota_interna: notaInternaEdit.trim() || null,
    }).eq('id', id)
    setFactura(f => f ? { ...f, observatii: observatiiEdit.trim() || null, nota_interna: notaInternaEdit.trim() || null } : f)
    setSalvandNote(false)
  }

  async function schimbaStatus(nou: string) {
    if (!factura) return
    setSalvandStatus(true)
    await createClient().from('facturi').update({ status: nou }).eq('id', id)
    setFactura(f => f ? { ...f, status: nou } : f)
    setSalvandStatus(false)
  }

  async function emiteFactura() {
    if (!factura) return
    setSalvandStatus(true)
    const supabase = createClient()

    // ── 1. Scade stocul (FIFO) ───────────────────────────────────────────────
    for (const p of produse) {
      let deScazut = p.cantitate
      if (p.stoc_id) {
        const { data: s } = await supabase.from('stoc').select('cantitate').eq('id', p.stoc_id).single()
        if (s) await supabase.from('stoc').update({ cantitate: Math.max(0, s.cantitate - deScazut) }).eq('id', p.stoc_id)
        continue
      }
      if (!p.cod) continue
      const { data: intrari } = await supabase.from('stoc').select('id, cantitate')
        .gt('cantitate', 0).eq('produs_cod', p.cod).order('updated_at', { ascending: true })
      for (const intrare of (intrari ?? [])) {
        if (deScazut <= 0) break
        const scade = Math.min(deScazut, intrare.cantitate)
        await supabase.from('stoc').update({ cantitate: intrare.cantitate - scade }).eq('id', intrare.id)
        deScazut -= scade
      }
    }

    // ── 2. Trimite la Oblio dacă există setări ───────────────────────────────
    if (oblioSettings) {
      try {
        const { data: client } = await supabase.from('clienti')
          .select('denumire, cod_fiscal, reg_com, adresa, localitate, judet, tara, telefon, email, platitor_tva')
          .eq('id', factura.client_id).single()

        if (!client?.denumire) {
          alert('⚠️ Clientul nu are denumire completată.')
          setSalvandStatus(false)
          return
        }

        const oblioPayload = {
          cif: oblioSettings.cui.replace(/^RO/i, '').trim(),
          issueDate: factura.data_emitere,
          dueDate: factura.data_scadenta ?? '',
          seriesName: oblioSettings.serie_factura,
          currency: 'RON',
          language: 'RO',
          isDraft: 0,
          useStock: 0,
          client: {
            cif: (client.cod_fiscal ?? '').replace(/^RO/i, '').trim(),
            name: client.denumire,
            rc: client.reg_com ?? '',
            address: client.adresa ?? '',
            city: client.localitate ?? '',
            county: client.judet ?? '',
            country: client.tara ?? 'Romania',
            phone: client.telefon ?? '',
            email: client.email ?? '',
            isTaxPayer: client.platitor_tva ? 1 : 0,
          },
          products: produse.map(p => ({
            name: p.nume_produs,
            code: '',
            description: '',
            price: parseFloat((p.pret_vanzare * 1.21).toFixed(4)), // Oblio asteapta pretul CU TVA inclus
            quantity: p.cantitate,
            unit: p.unitate || 'buc',
            vatName: 'Normala',
            vatPercentage: 21,
            productType: 'Marfa',
            management: 'Gestiune AV Auto',
            useStock: 0,
          })),
          ...(factura.observatii ? { mentions: factura.observatii } : {}),
        }

        const res = await fetch('/api/oblio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oblioEmail: oblioSettings.oblio_email,
            oblioSecret: oblioSettings.oblio_secret,
            invoiceData: oblioPayload,
          }),
        })
        const data = await res.json()

        if (res.ok && (data.link || data.data?.link)) {
          const link = data.link ?? data.data?.link
          const seriesName = data.seriesName ?? data.data?.seriesName
          const number = data.number ?? data.data?.number
          await supabase.from('facturi')
            .update({ status: 'emisa', oblio_link: link, oblio_serie: seriesName ?? null, oblio_numar: number ?? null })
            .eq('id', id)
          setFactura(f => f ? { ...f, status: 'emisa' } : f)
          setSalvandStatus(false)
          return
        } else {
          // Oblio a dat eroare — stocul a fost deja scăzut, dar NU marcam ca emisa
          const errMsg = data.error ?? data.statusMessage ?? data.message ?? 'Eroare necunoscută Oblio'
          alert(`⚠️ Oblio: ${errMsg}\n\nStocul a fost scăzut. Corectează în Oblio manual dacă e cazul.`)
          // Marcam totusi ca emisa local (stocul a fost scazut)
          await supabase.from('facturi').update({ status: 'emisa' }).eq('id', id)
          setFactura(f => f ? { ...f, status: 'emisa' } : f)
          setSalvandStatus(false)
          return
        }
      } catch (e) {
        alert(`⚠️ Conexiune Oblio eșuată: ${e}`)
        // Marcam totusi emisa local deoarece stocul a fost deja scazut
        await supabase.from('facturi').update({ status: 'emisa' }).eq('id', id)
        setFactura(f => f ? { ...f, status: 'emisa' } : f)
        setSalvandStatus(false)
        return
      }
    }

    // Fără Oblio — doar actualizăm statusul
    await supabase.from('facturi').update({ status: 'emisa' }).eq('id', id)
    setFactura(f => f ? { ...f, status: 'emisa' } : f)
    setSalvandStatus(false)
  }

  async function stergeFactura() {
    const esteNefinalizata = factura?.status === 'nefinalizata'
    if (!confirm(esteNefinalizata
      ? 'Ștergi factura nefinalizată?'
      : 'Ștergi factura și restituii stocul?')) return
    setSalvandStatus(true)
    const supabase = createClient()

    // Stocul se restituie DOAR dacă factura era emisa/platita (stocul a fost scăzut la emitere)
    // Dacă era nefinalizata, stocul NU a fost scăzut → nu restituim
    if (!esteNefinalizata) {
      for (const p of produse) {
        if (p.stoc_id) {
          const { data: s } = await supabase.from('stoc').select('cantitate').eq('id', p.stoc_id).single()
          if (s) await supabase.from('stoc').update({ cantitate: s.cantitate + p.cantitate }).eq('id', p.stoc_id)
          continue
        }
        if (!p.cod) continue
        const { data: intrari } = await supabase.from('stoc').select('id, cantitate')
          .eq('produs_cod', p.cod).order('updated_at', { ascending: true }).limit(1)
        if (intrari?.length) {
          await supabase.from('stoc').update({ cantitate: intrari[0].cantitate + p.cantitate }).eq('id', intrari[0].id)
        }
      }
    }

    await supabase.from('facturi').delete().eq('id', id)
    router.push('/facturare')
  }

  async function storneazaIntegral() {
    if (!factura) return
    if (!confirm(`Stornezi integral Factura #${factura.numar}? Se va crea o factură storno și stocul va fi restituit.`)) return
    setSalvandStatus(true)
    const supabase = createClient()

    // Creaza factura storno
    const { data: storno, error } = await supabase.from('facturi').insert({
      client_id: factura.client_id,
      data_emitere: new Date().toISOString().slice(0, 10),
      status: 'emisa',
      tip: 'storno',
      referinta_id: factura.id,
      observatii: `Storno Factura #${factura.numar}`,
    }).select('id').single()

    if (error || !storno) {
      alert('Eroare la creare storno: ' + error?.message)
      setSalvandStatus(false)
      return
    }

    // Insereaza produsele cu cantitate negativa, legate exact de linia originala
    await supabase.from('facturi_produse').insert(
      produse.map(p => ({
        factura_id: storno.id,
        referinta_linie_id: p.id,
        produs_id: p.produs_id,
        stoc_id: p.stoc_id,
        nume_produs: p.nume_produs,
        cod: p.cod,
        producator: p.producator,
        unitate: p.unitate,
        cantitate: -p.cantitate,
        pret_achizitie: p.pret_achizitie,
        pret_vanzare: p.pret_vanzare,
      }))
    )

    // Restituie stocul
    for (const p of produse) {
      if (p.stoc_id) {
        const { data: s } = await supabase.from('stoc').select('cantitate').eq('id', p.stoc_id).single()
        if (s) await supabase.from('stoc').update({ cantitate: s.cantitate + p.cantitate }).eq('id', p.stoc_id)
        continue
      }
      if (!p.cod) continue
      const { data: intrari } = await supabase.from('stoc').select('id, cantitate')
        .eq('produs_cod', p.cod).order('updated_at', { ascending: true }).limit(1)
      if (intrari?.length) {
        await supabase.from('stoc').update({ cantitate: intrari[0].cantitate + p.cantitate }).eq('id', intrari[0].id)
      }
    }

    // Marcheaza factura originala ca anulata — nu mai poate fi stornata din nou
    await supabase.from('facturi').update({ status: 'stornata' }).eq('id', id)

    router.push(`/facturare/${storno.id}`)
  }

  if (loading) return <div className="text-sm text-gray-600 p-8">Se încarcă...</div>
  if (!factura) return <div className="text-sm text-red-700 p-8">Factura nu a fost găsită.</div>

  const total = produse.reduce((s, p) => s + p.cantitate * p.pret_vanzare, 0)
  const totalAch = produse.reduce((s, p) => s + p.cantitate * p.pret_achizitie, 0)
  const adaos = totalAch > 0 ? ((total - totalAch) / totalAch) * 100 : null
  const s = STATUS_LABEL[factura.status] ?? { label: factura.status, color: 'bg-gray-100 text-gray-700' }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/facturare')} className="text-sm text-gray-700 hover:text-gray-900 font-medium">
            ← Înapoi la facturi
          </button>
          <span className="text-gray-300">|</span>
          <h2 className="text-2xl font-bold text-gray-900">Factura #{factura.numar}</h2>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${s.color}`}>
            {s.label}
          </span>
          {factura.tip === 'storno' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
              STORNO
            </span>
          )}
        </div>

        {/* Actiuni status */}
        <div className="flex gap-2">
          {factura.status === 'nefinalizata' && (
            <>
              <button onClick={stergeFactura} disabled={salvandStatus}
                className="px-4 py-2 text-sm font-semibold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40">
                🗑 Șterge
              </button>
              <button onClick={emiteFactura} disabled={salvandStatus}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-40"
                style={{ backgroundColor: '#0f172a' }}>
                {salvandStatus ? '⏳ Se trimite...' : '🧾 Emite factură'}
              </button>
            </>
          )}
          {factura.status === 'emisa' && factura.tip !== 'storno' && (
            <>
              <button onClick={() => schimbaStatus('platita')} disabled={salvandStatus}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-40"
                style={{ backgroundColor: '#16a34a' }}>
                ✓ Marchează plătită
              </button>
              <button onClick={storneazaIntegral} disabled={salvandStatus}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-40"
                style={{ backgroundColor: '#7c3aed' }}>
                ↩ Stornează integral
              </button>
              <button onClick={stergeFactura} disabled={salvandStatus}
                className="px-4 py-2 text-sm font-semibold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40">
                Șterge + restituie stoc
              </button>
            </>
          )}
          {factura.status === 'platita' && factura.tip !== 'storno' && (
            <>
              <button onClick={() => schimbaStatus('emisa')} disabled={salvandStatus}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                ↩ Anulează plata
              </button>
              <button onClick={storneazaIntegral} disabled={salvandStatus}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-40"
                style={{ backgroundColor: '#7c3aed' }}>
                ↩ Stornează integral
              </button>
            </>
          )}
          {factura.status === 'anulata' && (
            <button onClick={stergeFactura} disabled={salvandStatus}
              className="px-4 py-2 text-sm font-semibold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40">
              🗑 Șterge definitiv + restituie stoc
            </button>
          )}
        </div>
      </div>

      {/* Info factura */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Client</p>
          <p className="font-semibold text-gray-900">{factura.client_denumire}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Data emiterii</p>
          <p className="font-semibold text-gray-900">
            {new Date(factura.data_emitere).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Total fără TVA</p>
          <p className="font-bold text-gray-900 text-lg">{total.toFixed(2)} <span className="text-sm font-normal text-gray-500">RON</span></p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Total cu TVA 21%</p>
          <p className="font-bold text-gray-900 text-lg">{(total * 1.21).toFixed(2)} <span className="text-sm font-normal text-gray-500">RON</span></p>
        </div>
        {adaos !== null && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Adaos</p>
            <p className="font-semibold text-green-700">+{adaos.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* Produse */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Produse ({produse.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-700">Produs</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Cant.</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Preț ach.</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Preț vânz.</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {produse.map(p => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{p.nume_produs}</p>
                  <div className="flex gap-2 mt-0.5">
                    {p.cod && <span className="text-xs text-gray-600 font-mono">{p.cod}</span>}
                    {p.producator && <span className="text-xs text-gray-500">{p.producator}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-900">{p.cantitate} {p.unitate}</td>
                <td className="px-4 py-3 text-right text-gray-600">{p.pret_achizitie.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{p.pret_vanzare.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{(p.cantitate * p.pret_vanzare).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-xs text-gray-600">Total fără TVA:</td>
              <td className="px-4 py-2 text-right text-gray-800 font-medium">{total.toFixed(2)} RON</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-xs text-gray-600">TVA 21%:</td>
              <td className="px-4 py-2 text-right text-gray-700">{(total * 0.21).toFixed(2)} RON</td>
            </tr>
            <tr className="border-t border-gray-300">
              <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-gray-900">Total cu TVA:</td>
              <td className="px-4 py-3 text-right font-bold text-gray-900 text-base">{(total * 1.21).toFixed(2)} RON</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Observatii + Nota interna */}
      {factura.status === 'nefinalizata' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Observații <span className="text-xs font-normal text-gray-500">(apar pe factură)</span></label>
            <textarea
              value={observatiiEdit}
              onChange={e => setObservatiiEdit(e.target.value)}
              rows={3}
              placeholder="ex: Conform comanda nr. 123..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400"
            />
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Notă internă <span className="text-xs font-normal text-gray-500">(nu apare pe factură)</span></label>
            <textarea
              value={notaInternaEdit}
              onChange={e => setNotaInternaEdit(e.target.value)}
              rows={2}
              placeholder="ex: Client verificat, plătitor lent..."
              className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none placeholder:text-gray-400 bg-amber-50"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={salveazaNote}
              disabled={salvandNote}
              className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-50"
            >
              {salvandNote ? 'Se salvează...' : 'Salvează note'}
            </button>
          </div>
        </div>
      ) : (factura.observatii || factura.nota_interna) ? (
        <div className="space-y-3">
          {factura.observatii && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 mb-1">Observații (pe factură)</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{factura.observatii}</p>
            </div>
          )}
          {factura.nota_interna && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
              <p className="text-xs text-gray-500 mb-1">Notă internă</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{factura.nota_interna}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
