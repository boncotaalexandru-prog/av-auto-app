// Legătura ofertă → factură. Statusurile ofertei se schimbă doar de aici:
// confirmata → in_facturare (factură nefinalizată salvată) → facturat (factură emisă) → stornata / stornata_partial
// Ștergerea facturii readuce ofertele pe confirmata.
import { createClient } from '@/lib/supabase/client'
import { statusOfertaDupaStorno, type LinieFacturata } from '@/lib/stornoOferta'

/**
 * Leagă ofertele de factura nefinalizată. Doar ofertele încă „confirmata" sunt preluate,
 * ca două facturi să nu poată lua aceeași ofertă. Dacă vreo ofertă nu mai e liberă,
 * nu se leagă niciuna și se întoarce mesajul de eroare.
 */
export async function legaOferteDeFactura(facturaId: string, ofertaIds: string[]): Promise<string | null> {
  if (!ofertaIds.length) return null
  const supabase = createClient()
  const { data: preluate, error } = await supabase.from('oferte')
    .update({ status: 'in_facturare', factura_id: facturaId, updated_at: new Date().toISOString() })
    .in('id', ofertaIds)
    .eq('status', 'confirmata')
    .select('id')
  if (!error && (preluate?.length ?? 0) === ofertaIds.length) return null

  if (preluate?.length) await elibereazaOferte(facturaId)
  return error
    ? `Eroare la legarea ofertei de factură: ${error.message}`
    : 'Oferta nu mai e confirmată — a fost deja trimisă la facturare din altă parte. Reîncarcă oferta și verifică.'
}

/** Factura a fost emisă → ofertele ei devin „facturat". */
export async function marcheazaOferteFacturate(facturaId: string) {
  await createClient().from('oferte')
    .update({ status: 'facturat', updated_at: new Date().toISOString() })
    .eq('factura_id', facturaId)
}

/** Factura a fost ștearsă → ofertele ei redevin „confirmata" și pot fi facturate din nou. */
export async function elibereazaOferte(facturaId: string) {
  await createClient().from('oferte')
    .update({ status: 'confirmata', factura_id: null, updated_at: new Date().toISOString() })
    .eq('factura_id', facturaId)
}

/**
 * După un storno: ofertele facturilor stornate primesc „stornata" (tot) sau „stornata_partial".
 * Se socotește pe piesele fiecărei oferte, ca la factura cumulată storno-ul unei oferte să n-o atingă pe alta.
 */
export async function actualizeazaOferteDupaStorno(facturiOriginale: string[]) {
  if (!facturiOriginale.length) return
  const supabase = createClient()
  const { data: oferte } = await supabase.from('oferte')
    .select('id, factura_id')
    .in('factura_id', facturiOriginale)
    .in('status', ['facturat', 'stornata_partial'])
  if (!oferte?.length) return

  const { data: rand } = await supabase.from('facturi_produse')
    .select('id, factura_id, cantitate, oferte_produse(oferta_id)')
    .in('factura_id', facturiOriginale)
    .gt('cantitate', 0)
  const { data: storno } = await supabase.from('facturi_produse')
    .select('referinta_linie_id, cantitate')
    .in('referinta_linie_id', (rand ?? []).map(l => l.id))
    .lt('cantitate', 0)

  const stornatPeLinie = new Map<string, number>()
  for (const s of storno ?? []) {
    if (s.referinta_linie_id) stornatPeLinie.set(s.referinta_linie_id, (stornatPeLinie.get(s.referinta_linie_id) ?? 0) + Math.abs(Number(s.cantitate)))
  }

  for (const o of oferte) {
    const oferteAleFacturii = oferte.filter(x => x.factura_id === o.factura_id)
    const linii: LinieFacturata[] = (rand ?? []).filter(l => l.factura_id === o.factura_id).map(l => {
      const op = (Array.isArray(l.oferte_produse) ? l.oferte_produse[0] : l.oferte_produse) as { oferta_id: string } | null
      // linie fără piesă de ofertă (ciorne vechi): e a ofertei doar dacă factura are o singură ofertă
      const ofertaId = op?.oferta_id ?? (oferteAleFacturii.length === 1 ? o.id : '')
      return { id: l.id, oferta_id: ofertaId, cantitate: Number(l.cantitate) }
    })
    const status = statusOfertaDupaStorno(o.id, linii, stornatPeLinie)
    if (status) {
      await supabase.from('oferte').update({ status, updated_at: new Date().toISOString() }).eq('id', o.id)
    }
  }
}
