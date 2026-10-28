// Stocul rezervat = piese care au plecat sau sunt promise, dar inca n-au scazut din stoc:
//   - linii din facturi nefinalizate (stocul scade abia la emitere)
//   - piese bifate „livrat" pe oferte confirmate (oferta inca n-a ajuns in factura)
// Stoc disponibil = stoc fizic − rezervat. Stocul fizic din tabela `stoc` nu se atinge aici.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface Rezervare {
  tip: 'factura' | 'livrat'
  stoc_id: string | null
  produs_id: string | null
  cod: string | null
  cantitate: number
  eticheta: string // ex. „GELCOSIN SRL · oferta #2407"
  sursa_id: string // oferta sau factura care rezerva
}

export interface IntrareStoc {
  id: string
  produs_id: string | null
  produs_cod: string | null
  cantitate: number
  updated_at?: string | null
}

type Clienti = { denumire: string } | { denumire: string }[] | null
const denumire = (c: Clienti) => (Array.isArray(c) ? c[0]?.denumire : c?.denumire) ?? '?'

/**
 * Toate rezervarile active. `except` scoate rezervarile documentului la care lucrezi,
 * ca o oferta sa nu-si blocheze singura piesele cand o facturezi.
 */
export async function incarcaRezervari(
  supabase: SupabaseClient,
  except?: { oferte?: string[]; factura?: string | null },
): Promise<Rezervare[]> {
  const [{ data: facturi }, { data: livrate }] = await Promise.all([
    supabase.from('facturi_produse')
      .select('stoc_id, produs_id, cod, cantitate, factura_id, facturi!inner(status, numar, clienti(denumire))')
      .eq('facturi.status', 'nefinalizata'),
    supabase.from('oferte_produse')
      .select('stoc_id, produs_id, cod, cantitate, oferta_id, oferte!inner(status, numar, clienti(denumire))')
      .eq('oferte.status', 'confirmata')
      .not('livrat_la', 'is', null),
  ])

  const rez: Rezervare[] = []
  for (const l of facturi ?? []) {
    if (l.factura_id === except?.factura) continue
    const f = (Array.isArray(l.facturi) ? l.facturi[0] : l.facturi) as { numar: number; clienti: Clienti }
    rez.push({
      tip: 'factura', stoc_id: l.stoc_id, produs_id: l.produs_id, cod: l.cod, cantitate: Number(l.cantitate ?? 1),
      sursa_id: l.factura_id,
      eticheta: `${denumire(f.clienti)} · factură nefinalizată #${f.numar}`,
    })
  }
  for (const l of livrate ?? []) {
    if (except?.oferte?.includes(l.oferta_id)) continue
    const o = (Array.isArray(l.oferte) ? l.oferte[0] : l.oferte) as { numar: number | null; clienti: Clienti }
    rez.push({
      tip: 'livrat', stoc_id: l.stoc_id, produs_id: l.produs_id, cod: l.cod, cantitate: Number(l.cantitate ?? 1),
      sursa_id: l.oferta_id,
      eticheta: `${denumire(o.clienti)} · oferta #${o.numar ?? '—'}`,
    })
  }
  return rez
}

function sePotrivesc(r: Rezervare, e: IntrareStoc) {
  return (!!r.produs_id && r.produs_id === e.produs_id) || (!!r.cod && r.cod === e.produs_cod)
}

export interface Alocare { rezervat: number; rezervari: { tip: Rezervare['tip']; eticheta: string; cantitate: number }[] }

/**
 * Imparte rezervarile pe intrarile de stoc primite: intai pe intrarea exacta (stoc_id),
 * restul FIFO (cea mai veche intrare intai — la fel ca la emitere) pe intrarile aceluiasi produs.
 */
export function alocaRezervari(intrari: IntrareStoc[], rezervari: Rezervare[]): Map<string, Alocare> {
  const alocari = new Map<string, Alocare>(intrari.map(e => [e.id, { rezervat: 0, rezervari: [] }]))
  const fifo = [...intrari].sort((a, b) => new Date(a.updated_at ?? 0).getTime() - new Date(b.updated_at ?? 0).getTime())
  const liber = (e: IntrareStoc) => Math.max(0, e.cantitate - alocari.get(e.id)!.rezervat)
  const ia = (e: IntrareStoc, r: Rezervare, cat: number) => {
    const a = alocari.get(e.id)!
    a.rezervat += cat
    a.rezervari.push({ tip: r.tip, eticheta: r.eticheta, cantitate: cat })
  }

  // cele cu intrare exacta primele, ca sa nu le ia locul cele fara intrare
  for (const r of [...rezervari].sort((a, b) => Number(!a.stoc_id) - Number(!b.stoc_id))) {
    let rest = r.cantitate
    const exacta = r.stoc_id ? intrari.find(e => e.id === r.stoc_id) : undefined
    if (exacta) {
      const cat = Math.min(rest, liber(exacta))
      if (cat > 0) { ia(exacta, r, cat); rest -= cat }
    }
    for (const e of fifo) {
      if (rest <= 0) break
      if (e === exacta || !sePotrivesc(r, e)) continue
      const cat = Math.min(rest, liber(e))
      if (cat > 0) { ia(e, r, cat); rest -= cat }
    }
  }
  return alocari
}

/** Aceleasi intrari, cu `cantitate` = cat e disponibil (stoc fizic − rezervat). */
export function cuDisponibil<T extends IntrareStoc>(intrari: T[], rezervari: Rezervare[]): T[] {
  if (!rezervari.length) return intrari
  const alocari = alocaRezervari(intrari, rezervari)
  return intrari.map(e => ({ ...e, cantitate: Math.max(0, e.cantitate - alocari.get(e.id)!.rezervat) }))
}

export interface RandStoc extends IntrareStoc {
  pret_achizitie: number
  pret_lista: number | null
  furnizor_nume: string | null
}

/**
 * Intrarile de stoc (cu cantitate > 0) ale produselor date prin id sau cod.
 * Fara .or() scris de mana: .in() pune ghilimele la codurile cu virgula sau paranteze, care altfel stricau filtrul.
 */
export async function incarcaStoc(supabase: SupabaseClient, produsIds: string[], coduri: string[]): Promise<RandStoc[]> {
  const select = 'id, produs_id, produs_cod, cantitate, pret_achizitie, pret_lista, furnizor_nume, updated_at'
  const ids = [...new Set(produsIds.filter(Boolean))]
  const cods = [...new Set(coduri.filter(Boolean))]
  // Cate 100 pe cerere: sute de id-uri intr-un singur .in() fac adresa prea lunga si Supabase raspunde 400
  const loturi = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / 100) }, (_, i) => xs.slice(i * 100, (i + 1) * 100))
  const rezultate = await Promise.all([
    ...loturi(ids).map(lot => supabase.from('stoc').select(select).gt('cantitate', 0).in('produs_id', lot)),
    ...loturi(cods).map(lot => supabase.from('stoc').select(select).gt('cantitate', 0).in('produs_cod', lot)),
  ])
  const unice = new Map<string, RandStoc>()
  for (const r of rezultate.flatMap(res => res.data ?? []) as RandStoc[]) unice.set(r.id, r)
  return [...unice.values()]
}
