/**
 * Calculeaza adaos brut (profit) pentru o luna data.
 * Aceasta este SURSA UNICA de adevar — folosita de Salarii si Rapoarte.
 * Logica este identica cu calculul profitFact din pagina Rapoarte.
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

  // Exact aceleasi query-uri ca Rapoarte
  const [fRaw, fpRaw] = await Promise.all([
    supabase
      .from('facturi')
      .select('id, data_emitere')
      .in('status', ['emisa', 'stornata']),
    supabase
      .from('facturi_produse')
      .select('factura_id, pret_vanzare, pret_achizitie, cantitate')
      .limit(10000),
  ])

  // Map factura_id → data_emitere (identic cu facturaMap din Rapoarte)
  const facturaDateMap: Record<string, string> = {}
  ;(fRaw.data ?? []).forEach((f: { id: string; data_emitere: string }) => {
    facturaDateMap[f.id] = f.data_emitere
  })

  // Filtru luna + calcul profit — identic cu kpi.profitFact din Rapoarte
  type FpRow = {
    factura_id: string
    pret_vanzare: number | null
    pret_achizitie: number | null
    cantitate: number | null
  }

  return ((fpRaw.data ?? []) as FpRow[])
    .filter((p) => {
      const dataEmitere = facturaDateMap[p.factura_id] ?? ''
      return dataEmitere >= start && dataEmitere <= end
    })
    .reduce((sum, p) => {
      const cant = p.cantitate ?? 1
      const pv = p.pret_vanzare ?? 0
      const pa = p.pret_achizitie ?? 0
      return sum + cant * (pv - pa)
    }, 0)
}
