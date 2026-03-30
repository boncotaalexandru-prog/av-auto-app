'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProdusNouModal from '@/components/produse/ProdusNouModal'

interface Oferta {
  id: string
  numar: number | null
  status: string
  necesar_piese: string | null
  client_id: string
  preluat_de: string | null
  clienti: { denumire: string } | null
  clienti_masini: { nr_inmatriculare: string | null; marca: string | null } | null
}

interface OfertaProdus {
  id: string
  produs_id: string | null
  stoc_id: string | null
  nume_produs: string
  cod: string | null
  cantitate: number
  unitate: string | null
  pret_achizitie: number
  pret_vanzare: number
  furnizor_id: string | null
  furnizori: { denumire: string } | null
  disponibil: boolean
  producator: string | null
}

interface ProdusSearch { id: string; cod: string | null; nume: string; unitate: string | null; pret: number | null; producator: string | null }
interface FurnizorSearch { id: string; denumire: string; is_favorit: boolean }
interface StocOptiune { id: string; pret_achizitie: number; pret_lista: number | null; cantitate: number; furnizor_nume: string | null; updated_at: string }

interface ConfirmaRand {
  oferta_produs_id: string
  nume_produs: string
  producator: string | null
  cantitate: number
  unitate: string | null
  furnizor_id: string | null
  furnizor_nume: string
  ora_ridicare: string
  data_livrare: string
  include: boolean
}

const STATUS: Record<string, { label: string; color: string }> = {
  draft:      { label: 'Oferta noua', color: '#16a34a' },
  in_lucru:   { label: 'In lucru',    color: '#d97706' },
  finalizata: { label: 'Finalizata',  color: '#059669' },
  confirmata: { label: 'Confirmata',  color: '#7c3aed' },
  facturat:   { label: 'Facturat',    color: '#0f172a' },
  anulata:    { label: 'Anulata',     color: '#dc2626' },
}

const EMPTY_FORM = {
  produs_id: null as string | null,
  stoc_id: null as string | null,
  nume_produs: '',
  cod: '',
  cantitate: 1,
  unitate: '',
  pret_achizitie: 0,
  pret_vanzare: 0,
  furnizor_id: null as string | null,
  furnizor_label: '',
  disponibil: true,
  producator: '',
  ora_ridicare: '' as string,
  data_livrare: '' as string,
}

function AdaosDisplay({ ach, vanz }: { ach: number; vanz: number }) {
  if (ach <= 0 || vanz <= 0) return null
  const adaos = ((vanz - ach) / ach) * 100
  const pozitiv = adaos >= 0
  const bgClass = pozitiv ? 'bg-green-50' : 'bg-red-50'
  const textClass = pozitiv ? 'text-green-700' : 'text-red-700'
  return (
    <div className={'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ' + bgClass + ' ' + textClass}>
      <span>{pozitiv ? '\u25B2' : '\u25BC'} Adaos:</span>
      <span>{adaos.toFixed(1)}%</span>
      <span className="font-normal text-xs opacity-70">({(vanz - ach).toFixed(2)} RON / buc)</span>
    </div>
  )
}

export default function OfertaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [oferta, setOferta] = useState<Oferta | null>(null)
  const [produse, setProduse] = useState<OfertaProdus[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [prodSearch, setProdSearch] = useState('')
  const [prodResults, setProdResults] = useState<ProdusSearch[]>([])
  const [furnizorSearch, setFurnizorSearch] = useState('')
  const [furnizorResults, setFurnizorResults] = useState<FurnizorSearch[]>([])
  const [showProdList, setShowProdList] = useState(false)
  const [showFurnList, setShowFurnList] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actualizand, setActualizand] = useState(false)
  const [modalProdusNou, setModalProdusNou] = useState(false)
  const [furnizorOre, setFurnizorOre] = useState<string[]>([])
  const [editProducatorModal, setEditProducatorModal] = useState(false)
  const [modalConfirma, setModalConfirma] = useState(false)
  const [confirmaRanduri, setConfirmaRanduri] = useState<ConfirmaRand[]>([])
  const [totiIFurnizori, setTotiIFurnizori] = useState<FurnizorSearch[]>([])
  const [confirmand, setConfirmand] = useState(false)
  const [stocOptiuni, setStocOptiuni] = useState<StocOptiune[]>([])
  const [stocOptiuneIdx, setStocOptiuneIdx] = useState<number>(0)
  const [stocMap, setStocMap] = useState<Record<string, number>>({})
  const [pretSpecialClient, setPretSpecialClient] = useState<number | null>(null)
  const prodRef = useRef<HTMLDivElement>(null)
  const furnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    Promise.all([
      supabase.from('oferte')
        .select('id, numar, status, necesar_piese, client_id, clienti(denumire), clienti_masini(nr_inmatriculare, marca)')
        .eq('id', id).single(),
      supabase.from('oferte_produse')
        .select('*, furnizori(denumire)')
        .eq('oferta_id', id)
        .order('created_at'),
    ]).then(([{ data: o }, { data: p }]) => {
      setOferta(o as unknown as Oferta)
      setProduse((p as OfertaProdus[]) ?? [])
      setLoading(false)
    })
  }, [id])

  // Cautare produse din catalog + stoc disponibil
  useEffect(() => {
    if (!prodSearch.trim()) { setProdResults([]); setStocMap({}); return }
    const supabase = createClient()
    const q = prodSearch.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    supabase.from('produse')
      .select('id, cod, nume, unitate, pret, producator')
      .or(`nume.ilike.%${q}%,cod.ilike.%${q}%`)
      .limit(15)
      .then(async ({ data }) => {
        setProdResults(data ?? [])
        if (!data?.length) return
        const ids = data.map(p => p.id)
        const cods = data.filter(p => p.cod).map(p => p.cod as string)
        const orParts = [`produs_id.in.(${ids.join(',')})`]
        if (cods.length) orParts.push(`produs_cod.in.(${cods.join(',')})`)
        const { data: stocData } = await supabase.from('stoc')
          .select('produs_id, produs_cod, cantitate').or(orParts.join(','))
        const map: Record<string, number> = {}
        for (const row of stocData ?? []) {
          const key = row.produs_id ?? row.produs_cod ?? ''
          if (key) map[key] = (map[key] ?? 0) + row.cantitate
        }
        setStocMap(map)
      })
  }, [prodSearch])

  // Cautare furnizori — incarca si la focus (search gol), favorite primele
  useEffect(() => {
    const supabase = createClient()
    let query = supabase
      .from('furnizori')
      .select('id, denumire, is_favorit')
      .order('is_favorit', { ascending: false })
      .order('denumire')
      .limit(20)
    if (furnizorSearch.trim()) {
      query = query.ilike('denumire', `%${furnizorSearch}%`)
    }
    query.then(({ data }) => setFurnizorResults(data ?? []))
  }, [furnizorSearch, showFurnList])

  // Inchide dropdown-uri la click afara
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (prodRef.current && !prodRef.current.contains(e.target as Node)) setShowProdList(false)
      if (furnRef.current && !furnRef.current.contains(e.target as Node)) setShowFurnList(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function produsNouSalvat(p: { id: string; cod: string | null; nume: string; unitate: string | null; pret: number | null; producator: string | null }) {
    setForm(f => ({
      ...f,
      produs_id: p.id,
      nume_produs: p.nume,
      cod: p.cod ?? '',
      unitate: p.unitate ?? '',
      pret_vanzare: p.pret ?? 0,
      producator: p.producator ?? '',
    }))
    setProdSearch(p.nume)
    setShowProdList(false)
    setModalProdusNou(false)
  }

  async function selectProdus(p: ProdusSearch) {
    const supabase = createClient()
    setPretSpecialClient(null)

    // Cauta in stoc strict dupa codul produsului selectat (nu ilike pe nume — ar prinde produse similare)
    const orParts: string[] = [`produs_id.eq.${p.id}`]
    if (p.cod) orParts.push(`produs_cod.eq.${p.cod}`)

    const { data: optiuni } = await supabase
      .from('stoc')
      .select('id, pret_achizitie, pret_lista, cantitate, furnizor_nume, updated_at')
      .gt('cantitate', 0)
      .or(orParts.join(','))
      .order('updated_at', { ascending: false })

    // Pret special pentru clientul ofertei
    if (oferta?.client_id) {
      const pretQ = supabase.from('clienti_preturi')
        .select('pret_vanzare').eq('client_id', oferta.client_id).limit(1)
      const { data: pretRows } = p.cod
        ? await pretQ.eq('produs_cod', p.cod)
        : await pretQ.eq('produs_id', p.id)
      if (pretRows && pretRows.length > 0) setPretSpecialClient(pretRows[0].pret_vanzare)
    }

    const lista = (optiuni ?? []) as StocOptiune[]
    setStocOptiuni(lista)
    setStocOptiuneIdx(0)

    const prima = lista[0]
    setForm(f => ({
      ...f,
      produs_id: p.id,
      nume_produs: p.nume,
      cod: p.cod ?? '',
      unitate: p.unitate ?? '',
      pret_achizitie: prima?.pret_achizitie ?? 0,
      pret_vanzare: prima?.pret_lista ?? p.pret ?? 0,
      producator: p.producator ?? '',
    }))
    setProdSearch(p.nume)
    setShowProdList(false)
    setEditProducatorModal(false)
  }

  function aplicaStocOptiune(idx: number) {
    const opt = stocOptiuni[idx]
    if (!opt) return
    setStocOptiuneIdx(idx)
    setForm(f => ({
      ...f,
      stoc_id: opt.id,
      pret_achizitie: opt.pret_achizitie,
      pret_vanzare: opt.pret_lista ?? f.pret_vanzare,
    }))
  }

  async function selectFurnizor(f: FurnizorSearch | { id: null; denumire: string; is_favorit: false }) {
    setForm(prev => ({ ...prev, furnizor_id: f.id, furnizor_label: f.denumire, ora_ridicare: '', data_livrare: '' }))
    setFurnizorSearch(f.denumire)
    setShowFurnList(false)
    setFurnizorOre([])
    if (f.id) {
      const { data } = await createClient()
        .from('furnizori_ore')
        .select('ora')
        .eq('furnizor_id', f.id)
        .order('ora')
      setFurnizorOre((data ?? []).map((r: { ora: string }) => r.ora))
    }
  }

  function closeModal() {
    setModal(false)
    setForm({ ...EMPTY_FORM })
    setProdSearch('')
    setFurnizorSearch('')
    setProdResults([])
    setFurnizorResults([])
    setFurnizorOre([])
    setEditProducatorModal(false)
    setStocOptiuni([])
    setStocOptiuneIdx(0)
  }

  async function adaugaProdus() {
    if (!form.nume_produs.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase.from('oferte_produse').insert({
      oferta_id: id,
      produs_id: form.produs_id,
      stoc_id: form.stoc_id,
      nume_produs: form.nume_produs,
      cod: form.cod || null,
      cantitate: form.cantitate,
      unitate: form.unitate || null,
      pret_achizitie: form.pret_achizitie,
      pret_vanzare: form.pret_vanzare,
      furnizor_id: form.furnizor_id,
      disponibil: form.disponibil,
      producator: form.producator || null,
      ora_ridicare: form.ora_ridicare || null,
      data_livrare: form.data_livrare || null,
    }).select('*, furnizori(denumire)').single()

    // Daca produsul e din catalog si are producator nou, actualizeaza si in produse
    if (form.produs_id && form.producator.trim()) {
      await supabase.from('produse').update({ producator: form.producator.trim() }).eq('id', form.produs_id)
    }

    if (data) setProduse(prev => [...prev, data as OfertaProdus])
    setSaving(false)
    closeModal()
  }

  async function stergeRand(randId: string) {
    await createClient().from('oferte_produse').delete().eq('id', randId)
    setProduse(prev => prev.filter(p => p.id !== randId))
  }


  async function finalizeazaOferta() {
    setActualizand(true)
    await createClient().from('oferte').update({ status: 'finalizata', updated_at: new Date().toISOString() }).eq('id', id)
    setOferta(o => o ? { ...o, status: 'finalizata' } : o)
    setActualizand(false)
    window.open(`/oferte/${id}/preview`, '_blank')
  }

  async function deschideConfirmare() {
    // Incarca toti furnizorii pentru dropdown-urile din modal
    const { data: furnizori } = await createClient()
      .from('furnizori')
      .select('id, denumire, is_favorit')
      .order('is_favorit', { ascending: false })
      .order('denumire')
    setTotiIFurnizori(furnizori ?? [])

    // Construieste randurile editabile
    const randuri: ConfirmaRand[] = produse.map(p => {
      const furnNume = (p as unknown as { furnizori: { denumire: string } | null }).furnizori?.denumire ?? ''
      const isStocPropriu = !p.furnizor_id
      return {
        oferta_produs_id: p.id,
        nume_produs: p.nume_produs,
        producator: p.producator,
        cantitate: p.cantitate,
        unitate: p.unitate,
        furnizor_id: p.furnizor_id,
        furnizor_nume: furnNume,
        ora_ridicare: (p as unknown as { ora_ridicare: string | null }).ora_ridicare ?? '',
        data_livrare: (p as unknown as { data_livrare: string | null }).data_livrare ?? '',
        include: !isStocPropriu,
      }
    })
    setConfirmaRanduri(randuri)
    setModalConfirma(true)
  }

  async function salveazaConfirmare() {
    if (!oferta) return
    setConfirmand(true)
    const supabase = createClient()

    // Insert in ridicari pentru fiecare rand inclus
    const deRidicat = confirmaRanduri.filter(r => r.include)
    console.log('[Confirmare] produse de ridicat:', deRidicat)

    if (deRidicat.length > 0) {
      const payload = deRidicat.map(r => ({
        oferta_id: id,
        oferta_produs_id: r.oferta_produs_id,
        client_id: oferta.client_id || null,
        client_nume: oferta.clienti?.denumire ?? null,
        nume_produs: r.nume_produs,
        producator: r.producator || null,
        cantitate: r.cantitate,
        unitate: r.unitate || null,
        furnizor_id: r.furnizor_id || null,
        furnizor_nume: r.furnizor_nume || null,
        ora_ridicare: r.ora_ridicare || null,
        data_livrare: r.data_livrare || null,
      }))
      const { error: errIns } = await supabase.from('ridicari').insert(payload)
      if (errIns) {
        console.error('[Confirmare] Eroare insert ridicari:', errIns)
        alert(`Eroare la salvare ridicări: ${errIns.message}`)
        setConfirmand(false)
        return
      }
    }

    // Schimba status la confirmata
    const { error: errStatus } = await supabase.from('oferte')
      .update({ status: 'confirmata', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (errStatus) {
      console.error('[Confirmare] Eroare update status:', errStatus)
      alert(`Eroare la actualizare status: ${errStatus.message}`)
      setConfirmand(false)
      return
    }

    setOferta(o => o ? { ...o, status: 'confirmata' } : o)
    setConfirmand(false)
    setModalConfirma(false)
  }

  async function updateStatus(nou: string) {
    setActualizand(true)
    const supabase = createClient()

    // Daca se preia oferta si nu are inca responsabil, atribuie utilizatorul curent
    const updateData: Record<string, unknown> = { status: nou, updated_at: new Date().toISOString() }
    if (nou === 'in_lucru' && !oferta?.preluat_de) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        updateData.preluat_de = user.id
        updateData.preluat_la = new Date().toISOString()
      }
    }
    await supabase.from('oferte').update(updateData).eq('id', id)
    setOferta(o => o ? { ...o, status: nou } : o)
    setActualizand(false)
    if (nou === 'anulata') router.push('/oferte')
  }

  if (loading) return <p className="text-sm text-gray-600 p-6">Se incarca...</p>
  if (!oferta) return <p className="text-sm text-red-600 p-6">Oferta nu a fost gasita.</p>

  const st = STATUS[oferta.status] ?? { label: oferta.status, color: '#6b7280' }
  const masina = oferta.clienti_masini
  const totalGeneral = produse.reduce((s, p) => s + p.cantitate * p.pret_vanzare, 0)
  const totalAchizitie = produse.reduce((s, p) => s + p.cantitate * p.pret_achizitie, 0)
  const adaosTotal = totalAchizitie > 0 ? ((totalGeneral - totalAchizitie) / totalAchizitie) * 100 : null

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.push('/oferte')} className="cursor-pointer text-gray-600 hover:text-gray-900 mt-1 text-sm shrink-0">
          ← Inapoi
        </button>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-900">
                  Cerere #{oferta.numar ?? '—'}
                </h2>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: st.color }}
                >
                  {st.label.toUpperCase()}
                </span>
                {oferta.status === 'draft' && (
                  <button
                    onClick={() => updateStatus('in_lucru')}
                    disabled={actualizand}
                    className="px-4 py-1.5 text-white text-sm font-bold rounded-lg disabled:opacity-50"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    ▶ Preia Oferta
                  </button>
                )}
                {['confirmata', 'finalizata', 'anulata'].includes(oferta.status) && (
                  <button
                    onClick={() => updateStatus('in_lucru')}
                    disabled={actualizand}
                    className="px-4 py-1.5 text-white text-sm font-bold rounded-lg disabled:opacity-50"
                    style={{ backgroundColor: '#d97706' }}
                  >
                    ✏ Editeaza Oferta
                  </button>
                )}
                {oferta.status === 'facturat' && (
                  <span className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style={{ backgroundColor: '#0f172a' }}>
                    🔒 Facturat
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-900 mt-0.5">
                {oferta.clienti?.denumire}
                {masina && ` — ${masina.nr_inmatriculare || ''} ${masina.marca ? '· ' + masina.marca : ''}`}
                {oferta.necesar_piese && ` — ${oferta.necesar_piese}`}
              </p>
            </div>
            {/* Buton previzualizare — doar in status finalizata */}
            {oferta.status === 'finalizata' && (
              <a
                href={`/oferte/${id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-white text-sm font-bold rounded-lg shrink-0 no-underline"
                style={{ backgroundColor: '#E07020' }}
              >
                📄 Previzualizare Ofertă
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Produse */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Produse</h3>
          {oferta.status === 'in_lucru' && (
            <button
              onClick={() => setModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium hover:bg-gray-50"
            >
              + Adauga Produs
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Produs</th>
                <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Producator</th>
                <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Cant.</th>
                <th className="text-left px-4 py-2.5 text-gray-900 font-medium">UM</th>
                <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Cod</th>
                <th className="text-right px-4 py-2.5 text-gray-900 font-medium">Pret ach.</th>
                <th className="text-right px-4 py-2.5 text-gray-900 font-medium">Pret vanz.</th>
                <th className="text-right px-4 py-2.5 text-gray-900 font-medium">Adaos</th>
                <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Furnizor</th>
                <th className="text-left px-4 py-2.5 text-gray-900 font-medium">Ridicare</th>
                <th className="text-right px-4 py-2.5 text-gray-900 font-medium">Total fără TVA</th>
                <th className="text-right px-4 py-2.5 text-gray-900 font-medium">TVA 21%</th>
                <th className="text-right px-4 py-2.5 text-gray-900 font-medium">Total cu TVA</th>
                {oferta.status === 'in_lucru' && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {produse.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-6 text-center text-gray-600 text-sm">
                    Niciun produs adaugat. Apasa &quot;Adauga Produs&quot;.
                  </td>
                </tr>
              ) : produse.map(p => (
                <tr key={p.id} className="border-t border-gray-200">
                  <td className="px-4 py-2.5 text-gray-900 font-medium">{p.nume_produs}</td>
                  <td className="px-4 py-2.5 text-gray-900">{p.producator || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-900">{p.cantitate}</td>
                  <td className="px-4 py-2.5 text-gray-900">{p.unitate || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-900">{p.cod || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-900">{p.pret_achizitie?.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-900 font-semibold">{p.pret_vanzare?.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-semibold">
                    {p.pret_achizitie > 0 && p.pret_vanzare > 0 ? (() => {
                      const a = ((p.pret_vanzare - p.pret_achizitie) / p.pret_achizitie) * 100
                      return <span style={{ color: a >= 0 ? '#16a34a' : '#dc2626' }}>{a >= 0 ? '+' : ''}{a.toFixed(1)}%</span>
                    })() : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-900">{p.furnizori?.denumire || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-900 text-sm">{(p as unknown as { ora_ridicare: string | null }).ora_ridicare || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {(p.cantitate * p.pret_vanzare).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                    {(p.cantitate * p.pret_vanzare * 0.21).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                    {(p.cantitate * p.pret_vanzare * 1.21).toFixed(2)}
                  </td>
                  {oferta.status === 'in_lucru' && (
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => stergeRand(p.id)} className="text-xs text-red-600 hover:text-red-800">
                        Sterge
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {produse.length > 0 && (
              <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                <tr>
                  <td colSpan={10} className="px-4 py-1.5 text-right text-xs text-gray-600">Total fără TVA:</td>
                  <td className="px-4 py-1.5 text-right text-gray-800 font-medium">{totalGeneral.toFixed(2)} RON</td>
                  <td />
                  <td />
                  {oferta.status === 'in_lucru' && <td />}
                </tr>
                <tr>
                  <td colSpan={10} className="px-4 py-1.5 text-right text-xs text-gray-600">TVA 21%:</td>
                  <td />
                  <td className="px-4 py-1.5 text-right text-gray-700">{(totalGeneral * 0.21).toFixed(2)} RON</td>
                  <td />
                  {oferta.status === 'in_lucru' && <td />}
                </tr>
                <tr className="border-t border-gray-300">
                  <td colSpan={10} className="px-4 py-2.5 text-right font-bold text-gray-900">Total cu TVA:</td>
                  <td />
                  <td />
                  <td className="px-4 py-2.5 text-right font-bold text-gray-900 text-base">{(totalGeneral * 1.21).toFixed(2)} RON</td>
                  {oferta.status === 'in_lucru' && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Bara fixa jos — Finalizeaza / Anuleaza */}
      {oferta.status === 'in_lucru' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-gray-200 px-6 py-4 flex items-center justify-between shadow-lg">
          <p className="text-sm text-gray-900 font-medium">
            Cerere #{oferta.numar} — {oferta.clienti?.denumire}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => updateStatus('anulata')}
              disabled={actualizand}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:opacity-50 text-sm"
            >
              Anuleaza
            </button>
            <button
              onClick={finalizeazaOferta}
              disabled={actualizand}
              className="cursor-pointer px-6 py-2.5 text-white font-bold rounded-lg disabled:opacity-50 text-sm"
              style={{ backgroundColor: '#16a34a' }}
            >
              ✓ FINALIZEAZA OFERTA
            </button>
          </div>
        </div>
      )}

      {/* Bara fixa jos — Factureaza (status confirmata) */}
      {oferta.status === 'confirmata' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-gray-200 px-6 py-4 flex items-center justify-between shadow-lg">
          <p className="text-sm text-gray-900 font-medium">
            Cerere #{oferta.numar} — {oferta.clienti?.denumire}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => updateStatus('facturat')}
              disabled={actualizand}
              className="px-4 py-2.5 text-gray-700 font-semibold rounded-lg disabled:opacity-50 text-sm border border-gray-300 hover:bg-gray-50"
            >
              Marchează facturat
            </button>
            <button
              onClick={() => router.push(`/facturare?oferta_id=${id}`)}
              disabled={actualizand}
              className="px-6 py-2.5 text-white font-bold rounded-lg disabled:opacity-50 text-sm"
              style={{ backgroundColor: '#0f172a' }}
            >
              🧾 Emite factură
            </button>
          </div>
        </div>
      )}

      {/* Bara fixa jos — Confirma oferta (status finalizata) */}
      {oferta.status === 'finalizata' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-gray-200 px-6 py-4 flex items-center justify-between shadow-lg">
          <p className="text-sm text-gray-900 font-medium">
            Cerere #{oferta.numar} — {oferta.clienti?.denumire}
          </p>
          <button
            onClick={deschideConfirmare}
            disabled={actualizand}
            className="cursor-pointer px-6 py-2.5 text-white font-bold rounded-lg disabled:opacity-50 text-sm"
            style={{ backgroundColor: '#7c3aed' }}
          >
            ✓ CONFIRMA OFERTA
          </button>
        </div>
      )}

      {/* Spatiu pentru bara fixa */}
      {['in_lucru', 'finalizata', 'confirmata'].includes(oferta.status) && <div className="h-20" />}

      {/* Modal confirmare oferta */}
      {modalConfirma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirmă Oferta</h3>
                <p className="text-sm text-gray-600 mt-0.5">Verifică și ajustează ridicările înainte de confirmare</p>
              </div>
              <button onClick={() => setModalConfirma(false)} className="text-gray-600 hover:text-gray-900 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {confirmaRanduri.map((rand, idx) => (
                <div key={rand.oferta_produs_id} className={`rounded-xl border-2 p-4 transition-colors ${rand.include ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                  <div className="flex items-start gap-3">
                    {/* Checkbox inclus/exclus */}
                    <input
                      type="checkbox"
                      checked={rand.include}
                      onChange={e => setConfirmaRanduri(prev => prev.map((r, i) => i === idx ? { ...r, include: e.target.checked } : r))}
                      className="mt-1 w-4 h-4 accent-purple-600 cursor-pointer"
                    />
                    <div className="flex-1 space-y-3">
                      {/* Produs info */}
                      <div>
                        <p className="font-semibold text-gray-900">{rand.nume_produs}</p>
                        <p className="text-xs text-gray-600">{rand.cantitate} {rand.unitate || 'buc'}{rand.producator ? ` · ${rand.producator}` : ''}</p>
                      </div>
                      {rand.include && (
                        <div className="grid grid-cols-3 gap-3">
                          {/* Furnizor */}
                          <div>
                            <label className="block text-xs font-medium text-gray-900 mb-1">Furnizor</label>
                            <select
                              value={rand.furnizor_id ?? ''}
                              onChange={e => {
                                const fid = e.target.value
                                const fnum = fid ? (totiIFurnizori.find(f => f.id === fid)?.denumire ?? '') : 'Stoc Propriu'
                                setConfirmaRanduri(prev => prev.map((r, i) => i === idx ? { ...r, furnizor_id: fid || null, furnizor_nume: fnum } : r))
                              }}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="">— Stoc Propriu —</option>
                              {totiIFurnizori.map(f => (
                                <option key={f.id} value={f.id}>{f.is_favorit ? '★ ' : ''}{f.denumire}</option>
                              ))}
                            </select>
                          </div>
                          {/* Ora + Data — ascunse pentru Stoc Propriu */}
                          {rand.furnizor_id === null ? (
                            <div className="col-span-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                              <span>✓</span>
                              <span>Stoc Propriu — produs disponibil imediat, fără dată de ridicare</span>
                            </div>
                          ) : (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-gray-900 mb-1">Ora ridicare</label>
                                <input
                                  type="text"
                                  value={rand.ora_ridicare}
                                  onChange={e => setConfirmaRanduri(prev => prev.map((r, i) => i === idx ? { ...r, ora_ridicare: e.target.value } : r))}
                                  placeholder="ex: 10:00"
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                              </div>
                              {rand.ora_ridicare !== 'Stoc CT' && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-900 mb-1">Data livrare</label>
                                  <input
                                    type="date"
                                    value={rand.data_livrare}
                                    onChange={e => setConfirmaRanduri(prev => prev.map((r, i) => i === idx ? { ...r, data_livrare: e.target.value } : r))}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setModalConfirma(false)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium hover:bg-gray-50"
              >
                Anulează
              </button>
              <button
                onClick={salveazaConfirmare}
                disabled={confirmand}
                className="flex-1 py-2.5 text-white font-bold rounded-lg disabled:opacity-50 text-sm"
                style={{ backgroundColor: '#7c3aed' }}
              >
                {confirmand ? 'Se salvează...' : '✓ Confirmă și trimite la ridicare'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal produs nou in catalog */}
      <ProdusNouModal
        open={modalProdusNou}
        onClose={() => setModalProdusNou(false)}
        onSaved={produsNouSalvat}
        numeInitial={prodSearch}
      />

      {/* Modal adauga produs */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">Adauga Produs</h3>
              <button onClick={closeModal} className="text-gray-600 hover:text-gray-900 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100">
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Cautare catalog */}
              <div ref={prodRef}>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Selecteaza produs din catalog
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={prodSearch}
                    onChange={e => { setProdSearch(e.target.value); setShowProdList(true) }}
                    onFocus={() => setShowProdList(true)}
                    placeholder="Cauta produs dupa nume sau cod..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-600 text-sm">🔍</span>
                  {showProdList && prodResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {prodResults.map(p => {
                        const cantStoc = stocMap[p.id] ?? (p.cod ? stocMap[p.cod] : 0) ?? 0
                        return (
                          <button key={p.id} onClick={() => selectProdus(p)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center justify-between gap-2">
                            <span>
                              <span className="font-medium text-gray-900">{p.nume}</span>
                              {p.cod && <span className="text-gray-500 ml-2 font-mono text-xs">{p.cod}</span>}
                              {p.producator && <span className="text-gray-500 ml-1 text-xs">· {p.producator}</span>}
                            </span>
                            <span className={`text-xs font-semibold whitespace-nowrap px-1.5 py-0.5 rounded ${cantStoc > 0 ? 'text-green-700 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                              stoc: {cantStoc}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {showProdList && prodSearch.trim() && prodResults.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow px-3 py-2 flex items-center justify-between">
                      <span className="text-sm text-gray-600">Niciun produs gasit.</span>
                      <button
                        onClick={() => { setShowProdList(false); setModalProdusNou(true) }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline ml-3 whitespace-nowrap"
                      >
                        + Adauga in catalog
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Daca e produs din catalog — afisare statica */}
              {form.produs_id ? (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <p className="text-xs text-gray-900 mb-0.5">Denumire</p>
                      <p className="text-sm font-medium text-gray-900">{form.nume_produs}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-900 mb-0.5">UM</p>
                      <p className="text-sm text-gray-900">{form.unitate || '—'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-900 mb-0.5">Cod/SKU</p>
                      <p className="text-sm font-mono text-gray-900">{form.cod || '—'}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs text-gray-900">Producator</p>
                        <button
                          type="button"
                          onClick={() => setEditProducatorModal(v => !v)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Editeaza producator"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </div>
                      {editProducatorModal ? (
                        <input
                          type="text"
                          value={form.producator}
                          onChange={e => setForm(f => ({ ...f, producator: e.target.value }))}
                          autoFocus
                          placeholder="ex: VALEO..."
                          className="w-full px-2 py-1 border border-blue-400 rounded text-sm text-gray-900 focus:outline-none"
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{form.producator || '—'}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Nume produs manual */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1.5">
                      Nume produs <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.nume_produs}
                      onChange={e => setForm(f => ({ ...f, nume_produs: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1.5">Cod/SKU</label>
                      <input type="text" value={form.cod} onChange={e => setForm(f => ({ ...f, cod: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1.5">UM</label>
                      <input type="text" value={form.unitate} onChange={e => setForm(f => ({ ...f, unitate: e.target.value }))}
                        placeholder="buc, set..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1.5">Producator</label>
                      <input type="text" value={form.producator} onChange={e => setForm(f => ({ ...f, producator: e.target.value }))}
                        placeholder="ex: VALEO..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </>
              )}

              {/* Cantitate — mereu editabila */}
              {form.produs_id && (
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Cantitate</label>
                  <input
                    type="number" min="1" step="1" value={form.cantitate}
                    onChange={e => setForm(f => ({ ...f, cantitate: parseFloat(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Cantitate pentru produs manual */}
              {!form.produs_id && (
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Cantitate</label>
                  <input
                    type="number" min="1" step="1" value={form.cantitate}
                    onChange={e => setForm(f => ({ ...f, cantitate: parseFloat(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Pret achizitie + Pret vanzare + Adaos dinamic */}
              <div className="space-y-2">
                {form.produs_id && stocOptiuni.length > 1 && (
                  <div className="border border-blue-200 rounded-lg overflow-hidden">
                    <div className="bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 border-b border-blue-200">
                      📦 {stocOptiuni.length} intrări în stoc — alege de unde ofertezi:
                    </div>
                    {stocOptiuni.map((opt, i) => (
                      <button key={opt.id} onClick={() => aplicaStocOptiune(i)}
                        className="w-full text-left px-3 py-2 flex items-center justify-between text-sm border-b border-blue-100 last:border-0 transition-colors"
                        style={{ backgroundColor: stocOptiuneIdx === i ? '#eff6ff' : 'white' }}>
                        <span className="flex items-center gap-2">
                          <span style={{ color: stocOptiuneIdx === i ? '#1d4ed8' : 'transparent' }} className="font-bold">✓</span>
                          <span className="text-gray-600">{opt.furnizor_nume || 'Furnizor necunoscut'}</span>
                          <span className="text-gray-400 text-xs">· {opt.cantitate} {' '}buc stoc</span>
                        </span>
                        <span className="flex gap-4 text-xs">
                          <span className="text-gray-500">Ach: <strong className="text-gray-900">{opt.pret_achizitie.toFixed(2)} RON</strong></span>
                          <span className="text-blue-600">Listă: <strong>{opt.pret_lista ? opt.pret_lista.toFixed(2) + ' RON' : '—'}</strong></span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {form.produs_id && stocOptiuni.length === 1 && stocOptiuni[0].pret_achizitie > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                    <span>✓</span>
                    <span>Prețuri preluate din gestiune · Pretul de vanzare poate fi modificat</span>
                  </div>
                )}
                {form.produs_id && stocOptiuni.length === 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <span>⚠</span>
                    <span>Produsul nu este in gestiune · Introdu preturile manual</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1.5">
                      Pret achizitie
                      {stocOptiuni.length > 0 && <span className="ml-1 text-xs text-gray-400 font-normal">(din gestiune)</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.pret_achizitie}
                      onChange={e => stocOptiuni.length === 0 && setForm(f => ({ ...f, pret_achizitie: parseFloat(e.target.value) || 0 }))}
                      readOnly={stocOptiuni.length > 0}
                      className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${stocOptiuni.length > 0 ? 'bg-gray-50 border-gray-200 cursor-not-allowed text-gray-600' : 'border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                      <label className="text-sm font-medium text-gray-900">Pret vanzare <span className="text-gray-500 font-normal">(preț listă +30%)</span></label>
                      {pretSpecialClient !== null && (
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, pret_vanzare: pretSpecialClient! }))}
                          className="text-xs font-bold rounded px-2 py-1 flex items-center gap-1"
                          style={{ color: '#5b21b6', backgroundColor: '#ede9fe', border: '1px solid #a78bfa' }}
                        >
                          <span>⭐</span>
                          <span style={{ color: '#3b0764' }}>Preț special client: {pretSpecialClient!.toFixed(2)} RON · ↩ folosește</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.pret_vanzare}
                      onChange={e => setForm(f => ({ ...f, pret_vanzare: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {/* Adaos dinamic */}
                <AdaosDisplay ach={form.pret_achizitie} vanz={form.pret_vanzare} />
              </div>

              {/* Furnizor */}
              <div ref={furnRef}>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Furnizor</label>
                <div className="relative">
                  <input
                    type="text"
                    value={furnizorSearch}
                    onChange={e => { setFurnizorSearch(e.target.value); setShowFurnList(true) }}
                    onFocus={() => setShowFurnList(true)}
                    placeholder="Cauta furnizor..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-600 text-sm">🔍</span>
                  {showFurnList && (
                    <div className="absolute z-10 w-full bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {/* Stoc Propriu — mereu primul */}
                      <button
                        onClick={() => selectFurnizor({ id: null, denumire: 'Stoc Propriu', is_favorit: false })}
                        className="w-full text-left px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-blue-50 border-b border-gray-200 flex items-center gap-2"
                      >
                        <span>🏠</span> Stoc Propriu
                      </button>
                      {furnizorResults.map(f => (
                        <button key={f.id} onClick={() => selectFurnizor(f)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center gap-2">
                          <span style={{ color: f.is_favorit ? '#F59E0B' : 'transparent', fontSize: '12px' }}>★</span>
                          {f.denumire}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ridicare — apare doar pentru furnizori externi, nu pentru Stoc Propriu */}
              {form.furnizor_label && form.furnizor_label !== 'Stoc Propriu' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Ridicare</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {/* Stoc CT — mereu disponibil */}
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, ora_ridicare: 'Stoc CT' }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        form.ora_ridicare === 'Stoc CT'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      ✓ Stoc CT
                    </button>
                    {/* Orele furnizorului */}
                    {furnizorOre.map(ora => (
                      <button
                        key={ora}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, ora_ridicare: ora }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          form.ora_ridicare === ora
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        🕐 {ora}
                      </button>
                    ))}
                  </div>
                  {/* Data livrare — nu e relevanta daca e Stoc CT */}
                  {form.ora_ridicare && form.ora_ridicare !== 'Stoc CT' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-900 mb-1">Data livrare (optional)</label>
                      <input
                        type="date"
                        value={form.data_livrare}
                        onChange={e => setForm(f => ({ ...f, data_livrare: e.target.value }))}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="px-6 pb-6">
              <button
                onClick={adaugaProdus}
                disabled={saving || !form.nume_produs.trim()}
                className="w-full py-3 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-lg disabled:opacity-40 transition-colors"
              >
                {saving ? 'Se salveaza...' : 'Adauga Produs'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
