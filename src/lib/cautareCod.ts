// Căutare după cod de produs, indiferent cum e scris.
// Aceeași regulă e în baza de date: funcția public.cheie_cod → coloana cod_cautare
// (supabase/produse_cod_cautare_migration.sql). Modifică-le împreună.
import type { SupabaseClient } from '@supabase/supabase-js'

/** „HU 719/7 X" → „HU7197X", „EL136790" → „136790" (Elring), „LMI26772" → „26772" (Lemförder). */
export function cheieCod(t: string | null | undefined): string {
  return (t ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^EL(\d{6})$/, '$1')
    .replace(/^LMI(\d)/, '$1')
}

/**
 * Variantele de cheie pentru un text căutat. La Lemförder „26772 01" trebuie să găsească și
 * „LMI26772" (salvat fără sufix), deci adăugăm și varianta fără sufixul de 2 cifre.
 */
export function cheiCautare(q: string): string[] {
  const k = cheieCod(q)
  if (k.length < 2) return []
  const chei = [k]
  const lemforder = q.trim().match(/^(?:LMI\s*)?(\d{4,5})[\s.-]+\d{2}$/i)
  if (lemforder) chei.push(lemforder[1])
  return chei
}

/** Bucățile de filtru PostgREST (pentru .or()) pe coloana cu cheia de căutare. */
export function filtreCod(q: string, coloana = 'cod_cautare'): string[] {
  return cheiCautare(q).map(k => `${coloana}.ilike.%${k}%`)
}

export interface ProdusGasit { id: string; cod: string | null; nume: string; producator: string | null }

/**
 * Produsele care au deja același cod, oricum ar fi scris. Folosit înainte de a crea un produs nou.
 * `cuVariante` adaugă și varianta Lemförder fără sufix — doar pentru sugestii arătate omului.
 * Produsul cu codul scris identic vine primul.
 */
export async function produseCuAcelasiCod(supabase: SupabaseClient, cod: string, cuVariante = false): Promise<ProdusGasit[]> {
  const chei = cuVariante ? cheiCautare(cod) : [cheieCod(cod)].filter(k => k.length >= 2)
  if (!chei.length) return []
  const { data } = await supabase.from('produse').select('id, cod, nume, producator').in('cod_cautare', chei)
  const t = cod.trim().toUpperCase()
  return ((data ?? []) as ProdusGasit[]).sort((a, b) => Number((b.cod ?? '').trim().toUpperCase() === t) - Number((a.cod ?? '').trim().toUpperCase() === t))
}
