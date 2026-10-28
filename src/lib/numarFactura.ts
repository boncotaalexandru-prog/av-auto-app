/**
 * Numarul afisat al unei facturi.
 *
 * Facturile emise poarta numarul din Oblio (ex: "AVF 2153") — acela e numarul
 * oficial: cel trimis in SPV si cel pe care il vede clientul.
 *
 * Facturile nefinalizate nu au inca numar Oblio (il primesc abia la emitere),
 * deci arata numarul intern (ex: "#739"). La fel si facturile vechi, emise
 * inainte ca aplicatia sa salveze referinta Oblio.
 */
export function numarFactura(f: {
  numar: number | null
  oblio_serie?: string | null
  oblio_numar?: number | null
}): string {
  if (f.oblio_serie && f.oblio_numar) return `${f.oblio_serie} ${f.oblio_numar}`
  return `#${f.numar ?? '—'}`
}
