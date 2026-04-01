'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { read, utils } from 'xlsx'
import ProdusNouModal from '@/components/produse/ProdusNouModal'

// ─── Tipuri ─────────────────────────────────────────────────────────────────

interface StocItem {
  id: string
  produs_id: string | null
  produs_cod: string | null
  produs_nume: string
  producator: string | null
  unitate: string | null
  cantitate: number
  pret_achizitie: number
  pret_lista: number | null
  furnizor_id: string | null
  furnizor_nume: string | null
  updated_at: string
}

interface NirRow {
  id: string
  numar: number
  numar_document: string | null
  data_document: string | null
  data_intrare: string
  data_scadenta: string | null
  furnizor_id: string | null
  furnizor_nume: string | null
  total_fara_tva: number
  total_tva: number
  total_cu_tva: number
  valoare_factura_verificare: number | null
  corectie_valoare: number
  created_at: string
}

interface NirProdusForm {
  _key: string
  produs_id: string | null
  produs_cod: string
  produs_nume: string
  producator: string
  cantitate: number
  unitate: string
  pret_achizitie: number
}

interface ImportStocRow {
  _key: string
  produs_cod: string
  produs_nume: string
  unitate: string
  cantitate: number
  pret_achizitie: number
}

interface ProdusSearch {
  id: string
  cod: string | null
  nume: string
  unitate: string | null
  producator: string | null
  pret: number | null
}

interface FurnizorOpt {
  id: string
  denumire: string
  is_favorit: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function emptyProdus(): NirProdusForm {
  return {
    _key: Math.random().toString(36).slice(2),
    produs_id: null,
    produs_cod: '',
    produs_nume: '',
    producator: '',
    cantitate: 1,
    unitate: 'buc',
    pret_achizitie: 0,
  }
}

const TVA = 0.21

// ─── Component ──────────────────────────────────────────────────────────────

export default function GestiunePage() {
  const [tab, setTab] = useState<'stoc' | 'nir'>('stoc')
  const [isAdmin, setIsAdmin] = useState(false)

  // Modal Ajustare Stoc (admin only)
  const [modalAjustare, setModalAjustare] = useState(false)
  const [ajustareStocId, setAjustareStocId] = useState<string | null>(null)
  const [ajustareNume, setAjustareNume] = useState('')
  const [ajustareCantitate, setAjustareCantitate] = useState('')
  const [ajustareMotiv, setAjustareMotiv] = useState('')
  const [salvandAjustare, setSalvandAjustare] = useState(false)

  // Stoc
  const [stoc, setStoc] = useState<StocItem[]>([])
  const [loadingStoc, setLoadingStoc] = useState(true)
  const [cautareStoc, setCautareStoc] = useState('')
  // Rezervari: stoc_id (sau `cod:X`) → lista clienti care au produs in factura nefinalizata
  const [rezervari, setRezervari] = useState<Record<string, { client: string; cantitate: number }[]>>({})

  // NIR list
  const [nirList, setNirList] = useState<NirRow[]>([])
  const [loadingNir, setLoadingNir] = useState(false)

  // Modal Intrare Marfă
  const [modalIntrare, setModalIntrare] = useState(false)
  const [furnizorSearch, setFurnizorSearch] = useState('')
  const [furnizorResults, setFurnizorResults] = useState<FurnizorOpt[]>([])
  const [furnizorId, setFurnizorId] = useState<string | null>(null)
  const [furnizorLabel, setFurnizorLabel] = useState('')
  const [showFurnList, setShowFurnList] = useState(false)
  const [dataIntrare, setDataIntrare] = useState(new Date().toISOString().split('T')[0])
  const [numarDocument, setNumarDocument] = useState('')
  const [dataDocument, setDataDocument] = useState('')
  const [dataScadenta, setDataScadenta] = useState('')
  const [valoareFacturaVerif, setValoareFacturaVerif] = useState('')
  const [nirProduse, setNirProduse] = useState<NirProdusForm[]>([emptyProdus()])
  const [salvandNir, setSalvandNir] = useState(false)
  const [numarDocError, setNumarDocError] = useState(false)
  const [furnizorError, setFurnizorError] = useState(false)
  const [modalProdusNouKey, setModalProdusNouKey] = useState<string | null>(null)
  const [editNirId, setEditNirId] = useState<string | null>(null)
  const [editOriginalProduse, setEditOriginalProduse] = useState<NirProdusForm[]>([])

  // Modal Import Stoc
  const [modalImport, setModalImport] = useState(false)
  const [importStep, setImportStep] = useState<'idle' | 'preview' | 'importing' | 'done'>('idle')
  const [importRows, setImportRows] = useState<ImportStocRow[]>([])
  const [importProgress, setImportProgress] = useState(0)

  // Cautare produs per rand NIR
  const [prodSearchMap, setProdSearchMap] = useState<Record<string, string>>({})
  const [prodResultsMap, setProdResultsMap] = useState<Record<string, ProdusSearch[]>>({})
  const [showProdMap, setShowProdMap] = useState<Record<string, boolean>>({})

  const furnRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    incarcaStoc()
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => { if (data?.role === 'admin') setIsAdmin(true) })
    })
  }, [])
  useEffect(() => { if (tab === 'nir') incarcaNir() }, [tab])

  async function incarcaStoc() {
    setLoadingStoc(true)
    const supabase = createClient()
    const { data } = await supabase.from('stoc').select('*').order('produs_nume')
    setStoc((data as StocItem[]) ?? [])

    // Incarca rezervarile: produse din facturi nefinalizate
    const { data: nefinalizate } = await supabase
      .from('facturi')
      .select('id, clienti(denumire)')
      .eq('status', 'nefinalizata')

    if (nefinalizate && nefinalizate.length > 0) {
      const clientMap: Record<string, string> = {}
      for (const f of nefinalizate) {
        const c = Array.isArray(f.clienti) ? f.clienti[0] : (f.clienti as { denumire: string } | null)
        clientMap[f.id] = c?.denumire ?? '(necunoscut)'
      }
      const ids = nefinalizate.map(f => f.id)
      const { data: fp } = await supabase
        .from('facturi_produse')
        .select('stoc_id, cod, cantitate, factura_id')
        .in('factura_id', ids)

      const map: Record<string, { client: string; cantitate: number }[]> = {}
      for (const p of (fp ?? [])) {
        const key = p.stoc_id ?? `cod:${p.cod ?? ''}`
        if (!map[key]) map[key] = []
        map[key].push({ client: clientMap[p.factura_id] ?? '?', cantitate: p.cantitate ?? 1 })
      }
      setRezervari(map)
    } else {
      setRezervari({})
    }

    setLoadingStoc(false)
  }

  async function incarcaNir() {
    setLoadingNir(true)
    const { data } = await createClient().from('nir').select('*').order('created_at', { ascending: false }).limit(100)
    setNirList((data as NirRow[]) ?? [])
    setLoadingNir(false)
  }

  // ─── Furnizori dropdown ────────────────────────────────────────────────────

  useEffect(() => {
    if (!showFurnList) return
    let q = createClient().from('furnizori').select('id, denumire, is_favorit')
      .order('is_favorit', { ascending: false }).order('denumire').limit(20)
    if (furnizorSearch.trim()) q = q.ilike('denumire', `%${furnizorSearch}%`)
    q.then(({ data }) => setFurnizorResults((data as FurnizorOpt[]) ?? []))
  }, [furnizorSearch, showFurnList])

  useEffect(() => {
    function h(e: MouseEvent) {
      if (furnRef.current && !furnRef.current.contains(e.target as Node)) setShowFurnList(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ─── Cautare produs per rand ───────────────────────────────────────────────

  async function cautaProdus(key: string, val: string) {
    setProdSearchMap(m => ({ ...m, [key]: val }))
    setShowProdMap(m => ({ ...m, [key]: true }))
    if (!val.trim()) { setProdResultsMap(m => ({ ...m, [key]: [] })); return }
    const q = val.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const { data } = await createClient().from('produse')
      .select('id, cod, nume, unitate, producator, pret')
      .or(`nume.ilike.%${q}%,cod.ilike.%${q}%`)
      .limit(10)
    setProdResultsMap(m => ({ ...m, [key]: (data as ProdusSearch[]) ?? [] }))
  }

  function produsNouSalvatNir(p: { id: string; cod: string | null; nume: string; unitate: string | null; pret: number | null; producator: string | null }) {
    if (!modalProdusNouKey) return
    selectProdusNir(modalProdusNouKey, { id: p.id, cod: p.cod, nume: p.nume, unitate: p.unitate, producator: p.producator, pret: p.pret })
    setModalProdusNouKey(null)
  }

  function selectProdusNir(key: string, p: ProdusSearch) {
    setNirProduse(prev => prev.map(r => r._key === key ? {
      ...r, produs_id: p.id, produs_cod: p.cod ?? '', produs_nume: p.nume,
      producator: p.producator ?? '', unitate: p.unitate ?? 'buc',
      pret_achizitie: p.pret ?? 0,
    } : r))
    setProdSearchMap(m => ({ ...m, [key]: p.nume }))
    setShowProdMap(m => ({ ...m, [key]: false }))
  }

  // ─── Salvare NIR ──────────────────────────────────────────────────────────

  async function ajusteazaStoc(
    supabase: ReturnType<typeof createClient>,
    produse: NirProdusForm[],
    furnId: string | null,
    furnNume: string,
    delta: 1 | -1
  ) {
    for (const p of produse) {
      if (!p.produs_nume.trim() || p.cantitate === 0) continue
      let stocQuery = supabase.from('stoc').select('id, cantitate').eq('produs_nume', p.produs_nume)
      stocQuery = furnId ? stocQuery.eq('furnizor_id', furnId) : stocQuery.is('furnizor_id', null)
      const { data: stocEx } = await stocQuery.maybeSingle()

      const nouaCantitate = (stocEx?.cantitate ?? 0) + delta * p.cantitate

      const pretLista = delta === 1
        ? parseFloat((p.pret_achizitie * 1.30).toFixed(2))
        : null

      if (stocEx) {
        const updatePayload: Record<string, unknown> = {
          cantitate: Math.max(0, nouaCantitate),
          updated_at: new Date().toISOString(),
        }
        if (delta === 1) {
          updatePayload.pret_achizitie = p.pret_achizitie
          updatePayload.pret_lista = pretLista
        }
        await supabase.from('stoc').update(updatePayload).eq('id', stocEx.id)
      } else if (delta === 1 && p.cantitate > 0) {
        // Daca produsul nu exista in catalog, il cream automat
        let produsId = p.produs_id || null
        if (!produsId && p.produs_nume.trim()) {
          const { data: prodNou } = await supabase.from('produse').insert({
            nume: p.produs_nume.trim(),
            cod: p.produs_cod || null,
            unitate: p.unitate || 'buc',
            producator: p.producator || null,
            pret: p.pret_achizitie || null,
          }).select('id').single()
          if (prodNou) produsId = prodNou.id
        }

        await supabase.from('stoc').insert({
          produs_id: produsId,
          produs_cod: p.produs_cod || null,
          produs_nume: p.produs_nume,
          producator: p.producator || null,
          cantitate: p.cantitate,
          unitate: p.unitate || 'buc',
          pret_achizitie: p.pret_achizitie,
          pret_lista: pretLista,
          furnizor_id: furnId || null,
          furnizor_nume: furnNume || null,
        })
      }
    }
  }

  async function salveazaNir() {
    // Validare câmpuri obligatorii
    if (!furnizorId) {
      setFurnizorError(true)
      alert('Furnizorul este obligatoriu!')
      return
    }
    setFurnizorError(false)
    if (!numarDocument.trim()) {
      setNumarDocError(true)
      alert('Numărul documentului furnizorului este obligatoriu!')
      return
    }
    setNumarDocError(false)

    const valide = nirProduse.filter(p => p.produs_nume.trim() && p.cantitate !== 0)
    if (!valide.length) return
    setSalvandNir(true)
    const supabase = createClient()

    // Verificare duplicat document furnizor
    let dupQuery = supabase.from('nir').select('id, numar').eq('numar_document', numarDocument.trim())
    if (furnizorId) {
      dupQuery = dupQuery.eq('furnizor_id', furnizorId)
    } else {
      dupQuery = dupQuery.is('furnizor_id', null)
    }
    if (editNirId) dupQuery = dupQuery.neq('id', editNirId)
    const { data: dup } = await dupQuery.maybeSingle()
    if (dup) {
      alert(`Documentul "${numarDocument}" de la acest furnizor există deja (NIR #${(dup as {numar: number}).numar})!\n\nNu poți înregistra același document de două ori.`)
      setSalvandNir(false)
      return
    }

    const totalFaraTva = valide.reduce((s, p) => s + p.cantitate * p.pret_achizitie, 0)
    const totalTva = parseFloat((totalFaraTva * TVA).toFixed(2))
    const totalCuTva = parseFloat((totalFaraTva + totalTva).toFixed(2))
    const valoareFacturaNum = parseFloat(valoareFacturaVerif) || 0
    const corectieValoare = valoareFacturaNum > 0
      ? parseFloat((valoareFacturaNum - totalCuTva).toFixed(2))
      : 0

    // Avertizare corecție
    if (corectieValoare !== 0) {
      const semn = corectieValoare > 0 ? '+' : ''
      const ok = window.confirm(
        `Atenție! Există o CORECȚIE VALOARE de ${semn}${corectieValoare.toFixed(2)} RON\n` +
        `(Valoare factură: ${valoareFacturaNum.toFixed(2)} RON ≠ Total calculat: ${totalCuTva.toFixed(2)} RON)\n\n` +
        `Această diferență va fi înregistrată pe NIR dar NU va afecta stocul.\n\n` +
        `Ești sigur că vrei să continui?`
      )
      if (!ok) { setSalvandNir(false); return }
    }

    const nirPayload = {
      furnizor_id: furnizorId || null,
      furnizor_nume: furnizorLabel || null,
      data_intrare: dataIntrare,
      numar_document: numarDocument || null,
      data_document: dataDocument || null,
      data_scadenta: dataScadenta || null,
      total_fara_tva: totalFaraTva,
      total_tva: totalTva,
      total_cu_tva: totalCuTva,
      valoare_factura_verificare: valoareFacturaNum > 0 ? valoareFacturaNum : null,
      corectie_valoare: corectieValoare,
    }

    let nirId: string

    if (editNirId) {
      // ── MOD EDITARE ──────────────────────────────────────────
      const { error: updErr } = await supabase.from('nir').update(nirPayload).eq('id', editNirId)
      if (updErr) { alert('Eroare actualizare NIR: ' + updErr.message); setSalvandNir(false); return }

      // Inversează stocul pentru produsele VECHI
      await ajusteazaStoc(supabase, editOriginalProduse, furnizorId, furnizorLabel, -1)

      // Șterge produsele vechi
      await supabase.from('nir_produse').delete().eq('nir_id', editNirId)

      nirId = editNirId
    } else {
      // ── MOD NOU ───────────────────────────────────────────────
      const { data: nirData, error: nirErr } = await supabase.from('nir')
        .insert(nirPayload).select('id, numar').single()
      if (nirErr || !nirData) { alert('Eroare NIR: ' + nirErr?.message); setSalvandNir(false); return }
      nirId = nirData.id
    }

    // Inserează produsele noi
    await supabase.from('nir_produse').insert(valide.map(p => ({
      nir_id: nirId,
      produs_id: p.produs_id || null,
      produs_cod: p.produs_cod || null,
      produs_nume: p.produs_nume,
      producator: p.producator || null,
      cantitate: p.cantitate,
      unitate: p.unitate || 'buc',
      pret_achizitie: p.pret_achizitie,
      tva_procent: 21,
      valoare_fara_tva: p.cantitate * p.pret_achizitie,
      valoare_tva: p.cantitate * p.pret_achizitie * TVA,
      valoare_cu_tva: p.cantitate * p.pret_achizitie * (1 + TVA),
    })))

    // Adaugă produsele noi în stoc
    await ajusteazaStoc(supabase, valide, furnizorId, furnizorLabel, 1)

    setSalvandNir(false)
    resetModalIntrare()
    incarcaStoc()
    incarcaNir()

    window.open(`/gestiune/nir/${nirId}`, '_blank')
  }

  async function stergeNir(nir: NirRow) {
    const ok = window.confirm(
      `URMEAZĂ SĂ ȘTERGI NIR nr. ${nir.numar}` +
      (nir.furnizor_nume ? ` — ${nir.furnizor_nume}` : '') +
      `\n\nTOATE produsele din acest NIR vor fi scăzute din gestiune!\n\nEști sigur?`
    )
    if (!ok) return

    const supabase = createClient()

    // 1. Încarcă produsele NIR-ului
    const { data: produse } = await supabase
      .from('nir_produse').select('*').eq('nir_id', nir.id)

    const produseForm: NirProdusForm[] = ((produse as any[]) ?? []).map(p => ({
      _key: '',
      produs_id: p.produs_id ?? null,
      produs_cod: p.produs_cod ?? '',
      produs_nume: p.produs_nume ?? '',
      producator: p.producator ?? '',
      cantitate: p.cantitate ?? 0,
      unitate: p.unitate ?? 'buc',
      pret_achizitie: p.pret_achizitie ?? 0,
    }))

    // 2. Scade cantitățile din stoc
    await ajusteazaStoc(supabase, produseForm, nir.furnizor_id, nir.furnizor_nume ?? '', -1)

    // 3. Șterge produsele NIR
    await supabase.from('nir_produse').delete().eq('nir_id', nir.id)

    // 4. Șterge NIR-ul
    await supabase.from('nir').delete().eq('id', nir.id)

    incarcaNir()
    incarcaStoc()
  }

  function resetModalIntrare() {
    setModalIntrare(false)
    setEditNirId(null)
    setEditOriginalProduse([])
    setFurnizorId(null)
    setFurnizorLabel('')
    setFurnizorSearch('')
    setDataIntrare(new Date().toISOString().split('T')[0])
    setNumarDocument('')
    setDataDocument('')
    setDataScadenta('')
    setValoareFacturaVerif('')
    setNirProduse([emptyProdus()])
    setProdSearchMap({})
    setProdResultsMap({})
    setShowProdMap({})
    setNumarDocError(false)
    setFurnizorError(false)
  }

  async function deschideEditNir(nir: NirRow) {
    const supabase = createClient()
    const { data: produse } = await supabase
      .from('nir_produse')
      .select('*')
      .eq('nir_id', nir.id)
      .order('created_at')

    const produseForm: NirProdusForm[] = ((produse as NirProdusForm[]) ?? []).map((p: any) => ({
      _key: Math.random().toString(36).slice(2),
      produs_id: p.produs_id ?? null,
      produs_cod: p.produs_cod ?? '',
      produs_nume: p.produs_nume ?? '',
      producator: p.producator ?? '',
      cantitate: p.cantitate ?? 1,
      unitate: p.unitate ?? 'buc',
      pret_achizitie: p.pret_achizitie ?? 0,
    }))

    const searchMap: Record<string, string> = {}
    produseForm.forEach(p => { searchMap[p._key] = p.produs_nume })

    setEditNirId(nir.id)
    setEditOriginalProduse(produseForm.map(p => ({ ...p })))
    setFurnizorId(nir.furnizor_id ?? null)
    setFurnizorLabel(nir.furnizor_nume ?? '')
    setFurnizorSearch(nir.furnizor_nume ?? '')
    setDataIntrare(nir.data_intrare.split('T')[0])
    setNumarDocument(nir.numar_document ?? '')
    setDataDocument(nir.data_document ? nir.data_document.split('T')[0] : '')
    setDataScadenta(nir.data_scadenta ? nir.data_scadenta.split('T')[0] : '')
    setValoareFacturaVerif(nir.valoare_factura_verificare ? String(nir.valoare_factura_verificare) : '')
    setNirProduse(produseForm)
    setProdSearchMap(searchMap)
    setProdResultsMap({})
    setShowProdMap({})
    setModalIntrare(true)
  }

  // ─── Import stoc initial ──────────────────────────────────────────────────

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb = read(buf, { type: 'array', WTF: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: unknown[][] = utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Format export: A=Denumire, B=Tip(ignorat), C=Cod, D=Stoc, E=UM, F=Cost fără TVA,
    //                G=Monedă(ignorat), H=Preț Listă, I/J/K=ignorat
    function cleanCod(val: unknown): string {
      const s = String(val ?? '').trim()
      // Dacă e număr întreg cu .0 (ex "8973.0"), scoatem zecimalele
      if (/^\d+\.0$/.test(s)) return s.replace('.0', '')
      return s
    }
    function cleanUM(val: unknown): string {
      const s = String(val ?? '').trim()
      // Dacă UM e numeric (ex "1.0"), înlocuim cu buc
      if (!s || /^\d+(\.\d+)?$/.test(s)) return 'buc'
      return s
    }

    const parsed: ImportStocRow[] = rows.slice(1)
      .filter(r => r[0]?.toString().trim())
      .map(r => ({
        _key: Math.random().toString(36).slice(2),
        produs_nume: r[0]?.toString().trim() ?? '',
        produs_cod: cleanCod(r[2]),
        cantitate: parseFloat(String(r[3])) || 0,
        unitate: cleanUM(r[4]),
        pret_achizitie: parseFloat(String(r[5])) || 0,
      }))
    setImportRows(parsed)
    setImportStep('preview')
    // reset input so same file can be re-selected
    e.target.value = ''
  }

  async function executeImport() {
    setImportStep('importing')
    const supabase = createClient()
    const batch = 50
    for (let i = 0; i < importRows.length; i += batch) {
      const chunk = importRows.slice(i, i + batch)
      await supabase.from('stoc').insert(chunk.map(p => ({
        produs_cod: p.produs_cod || null,
        produs_nume: p.produs_nume,
        unitate: p.unitate || 'buc',
        cantitate: p.cantitate,
        pret_achizitie: p.pret_achizitie,
        pret_lista: p.pret_achizitie > 0
          ? parseFloat((p.pret_achizitie * 1.30).toFixed(2))
          : null,
      })))
      setImportProgress(Math.round(((i + chunk.length) / importRows.length) * 100))
    }
    setImportStep('done')
    incarcaStoc()
  }

  // ─── Calcul total NIR curent ──────────────────────────────────────────────

  const nirTotal = nirProduse.reduce((s, p) => s + p.cantitate * p.pret_achizitie, 0)
  const nirTotalCuTva = parseFloat((nirTotal * (1 + TVA)).toFixed(2))
  const valoareFacturaNr = parseFloat(valoareFacturaVerif) || 0
  const corectieAfisata = valoareFacturaNr > 0
    ? parseFloat((valoareFacturaNr - nirTotalCuTva).toFixed(2))
    : null

  // ─── Filtrare stoc ───────────────────────────────────────────────────────

  async function salveazaAjustare() {
    if (!ajustareStocId) return
    const delta = parseFloat(ajustareCantitate)
    if (isNaN(delta) || delta === 0) { alert('Introdu o cantitate diferită de 0 (pozitiv = adaugi, negativ = scazi)'); return }
    setSalvandAjustare(true)
    const supabase = createClient()
    const item = stoc.find(s => s.id === ajustareStocId)
    if (!item) return
    const nouaCantitate = item.cantitate + delta
    await supabase.from('stoc').update({ cantitate: nouaCantitate, updated_at: new Date().toISOString() }).eq('id', ajustareStocId)
    setSalvandAjustare(false)
    setModalAjustare(false)
    incarcaStoc()
  }

  const stocFiltrat = stoc.filter(s => {
    if (s.cantitate <= 0) return false
    if (!cautareStoc.trim()) return true
    const q = cautareStoc.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const strip = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    return (
      strip(s.produs_nume).includes(q) ||
      strip(s.produs_cod ?? '').includes(q) ||
      strip(s.producator ?? '').includes(q)
    )
  })

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestiune Stoc</h2>
          <p className="text-sm text-gray-600 mt-0.5">{stoc.length} articole în stoc</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setModalImport(true); setImportStep('idle') }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            ⬆ Import stoc inițial
          </button>
          <button
            onClick={() => setModalIntrare(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: '#16a34a' }}
          >
            + Intrare Marfă (NIR)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['stoc', 'nir'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            {t === 'stoc' ? '📦 Stoc curent' : '📄 NIR-uri'}
          </button>
        ))}
      </div>

      {/* ── TAB STOC ── */}
      {tab === 'stoc' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-200">
            <input
              type="text" placeholder="Caută produs, cod, producător..."
              value={cautareStoc} onChange={e => setCautareStoc(e.target.value)}
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Produs</th>
                  <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Producător</th>
                  <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Cod</th>
                  <th className="text-left px-4 py-2.5 text-gray-900 font-medium">UM</th>
                  <th className="text-right px-4 py-2.5 text-gray-900 font-medium">Cantitate</th>
                  <th className="text-right px-4 py-2.5 text-gray-900 font-medium">Cost ach. (fără TVA)</th>
                  <th className="text-right px-4 py-2.5 text-gray-900 font-medium">Preț listă (fără TVA)</th>
                  <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Furnizor</th>
                  <th className="text-right px-4 py-2.5 text-gray-900 font-medium">Valoare stoc</th>
                  {isAdmin && <th className="px-2 py-2.5"></th>}
                </tr>
              </thead>
              <tbody>
                {loadingStoc ? (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-600">Se încarcă...</td></tr>
                ) : stocFiltrat.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-600">
                    {cautareStoc ? 'Niciun rezultat.' : 'Stocul este gol. Adaugă o intrare de marfă.'}
                  </td></tr>
                ) : stocFiltrat.map(s => (
                  <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      <div>{s.produs_nume}</div>
                      {(rezervari[s.id] ?? rezervari[`cod:${s.produs_cod ?? ''}`] ?? []).map((r, i) => (
                        <span key={i} className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          🔒 REZERVAT {r.cantitate} buc — {r.client}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-2.5 text-gray-900">{s.producator || '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-900">{s.produs_cod || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-900">{s.unitate || 'buc'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{s.cantitate}</td>
                    <td className="px-4 py-2.5 text-right text-gray-900">{s.pret_achizitie.toFixed(2)} RON</td>
                    <td className="px-4 py-2.5 text-right font-medium" style={{ color: s.pret_lista ? '#1d4ed8' : '#9ca3af' }}>
                      {s.pret_lista ? s.pret_lista.toFixed(2) + ' RON' : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-900">{s.furnizor_nume || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                      {(s.cantitate * s.pret_achizitie).toFixed(2)} RON
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-2.5 text-center">
                        <button
                          onClick={() => { setAjustareStocId(s.id); setAjustareNume(s.produs_nume); setAjustareCantitate(''); setAjustareMotiv(''); setModalAjustare(true) }}
                          className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 font-medium"
                          title="Ajustare manuală stoc"
                        >±</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {stocFiltrat.length > 0 && (
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={8} className="px-4 py-2.5 text-right font-semibold text-gray-900">Valoare totală stoc:</td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-900">
                      {stocFiltrat.reduce((s, x) => s + x.cantitate * x.pret_achizitie, 0).toFixed(2)} RON
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── TAB NIR ── */}
      {tab === 'nir' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Nr. NIR</th>
                  <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Data</th>
                  <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Furnizor</th>
                  <th className="text-right px-4 py-2.5 text-gray-900 font-medium">Total fără TVA</th>
                  <th className="text-right px-4 py-2.5 text-gray-900 font-medium">TVA (21%)</th>
                  <th className="text-right px-4 py-2.5 text-gray-900 font-medium">Total cu TVA</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {loadingNir ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-600">Se încarcă...</td></tr>
                ) : nirList.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-600">Niciun NIR înregistrat.</td></tr>
                ) : nirList.map(n => (
                  <tr key={n.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-semibold text-gray-900">NIR #{n.numar}</td>
                    <td className="px-4 py-2.5 text-gray-900">
                      {new Date(n.data_intrare).toLocaleDateString('ro-RO')}
                    </td>
                    <td className="px-4 py-2.5 text-gray-900">{n.furnizor_nume || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-900">{n.total_fara_tva.toFixed(2)} RON</td>
                    <td className="px-4 py-2.5 text-right text-gray-900">{n.total_tva.toFixed(2)} RON</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{n.total_cu_tva.toFixed(2)} RON</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => deschideEditNir(n)}
                          className="text-xs text-gray-600 hover:text-gray-900 font-medium">
                          ✏️ Editează
                        </button>
                        <button onClick={() => window.open(`/gestiune/nir/${n.id}`, '_blank')}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          🖨 Print
                        </button>
                        <button onClick={() => stergeNir(n)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium">
                          🗑 Șterge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          MODAL — Intrare Marfă (NIR)
      ════════════════════════════════════════════════ */}
      {modalIntrare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h3 className="text-lg font-bold text-gray-900">{editNirId ? 'Editează NIR' : 'Intrare Marfă — NIR nou'}</h3>
              <button onClick={resetModalIntrare} className="text-gray-600 hover:text-gray-900 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Furnizor + Câmpuri document */}
              <div className="grid grid-cols-2 gap-4">
                {/* Furnizor */}
                <div ref={furnRef}>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Furnizor <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type="text" value={furnizorSearch}
                      onChange={e => { setFurnizorSearch(e.target.value); setShowFurnList(true); if (furnizorError) setFurnizorError(false) }}
                      onFocus={() => setShowFurnList(true)}
                      placeholder="Caută furnizor..."
                      className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 ${furnizorError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-500'}`}
                    />
                    {showFurnList && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {furnizorResults.map(f => (
                          <button key={f.id} onClick={() => { setFurnizorId(f.id); setFurnizorLabel(f.denumire); setFurnizorSearch(f.denumire); setShowFurnList(false); setFurnizorError(false) }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center gap-2">
                            <span style={{ color: f.is_favorit ? '#F59E0B' : 'transparent' }}>★</span>
                            {f.denumire}
                          </button>
                        ))}
                        {furnizorResults.length === 0 && <p className="px-3 py-2 text-sm text-gray-600">Niciun furnizor.</p>}
                      </div>
                    )}
                  </div>
                </div>
                {/* Număr document */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">
                    Număr document furnizor <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={numarDocument} onChange={e => { setNumarDocument(e.target.value); if (e.target.value.trim()) setNumarDocError(false) }}
                    placeholder="ex. 12345"
                    className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 ${numarDocError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-500'}`}
                  />
                </div>
                {/* Dată document */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Dată document</label>
                  <input type="date" value={dataDocument} onChange={e => setDataDocument(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Dată intrare în stoc */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Dată intrare în stoc</label>
                  <input type="date" value={dataIntrare} onChange={e => setDataIntrare(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Dată scadență */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Dată scadență</label>
                  <input type="date" value={dataScadenta} onChange={e => setDataScadenta(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Valoare factură furnizor */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">
                    Valoare factură furnizor (cu TVA)
                  </label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.01"
                      value={valoareFacturaVerif}
                      onChange={e => setValoareFacturaVerif(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">RON</span>
                  </div>
                </div>
              </div>

              {/* Produse */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-900">Produse</label>
                  <button onClick={() => setNirProduse(p => [...p, emptyProdus()])}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    + Adaugă rând
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-visible">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-900 font-medium w-72">Produs</th>
                        <th className="text-left px-3 py-2 text-gray-900 font-medium w-24">Cant.</th>
                        <th className="text-left px-3 py-2 text-gray-900 font-medium w-16">UM</th>
                        <th className="text-right px-3 py-2 text-gray-900 font-medium w-28">Preț fără TVA</th>
                        <th className="text-right px-3 py-2 text-gray-900 font-medium w-24">Valoare</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {nirProduse.map((rand, idx) => (
                        <tr key={rand._key} className="border-t border-gray-100">
                          {/* Produs search */}
                          <td className="px-3 py-2">
                            <div className="relative">
                              <input type="text"
                                value={prodSearchMap[rand._key] ?? rand.produs_nume}
                                onChange={e => cautaProdus(rand._key, e.target.value)}
                                onFocus={() => setShowProdMap(m => ({ ...m, [rand._key]: true }))}
                                placeholder="Caută sau scrie manual..."
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              {showProdMap[rand._key] && (prodResultsMap[rand._key] ?? []).length > 0 && (
                                <div className="absolute z-50 w-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                  {(prodResultsMap[rand._key] ?? []).map(p => (
                                    <button key={p.id} onClick={() => selectProdusNir(rand._key, p)}
                                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 border-b border-gray-100 last:border-0">
                                      <span className="font-medium text-gray-900">{p.nume}</span>
                                      {p.cod && <span className="text-gray-500 ml-2 font-mono">{p.cod}</span>}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {showProdMap[rand._key] && (prodSearchMap[rand._key] ?? '').trim() && (prodResultsMap[rand._key] ?? []).length === 0 && (
                                <div className="absolute z-50 w-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-xl px-2 py-1.5 flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Niciun produs găsit.</span>
                                  <button
                                    type="button"
                                    onClick={() => { setShowProdMap(m => ({ ...m, [rand._key]: false })); setModalProdusNouKey(rand._key) }}
                                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline ml-2 whitespace-nowrap"
                                  >
                                    + Creează produs nou
                                  </button>
                                </div>
                              )}
                            </div>
                            {!rand.produs_id && (prodSearchMap[rand._key] ?? rand.produs_nume) && (
                              <input type="text" placeholder="Producător..."
                                value={rand.producator}
                                onChange={e => setNirProduse(p => p.map(r => r._key === rand._key ? { ...r, producator: e.target.value } : r))}
                                className="w-full mt-1 px-2 py-1 border border-gray-200 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none"
                              />
                            )}
                            {rand.produs_id && (() => {
                              const stocCant = stoc.filter(s => s.produs_id === rand.produs_id || (rand.produs_cod && s.produs_cod === rand.produs_cod)).reduce((sum, s) => sum + s.cantitate, 0)
                              return (
                                <p className={`text-xs mt-0.5 font-medium ${stocCant > 0 ? 'text-green-600' : 'text-orange-500'}`}>
                                  Stoc curent: {stocCant} {rand.unitate || 'buc'}
                                </p>
                              )
                            })()}
                          </td>
                          {/* Cantitate */}
                          <td className="px-3 py-2">
                            <input type="number" step="0.01" value={rand.cantitate}
                              onChange={e => setNirProduse(p => p.map(r => r._key === rand._key ? { ...r, cantitate: parseFloat(e.target.value) || 0 } : r))}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                            />
                          </td>
                          {/* UM */}
                          <td className="px-3 py-2">
                            <input type="text" value={rand.unitate}
                              onChange={e => setNirProduse(p => p.map(r => r._key === rand._key ? { ...r, unitate: e.target.value } : r))}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none"
                            />
                          </td>
                          {/* Pret */}
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.01" value={rand.pret_achizitie}
                              onChange={e => setNirProduse(p => p.map(r => r._key === rand._key ? { ...r, pret_achizitie: parseFloat(e.target.value) || 0 } : r))}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                            />
                          </td>
                          {/* Valoare */}
                          <td className="px-3 py-2 text-right font-medium text-gray-900">
                            {(rand.cantitate * rand.pret_achizitie).toFixed(2)}
                          </td>
                          {/* Sterge */}
                          <td className="px-2 py-2 text-center">
                            {nirProduse.length > 1 && (
                              <button onClick={() => setNirProduse(p => p.filter((_, i) => i !== idx))}
                                className="text-red-400 hover:text-red-600 text-base leading-none">×</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totale + verificare factură */}
              <div className="flex justify-end">
                <div className="text-sm space-y-1 min-w-[320px]">
                  <div className="flex justify-between gap-8 text-gray-900">
                    <span>Total fără TVA:</span>
                    <span className="font-medium">{nirTotal.toFixed(2)} RON</span>
                  </div>
                  <div className="flex justify-between gap-8 text-gray-900">
                    <span>TVA 21%:</span>
                    <span className="font-medium">{(nirTotal * TVA).toFixed(2)} RON</span>
                  </div>
                  <div className="flex justify-between gap-8 font-bold text-gray-900 text-base border-t border-gray-200 pt-1 mt-1">
                    <span>Total calculat cu TVA:</span>
                    <span>{nirTotalCuTva.toFixed(2)} RON</span>
                  </div>
                  {/* Valoare factură afișată */}
                  {valoareFacturaNr > 0 && (
                    <div className="flex justify-between gap-8 items-center pt-2 mt-1 border-t border-dashed border-gray-300 text-gray-700">
                      <span className="font-medium">Valoare factură:</span>
                      <span className="font-medium">{valoareFacturaNr.toFixed(2)} RON</span>
                    </div>
                  )}
                  {/* Corecție valoare */}
                  {corectieAfisata !== null && corectieAfisata === 0 && (
                    <div className="flex justify-between gap-8 text-green-700 font-medium text-xs">
                      <span>&#10003; Corecție valoare:</span>
                      <span>0.00 RON &mdash; valori identice</span>
                    </div>
                  )}
                  {corectieAfisata !== null && corectieAfisata !== 0 && (
                    <div className="flex justify-between gap-8 font-semibold text-xs px-2 py-1.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                      <span>&#9888; Corecție valoare:</span>
                      <span>{corectieAfisata > 0 ? '+' : ''}{corectieAfisata.toFixed(2)} RON</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex gap-3 justify-end">
              <button onClick={resetModalIntrare}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={salveazaNir} disabled={salvandNir || nirProduse.every(p => !p.produs_nume.trim())}
                className="px-6 py-2.5 text-white font-bold rounded-lg disabled:opacity-40 text-sm"
                style={{ backgroundColor: '#16a34a' }}>
                {salvandNir ? 'Se salvează...' : editNirId ? '✓ Actualizează NIR' : '✓ Salvează NIR și actualizează stocul'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal produs nou în catalog (din NIR) */}
      <ProdusNouModal
        open={modalProdusNouKey !== null}
        onClose={() => setModalProdusNouKey(null)}
        onSaved={produsNouSalvatNir}
        numeInitial={modalProdusNouKey ? (prodSearchMap[modalProdusNouKey] ?? '') : ''}
      />

      {/* ════════════════════════════════════════════════
          MODAL — Import Stoc Initial
      ════════════════════════════════════════════════ */}
      {modalImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Import Stoc Inițial</h3>
              <button onClick={() => { setModalImport(false); setImportStep('idle') }}
                className="text-gray-600 hover:text-gray-900 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {importStep === 'idle' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                    <p className="font-semibold mb-1">Format fișier export gestiune:</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-1">
                      <span><strong>A</strong> — Denumire produs</span>
                      <span className="text-blue-400 line-through"><strong>B</strong> — Tip (ignorat)</span>
                      <span><strong>C</strong> — Cod produs</span>
                      <span><strong>D</strong> — Stoc (cantitate)</span>
                      <span><strong>E</strong> — U.M.</span>
                      <span><strong>F</strong> — Cost achiziție fără TVA</span>
                      <span className="text-blue-400 line-through"><strong>G, H, I, J, K</strong> — (ignorate)</span>
                    </div>
                  </div>
                  <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleImportFile} />
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 font-medium">
                    📁 Alege fișier Excel (.xls / .xlsx)
                  </button>
                </>
              )}

              {importStep === 'preview' && (
                <>
                  <p className="text-sm text-gray-900 font-medium">{importRows.length} articole găsite în fișier. (previzualizare primele 50)</p>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-900">Cod</th>
                          <th className="text-left px-3 py-2 text-gray-900">Denumire</th>
                          <th className="text-right px-3 py-2 text-gray-900">Cant.</th>
                          <th className="text-right px-3 py-2 text-gray-900">UM</th>
                          <th className="text-right px-3 py-2 text-gray-900">Cost ach.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 50).map(r => (
                          <tr key={r._key} className="border-t border-gray-100">
                            <td className="px-3 py-1.5 font-mono text-gray-500">{r.produs_cod || '—'}</td>
                            <td className="px-3 py-1.5 text-gray-900 font-medium">{r.produs_nume}</td>
                            <td className="px-3 py-1.5 text-right text-gray-900">{r.cantitate}</td>
                            <td className="px-3 py-1.5 text-right text-gray-500">{r.unitate}</td>
                            <td className="px-3 py-1.5 text-right text-gray-900">{r.pret_achizitie.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importRows.length > 50 && (
                    <p className="text-xs text-gray-500 text-center">... și încă {importRows.length - 50} articole care nu sunt afișate</p>
                  )}
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setImportStep('idle')}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 hover:bg-gray-50">Înapoi</button>
                    <button onClick={executeImport}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm">
                      Importă {importRows.length} articole
                    </button>
                  </div>
                </>
              )}

              {importStep === 'importing' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-900 font-medium">Se importă... {importProgress}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
                  </div>
                </div>
              )}

              {importStep === 'done' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="font-semibold text-green-800">Import finalizat!</p>
                  <p className="text-sm text-green-700 mt-1">{importRows.length} articole adăugate în stoc.</p>
                  <button onClick={() => { setModalImport(false); setImportStep('idle') }}
                    className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm">
                    Închide
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustare Stoc — admin only */}
      {modalAjustare && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Ajustare manuală stoc</h2>
            <p className="text-sm text-gray-500 mb-4">{ajustareNume}</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantitate <span className="text-gray-400 font-normal">(pozitiv = adaugi, negativ = scazi)</span>
              </label>
              <input
                type="number" step="1"
                value={ajustareCantitate}
                onChange={e => setAjustareCantitate(e.target.value)}
                placeholder="ex: 5 sau -3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motiv <span className="text-gray-400 font-normal">(opțional)</span></label>
              <input
                type="text"
                value={ajustareMotiv}
                onChange={e => setAjustareMotiv(e.target.value)}
                placeholder="ex: inventar, pierdere, corecție..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalAjustare(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={salveazaAjustare} disabled={salvandAjustare || !ajustareCantitate}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {salvandAjustare ? 'Se salvează...' : 'Salvează ajustarea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
