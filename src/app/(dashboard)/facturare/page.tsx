'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Tipuri ─────────────────────────────────────────────────────────────────

interface ClientOpt { id: string; denumire: string }
interface ProdusSearch { id: string; cod: string | null; nume: string; unitate: string | null; producator: string | null }
interface StocOptiune { id: string; pret_achizitie: number; pret_lista: number | null; cantitate: number; furnizor_nume: string | null }

interface RandFactura {
  _key: string
  produs_id: string | null
  stoc_id: string | null
  nume_produs: string
  cod: string
  producator: string
  unitate: string
  cantitate: number
  pret_achizitie: number
  pret_vanzare: number
  stoc_disponibil: number
  stoc_optiuni: StocOptiune[]
  stoc_idx: number
}

interface FacturaItem {
  id: string
  numar: number
  data_emitere: string
  status: string
  client_denumire: string
  total: number
  nr_produse: number
  nota_interna: string | null
}

interface StornoLinie {
  _key: string
  factura_id: string
  factura_numar: number
  factura_data: string
  linie_id: string
  produs_id: string | null
  stoc_id: string | null
  nume_produs: string
  cod: string | null
  producator: string | null
  unitate: string
  cantitate_maxima: number
  cantitate: number
  pret_achizitie: number
  pret_vanzare: number
  selectat: boolean
}

function stripDiacritice(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function emptyRand(): RandFactura {
  return {
    _key: Math.random().toString(36).slice(2),
    produs_id: null, stoc_id: null, nume_produs: '', cod: '', producator: '',
    unitate: 'buc', cantitate: 1, pret_achizitie: 0, pret_vanzare: 0,
    stoc_disponibil: 0, stoc_optiuni: [], stoc_idx: 0,
  }
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  nefinalizata: { label: 'Nefinalizată', color: 'bg-orange-100 text-orange-800' },
  emisa:        { label: 'Emisă',        color: 'bg-blue-100 text-blue-800' },
  platita:      { label: 'Plătită',      color: 'bg-green-100 text-green-800' },
  anulata:      { label: 'Anulată',      color: 'bg-red-100 text-red-800' },
  stornata:     { label: 'Stornată',     color: 'bg-purple-100 text-purple-800' },
}

// ─── Component ───────────────────────────────────────────────────────────────

function FacturarePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<'lista' | 'nou' | 'storno'>('lista')

  // ─── Lista facturi ────────────────────────────────────────────────────────
  const [facturi, setFacturi] = useState<FacturaItem[]>([])
  const [loading, setLoading] = useState(true)

  // ─── Storno state ─────────────────────────────────────────────────────────
  const [stornoClientSearch, setStornoClientSearch] = useState('')
  const [stornoClientResults, setStornoClientResults] = useState<ClientOpt[]>([])
  const [stornoClientId, setStornoClientId] = useState<string | null>(null)
  const [showStornoClientList, setShowStornoClientList] = useState(false)
  const stornoClientRef = useRef<HTMLDivElement>(null)
  const [stornoDataEmitere, setStornoDataEmitere] = useState(new Date().toISOString().slice(0, 10))
  const [stornoObservatii, setStornoObservatii] = useState('')
  const [stornoLinii, setStornoLinii] = useState<StornoLinie[]>([])
  const [stornoLoading, setStornoLoading] = useState(false)
  const [stornoSalvand, setStornoSalvand] = useState(false)

  useEffect(() => {
    if (view === 'lista') loadFacturi()
  }, [view])

  async function loadFacturi() {
    setLoading(true)
    const supabase = createClient()

    const { data: fRows } = await supabase
      .from('facturi')
      .select('id, numar, data_emitere, status, client_id, nota_interna, clienti(denumire)')
      .order('numar', { ascending: false })
      .limit(200)

    if (!fRows) { setLoading(false); return }

    const ids = fRows.map(f => f.id)
    const { data: produse } = await supabase
      .from('facturi_produse')
      .select('factura_id, cantitate, pret_vanzare')
      .in('factura_id', ids)

    const result: FacturaItem[] = fRows.map(f => {
      const linii = (produse ?? []).filter(p => p.factura_id === f.id)
      const total = linii.reduce((s, p) => s + (p.cantitate ?? 1) * (p.pret_vanzare ?? 0), 0)
      const client = Array.isArray(f.clienti) ? f.clienti[0] : (f.clienti as { denumire: string } | null)
      return {
        id: f.id,
        numar: f.numar,
        data_emitere: f.data_emitere,
        status: f.status,
        client_denumire: client?.denumire ?? '—',
        total,
        nr_produse: linii.length,
        nota_interna: f.nota_interna ?? null,
      }
    })

    setFacturi(result)
    setLoading(false)
  }

  // ─── Creare factura noua ──────────────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<ClientOpt[]>([])
  const [clientId, setClientId] = useState<string | null>(null)
  const [showClientList, setShowClientList] = useState(false)
  const clientRef = useRef<HTMLDivElement>(null)
  const [dataEmitere, setDataEmitere] = useState(new Date().toISOString().slice(0, 10))
  const [termenPlata, setTermenPlata] = useState<number>(1)
  const [observatii, setObservatii] = useState('')

  const [randuri, setRanduri] = useState<RandFactura[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<RandFactura>(emptyRand())
  const [prodSearch, setProdSearch] = useState('')
  const [prodResults, setProdResults] = useState<ProdusSearch[]>([])
  const [stocMap, setStocMap] = useState<Record<string, number>>({})
  const [showProdList, setShowProdList] = useState(false)
  const [ultimaOfertare, setUltimaOfertare] = useState<{ pret: number; data: string; numar: number } | null>(null)
  const [pretSpecial, setPretSpecial] = useState<number | null>(null)
  const [adaosModalInput, setAdaosModalInput] = useState('')
  const prodRef = useRef<HTMLDivElement>(null)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [salvand, setSalvand] = useState(false)
  const [modalWarning, setModalWarning] = useState(false)
  const [warningItems, setWarningItems] = useState<string[]>([])
  const [editFacturaId, setEditFacturaId] = useState<string | null>(null)
  const [notaInterna, setNotaInterna] = useState('')

  function resetNou() {
    setClientSearch(''); setClientId(null); setRanduri([])
    setModal(false); setForm(emptyRand()); setProdSearch('')
    setEditIdx(null); setSalvand(false)
    setDataEmitere(new Date().toISOString().slice(0, 10))
    setTermenPlata(0)
    setObservatii('')
    setEditFacturaId(null)
    setNotaInterna('')
    setView('nou')
  }

  // Precompletare din oferta (daca vine cu ?oferta_id=...)
  useEffect(() => {
    const ofertaId = searchParams.get('oferta_id')
    if (!ofertaId) return

    async function preloadOferta() {
      const supabase = createClient()

      // Incarca oferta + client
      const { data: oferta } = await supabase
        .from('oferte')
        .select('id, client_id, clienti(denumire)')
        .eq('id', ofertaId)
        .single()
      if (!oferta) return

      const client = Array.isArray(oferta.clienti) ? oferta.clienti[0] : (oferta.clienti as { denumire: string } | null)
      setClientId(oferta.client_id)
      setClientSearch(client?.denumire ?? '')
      const { data: cl } = await supabase.from('clienti').select('termen_plata').eq('id', oferta.client_id).single()
      setTermenPlata(cl?.termen_plata ?? 1)

      // Incarca produsele ofertei
      const { data: opRows } = await supabase
        .from('oferte_produse')
        .select('id, nume_produs, cod, producator, unitate, cantitate, pret_achizitie, pret_vanzare, produs_id, stoc_id')
        .eq('oferta_id', ofertaId)
      if (!opRows?.length) { setView('nou'); return }

      const randuriFilled: RandFactura[] = await Promise.all(opRows.map(async (p) => {
        // Cauta optiunile din stoc pentru acest produs
        const orParts: string[] = []
        if (p.produs_id) orParts.push(`produs_id.eq.${p.produs_id}`)
        if (p.cod) orParts.push(`produs_cod.eq.${p.cod}`)

        let optiuni: StocOptiune[] = []
        if (orParts.length > 0) {
          const { data: stocRows } = await supabase.from('stoc')
            .select('id, pret_achizitie, pret_lista, cantitate, furnizor_nume')
            .gt('cantitate', 0).or(orParts.join(','))
            .order('updated_at', { ascending: true })
          optiuni = (stocRows ?? []) as StocOptiune[]
        }

        const totalDisponibil = optiuni.reduce((s, o) => s + o.cantitate, 0)
        // Daca stoc_id din oferta e inca valid, foloseste-l
        const idxInOptiuni = p.stoc_id ? optiuni.findIndex(o => o.id === p.stoc_id) : 0
        const stocIdx = idxInOptiuni >= 0 ? idxInOptiuni : 0
        const optSelec = optiuni[stocIdx]

        return {
          _key: Math.random().toString(36).slice(2),
          produs_id: p.produs_id ?? null,
          stoc_id: optSelec?.id ?? p.stoc_id ?? null,
          nume_produs: p.nume_produs ?? '',
          cod: p.cod ?? '',
          producator: p.producator ?? '',
          unitate: p.unitate ?? 'buc',
          cantitate: p.cantitate ?? 1,
          pret_achizitie: optSelec?.pret_achizitie ?? p.pret_achizitie ?? 0,
          pret_vanzare: p.pret_vanzare ?? 0,
          stoc_disponibil: totalDisponibil,
          stoc_optiuni: optiuni,
          stoc_idx: stocIdx,
        }
      }))

      setRanduri(randuriFilled)
      setView('nou')
    }

    preloadOferta()
  }, [searchParams])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setShowClientList(false)
      if (prodRef.current && !prodRef.current.contains(e.target as Node)) setShowProdList(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!clientSearch.trim()) { setClientResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await createClient().from('clienti').select('id, denumire')
        .ilike('denumire', `%${clientSearch}%`).limit(8)
      setClientResults(data ?? [])
    }, 200)
    return () => clearTimeout(t)
  }, [clientSearch])

  useEffect(() => {
    if (!prodSearch.trim()) { setProdResults([]); setStocMap({}); return }
    const t = setTimeout(async () => {
      const supabase = createClient()
      const q = stripDiacritice(prodSearch.trim())

      // Cauta in tabela produse
      const { data: dinProduse } = await supabase.from('produse')
        .select('id, cod, nume, unitate, producator')
        .or(`nume.ilike.%${q}%,cod.ilike.%${q}%`)
        .limit(10)

      // Cauta si direct in stoc (produse importate fara intrare in tabela produse)
      const { data: dinStoc } = await supabase.from('stoc')
        .select('produs_id, produs_cod, produs_nome, unitate, furnizor_nume, cantitate')
        .or(`produs_nome.ilike.%${q}%,produs_cod.ilike.%${q}%`)
        .gt('cantitate', 0)
        .limit(10)

      // Produsele deja gasite din tabela produse
      const idsGasite = new Set((dinProduse ?? []).map(p => p.id))
      const coduriGasite = new Set((dinProduse ?? []).filter(p => p.cod).map(p => p.cod as string))

      // Adauga din stoc doar ce nu e deja in lista (ca sa nu apara dublu)
      const extraDinStoc: ProdusSearch[] = []
      for (const s of (dinStoc ?? [])) {
        const dejaPrinId = s.produs_id && idsGasite.has(s.produs_id)
        const dejaPrinCod = s.produs_cod && coduriGasite.has(s.produs_cod)
        if (!dejaPrinId && !dejaPrinCod && s.produs_nome) {
          extraDinStoc.push({
            id: s.produs_id ?? `stoc_${s.produs_cod}`,
            cod: s.produs_cod ?? null,
            nume: s.produs_nome,
            unitate: s.unitate ?? 'buc',
            producator: null,
          })
          if (s.produs_id) idsGasite.add(s.produs_id)
          if (s.produs_cod) coduriGasite.add(s.produs_cod)
        }
      }

      const allProduse = [...(dinProduse ?? []), ...extraDinStoc]
      setProdResults(allProduse)
      if (!allProduse.length) { setStocMap({}); return }

      // Calculeaza stoc total per produs
      const ids = allProduse.filter(p => !p.id.startsWith('stoc_')).map(p => p.id)
      const cods = allProduse.filter(p => p.cod).map(p => p.cod as string)
      const orParts: string[] = []
      if (ids.length) orParts.push(`produs_id.in.(${ids.join(',')})`)
      if (cods.length) orParts.push(`produs_cod.in.(${cods.join(',')})`)
      if (!orParts.length) { setStocMap({}); return }
      const { data: stocData } = await supabase.from('stoc').select('produs_id, produs_cod, cantitate').or(orParts.join(','))
      const map: Record<string, number> = {}
      for (const row of stocData ?? []) {
        const key = row.produs_id ?? row.produs_cod ?? ''
        if (key) map[key] = (map[key] ?? 0) + row.cantitate
      }
      setStocMap(map)
    }, 200)
    return () => clearTimeout(t)
  }, [prodSearch])

  async function selectProdus(p: ProdusSearch) {
    setShowProdList(false)
    setProdSearch(p.nume)
    setUltimaOfertare(null)
    setPretSpecial(null)

    const supabase = createClient()
    const orParts: string[] = [`produs_id.eq.${p.id}`]
    if (p.cod) orParts.push(`produs_cod.eq.${p.cod}`)

    const { data: optiuni } = await supabase.from('stoc')
      .select('id, pret_achizitie, pret_lista, cantitate, furnizor_nume')
      .gt('cantitate', 0).or(orParts.join(','))
      .order('updated_at', { ascending: true })

    // Ultima ofertare — doar pentru clientul curent
    if (clientId) {
      const { data: oferteClient } = await supabase.from('oferte')
        .select('id, numar, created_at')
        .eq('client_id', clientId)
        .neq('status', 'anulata')
        .order('created_at', { ascending: false })
        .limit(50)

      if (oferteClient?.length) {
        const ofertaIds = oferteClient.map(o => o.id)
        const ofProdQuery = supabase.from('oferte_produse')
          .select('pret_vanzare, oferta_id')
          .in('oferta_id', ofertaIds)
          .order('created_at', { ascending: false })
          .limit(20)
        const { data: opRows } = p.cod ? await ofProdQuery.eq('cod', p.cod) : await ofProdQuery.eq('produs_id', p.id)
        if (opRows?.length) {
          const o = oferteClient.find(oc => oc.id === opRows[0].oferta_id)
          if (o) setUltimaOfertare({ pret: opRows[0].pret_vanzare ?? 0, data: new Date(o.created_at).toLocaleDateString('ro-RO'), numar: o.numar })
        }
      }
    }

    // Pret special
    if (clientId) {
      const pretQ = supabase.from('clienti_preturi').select('pret_vanzare').eq('client_id', clientId).limit(1)
      const { data: pretRows } = p.cod ? await pretQ.eq('produs_cod', p.cod) : await pretQ.eq('produs_id', p.id)
      if (pretRows?.length) setPretSpecial(pretRows[0].pret_vanzare)
    }

    const lista = (optiuni ?? []) as StocOptiune[]
    const prima = lista[0]
    setForm(f => ({
      ...f, produs_id: p.id, stoc_id: prima?.id ?? null, stoc_idx: 0,
      nume_produs: p.nume, cod: p.cod ?? '', producator: p.producator ?? '',
      unitate: p.unitate ?? 'buc', pret_achizitie: prima?.pret_achizitie ?? 0,
      pret_vanzare: prima?.pret_lista ?? 0,
      stoc_disponibil: lista.reduce((s, o) => s + o.cantitate, 0),
      stoc_optiuni: lista,
    }))
    const ach2 = prima?.pret_achizitie ?? 0
    const vanz2 = prima?.pret_lista ?? 0
    if (ach2 > 0 && vanz2 > 0) {
      setAdaosModalInput(((vanz2 - ach2) / ach2 * 100).toFixed(1))
    } else {
      setAdaosModalInput('')
    }
  }

  function aplicaStocOptiune(idx: number) {
    const opt = form.stoc_optiuni[idx]
    if (!opt) return
    setForm(f => ({ ...f, stoc_idx: idx, stoc_id: opt.id, pret_achizitie: opt.pret_achizitie, pret_vanzare: opt.pret_lista ?? f.pret_vanzare }))
    if (opt.pret_achizitie > 0 && (opt.pret_lista ?? 0) > 0) {
      setAdaosModalInput(((opt.pret_lista! - opt.pret_achizitie) / opt.pret_achizitie * 100).toFixed(1))
    }
  }

  function deschideModal(idx?: number) {
    if (idx !== undefined) {
      setEditIdx(idx); setForm({ ...randuri[idx] }); setProdSearch(randuri[idx].nume_produs)
      const r = randuri[idx]
      if (r.pret_achizitie > 0 && r.pret_vanzare > 0) {
        setAdaosModalInput(((r.pret_vanzare - r.pret_achizitie) / r.pret_achizitie * 100).toFixed(1))
      } else {
        setAdaosModalInput('')
      }
    } else {
      setEditIdx(null); setForm(emptyRand()); setProdSearch('')
      setAdaosModalInput('')
    }
    setUltimaOfertare(null); setPretSpecial(null)
    setModal(true)
  }

  function salveazaRand() {
    if (!form.nume_produs.trim()) return
    if (editIdx !== null) setRanduri(prev => prev.map((r, i) => i === editIdx ? { ...form } : r))
    else setRanduri(prev => [...prev, { ...form }])
    setModal(false)
  }

  async function verificaSiFactureaza() {
    if (randuri.length === 0) return
    const supabase = createClient()
    const lipsa: string[] = []
    for (const r of randuri) {
      if (r.stoc_id) {
        const { data: s } = await supabase.from('stoc').select('cantitate').eq('id', r.stoc_id).single()
        if (!s || s.cantitate < r.cantitate) lipsa.push(`${r.nume_produs} (disponibil: ${s?.cantitate ?? 0}, necesar: ${r.cantitate})`)
        continue
      }
      if (r.stoc_disponibil < r.cantitate) lipsa.push(`${r.nume_produs} (disponibil: ${r.stoc_disponibil}, necesar: ${r.cantitate})`)
    }
    if (lipsa.length > 0) { setWarningItems(lipsa); setModalWarning(true); return }
    await executaFacturare()
  }

  async function executaFacturare() {
    if (!clientId || randuri.length === 0) return
    setSalvand(true)
    const supabase = createClient()

    if (editFacturaId) {
      // Edit mode: restore old stock, delete old products, update factura, insert new products, deduct new stock

      // Restore old stock
      const { data: liniiVechi } = await supabase
        .from('facturi_produse')
        .select('stoc_id, cod, cantitate, produs_id')
        .eq('factura_id', editFacturaId)

      for (const linie of (liniiVechi ?? [])) {
        if (linie.stoc_id) {
          const { data: s } = await supabase.from('stoc').select('cantitate').eq('id', linie.stoc_id).single()
          if (s) await supabase.from('stoc').update({ cantitate: s.cantitate + linie.cantitate }).eq('id', linie.stoc_id)
          continue
        }
        if (!linie.cod) continue
        const { data: intrari } = await supabase.from('stoc').select('id, cantitate')
          .eq('produs_cod', linie.cod).order('updated_at', { ascending: true }).limit(1)
        if (intrari?.length) {
          await supabase.from('stoc').update({ cantitate: intrari[0].cantitate + linie.cantitate }).eq('id', intrari[0].id)
        }
      }

      // Delete old products
      await supabase.from('facturi_produse').delete().eq('factura_id', editFacturaId)

      // Update factura
      const scadenta = termenPlata > 0
        ? new Date(new Date(dataEmitere).getTime() + termenPlata * 86400000).toISOString().slice(0, 10)
        : null
      await supabase.from('facturi').update({
        client_id: clientId,
        data_emitere: dataEmitere,
        termen_plata: termenPlata || null,
        data_scadenta: scadenta,
        observatii: observatii.trim() || null,
        nota_interna: notaInterna.trim() || null,
      }).eq('id', editFacturaId)

      // Insert new products
      await supabase.from('facturi_produse').insert(randuri.map(r => ({
        factura_id: editFacturaId,
        produs_id: r.produs_id,
        stoc_id: r.stoc_id,
        nume_produs: r.nume_produs,
        cod: r.cod || null,
        producator: r.producator || null,
        unitate: r.unitate || 'buc',
        cantitate: r.cantitate,
        pret_achizitie: r.pret_achizitie,
        pret_vanzare: r.pret_vanzare,
      })))

      // Deduct new stock (same logic as normal)
      for (const r of randuri) {
        let deScazut = r.cantitate
        if (r.stoc_id) {
          const { data: s } = await supabase.from('stoc').select('cantitate').eq('id', r.stoc_id).single()
          if (s) await supabase.from('stoc').update({ cantitate: Math.max(0, s.cantitate - deScazut) }).eq('id', r.stoc_id)
          continue
        }
        if (!r.cod) continue
        const { data: intrari } = await supabase.from('stoc').select('id, cantitate')
          .gt('cantitate', 0).eq('produs_cod', r.cod).order('updated_at', { ascending: true })
        for (const intrare of (intrari ?? [])) {
          if (deScazut <= 0) break
          const scade = Math.min(deScazut, intrare.cantitate)
          await supabase.from('stoc').update({ cantitate: intrare.cantitate - scade }).eq('id', intrare.id)
          deScazut -= scade
        }
      }

      setSalvand(false)
      setView('lista')
      return
    }

    // 1. Creaza factura
    const { data: { user } } = await supabase.auth.getUser()
    const scadenta = termenPlata > 0
      ? new Date(new Date(dataEmitere).getTime() + termenPlata * 86400000).toISOString().slice(0, 10)
      : null
    const { data: factura, error } = await supabase.from('facturi').insert({
      client_id: clientId,
      data_emitere: dataEmitere,
      termen_plata: termenPlata || null,
      data_scadenta: scadenta,
      observatii: observatii.trim() || null,
      nota_interna: notaInterna.trim() || null,
      status: 'nefinalizata',
      created_by: user?.id ?? null,
    }).select('id, numar').single()

    if (error || !factura) {
      alert('Eroare la creare factură: ' + error?.message)
      setSalvand(false)
      return
    }

    // 2. Insereaza produsele
    const { error: prodErr } = await supabase.from('facturi_produse').insert(randuri.map(r => ({
      factura_id: factura.id,
      produs_id: r.produs_id,
      stoc_id: r.stoc_id,
      nume_produs: r.nume_produs,
      cod: r.cod || null,
      producator: r.producator || null,
      unitate: r.unitate || 'buc',
      cantitate: r.cantitate,
      pret_achizitie: r.pret_achizitie,
      pret_vanzare: r.pret_vanzare,
    })))

    if (prodErr) {
      alert('Eroare la salvare produse: ' + prodErr.message)
      setSalvand(false)
      return
    }

    // 3. Scade din stoc (FIFO)
    for (const r of randuri) {
      let deScazut = r.cantitate
      if (r.stoc_id) {
        const { data: s } = await supabase.from('stoc').select('cantitate').eq('id', r.stoc_id).single()
        if (s) await supabase.from('stoc').update({ cantitate: Math.max(0, s.cantitate - deScazut) }).eq('id', r.stoc_id)
        continue
      }
      if (!r.cod) continue
      const { data: intrari } = await supabase.from('stoc').select('id, cantitate')
        .gt('cantitate', 0).eq('produs_cod', r.cod).order('updated_at', { ascending: true })
      for (const intrare of (intrari ?? [])) {
        if (deScazut <= 0) break
        const scade = Math.min(deScazut, intrare.cantitate)
        await supabase.from('stoc').update({ cantitate: intrare.cantitate - scade }).eq('id', intrare.id)
        deScazut -= scade
      }
    }

    setSalvand(false)
    setView('lista')
  }

  async function emiteFactura(id: string) {
    const supabase = createClient()
    await supabase.from('facturi').update({ status: 'emisa' }).eq('id', id)
    loadFacturi()
  }

  async function stergeNefinalizata(id: string) {
    if (!confirm('Ștergi factura nefinalizată? Stocul va fi restituit.')) return
    const supabase = createClient()

    // Recuperează produsele facturii pentru a restitui stocul
    const { data: linii } = await supabase
      .from('facturi_produse')
      .select('stoc_id, cod, cantitate, produs_id')
      .eq('factura_id', id)

    for (const linie of (linii ?? [])) {
      if (linie.stoc_id) {
        const { data: s } = await supabase.from('stoc').select('cantitate').eq('id', linie.stoc_id).single()
        if (s) await supabase.from('stoc').update({ cantitate: s.cantitate + linie.cantitate }).eq('id', linie.stoc_id)
        continue
      }
      if (!linie.cod) continue
      // FIFO invers: adaugă înapoi la prima intrare cu acel cod
      const { data: intrari } = await supabase.from('stoc').select('id, cantitate')
        .eq('produs_cod', linie.cod).order('updated_at', { ascending: true }).limit(1)
      if (intrari?.length) {
        await supabase.from('stoc').update({ cantitate: intrari[0].cantitate + linie.cantitate }).eq('id', intrari[0].id)
      }
    }

    // Sterge factura (produsele se sterg automat prin CASCADE)
    await supabase.from('facturi').delete().eq('id', id)
    loadFacturi()
  }

  async function incarcaFacturaEdit(facturaId: string) {
    const supabase = createClient()
    const { data: factura } = await supabase
      .from('facturi')
      .select('id, client_id, data_emitere, termen_plata, observatii, nota_interna, clienti(denumire)')
      .eq('id', facturaId).single()
    if (!factura) return

    const client = Array.isArray(factura.clienti) ? factura.clienti[0] : (factura.clienti as { denumire: string } | null)
    setClientId(factura.client_id)
    setClientSearch(client?.denumire ?? '')
    setDataEmitere(factura.data_emitere)
    setTermenPlata(factura.termen_plata ?? 1)
    setObservatii(factura.observatii ?? '')
    setNotaInterna(factura.nota_interna ?? '')

    const { data: linii } = await supabase
      .from('facturi_produse')
      .select('id, produs_id, stoc_id, nume_produs, cod, producator, unitate, cantitate, pret_achizitie, pret_vanzare')
      .eq('factura_id', facturaId)
    if (!linii) return

    const randuriFilled: RandFactura[] = await Promise.all(linii.map(async (p) => {
      const orParts: string[] = []
      if (p.produs_id) orParts.push(`produs_id.eq.${p.produs_id}`)
      if (p.cod) orParts.push(`produs_cod.eq.${p.cod}`)
      let optiuni: StocOptiune[] = []
      if (orParts.length > 0) {
        const { data: stocRows } = await supabase.from('stoc')
          .select('id, pret_achizitie, pret_lista, cantitate, furnizor_nume')
          .gt('cantitate', 0).or(orParts.join(','))
          .order('updated_at', { ascending: true })
        optiuni = (stocRows ?? []) as StocOptiune[]
      }
      const totalDisponibil = optiuni.reduce((s, o) => s + o.cantitate, 0)
      const idxInOptiuni = p.stoc_id ? optiuni.findIndex(o => o.id === p.stoc_id) : 0
      const stocIdx = idxInOptiuni >= 0 ? idxInOptiuni : 0
      const optSelec = optiuni[stocIdx]
      return {
        _key: Math.random().toString(36).slice(2),
        produs_id: p.produs_id ?? null,
        stoc_id: optSelec?.id ?? p.stoc_id ?? null,
        nume_produs: p.nume_produs ?? '',
        cod: p.cod ?? '',
        producator: p.producator ?? '',
        unitate: p.unitate ?? 'buc',
        cantitate: p.cantitate ?? 1,
        pret_achizitie: optSelec?.pret_achizitie ?? p.pret_achizitie ?? 0,
        pret_vanzare: p.pret_vanzare ?? 0,
        stoc_disponibil: totalDisponibil,
        stoc_optiuni: optiuni,
        stoc_idx: stocIdx,
      }
    }))

    setRanduri(randuriFilled)
    setEditFacturaId(facturaId)
    setView('nou')
  }

  // ─── Storno functions ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!stornoClientSearch.trim()) { setStornoClientResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await createClient().from('clienti').select('id, denumire')
        .ilike('denumire', `%${stornoClientSearch}%`).limit(8)
      setStornoClientResults(data ?? [])
    }, 200)
    return () => clearTimeout(t)
  }, [stornoClientSearch])

  async function loadStornoLinii(clientId: string) {
    setStornoLoading(true)
    setStornoLinii([])
    const supabase = createClient()

    // 1. Facturi normale emise/platite ale clientului
    const { data: fRows } = await supabase
      .from('facturi')
      .select('id, numar, data_emitere')
      .eq('client_id', clientId)
      .in('status', ['emisa', 'platita'])
      .eq('tip', 'normala')
      .order('numar', { ascending: false })

    if (!fRows?.length) { setStornoLoading(false); return }

    const normalIds = fRows.map(f => f.id)

    // 2. Liniile produselor facturate
    const { data: produse } = await supabase
      .from('facturi_produse')
      .select('id, factura_id, stoc_id, produs_id, nume_produs, cod, producator, unitate, cantitate, pret_achizitie, pret_vanzare')
      .in('factura_id', normalIds)
      .gt('cantitate', 0)

    if (!produse?.length) { setStornoLoading(false); return }

    // 3. Calculeaza cantitatea deja stornata per linie EXACT via referinta_linie_id
    const linieIds = produse.map(p => p.id)
    const { data: stornoLinii } = await supabase
      .from('facturi_produse')
      .select('referinta_linie_id, cantitate')
      .in('referinta_linie_id', linieIds)
      .lt('cantitate', 0)

    const stornateMap: Record<string, number> = {}
    for (const sl of stornoLinii ?? []) {
      if (sl.referinta_linie_id) {
        stornateMap[sl.referinta_linie_id] = (stornateMap[sl.referinta_linie_id] ?? 0) + Math.abs(sl.cantitate)
      }
    }

    // 4. Filtreaza liniile deja integral stornate, arata doar cantitatea ramasa
    const linii: StornoLinie[] = []
    for (const p of produse) {
      const f = fRows.find(f => f.id === p.factura_id)!
      const dejaStornat = stornateMap[p.id] ?? 0
      const disponibil = p.cantitate - dejaStornat

      if (disponibil <= 0) continue

      linii.push({
        _key: p.id,
        factura_id: p.factura_id,
        factura_numar: f.numar,
        factura_data: f.data_emitere,
        linie_id: p.id,
        produs_id: (p as { produs_id?: string | null }).produs_id ?? null,
        stoc_id: p.stoc_id,
        nume_produs: p.nume_produs ?? '',
        cod: p.cod,
        producator: p.producator,
        unitate: p.unitate ?? 'buc',
        cantitate_maxima: disponibil,
        cantitate: disponibil,
        pret_achizitie: p.pret_achizitie ?? 0,
        pret_vanzare: p.pret_vanzare ?? 0,
        selectat: false,
      })
    }

    setStornoLinii(linii)
    setStornoLoading(false)
  }

  async function emiteStorno() {
    const selectate = stornoLinii.filter(l => l.selectat && l.cantitate > 0)
    if (!selectate.length || !stornoClientId) return
    if (!confirm(`Emiți o factură storno cu ${selectate.length} produs(e)? Stocul va fi restituit.`)) return

    setStornoSalvand(true)
    const supabase = createClient()

    const { data: storno, error } = await supabase.from('facturi').insert({
      client_id: stornoClientId,
      data_emitere: stornoDataEmitere,
      status: 'emisa',
      tip: 'storno',
      observatii: stornoObservatii.trim() || null,
    }).select('id').single()

    if (error || !storno) {
      alert('Eroare la creare storno: ' + error?.message)
      setStornoSalvand(false)
      return
    }

    await supabase.from('facturi_produse').insert(
      selectate.map(l => ({
        factura_id: storno.id,
        referinta_linie_id: l.linie_id,
        produs_id: l.produs_id,
        stoc_id: l.stoc_id,
        nume_produs: l.nume_produs,
        cod: l.cod,
        producator: l.producator,
        unitate: l.unitate,
        cantitate: -l.cantitate,
        pret_achizitie: l.pret_achizitie,
        pret_vanzare: l.pret_vanzare,
      }))
    )

    for (const l of selectate) {
      if (l.stoc_id) {
        const { data: s } = await supabase.from('stoc').select('cantitate').eq('id', l.stoc_id).single()
        if (s) await supabase.from('stoc').update({ cantitate: s.cantitate + l.cantitate }).eq('id', l.stoc_id)
        continue
      }
      if (!l.cod) continue
      const { data: intrari } = await supabase.from('stoc').select('id, cantitate')
        .eq('produs_cod', l.cod).order('updated_at', { ascending: true }).limit(1)
      if (intrari?.length) {
        await supabase.from('stoc').update({ cantitate: intrari[0].cantitate + l.cantitate }).eq('id', intrari[0].id)
      }
    }

    router.push(`/facturare/${storno.id}`)
  }

  const total = randuri.reduce((s, r) => s + r.cantitate * r.pret_vanzare, 0)
  const totalAch = randuri.reduce((s, r) => s + r.cantitate * r.pret_achizitie, 0)
  const adaos = totalAch > 0 ? ((total - totalAch) / totalAch) * 100 : null

  // ─── Filtre lista ─────────────────────────────────────────────────────────
  const [filtruStatus, setFiltruStatus] = useState('')
  const [filtruClient, setFiltruClient] = useState('')
  const [filtruDe, setFiltruDe] = useState('')
  const [filtruPana, setFiltruPana] = useState('')

  const facturiFiltrate = facturi.filter(f => {
    if (filtruStatus && f.status !== filtruStatus) return false
    if (filtruClient && !f.client_denumire.toLowerCase().includes(filtruClient.toLowerCase())) return false
    if (filtruDe && f.data_emitere < filtruDe) return false
    if (filtruPana && f.data_emitere > filtruPana) return false
    return true
  })

  // ─── RENDER LISTA ─────────────────────────────────────────────────────────

  if (view === 'lista') {
    return (
      <div className="space-y-4 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Facturi</h2>
            <p className="text-sm text-gray-600 mt-0.5">Facturi emise către clienți</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setStornoClientSearch(''); setStornoClientId(null); setStornoLinii([]); setStornoObservatii(''); setStornoDataEmitere(new Date().toISOString().slice(0, 10)); setView('storno') }}
              className="px-5 py-2.5 font-bold rounded-xl text-sm shadow-sm border border-purple-300 text-purple-800 bg-purple-50 hover:bg-purple-100">
              ↩ Factură storno
            </button>
            <button onClick={resetNou}
              className="px-5 py-2.5 text-white font-bold rounded-xl text-sm shadow-sm"
              style={{ backgroundColor: '#0f172a' }}>
              + Factură nouă
            </button>
          </div>
        </div>

        {/* Filtre */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={filtruStatus} onChange={e => setFiltruStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Toate</option>
              <option value="nefinalizata">Nefinalizată</option>
              <option value="emisa">Emisă</option>
              <option value="platita">Plătită</option>
              <option value="anulata">Anulată</option>
              <option value="stornata">Stornată</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
            <input type="text" value={filtruClient} onChange={e => setFiltruClient(e.target.value)}
              placeholder="Caută client..." className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">De la</label>
            <input type="date" value={filtruDe} onChange={e => setFiltruDe(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Până la</label>
            <input type="date" value={filtruPana} onChange={e => setFiltruPana(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {(filtruStatus || filtruClient || filtruDe || filtruPana) && (
            <button onClick={() => { setFiltruStatus(''); setFiltruClient(''); setFiltruDe(''); setFiltruPana('') }}
              className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 border border-gray-200 rounded-lg">
              ✕ Resetează
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500 self-end">{facturiFiltrate.length} facturi</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-600">Se încarcă...</div>
          ) : facturiFiltrate.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-4xl mb-3">🧾</p>
              <p className="text-gray-800 font-semibold mb-1">Nicio factură emisă</p>
              <p className="text-sm text-gray-600 mb-5">Apasă butonul de mai sus pentru a emite prima factură.</p>
              <button onClick={resetNou}
                className="px-5 py-2.5 text-white font-bold rounded-xl text-sm"
                style={{ backgroundColor: '#0f172a' }}>
                + Factură nouă
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-700">Nr.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-700">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-700">Data</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-700">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-700">Produse</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-700">Total</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {facturiFiltrate.map(f => {
                  const s = STATUS_LABEL[f.status] ?? { label: f.status, color: 'bg-gray-100 text-gray-700' }
                  return (
                    <tr key={f.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-mono font-bold text-gray-900">#{f.numar}</span>
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {f.client_denumire}
                        {f.nota_interna && (
                          <p className="text-xs text-amber-700 font-normal mt-0.5">📌 {f.nota_interna}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        {new Date(f.data_emitere).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.color}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">{f.nr_produse}</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900">
                        {f.total.toFixed(2)} <span className="text-gray-500 font-normal text-xs">RON</span>
                      </td>
                      <td className="px-5 py-3 text-right flex items-center justify-end gap-2">
                        {f.status === 'nefinalizata' && (
                          <>
                            <button
                              onClick={() => incarcaFacturaEdit(f.id)}
                              className="text-xs text-blue-600 font-semibold px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50">
                              ✏ Editează
                            </button>
                            <button
                              onClick={() => stergeNefinalizata(f.id)}
                              className="text-xs text-red-600 font-semibold px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50">
                              Șterge
                            </button>
                            <button
                              onClick={() => emiteFactura(f.id)}
                              className="text-xs text-white font-bold px-3 py-1.5 rounded-lg"
                              style={{ backgroundColor: '#0f172a' }}>
                              🧾 Emite factură
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => router.push(`/facturare/${f.id}`)}
                          className="text-xs text-blue-700 font-semibold hover:underline px-2 py-1 rounded hover:bg-blue-50">
                          Vezi →
                        </button>
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

  // ─── RENDER STORNO ────────────────────────────────────────────────────────

  if (view === 'storno') {
    const stornoSelectate = stornoLinii.filter(l => l.selectat && l.cantitate > 0)
    const stornoTotal = stornoSelectate.reduce((s, l) => s + l.cantitate * l.pret_vanzare, 0)

    // Group lines by invoice
    const grupuriFacturi = stornoLinii.reduce<Record<string, StornoLinie[]>>((acc, l) => {
      if (!acc[l.factura_id]) acc[l.factura_id] = []
      acc[l.factura_id].push(l)
      return acc
    }, {})

    return (
      <div className="space-y-6 max-w-5xl pb-32">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('lista')} className="text-sm text-gray-700 hover:text-gray-900 font-medium">
            ← Înapoi la facturi
          </button>
          <span className="text-gray-300">|</span>
          <h2 className="text-2xl font-bold text-gray-900">Factură storno</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">STORNO</span>
        </div>

        {/* Client + data */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Client</label>
              <div ref={stornoClientRef} className="relative">
                <input type="text" value={stornoClientSearch}
                  onChange={e => { setStornoClientSearch(e.target.value); setShowStornoClientList(true); setStornoClientId(null); setStornoLinii([]) }}
                  onFocus={() => setShowStornoClientList(true)}
                  placeholder="Caută client..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {showStornoClientList && stornoClientResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {stornoClientResults.map(c => (
                      <button key={c.id} onClick={() => {
                        setStornoClientId(c.id)
                        setStornoClientSearch(c.denumire)
                        setShowStornoClientList(false)
                        loadStornoLinii(c.id)
                      }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-purple-50 border-b border-gray-100 last:border-0">
                        {c.denumire}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {stornoClientId && <p className="mt-1.5 text-xs text-green-700 font-medium">✓ Client selectat</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Data emiterii</label>
              <input type="date" value={stornoDataEmitere} onChange={e => setStornoDataEmitere(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Observații</label>
              <input type="text" value={stornoObservatii} onChange={e => setStornoObservatii(e.target.value)}
                placeholder="ex: Storno parțial factură..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Produse facturate */}
        {stornoClientId && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Produse facturate clientului
                {stornoLinii.length > 0 && <span className="ml-2 text-gray-500 font-normal">({stornoLinii.length} linii)</span>}
              </h3>
              {stornoLinii.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => setStornoLinii(prev => prev.map(l => ({ ...l, selectat: true })))}
                    className="text-xs text-purple-700 font-semibold px-3 py-1.5 border border-purple-200 rounded-lg hover:bg-purple-50">
                    Selectează tot
                  </button>
                  <button onClick={() => setStornoLinii(prev => prev.map(l => ({ ...l, selectat: false })))}
                    className="text-xs text-gray-600 font-semibold px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                    Deselectează tot
                  </button>
                </div>
              )}
            </div>

            {stornoLoading ? (
              <div className="px-5 py-10 text-center text-sm text-gray-600">Se încarcă...</div>
            ) : stornoLinii.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm text-gray-600">Nicio factură emisă sau plătită pentru acest client.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 w-8"></th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-700">Factură</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-700">Produs</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Cant. facturată</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Cant. storno</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Preț vânz.</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(grupuriFacturi).map(liniiFactura => {
                    const primalinie = liniiFactura[0]
                    return liniiFactura.map((l, li) => (
                      <tr key={l._key} className={`border-t border-gray-100 ${l.selectat ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-2.5 text-center">
                          <input type="checkbox" checked={l.selectat}
                            onChange={e => setStornoLinii(prev => prev.map(x => x._key === l._key ? { ...x, selectat: e.target.checked } : x))}
                            className="w-4 h-4 accent-purple-600 cursor-pointer"
                          />
                        </td>
                        {li === 0 ? (
                          <td className="px-4 py-2.5" rowSpan={liniiFactura.length}>
                            <span className="font-mono font-bold text-gray-900">#{primalinie.factura_numar}</span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(primalinie.factura_data).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </p>
                          </td>
                        ) : null}
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">{l.nume_produs}</p>
                          <div className="flex gap-2 mt-0.5">
                            {l.cod && <span className="text-xs text-gray-500 font-mono">{l.cod}</span>}
                            {l.producator && <span className="text-xs text-gray-500">{l.producator}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{l.cantitate_maxima} {l.unitate}</td>
                        <td className="px-4 py-2.5 text-right">
                          <input type="number" min={0.01} max={l.cantitate_maxima} step={1}
                            value={l.cantitate}
                            onChange={e => {
                              const v = Math.min(parseFloat(e.target.value) || 0, l.cantitate_maxima)
                              setStornoLinii(prev => prev.map(x => x._key === l._key ? { ...x, cantitate: v } : x))
                            }}
                            disabled={!l.selectat}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-900">{l.pret_vanzare.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                          {l.selectat ? (l.cantitate * l.pret_vanzare).toFixed(2) : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))
                  })}
                </tbody>
                {stornoSelectate.length > 0 && (
                  <tfoot className="border-t-2 border-gray-200 bg-purple-50">
                    <tr>
                      <td colSpan={6} className="px-4 py-2 text-right text-xs text-gray-600">Total storno fără TVA:</td>
                      <td className="px-4 py-2 text-right font-semibold text-purple-800">-{stornoTotal.toFixed(2)} RON</td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="px-4 py-2 text-right text-xs text-gray-600">Total storno cu TVA 21%:</td>
                      <td className="px-4 py-2 text-right font-bold text-purple-900">-{(stornoTotal * 1.21).toFixed(2)} RON</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        )}

        {/* Bara jos */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-gray-200 px-6 py-4 flex items-center justify-between shadow-lg">
          <button onClick={() => setView('lista')} className="text-sm font-medium text-gray-700 hover:text-gray-900">← Înapoi</button>
          <div className="flex items-center gap-4">
            {stornoSelectate.length > 0 && (
              <span className="text-sm text-gray-600">
                {stornoSelectate.length} produs(e) selectat(e) · <strong className="text-purple-800">-{stornoTotal.toFixed(2)} RON</strong>
              </span>
            )}
            <button onClick={emiteStorno} disabled={stornoSalvand || stornoSelectate.length === 0}
              className="px-8 py-2.5 font-bold rounded-lg disabled:opacity-40 text-sm text-white"
              style={{ backgroundColor: '#7c3aed' }}>
              {stornoSalvand ? 'Se procesează...' : '↩ Emite factură storno'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── RENDER CREARE FACTURA ────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl pb-32">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('lista')} className="text-sm text-gray-700 hover:text-gray-900 font-medium">
          ← Înapoi la facturi
        </button>
        <span className="text-gray-300">|</span>
        <h2 className="text-2xl font-bold text-gray-900">Factură nouă</h2>
      </div>

      {/* Client + date factura */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Client */}
          <div className="md:col-span-1">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Client</label>
            <div ref={clientRef} className="relative">
              <input type="text" value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientList(true); setClientId(null) }}
                onFocus={() => setShowClientList(true)}
                placeholder="Caută client..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showClientList && clientResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clientResults.map(c => (
                    <button key={c.id} onClick={async () => {
                      setClientId(c.id); setClientSearch(c.denumire); setShowClientList(false)
                      const { data: cl } = await createClient().from('clienti').select('termen_plata').eq('id', c.id).single()
                      setTermenPlata(cl?.termen_plata ?? 1)
                    }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                      {c.denumire}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clientId && <p className="mt-1.5 text-xs text-green-700 font-medium">✓ Client selectat</p>}
          </div>

          {/* Data emiterii */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Data emiterii</label>
            <input type="date" value={dataEmitere} onChange={e => setDataEmitere(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Termen plata */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Termen plată (zile)</label>
            <input type="number" min={1} value={termenPlata} onChange={e => setTermenPlata(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1"
            />
            {termenPlata > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                Scadent: {new Date(new Date(dataEmitere).getTime() + termenPlata * 86400000).toLocaleDateString('ro-RO')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Observatii */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Observații (apar pe factură)</label>
        <textarea
          value={observatii}
          onChange={e => setObservatii(e.target.value)}
          rows={3}
          placeholder="ex: Conform comanda nr. 123, livrare la depozit..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400"
        />
      </div>

      {/* Nota interna */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="block text-sm font-semibold text-gray-900 mb-1">
          Notă internă <span className="text-xs font-normal text-gray-500">(nu apare pe factură)</span>
        </label>
        <textarea
          value={notaInterna}
          onChange={e => setNotaInterna(e.target.value)}
          rows={2}
          placeholder="ex: Client plătitor lent, verificat stoc..."
          className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none placeholder:text-gray-400 bg-amber-50"
        />
      </div>

      {/* Produse */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Produse</h3>
          <button onClick={() => deschideModal()}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg">
            + Adaugă produs
          </button>
        </div>

        {randuri.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-600">
            Niciun produs adăugat. Apasă „+ Adaugă produs".
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-700">Produs</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Cant.</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Preț vânz.</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Adaos</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Total fără TVA</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">TVA 21%</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">Total cu TVA</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {randuri.map((r, i) => (
                <tr key={r._key} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {r.stoc_disponibil === 0 && <span title="Nu este în stoc" className="text-red-500 text-xs font-bold">⚠</span>}
                      {r.stoc_disponibil > 0 && r.cantitate > r.stoc_disponibil && <span title="Stoc insuficient" className="text-orange-500 text-xs font-bold">⚠</span>}
                      <div>
                        <p className="font-medium text-gray-900">{r.nume_produs}</p>
                        {r.cod && <p className="text-xs text-gray-600 font-mono">{r.cod}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">{r.cantitate} {r.unitate}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{r.pret_vanzare.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.pret_achizitie > 0 ? (
                      <span className={`text-xs font-semibold ${((r.pret_vanzare - r.pret_achizitie) / r.pret_achizitie) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {((r.pret_vanzare - r.pret_achizitie) / r.pret_achizitie * 100).toFixed(1)}%
                      </span>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{(r.cantitate * r.pret_vanzare).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">{(r.cantitate * r.pret_vanzare * 0.21).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{(r.cantitate * r.pret_vanzare * 1.21).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => deschideModal(i)} className="text-xs text-blue-600 font-semibold px-2 py-1 rounded hover:bg-blue-50">✏</button>
                      <button onClick={() => setRanduri(prev => prev.filter(x => x._key !== r._key))} className="text-xs text-red-600 font-semibold px-2 py-1 rounded hover:bg-red-50">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-2 text-right text-xs text-gray-600">Total fără TVA:</td>
                <td className="px-4 py-2 text-right text-gray-800 font-medium">{total.toFixed(2)} RON</td>
                <td colSpan={3} />
              </tr>
              <tr>
                <td colSpan={4} className="px-4 py-2 text-right text-xs text-gray-600">TVA 21%:</td>
                <td className="px-4 py-2 text-right text-gray-700">{(total * 0.21).toFixed(2)} RON</td>
                <td colSpan={3} />
              </tr>
              <tr className="border-t border-gray-300">
                <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-gray-900">Total cu TVA:</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900 text-base">{(total * 1.21).toFixed(2)} RON</td>
                <td colSpan={3} />
              </tr>
              {adaos !== null && (
                <tr>
                  <td colSpan={4} className="px-4 py-1.5 text-right text-xs text-gray-600">Adaos total:</td>
                  <td className="px-4 py-1.5 text-right text-sm font-bold" style={{ color: adaos >= 0 ? '#16a34a' : '#dc2626' }}>
                    {adaos >= 0 ? '+' : ''}{adaos.toFixed(1)}%
                    <span className="font-normal text-xs text-gray-500 ml-1">({(total - totalAch).toFixed(2)} RON)</span>
                  </td>
                  <td colSpan={3} />
                </tr>
              )}
            </tfoot>
          </table>
        )}
      </div>

      {/* Bara jos */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-gray-200 px-6 py-4 flex items-center justify-between shadow-lg">
        <button onClick={() => setView('lista')} className="text-sm font-medium text-gray-700 hover:text-gray-900">← Înapoi</button>
        <button onClick={verificaSiFactureaza} disabled={salvand || !clientId || randuri.length === 0}
          className="px-8 py-2.5 text-white font-bold rounded-lg disabled:opacity-40 text-sm"
          style={{ backgroundColor: '#0f172a' }}>
          {salvand ? 'Se procesează...' : '💾 Salvează nefinalizată'}
        </button>
      </div>

      {/* Modal adauga produs */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">{editIdx !== null ? 'Editează produs' : 'Adaugă produs'}</h3>
              <button onClick={() => setModal(false)} className="text-gray-600 hover:text-gray-900 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 font-bold">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div ref={prodRef} className="relative">
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Produs</label>
                <input type="text" value={prodSearch}
                  onChange={e => { setProdSearch(e.target.value); setShowProdList(true) }}
                  onFocus={() => setShowProdList(true)}
                  placeholder="Caută după nume sau cod..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showProdList && prodResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {prodResults.map(p => {
                      const cantStoc = stocMap[p.id] ?? (p.cod ? stocMap[p.cod] : 0) ?? 0
                      return (
                        <button key={p.id} onClick={() => selectProdus(p)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center justify-between gap-2">
                          <span>
                            <span className="font-medium text-gray-900">{p.nume}</span>
                            {p.cod && <span className="text-gray-600 ml-2 font-mono text-xs">{p.cod}</span>}
                          </span>
                          <span className={`text-xs font-semibold whitespace-nowrap px-1.5 py-0.5 rounded ${cantStoc > 0 ? 'text-green-700 bg-green-100' : 'text-gray-600 bg-gray-100'}`}>
                            stoc: {cantStoc}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {form.produs_id && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs bg-gray-50 rounded-lg p-2.5">
                    <span className="text-gray-700">Cod: <strong className="text-gray-900 font-mono">{form.cod || '—'}</strong></span>
                    <span className="text-gray-700">UM: <strong className="text-gray-900">{form.unitate}</strong></span>
                    {form.producator && <span className="text-gray-700 col-span-2">Producător: <strong className="text-gray-900">{form.producator}</strong></span>}
                  </div>
                )}
              </div>

              {form.stoc_optiuni.length > 1 && (
                <div className="border border-blue-200 rounded-lg overflow-hidden">
                  <div className="bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 border-b border-blue-200">
                    📦 {form.stoc_optiuni.length} intrări în stoc — alege de unde facturezi:
                  </div>
                  {form.stoc_optiuni.map((opt, i) => (
                    <button key={opt.id} onClick={() => aplicaStocOptiune(i)}
                      className="w-full text-left px-3 py-2 flex items-center justify-between text-sm border-b border-blue-100 last:border-0"
                      style={{ backgroundColor: form.stoc_idx === i ? '#eff6ff' : 'white' }}>
                      <span className="flex items-center gap-2">
                        <span style={{ color: form.stoc_idx === i ? '#1d4ed8' : 'transparent' }} className="font-bold">✓</span>
                        <span className="text-gray-800">{opt.furnizor_nume || 'Furnizor necunoscut'}</span>
                        <span className="text-gray-600 text-xs">· {opt.cantitate} buc stoc</span>
                      </span>
                      <span className="text-xs text-gray-800 font-mono font-semibold">{opt.pret_achizitie.toFixed(2)} RON</span>
                    </button>
                  ))}
                </div>
              )}
              {form.produs_id && form.stoc_optiuni.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <span>⚠</span><span>Produsul <strong>nu este în stoc</strong>. Poți introduce prețurile manual.</span>
                </div>
              )}
              {form.produs_id && form.stoc_optiuni.length === 1 && (
                <div className="flex items-center gap-2 text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <span>✓</span><span>Prețuri preluate din gestiune · disponibil: <strong>{form.stoc_disponibil} {form.unitate}</strong></span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Cantitate</label>
                <input type="number" min={1} step={1} value={form.cantitate}
                  onChange={e => setForm(f => ({ ...f, cantitate: parseFloat(e.target.value) || 1 }))}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {form.stoc_disponibil > 0 && form.cantitate > form.stoc_disponibil && (
                  <p className="text-xs text-orange-700 mt-1 font-medium">⚠ Cantitate mai mare decât stocul disponibil ({form.stoc_disponibil})</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Preț achiziție */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">
                    Preț achiziție
                    {form.stoc_optiuni.length > 0 && <span className="block text-xs text-gray-500 font-normal">(din gestiune)</span>}
                  </label>
                  <input type="number" min={0} step={0.01} value={form.pret_achizitie}
                    onChange={e => {
                      if (form.stoc_optiuni.length > 0) return
                      const ach = parseFloat(e.target.value) || 0
                      const adaos = parseFloat(adaosModalInput)
                      const newVanz = ach > 0 && !isNaN(adaos)
                        ? parseFloat((ach * (1 + adaos / 100)).toFixed(2))
                        : 0
                      setForm(f => ({ ...f, pret_achizitie: ach, pret_vanzare: newVanz }))
                    }}
                    readOnly={form.stoc_optiuni.length > 0}
                    className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.stoc_optiuni.length > 0 ? 'bg-gray-50 border-gray-200 cursor-not-allowed' : 'border-gray-300'}`}
                  />
                </div>
                {/* Adaos % — activ doar după ce ai preț achiziție */}
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${form.pret_achizitie > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                    Adaos %
                  </label>
                  <div className="relative">
                    <input
                      type="number" step="0.1"
                      value={adaosModalInput}
                      disabled={form.pret_achizitie <= 0}
                      onChange={e => {
                        setAdaosModalInput(e.target.value)
                        const adaos = parseFloat(e.target.value)
                        if (!isNaN(adaos) && form.pret_achizitie > 0) {
                          setForm(f => ({ ...f, pret_vanzare: parseFloat((f.pret_achizitie * (1 + adaos / 100)).toFixed(2)) }))
                        }
                      }}
                      placeholder={form.pret_achizitie > 0 ? '0' : '—'}
                      className={`w-full px-3 py-2 pr-8 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        form.pret_achizitie <= 0 ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' :
                        parseFloat(adaosModalInput) > 0 ? 'border-green-400 bg-green-50 text-green-800' :
                        parseFloat(adaosModalInput) < 0 ? 'border-red-400 bg-red-50 text-red-800' :
                        'border-orange-300 bg-orange-50 text-gray-900'
                      }`}
                    />
                    <span className="absolute right-3 top-2.5 text-sm text-gray-400 pointer-events-none">%</span>
                  </div>
                </div>
                {/* Preț vânzare — blocat, calculat automat */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                    <label className="text-sm font-medium text-gray-900">
                      Preț vânzare
                      <span className="ml-1 text-xs text-gray-400 font-normal">(calculat)</span>
                    </label>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {pretSpecial !== null && (
                        <button type="button"
                          onClick={() => {
                            if (form.pret_achizitie > 0) {
                              const adaos = ((pretSpecial! - form.pret_achizitie) / form.pret_achizitie * 100)
                              setAdaosModalInput(adaos.toFixed(1))
                              setForm(f => ({ ...f, pret_vanzare: pretSpecial! }))
                            }
                          }}
                          className="text-xs font-bold rounded px-1.5 py-0.5"
                          style={{ color: '#5b21b6', backgroundColor: '#ede9fe', border: '1px solid #a78bfa' }}>
                          ⭐ {pretSpecial!.toFixed(2)}
                        </button>
                      )}
                      {ultimaOfertare && (
                        <button type="button"
                          onClick={() => {
                            if (form.pret_achizitie > 0) {
                              const adaos = ((ultimaOfertare.pret - form.pret_achizitie) / form.pret_achizitie * 100)
                              setAdaosModalInput(adaos.toFixed(1))
                              setForm(f => ({ ...f, pret_vanzare: ultimaOfertare.pret }))
                            }
                          }}
                          className="text-xs font-semibold rounded px-1.5 py-0.5"
                          style={{ color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}>
                          📋 #{ultimaOfertare.numar} · {ultimaOfertare.pret.toFixed(2)}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={`w-full px-3 py-2 border rounded-lg text-sm font-bold text-right cursor-not-allowed ${
                    form.pret_vanzare > 0 ? 'bg-green-50 border-green-300 text-green-900' : 'bg-gray-100 border-gray-200 text-gray-400'
                  }`}>
                    {form.pret_vanzare > 0 ? form.pret_vanzare.toFixed(2) + ' RON' : '—'}
                  </div>
                </div>
              </div>

              {form.pret_achizitie > 0 && form.pret_vanzare > 0 && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${form.pret_vanzare >= form.pret_achizitie ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  <span>{form.pret_vanzare >= form.pret_achizitie ? '▲' : '▼'} Adaos:</span>
                  <span className="text-base">{(((form.pret_vanzare - form.pret_achizitie) / form.pret_achizitie) * 100).toFixed(1)}%</span>
                  <span className="font-normal text-xs opacity-70">({(form.pret_vanzare - form.pret_achizitie).toFixed(2)} RON / buc)</span>
                </div>
              )}
            </div>
            <div className="px-6 pb-6">
              <button onClick={salveazaRand} disabled={!form.nume_produs.trim()}
                className="w-full py-3 bg-gray-900 text-white font-bold rounded-lg disabled:opacity-40">
                {editIdx !== null ? 'Salvează modificările' : 'Adaugă produs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal warning stoc */}
      {modalWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Stoc insuficient</h3>
                <p className="text-sm text-gray-700">Următoarele produse nu au suficient stoc:</p>
              </div>
            </div>
            <ul className="space-y-1">
              {warningItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-800">
                  <span className="mt-0.5">•</span><span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-gray-800">Vrei să continui oricum?</p>
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setModalWarning(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-semibold hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={() => { setModalWarning(false); executaFacturare() }}
                className="px-5 py-2 bg-red-600 text-white font-bold rounded-lg text-sm">
                Continuă oricum
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FacturarePage() {
  return (
    <Suspense>
      <FacturarePageInner />
    </Suspense>
  )
}
