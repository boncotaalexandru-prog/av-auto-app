import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cuiValid, MESAJ_CUI_INCORECT } from '@/lib/anaf'
import { clientVerificabilAnaf } from '@/lib/oblioClient'
import { actualizeazaClientDinAnaf, COLOANE_CLIENT, verificatAzi, type ClientRow } from '@/lib/anafServer'

// Reverifică un client existent.
//   mod 'fortat' — butonul „Reverifică la ANAF" (ignoră cache-ul)
//   mod 'azi'    — la emiterea facturii (întreabă ANAF doar dacă ultima verificare nu e de azi)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const { clientId, mod } = await req.json().catch(() => ({}))
  if (!clientId) return NextResponse.json({ error: 'clientId lipsă' }, { status: 400 })

  const { data } = await supabase.from('clienti').select(COLOANE_CLIENT).eq('id', clientId).single()
  const client = data as unknown as ClientRow | null
  if (!client) return NextResponse.json({ error: 'Client inexistent' }, { status: 404 })

  // CNP, client din străinătate sau fără cod fiscal — nu se verifică la ANAF
  if (!clientVerificabilAnaf(client)) {
    return NextResponse.json({ stare: 'neverificabil', client })
  }
  if (!cuiValid(client.cod_fiscal)) {
    return NextResponse.json({ stare: 'invalid', client, mesaj: MESAJ_CUI_INCORECT })
  }

  const rez = await actualizeazaClientDinAnaf(supabase, client, mod === 'fortat' ? () => false : verificatAzi)
  return NextResponse.json(rez)
}
