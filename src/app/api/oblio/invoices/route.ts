import { NextRequest, NextResponse } from 'next/server'

// Helper: obtine token Oblio
async function getToken(email: string, secret: string): Promise<string | null> {
  const res = await fetch('https://www.oblio.eu/api/authorize/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: email, client_secret: secret }),
  })
  const data = await res.json()
  return data.access_token ?? null
}

export async function POST(req: NextRequest) {
  try {
    const { oblioEmail, oblioSecret, cui, issuedAfter, issuedBefore } = await req.json()

    if (!oblioEmail || !oblioSecret || !cui) {
      return NextResponse.json({ error: 'Credențiale Oblio lipsă' }, { status: 400 })
    }

    const token = await getToken(oblioEmail, oblioSecret)
    if (!token) {
      return NextResponse.json({ error: 'Autentificare Oblio eșuată' }, { status: 401 })
    }

    // Construieste URL cu filtre
    const params = new URLSearchParams({ cif: cui, limitPerPage: '100', orderBy: 'number', orderDir: 'desc' })
    if (issuedAfter) params.set('issuedAfter', issuedAfter)
    if (issuedBefore) params.set('issuedBefore', issuedBefore)

    const listRes = await fetch(`https://www.oblio.eu/api/docs/invoice/list?${params}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    const listJson = await listRes.json()

    if (!listRes.ok) {
      return NextResponse.json({ error: 'Eroare Oblio list', details: listJson }, { status: listRes.status })
    }

    return NextResponse.json(listJson)
  } catch (e) {
    return NextResponse.json({ error: 'Eroare server', details: String(e) }, { status: 500 })
  }
}
