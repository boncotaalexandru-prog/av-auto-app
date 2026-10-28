// Rulare: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cuiAfisat, cuiValid, curataCui, formateazaJudet, parseRaspunsAnaf } from './anaf.ts'
import { clientPentruOblio } from './oblioClient.ts'

// ─── Validare CUI ───────────────────────────────────────────────────────────

test('curataCui scoate RO, spațiile și punctele', () => {
  assert.equal(curataCui(' RO 14.399.840 '), '14399840')
  assert.equal(curataCui('ro18547290'), '18547290')
})

test('CUI-uri reale sunt valide', () => {
  for (const c of ['14399840', 'RO14399840', 'RO 18547290', '1590082', '159.008.2']) {
    assert.equal(cuiValid(c), true, c)
  }
})

test('cifră de control greșită → invalid', () => {
  assert.equal(cuiValid('14399841'), false)
  assert.equal(cuiValid('18547291'), false)
})

test('lungime sau caractere greșite → invalid', () => {
  assert.equal(cuiValid(''), false)
  assert.equal(cuiValid('1'), false)            // sub 2 cifre
  assert.equal(cuiValid('12345678901'), false)  // peste 10 cifre
  assert.equal(cuiValid('1439984A'), false)
  assert.equal(cuiValid(null), false)
})

test('restul 10 devine 0', () => {
  // corp 00000001 → 1×2 = 2; 2×10 = 20; 20 mod 11 = 9 → „19"
  assert.equal(cuiValid('19'), true)
  // găsim un corp pentru care restul e 10 și verificăm că cifra de control 0 e acceptată
  const cheie = '753217532'
  let gasit = ''
  for (let n = 1; n < 100000 && !gasit; n++) {
    const corp = String(n).padStart(9, '0')
    let suma = 0
    for (let i = 0; i < 9; i++) suma += Number(corp[i]) * Number(cheie[i])
    if ((suma * 10) % 11 === 10) gasit = String(n) + '0'
  }
  assert.ok(gasit)
  assert.equal(cuiValid(gasit), true)
})

test('RO afișat doar pentru plătitori de TVA', () => {
  assert.equal(cuiAfisat('RO14399840', true), 'RO14399840')
  assert.equal(cuiAfisat('RO14399840', false), '14399840')
  assert.equal(cuiAfisat('14399840', null), '14399840')
})

test('județ scris normal', () => {
  assert.equal(formateazaJudet('CONSTANŢA'), 'Constanța')
  assert.equal(formateazaJudet('CARAŞ-SEVERIN'), 'Caraș-Severin')
  assert.equal(formateazaJudet('SATU MARE'), 'Satu Mare')
  assert.equal(formateazaJudet('MUNICIPIUL BUCUREŞTI'), 'București')
})

// ─── Răspuns ANAF ───────────────────────────────────────────────────────────

function firma(over: { tva?: Record<string, unknown>; inactiv?: Record<string, unknown> } = {}) {
  return {
    date_generale: {
      cui: 14399840,
      denumire: 'FIRMA DE TEST S.R.L.',
      adresa: 'JUD. CONSTANŢA, MUN. CONSTANŢA, STR. ŞTEFAN CEL MARE, NR.1',
      nrRegCom: 'J13/123/2001',
      codPostal: '900001',
    },
    inregistrare_scop_Tva: over.tva ?? { scpTVA: true },
    stare_inactiv: { statusInactivi: false, dataRadiere: '', ...over.inactiv },
    adresa_sediu_social: {
      sdenumire_Judet: 'CONSTANŢA',
      sdenumire_Localitate: 'Mun. Constanţa',
      sdenumire_Strada: 'Str. Ştefan cel Mare',
      snumar_Strada: '1',
      scod_Postal: '900001',
    },
  }
}
const raspuns = (...found: unknown[]) => ({ cod: 200, message: 'SUCCESS', found, notFound: [] })

test('firmă activă, plătitoare de TVA', () => {
  const r = parseRaspunsAnaf(raspuns(firma()), 'RO14399840')
  assert.equal(r.stare, 'activa')
  if (r.stare !== 'activa') return
  assert.equal(r.date.cui, '14399840')
  assert.equal(r.date.platitor_tva, true)
  assert.equal(r.date.reg_com, 'J13/123/2001')
  assert.equal(r.date.judet, 'Constanța')
  assert.equal(r.date.localitate, 'Mun. Constanța')
  assert.equal(r.date.strada, 'Str. Ștefan cel Mare')
  assert.equal(r.date.numar, '1')
  assert.equal(r.date.cod_postal, '900001')
  assert.match(r.date.adresa, /CONSTANȚA.*ȘTEFAN/)
  assert.doesNotMatch(r.date.adresa, /[şţŞŢ]/)
  assert.ok(r.raw)
})

test('firmă neplătitoare de TVA', () => {
  const r = parseRaspunsAnaf(raspuns(firma({ tva: { scpTVA: false } })), '14399840')
  assert.equal(r.stare, 'activa')
  if (r.stare === 'activa') assert.equal(r.date.platitor_tva, false)
})

test('firmă inactivă', () => {
  const r = parseRaspunsAnaf(raspuns(firma({ inactiv: { statusInactivi: true } })), '14399840')
  assert.equal(r.stare, 'inactiva')
})

test('firmă radiată (dataRadiere completată) → inactivă', () => {
  const r = parseRaspunsAnaf(raspuns(firma({ inactiv: { dataRadiere: '2023-05-10' } })), '14399840')
  assert.equal(r.stare, 'inactiva')
})

test('CUI inexistent', () => {
  const r = parseRaspunsAnaf({ cod: 200, message: 'SUCCESS', found: [], notFound: [14399840] }, '14399840')
  assert.equal(r.stare, 'inexistent')
})

test('în found e altă firmă → inexistent', () => {
  const r = parseRaspunsAnaf(raspuns(firma()), '18547290')
  assert.equal(r.stare, 'inexistent')
})

test('fără scpTVA → null (necunoscut), nu false', () => {
  const r = parseRaspunsAnaf(raspuns(firma({ tva: {} })), '14399840')
  assert.equal(r.stare, 'activa')
  if (r.stare === 'activa') assert.equal(r.date.platitor_tva, null)
})

test('răspuns stricat → eroare, nu aruncă', () => {
  assert.equal(parseRaspunsAnaf(null, '14399840').stare, 'eroare')
  assert.equal(parseRaspunsAnaf('<html>', '14399840').stare, 'eroare')
  assert.equal(parseRaspunsAnaf({ message: 'Too many requests' }, '14399840').stare, 'eroare')
})

// ─── Client trimis la Oblio ─────────────────────────────────────────────────

const baza = {
  denumire: 'FIRMA DE TEST S.R.L.', cod_fiscal: '14399840', reg_com: 'J13/123/2001',
  adresa: 'Str. X nr. 1', localitate: 'Mun. Constanța', judet: 'Constanța', tara: 'România',
  telefon: '', email: '', platitor_tva: true,
}

test('Oblio: plătitor → RO + cifre, vatPayer 1, fără autocomplete', () => {
  const c = clientPentruOblio(baza)
  assert.equal(c.cif, 'RO14399840')
  assert.equal(c.vatPayer, 1)
  assert.equal(c.save, 1)
  assert.equal(c.autocomplete, 0)
  assert.equal(c.state, 'Constanța')
  assert.equal(c.country, 'România')
})

test('Oblio: neplătitor → doar cifre, vatPayer 0', () => {
  const c = clientPentruOblio({ ...baza, cod_fiscal: 'RO14399840', platitor_tva: false })
  assert.equal(c.cif, '14399840')
  assert.equal(c.vatPayer, 0)
})

test('Oblio: București → state București, city SECTOR n', () => {
  const c = clientPentruOblio({ ...baza, judet: 'București', localitate: 'Sector 3' })
  assert.equal(c.state, 'București')
  assert.equal(c.city, 'SECTOR 3')
})

test('Oblio: București — sectorul din adresa fiscală are prioritate', () => {
  const c = clientPentruOblio({ ...baza, judet: 'București', localitate: 'Sector 6 Mun. București', adresa: 'MUNICIPIUL BUCUREȘTI, SECTOR 2, STR. GARA HERĂSTRĂU, NR.6' })
  assert.equal(c.city, 'SECTOR 2')
})
