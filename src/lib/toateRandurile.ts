// Supabase (PostgREST) intoarce cel mult 1000 de randuri pe cerere, orice .limit() ai pune.
// Citeste pagina cu pagina pana se termina. `interogare` construieste de fiecare data aceeasi
// cerere de la zero si trebuie sa aiba o ordine stabila (ex. .order('id')), altfel paginile se suprapun.
const PAGINA = 1000

interface Paginabil<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }>
}

export async function toateRandurile<T>(interogare: () => Paginabil<T>): Promise<T[]> {
  const toate: T[] = []
  for (let from = 0; ; from += PAGINA) {
    const { data, error } = await interogare().range(from, from + PAGINA - 1)
    if (error) throw error
    toate.push(...(data ?? []))
    if (!data || data.length < PAGINA) return toate
  }
}
