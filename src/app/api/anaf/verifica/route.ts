import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { curataCui, cuiValid, MESAJ_CUI_INCORECT, type DateAnaf } from '@/lib/anaf'
import { cacheValid24h, campuriDinAnaf, COLOANE_CLIENT, gasesteClientDupaCui, interogheazaAnafCuMemorie, type ClientRow } from '@/lib/anafServer'

// Ecranul „Client nou": caută CUI-ul la ANAF (sau în cache-ul de 24 h) și întoarce datele.
// Nu creează client nou — asta face /api/clienti/salveaza. Dacă firma există deja, îi actualizează datele.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const { cui: cuiInput, fortat } = await req.json().catch(() => ({}))
  if (!cuiValid(cuiInput)) {
    return NextResponse.json({ stare: 'invalid', mesaj: MESAJ_CUI_INCORECT })
  }
  const cui = curataCui(cuiInput)

  const existent = await gasesteClientDupaCui(supabase, cui)
  if (existent && !fortat && cacheValid24h(existent) && existent.anaf_state !== 'inexistent') {
    return NextResponse.json({ stare: existent.anaf_state, date: dateDinClient(existent), clientExistent: rezumat(existent), dinCache: true })
  }

  const rez = await interogheazaAnafCuMemorie(cui, !!fortat)
  if (rez.stare === 'eroare') {
    return NextResponse.json({ stare: 'eroare', mesaj: 'ANAF nu a răspuns. Încercați din nou peste câteva minute.', clientExistent: existent ? rezumat(existent) : null })
  }

  let client: ClientRow | null = existent
  if (existent) {
    const { data } = await supabase.from('clienti').update(campuriDinAnaf(rez)!).eq('id', existent.id).select(COLOANE_CLIENT).single()
    if (data) client = data as unknown as ClientRow
  }

  if (rez.stare === 'inexistent') {
    return NextResponse.json({ stare: 'inexistent', clientExistent: client ? rezumat(client) : null })
  }
  return NextResponse.json({ stare: rez.stare, date: rez.date, clientExistent: client ? rezumat(client) : null, dinCache: false })
}

function rezumat(c: ClientRow) {
  return { id: c.id, denumire: c.denumire }
}

function dateDinClient(c: ClientRow): DateAnaf {
  return {
    cui: curataCui(c.cod_fiscal),
    denumire: c.denumire,
    adresa: c.adresa ?? '',
    reg_com: c.reg_com ?? '',
    cod_postal: c.cod_postal ?? '',
    platitor_tva: c.platitor_tva,
    judet: c.judet ?? '',
    localitate: c.localitate ?? '',
    strada: c.strada ?? '',
    numar: c.numar ?? '',
  }
}
