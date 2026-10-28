// Ce status primește o ofertă facturată după un storno pe factura ei.
// După storno oferta e închisă: doar eticheta se schimbă, nu se mai refacturează.

export interface LinieFacturata {
  id: string            // linia din factura originală
  oferta_id: string     // oferta din care vine linia
  cantitate: number
}

/**
 * @param linii       liniile facturii originale (pozitive)
 * @param stornatPeLinie cât s-a stornat din fiecare linie (pozitiv), după id-ul liniei
 * @returns status nou pe ofertă: „stornata" (tot), „stornata_partial" (o parte) sau null (nimic stornat)
 */
export function statusOfertaDupaStorno(
  ofertaId: string,
  linii: LinieFacturata[],
  stornatPeLinie: Map<string, number>,
): 'stornata' | 'stornata_partial' | null {
  const aleOfertei = linii.filter(l => l.oferta_id === ofertaId)
  const total = aleOfertei.reduce((s, l) => s + l.cantitate, 0)
  const stornat = aleOfertei.reduce((s, l) => s + Math.min(l.cantitate, stornatPeLinie.get(l.id) ?? 0), 0)
  if (total <= 0 || stornat <= 0) return null
  return stornat >= total ? 'stornata' : 'stornata_partial'
}
