/**
 * Calculeaza adaos brut (profit) pentru o luna data.
 * Aceasta este SURSA UNICA de adevar — folosita de Salarii si Rapoarte.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export async function getAdaosBrut(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  lunaStr: string  // format: YYYY-MM
): Promise<number> {
  const [an, luna_nr] = lunaStr.split('-').map(Number)
  const start = `${an}-${String(luna_nr).padStart(2, '0')}-01`
  const lastDay = new Date(an, luna_nr, 0).getDate()
  const end = `${an}-${String(luna_nr).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Fetch facturi din luna respectiva (filtrat server-side — evita cap-ul de 1000 pe facturi_produse)
  const { data: facturi } = await supabase
    .from('facturi')
    .select('id')
    .in('status', ['emisa', 'stornata'])
    .gte('data_emitere', start)
    .lte('data_emitere', end)

  const facturaIds = (facturi ?? []).map((f: { id: string }) => f.id)
  if (!facturaIds.length) return 0

  // Batch fetch facturi_produse in loturi de 100 (evita cap-ul PostgREST de 1000)
  const BATCH = 100
  const chunks = await Promise.all(
    Array.from({ length: Math.ceil(facturaIds.length / BATCH) }, (_, i) =>
      supabase
        .from('facturi_produse')
        .select('pret_vanzare, pret_achizitie, cantitate')
        .in('factura_id', facturaIds.slice(i * BATCH, (i + 1) * BATCH))
    )
  )

  type FpRow = {
    pret_vanzare: number | null
    pret_achizitie: number | null
    cantitate: number | null
  }

  return chunks
    .flatMap(r => (r.data ?? []) as FpRow[])
    .reduce((sum, p) => {
      const cant = p.cantitate ?? 1
      const pv = p.pret_vanzare ?? 0
      const pa = p.pret_achizitie ?? 0
      return sum + cant * (pv - pa)
    }, 0)
}
