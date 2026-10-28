// Funcții pure pentru CUI și răspunsul ANAF — fără importuri, ca să poată fi
// folosite și în browser, și pe server, și în teste (node --test).

export type AnafStare = 'activa' | 'inactiva' | 'inexistent' | 'eroare' | 'neverificat'

export interface DateAnaf {
  cui: string               // doar cifre
  denumire: string
  adresa: string
  reg_com: string
  cod_postal: string
  platitor_tva: boolean | null   // null = ANAF nu a trimis scpTVA
  judet: string
  localitate: string
  strada: string
  numar: string
}

export type RezultatAnaf =
  | { stare: 'activa' | 'inactiva'; date: DateAnaf; raw: unknown }
  | { stare: 'inexistent'; raw: unknown }
  | { stare: 'eroare'; mesaj: string }

export const MESAJ_CUI_INCORECT = 'CUI-ul nu pare corect — verificați cifrele.'

// ─── CUI ────────────────────────────────────────────────────────────────────

/** Scoate „RO", spațiile și punctele. Întoarce ce rămâne (poate conține și alte caractere). */
export function curataCui(input: string | null | undefined): string {
  return (input ?? '').trim().replace(/^RO/i, '').replace(/[\s.]/g, '')
}

/** true dacă CUI-ul are 2–10 cifre și cifra de control (cheia 753217532) se potrivește. */
export function cuiValid(input: string | null | undefined): boolean {
  const cui = curataCui(input)
  if (!/^\d{2,10}$/.test(cui)) return false
  const cheie = '753217532'
  const corp = cui.slice(0, -1).padStart(9, '0')
  let suma = 0
  for (let i = 0; i < 9; i++) suma += Number(corp[i]) * Number(cheie[i])
  let rest = (suma * 10) % 11
  if (rest === 10) rest = 0
  return rest === Number(cui[cui.length - 1])
}

/** „RO" + cifre doar pentru plătitorii de TVA. */
export function cuiAfisat(cui: string | null | undefined, platitorTva: boolean | null | undefined): string {
  const c = curataCui(cui)
  if (!c) return ''
  return platitorTva ? `RO${c}` : c
}

// ─── Text ───────────────────────────────────────────────────────────────────

/** ş→ș, ţ→ț (și majusculele). ANAF trimite încă diacriticele cu sedilă. */
export function corecteazaDiacritice(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/ş/g, 'ș').replace(/Ş/g, 'Ș')
    .replace(/ţ/g, 'ț').replace(/Ţ/g, 'Ț')
    .trim()
}

/** „CONSTANŢA" → „Constanța", „CARAŞ-SEVERIN" → „Caraș-Severin", „MUNICIPIUL BUCUREŞTI" → „București". */
export function formateazaJudet(s: string | null | undefined): string {
  const t = corecteazaDiacritice(s)
  if (!t) return ''
  if (/BUCURE[SȘ]TI/i.test(t)) return 'București'
  return t
    .toLocaleLowerCase('ro')
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, lit: string) => sep + lit.toLocaleUpperCase('ro'))
}

/** Data de azi (AAAA-LL-ZZ) în ora României. */
export function dataAziBucuresti(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

// ─── Răspuns ANAF ───────────────────────────────────────────────────────────

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const str = (v: unknown): string => (v == null ? '' : corecteazaDiacritice(String(v)))

/**
 * Citește răspunsul ANAF (PlatitorTvaRest v9) pentru un CUI.
 * Nu aruncă niciodată: un răspuns fără „found" e tratat ca eroare.
 */
export function parseRaspunsAnaf(json: unknown, cuiCautat: string): RezultatAnaf {
  const cui = curataCui(cuiCautat)
  const found = obj(json).found
  if (!Array.isArray(found)) {
    return { stare: 'eroare', mesaj: 'Răspuns ANAF neașteptat' }
  }

  const firma = found.find(f => String(obj(obj(f).date_generale).cui ?? '') === cui)
  if (!firma) return { stare: 'inexistent', raw: json }

  const dg = obj(obj(firma).date_generale)
  const tva = obj(obj(firma).inregistrare_scop_Tva)
  const inactiv = obj(obj(firma).stare_inactiv)
  const sediu = obj(obj(firma).adresa_sediu_social)

  const scp = tva.scpTVA
  const platitor_tva = typeof scp === 'boolean' ? scp : null

  const radiata = str(inactiv.dataRadiere) !== ''
  const esteInactiva = inactiv.statusInactivi === true || radiata

  return {
    stare: esteInactiva ? 'inactiva' : 'activa',
    raw: json,
    date: {
      cui,
      denumire: str(dg.denumire),
      adresa: str(dg.adresa),
      reg_com: str(dg.nrRegCom),
      cod_postal: str(sediu.scod_Postal) || str(dg.codPostal),
      platitor_tva,
      judet: formateazaJudet(str(sediu.sdenumire_Judet)),
      localitate: str(sediu.sdenumire_Localitate),
      strada: str(sediu.sdenumire_Strada),
      numar: str(sediu.snumar_Strada),
    },
  }
}
