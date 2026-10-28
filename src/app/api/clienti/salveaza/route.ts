import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { curataCui, cuiValid, MESAJ_CUI_INCORECT } from '@/lib/anaf'
import { campuriDinAnaf, COLOANE_CLIENT, gasesteClientDupaCui, interogheazaAnafCuMemorie } from '@/lib/anafServer'

// Câmpuri pe care le completează omul (ANAF nu le știe)
const CAMPURI_MANUALE = ['telefon', 'email', 'pers_contact', 'cod_client', 'banca', 'iban', 'observatii'] as const
// Folosite doar dacă ANAF nu a răspuns
const CAMPURI_DE_REZERVA = ['denumire', 'adresa', 'reg_com', 'judet', 'localitate', 'strada', 'numar', 'cod_postal'] as const

// Salvează clientul după CUI: dacă există îl actualizează, dacă nu îl creează.
// Datele firmei se iau de la ANAF pe server, nu din browser.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!cuiValid(body.cui)) return NextResponse.json({ error: MESAJ_CUI_INCORECT }, { status: 400 })
  const cui = curataCui(body.cui)

  const rand: Record<string, unknown> = {}
  for (const k of CAMPURI_MANUALE) {
    if (typeof body[k] === 'string' && body[k].trim()) rand[k] = body[k].trim()
  }

  const rez = await interogheazaAnafCuMemorie(cui)
  if (rez.stare === 'inexistent') {
    return NextResponse.json({ error: 'CUI inexistent la ANAF — clientul nu a fost salvat.' }, { status: 400 })
  }

  const existent = await gasesteClientDupaCui(supabase, cui)
  const dinAnaf = campuriDinAnaf(rez)
  if (dinAnaf) {
    Object.assign(rand, dinAnaf)
  } else {
    // ANAF nu a răspuns: păstrăm ce e salvat; pentru client nou folosim ce a scris omul
    if (!existent) {
      for (const k of CAMPURI_DE_REZERVA) {
        if (typeof body[k] === 'string' && body[k].trim()) rand[k] = body[k].trim()
      }
      if (!rand.denumire) {
        return NextResponse.json({ error: 'ANAF nu a răspuns. Completați denumirea sau încercați din nou peste câteva minute.' }, { status: 400 })
      }
      rand.cod_fiscal = cui
      rand.anaf_state = 'eroare'
      rand.tara = 'România'
    }
  }
  rand.updated_at = new Date().toISOString()

  if (existent) {
    const { data, error } = await supabase.from('clienti').update(rand).eq('id', existent.id).select(COLOANE_CLIENT).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ client: data, creat: false })
  }

  const { data, error } = await supabase.from('clienti').insert(rand).select(COLOANE_CLIENT).single()
  if (error?.code === '23505') {
    // Alt utilizator l-a creat în același timp — îl actualizăm
    const dupa = await gasesteClientDupaCui(supabase, cui)
    if (dupa) {
      const { data: d2, error: e2 } = await supabase.from('clienti').update(rand).eq('id', dupa.id).select(COLOANE_CLIENT).single()
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      return NextResponse.json({ client: d2, creat: false })
    }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data, creat: true })
}
