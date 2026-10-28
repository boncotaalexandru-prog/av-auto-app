// DOAR pe server (folosit din rutele /api/anaf/*). Nu importa din componente 'use client'.
import type { SupabaseClient } from '@supabase/supabase-js'
import { curataCui, dataAziBucuresti, parseRaspunsAnaf, type AnafStare, type RezultatAnaf } from './anaf.ts'

const ANAF_URL = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva'
const TIMEOUT_MS = 10_000
const INCERCARI = 2
const PAUZA_INTRE_INCERCARI_MS = 1_500
const DISTANTA_MINIMA_MS = 1_100   // ANAF acceptă ~1 cerere pe secundă

const pauza = (ms: number) => new Promise(r => setTimeout(r, ms))

// Coadă: cererile către ANAF pleacă una după alta, la minimum 1,1 s distanță.
let coada: Promise<unknown> = Promise.resolve()
let ultimaCerere = 0

function inCoada<T>(fn: () => Promise<T>): Promise<T> {
  const rezultat = coada.then(async () => {
    const asteapta = ultimaCerere + DISTANTA_MINIMA_MS - Date.now()
    if (asteapta > 0) await pauza(asteapta)
    ultimaCerere = Date.now()
    return fn()
  })
  coada = rezultat.catch(() => undefined)
  return rezultat
}

/** Întreabă ANAF. Nu aruncă niciodată — la probleme întoarce { stare: 'eroare' }. */
export async function interogheazaAnaf(cuiInput: string): Promise<RezultatAnaf> {
  const cui = curataCui(cuiInput)
  let ultimaEroare = 'ANAF nu a răspuns'

  for (let i = 0; i < INCERCARI; i++) {
    if (i > 0) await pauza(PAUZA_INTRE_INCERCARI_MS)
    try {
      const rez = await inCoada(async () => {
        const res = await fetch(ANAF_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{ cui: Number(cui), data: dataAziBucuresti() }]),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`ANAF HTTP ${res.status}`)
        return parseRaspunsAnaf(await res.json(), cui)
      })
      if (rez.stare !== 'eroare') return rez
      ultimaEroare = rez.mesaj
    } catch (e) {
      ultimaEroare = e instanceof Error ? e.message : String(e)
    }
  }
  return { stare: 'eroare', mesaj: ultimaEroare }
}

// Ultimele răspunsuri reușite, ținute 10 minute — ca „Salvează" să nu mai întrebe ANAF
// imediat după „Verifică la ANAF".
const memorie = new Map<string, { rez: RezultatAnaf; la: number }>()

export async function interogheazaAnafCuMemorie(cuiInput: string, fortat = false): Promise<RezultatAnaf> {
  const cui = curataCui(cuiInput)
  const m = memorie.get(cui)
  if (!fortat && m && Date.now() - m.la < 10 * 60 * 1000) return m.rez
  const rez = await interogheazaAnaf(cui)
  if (rez.stare !== 'eroare') memorie.set(cui, { rez, la: Date.now() })
  return rez
}

// ─── Baza de date ───────────────────────────────────────────────────────────

export const COLOANE_CLIENT =
  'id, denumire, cod_fiscal, reg_com, adresa, localitate, judet, strada, numar, cod_postal, tara, telefon, email, ' +
  'platitor_tva, anaf_state, anaf_checked_at'

export interface ClientRow {
  id: string
  denumire: string
  cod_fiscal: string | null
  reg_com: string | null
  adresa: string | null
  localitate: string | null
  judet: string | null
  strada: string | null
  numar: string | null
  cod_postal: string | null
  tara: string | null
  telefon: string | null
  email: string | null
  platitor_tva: boolean | null
  anaf_state: AnafStare | null
  anaf_checked_at: string | null
}

const STARI_REUSITE: AnafStare[] = ['activa', 'inactiva', 'inexistent']

/** Verificare reușită (ANAF a răspuns) în ultimele 24 de ore. */
export function cacheValid24h(c: Pick<ClientRow, 'anaf_state' | 'anaf_checked_at'>): boolean {
  if (!c.anaf_checked_at || !c.anaf_state || !STARI_REUSITE.includes(c.anaf_state)) return false
  return Date.now() - new Date(c.anaf_checked_at).getTime() < 24 * 3600 * 1000
}

/** Verificare reușită făcută azi (ora României) — necesar la facturare. */
export function verificatAzi(c: Pick<ClientRow, 'anaf_state' | 'anaf_checked_at'>): boolean {
  if (!c.anaf_checked_at || !c.anaf_state || !STARI_REUSITE.includes(c.anaf_state)) return false
  return dataAziBucuresti(new Date(c.anaf_checked_at)) === dataAziBucuresti()
}

/** Găsește clientul după CUI, indiferent dacă e salvat cu „RO" sau fără. */
export async function gasesteClientDupaCui(supabase: SupabaseClient, cuiInput: string): Promise<ClientRow | null> {
  const c = curataCui(cuiInput)
  const { data } = await supabase
    .from('clienti')
    .select(COLOANE_CLIENT)
    .in('cod_fiscal', [c, `RO${c}`, `RO ${c}`, `ro${c}`, `Ro${c}`])
    .limit(1)
  return ((data ?? [])[0] as unknown as ClientRow) ?? null
}

/** Câmpurile care se scriu în `clienti` după un răspuns ANAF reușit. */
export function campuriDinAnaf(rez: RezultatAnaf): Record<string, unknown> | null {
  const acum = new Date().toISOString()
  if (rez.stare === 'eroare') return null   // datele salvate deja NU se ating
  if (rez.stare === 'inexistent') {
    return { anaf_state: 'inexistent', anaf_checked_at: acum, anaf_raw: rez.raw, updated_at: acum }
  }
  const d = rez.date
  return {
    cod_fiscal: d.cui,
    denumire: d.denumire,
    adresa: d.adresa,
    reg_com: d.reg_com,
    platitor_tva: d.platitor_tva,
    judet: d.judet,
    localitate: d.localitate,
    strada: d.strada,
    numar: d.numar,
    cod_postal: d.cod_postal,
    tara: 'România',
    anaf_state: rez.stare,
    anaf_checked_at: acum,
    anaf_raw: rez.raw,
    updated_at: acum,
  }
}

/** Reverifică un client existent și îi actualizează datele. `fortat` ignoră cache-ul. */
export async function actualizeazaClientDinAnaf(
  supabase: SupabaseClient,
  client: ClientRow,
  conditieCache: (c: ClientRow) => boolean,
): Promise<{ stare: AnafStare; client: ClientRow; mesaj?: string; dinCache: boolean }> {
  if (conditieCache(client)) {
    return { stare: client.anaf_state as AnafStare, client, dinCache: true }
  }
  const rez = await interogheazaAnaf(client.cod_fiscal ?? '')
  const campuri = campuriDinAnaf(rez)
  if (!campuri) return { stare: 'eroare', client, mesaj: rez.stare === 'eroare' ? rez.mesaj : undefined, dinCache: false }

  const { data, error } = await supabase
    .from('clienti').update(campuri).eq('id', client.id).select(COLOANE_CLIENT).single()
  if (error || !data) {
    return { stare: 'eroare', client, mesaj: `Salvare eșuată: ${error?.message ?? 'necunoscut'}`, dinCache: false }
  }
  return { stare: rez.stare, client: data as unknown as ClientRow, dinCache: false }
}
