// Legătura ofertă → factură. Statusurile ofertei se schimbă doar de aici:
// confirmata → in_facturare (factură nefinalizată salvată) → facturat (factură emisă)
// Ștergerea facturii readuce ofertele pe confirmata.
import { createClient } from '@/lib/supabase/client'

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
