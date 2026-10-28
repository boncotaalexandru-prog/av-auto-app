import { curataCui, cuiValid } from './anaf.ts'

export interface ClientFacturare {
  denumire: string
  cod_fiscal: string | null
  reg_com: string | null
  adresa: string | null
  localitate: string | null
  judet: string | null
  tara: string | null
  telefon: string | null
  email: string | null
  platitor_tva: boolean | null
}

/** Firmă românească (2–10 cifre) — se verifică la ANAF. CNP-urile și clienții din străinătate nu. */
export function clientVerificabilAnaf(c: Pick<ClientFacturare, 'cod_fiscal' | 'tara'>): boolean {
  const tara = (c.tara ?? '').trim().toLowerCase()
  const dinRomania = tara === '' || tara === 'romania' || tara === 'românia' || tara === 'ro'
  return dinRomania && /^\d{2,10}$/.test(curataCui(c.cod_fiscal))
}

/** Blocul „client" trimis la Oblio. */
export function clientPentruOblio(c: ClientFacturare) {
  const verificabil = clientVerificabilAnaf(c) && cuiValid(c.cod_fiscal)
  const cifuri = curataCui(c.cod_fiscal)
  const vatPayer = c.platitor_tva ? 1 : 0

  let state = c.judet ?? ''
  let city = c.localitate ?? ''
  if (/bucure[sșş]ti/i.test(state)) {
    state = 'București'
    // sectorul din adresa fiscală are prioritate (sediul social poate fi în alt sector)
    const sector = ((c.adresa ?? '').match(/sector(?:ul)?\s*(\d)/i) ?? city.match(/sector(?:ul)?\s*(\d)/i))?.[1]
    if (sector) city = `SECTOR ${sector}`
  }

  return {
    // pentru clienții fără CUI românesc (CNP, străinătate) trimitem codul fiscal așa cum e salvat
    cif: verificabil ? (vatPayer ? `RO${cifuri}` : cifuri) : (c.cod_fiscal ?? '').trim(),
    name: c.denumire,
    rc: c.reg_com ?? '',
    address: c.adresa ?? '',
    state,
    city,
    country: verificabil ? 'România' : (c.tara || 'România'),
    phone: c.telefon ?? '',
    email: c.email ?? '',
    vatPayer,
    save: 1,
    autocomplete: 0, // Oblio să NU completeze singur cu datele vechi din contul lui
  }
}
