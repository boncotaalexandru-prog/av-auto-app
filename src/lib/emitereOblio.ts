// Emiterea facturilor și a storno-urilor spre Oblio — singurul loc din aplicație care face asta.
// Folosit din browser: facturare/page.tsx (lista + storno parțial) și facturare/[id]/page.tsx.
import { createClient } from '@/lib/supabase/client'
import { verificaClientPentruFactura, verificaFacturaInOblio } from '@/lib/anafFacturare'
import { clientPentruOblio, type ClientFacturare } from '@/lib/oblioClient'
import { numarFactura } from '@/lib/numarFactura'
import { marcheazaOferteFacturate, actualizeazaOferteDupaStorno } from '@/lib/oferteFactura'

export interface OblioSettings {
  oblio_email: string
  oblio_secret: string
  cui: string
  serie_factura: string
}

/** Setările Oblio din `settings` (id = 1). null = Oblio neconfigurat → facturile se emit doar în aplicație. */
export async function incarcaSetariOblio(): Promise<OblioSettings | null> {
  const { data } = await createClient()
    .from('settings')
    .select('oblio_email, oblio_secret, cui, serie_factura')
    .eq('id', 1)
    .single()
  if (data?.oblio_email && data?.oblio_secret && data?.cui && data?.serie_factura) return data as OblioSettings
  return null
}

// ─── Trimitere la Oblio ───────────────────────────────────────────────────────

type RaspunsOblio =
  | { ok: true; link: string; seriesName: string | null; number: number | null }
  // sigur = Oblio a răspuns cu eroare, deci documentul sigur NU a fost creat
  | { ok: false; sigur: boolean; mesaj: string }

async function trimiteLaOblio(setari: OblioSettings, invoiceData: object): Promise<RaspunsOblio> {
  try {
    const res = await fetch('/api/oblio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oblioEmail: setari.oblio_email, oblioSecret: setari.oblio_secret, invoiceData }),
    })
    const data = await res.json()
    const link = data.link ?? data.data?.link
    if (res.ok && link) {
      return { ok: true, link, seriesName: data.seriesName ?? data.data?.seriesName ?? null, number: data.number ?? data.data?.number ?? null }
    }
    const errMsg = data.error ?? data.statusMessage ?? data.message ?? 'Eroare necunoscută Oblio'
    const details = data.details ? JSON.stringify(data.details) : ''
    return { ok: false, sigur: res.status >= 400 && res.status < 500, mesaj: `${errMsg}${details ? '\n' + details : ''}` }
  } catch (e) {
    return { ok: false, sigur: false, mesaj: String(e) }
  }
}

function cifFirma(setari: OblioSettings) {
  return setari.cui.replace(/^RO/i, '').trim()
}

interface LinieOblio { nume_produs: string; unitate: string | null; cantitate: number; pret_vanzare: number }

function produsePentruOblio(linii: LinieOblio[], semn: 1 | -1) {
  return linii.map(p => ({
    name: p.nume_produs,
    productType: 'Marfa',
    management: 'Gestiune AV Auto',
    measuringUnit: p.unitate || 'buc',
    quantity: semn * p.cantitate,
    price: parseFloat((p.pret_vanzare * 1.21).toFixed(4)), // Oblio asteapta pretul CU TVA inclus
    vatName: 'Normala',
    vatPercentage: 21,
    isDiscount: false,
  }))
}

// ─── Stoc ─────────────────────────────────────────────────────────────────────

interface LinieStoc { stoc_id: string | null; cod: string | null; cantitate: number }
interface Miscare { id: string; cantitate: number }

/** Scade stocul FIFO. Întoarce exact ce s-a scăzut, ca să poată fi pus la loc. */
async function scadeStoc(linii: LinieStoc[]): Promise<Miscare[]> {
  const supabase = createClient()
  const miscari: Miscare[] = []
  for (const r of linii) {
    let deScazut = r.cantitate ?? 1
    if (r.stoc_id) {
      const { data: s } = await supabase.from('stoc').select('cantitate').eq('id', r.stoc_id).single()
      if (s) {
        const scade = Math.min(deScazut, s.cantitate)
        await supabase.from('stoc').update({ cantitate: Math.max(0, s.cantitate - deScazut) }).eq('id', r.stoc_id)
        if (scade > 0) miscari.push({ id: r.stoc_id, cantitate: scade })
      }
      continue
    }
    if (!r.cod) continue
    const { data: intrari } = await supabase.from('stoc').select('id, cantitate')
      .gt('cantitate', 0).eq('produs_cod', r.cod).order('updated_at', { ascending: true })
    for (const intrare of (intrari ?? [])) {
      if (deScazut <= 0) break
      const scade = Math.min(deScazut, intrare.cantitate)
      await supabase.from('stoc').update({ cantitate: intrare.cantitate - scade }).eq('id', intrare.id)
      miscari.push({ id: intrare.id, cantitate: scade })
      deScazut -= scade
    }
  }
  return miscari
}

async function anuleazaMiscari(miscari: Miscare[]) {
  const supabase = createClient()
  for (const m of miscari) {
    const { data: s } = await supabase.from('stoc').select('cantitate').eq('id', m.id).single()
    if (s) await supabase.from('stoc').update({ cantitate: s.cantitate + m.cantitate }).eq('id', m.id)
  }
}

/** Restituie stocul la storno (cantități pozitive = cât se pune înapoi). */
async function restituieStoc(linii: LinieStoc[]) {
  const supabase = createClient()
  for (const l of linii) {
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
}

// ─── Emitere factură nefinalizată ─────────────────────────────────────────────

export type RezultatEmitere =
  | { ok: true; avertisment: string | null; dataSchimbata: { veche: string; noua: string } | null }
  | { ok: false; mesaj: string }

/**
 * Emite o factură nefinalizată: verificare ANAF → scade stocul → Oblio → status „emisa".
 * Ordinea stoc-înainte-de-Oblio e intenționată: dacă răspunsul Oblio se pierde, stocul rămâne corect.
 * Dacă Oblio refuză explicit factura, stocul e pus la loc și factura rămâne nefinalizată.
 */
export async function emiteFactura(id: string): Promise<RezultatEmitere> {
  const supabase = createClient()
  const setari = await incarcaSetariOblio()

  const { data: factura } = await supabase.from('facturi')
    .select('id, client_id, status, data_emitere, data_scadenta, observatii, nota_interna')
    .eq('id', id).single()
  if (!factura) return { ok: false, mesaj: 'Factura nu a fost găsită.' }
  if (factura.status !== 'nefinalizata') return { ok: false, mesaj: 'Factura a fost deja emisă.' }

  // Verificare ANAF (statutul de azi) — ÎNAINTE de stoc, ca o firmă blocată să nu lase stocul scăzut
  const verificare = await verificaClientPentruFactura(factura.client_id)
  if (!verificare.ok) return { ok: false, mesaj: verificare.mesaj }
  const client = verificare.client
  if (setari && !client?.denumire) {
    return { ok: false, mesaj: '⚠️ Clientul nu are denumire completată. Completează datele clientului înainte de a emite.' }
  }

  const { data: linii } = await supabase.from('facturi_produse')
    .select('stoc_id, cod, nume_produs, unitate, cantitate, pret_vanzare')
    .eq('factura_id', id)
  const miscari = await scadeStoc(linii ?? [])

  if (!setari) {
    // Fără Oblio configurat — doar actualizăm statusul local
    await supabase.from('facturi').update({ status: 'emisa' }).eq('id', id)
    await marcheazaOferteFacturate(id)
    return { ok: true, avertisment: null, dataSchimbata: null }
  }

  // Oblio nu acceptă facturi cu dată în urmă față de ultima din serie → emitem cu data de azi
  const azi = new Date().toISOString().slice(0, 10)
  let dataSchimbata: { veche: string; noua: string } | null = null
  if (factura.data_emitere !== azi) {
    await supabase.from('facturi').update({ data_emitere: azi }).eq('id', id)
    dataSchimbata = { veche: factura.data_emitere, noua: azi }
  }

  const clientOblio = clientPentruOblio(client)
  const r = await trimiteLaOblio(setari, {
    cif: cifFirma(setari),
    issueDate: azi,
    dueDate: factura.data_scadenta ?? '',
    seriesName: setari.serie_factura,
    currency: 'RON',
    language: 'RO',
    isDraft: 0,           // finalizata direct, nu ciorna
    useStock: 0,          // oblio nu descarca stoc propriu
    mentions: factura.observatii ?? '',
    internalNote: factura.nota_interna ?? '',
    client: clientOblio,
    products: produsePentruOblio(linii ?? [], 1),
  })

  if (!r.ok) {
    if (r.sigur) {
      await anuleazaMiscari(miscari)
      return { ok: false, mesaj: `⚠️ Oblio: ${r.mesaj}\n\nFactura NU a fost emisă (stocul a fost pus la loc). Corectează și încearcă din nou.` }
    }
    return {
      ok: false,
      mesaj: `⚠️ Conexiune Oblio eșuată: ${r.mesaj}\n\nNu se știe sigur dacă factura a ajuns în Oblio. Verifică în Oblio înainte să o emiți din nou — stocul a fost deja scăzut.`,
    }
  }

  await supabase.from('facturi')
    .update({ status: 'emisa', oblio_link: r.link, oblio_serie: r.seriesName, oblio_numar: r.number })
    .eq('id', id)
  await marcheazaOferteFacturate(id)
  const avertisment = await verificaFacturaInOblio({
    oblioEmail: setari.oblio_email, oblioSecret: setari.oblio_secret, cifFirma: setari.cui,
    seriesName: r.seriesName, number: r.number, cifTrimis: clientOblio.cif, vatPayerTrimis: clientOblio.vatPayer,
  })
  return { ok: true, avertisment, dataSchimbata }
}

// ─── Storno ───────────────────────────────────────────────────────────────────

export interface LinieStorno {
  linie_id: string        // linia din factura originală
  factura_id: string      // factura originală
  produs_id: string | null
  stoc_id: string | null
  nume_produs: string
  cod: string | null
  producator: string | null
  unitate: string
  cantitate: number       // pozitivă = cât se stornează
  pret_achizitie: number
  pret_vanzare: number
}

export type RezultatStorno =
  | { ok: true; stornoId: string }
  | { ok: false; mesaj: string }

/**
 * Emite o factură storno: întâi în Oblio, apoi în aplicație (factură cu cantități negative + stoc restituit).
 * Dacă Oblio refuză, nu se scrie nimic în aplicație și se poate reîncerca.
 *
 * `integral` = factura originală se stornează complet → la Oblio pleacă stornare totală
 * (referenceDocument), iar originala devine „stornata". Altfel (storno parțial) la Oblio pleacă
 * o factură cu cantități negative și mențiunea facturilor stornate.
 */
export async function emiteStorno(p: {
  clientId: string
  dataEmitere: string
  observatii: string | null
  linii: LinieStorno[]
  integral?: string // id-ul facturii originale
}): Promise<RezultatStorno> {
  const supabase = createClient()
  const setari = await incarcaSetariOblio()

  const idsOriginale = [...new Set(p.linii.map(l => l.factura_id))]
  const { data: originale } = await supabase.from('facturi')
    .select('id, numar, oblio_serie, oblio_numar')
    .in('id', idsOriginale)
  const numereOriginale = (originale ?? []).map(numarFactura).join(', ')
  const mentiune = `Storno ${idsOriginale.length > 1 ? 'facturile' : 'factura'} ${numereOriginale}`

  let oblio: { link: string; seriesName: string | null; number: number | null } | null = null

  if (setari) {
    const originala = p.integral ? originale?.find(f => f.id === p.integral) : undefined
    // dacă originala a avut deja un storno parțial (pe ORICARE linie, inclusiv una stornată complet
    // și deci lipsă din p.linii), stornarea totală din Oblio ar dubla liniile acelea
    let stornariAnterioare = 0
    if (originala) {
      const { data: liniiOriginale } = await supabase.from('facturi_produse').select('id').eq('factura_id', originala.id)
      const { count } = await supabase.from('facturi_produse').select('id', { count: 'exact', head: true })
        .in('referinta_linie_id', (liniiOriginale ?? []).map(l => l.id)).lt('cantitate', 0)
      stornariAnterioare = count ?? 0
    }
    let invoiceData: object

    if (originala?.oblio_serie && originala?.oblio_numar && !stornariAnterioare) {
      // Stornare totală — Oblio copiază singur clientul și produsele din factura de referință
      invoiceData = {
        cif: cifFirma(setari),
        issueDate: p.dataEmitere,
        seriesName: setari.serie_factura,
        language: 'RO',
        ...(p.observatii ? { mentions: p.observatii } : {}),
        referenceDocument: {
          type: 'Factura',
          seriesName: originala.oblio_serie,
          number: originala.oblio_numar,
          refund: 0, // nu ștergem încasarea din Oblio
        },
      }
    } else {
      const { data: client } = await supabase.from('clienti')
        .select('denumire, cod_fiscal, reg_com, adresa, localitate, judet, tara, telefon, email, platitor_tva')
        .eq('id', p.clientId).single()
      if (!client?.denumire) return { ok: false, mesaj: '⚠️ Clientul nu are denumire completată.' }
      invoiceData = {
        cif: cifFirma(setari),
        issueDate: p.dataEmitere,
        seriesName: setari.serie_factura,
        currency: 'RON',
        language: 'RO',
        isDraft: 0,
        useStock: 0,
        mentions: [mentiune, p.observatii].filter(Boolean).join('\n'),
        client: clientPentruOblio(client as ClientFacturare),
        products: produsePentruOblio(p.linii, -1),
      }
    }

    const r = await trimiteLaOblio(setari, invoiceData)
    if (!r.ok) {
      return {
        ok: false,
        mesaj: r.sigur
          ? `⚠️ Oblio: ${r.mesaj}\n\nStorno-ul NU a fost emis. Nimic nu s-a modificat în aplicație.`
          : `⚠️ Conexiune Oblio eșuată: ${r.mesaj}\n\nNu se știe sigur dacă storno-ul a ajuns în Oblio. Verifică în Oblio înainte să încerci din nou.`,
      }
    }
    oblio = r
  }

  const { data: storno, error } = await supabase.from('facturi').insert({
    client_id: p.clientId,
    data_emitere: p.dataEmitere,
    status: 'emisa',
    tip: 'storno',
    referinta_id: idsOriginale.length === 1 ? idsOriginale[0] : null,
    observatii: p.observatii || mentiune,
    oblio_link: oblio?.link ?? null,
    oblio_serie: oblio?.seriesName ?? null,
    oblio_numar: oblio?.number ?? null,
  }).select('id').single()

  if (error || !storno) {
    const inOblio = oblio ? `\n\nATENȚIE: storno-ul a fost emis în Oblio (${oblio.seriesName} ${oblio.number}), dar nu a fost salvat în aplicație.` : ''
    return { ok: false, mesaj: `Eroare la salvare storno: ${error?.message}${inOblio}` }
  }

  await supabase.from('facturi_produse').insert(p.linii.map(l => ({
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
  })))

  await restituieStoc(p.linii)

  // Factura originală stornată complet nu mai poate fi stornată din nou
  if (p.integral) await supabase.from('facturi').update({ status: 'stornata' }).eq('id', p.integral)

  // Ofertele facturilor stornate primesc eticheta „Stornată" / „Stornată parțial"
  await actualizeazaOferteDupaStorno(idsOriginale)

  return { ok: true, stornoId: storno.id }
}
