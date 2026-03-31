import { NextRequest, NextResponse } from 'next/server'

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
    const { oblioEmail, oblioSecret, cui, seriesName, number } = await req.json()

    if (!oblioEmail || !oblioSecret || !cui || !seriesName || !number) {
      return NextResponse.json({ error: 'Parametri lipsă' }, { status: 400 })
    }

    const token = await getToken(oblioEmail, oblioSecret)
    if (!token) {
      return NextResponse.json({ error: 'Autentificare Oblio eșuată' }, { status: 401 })
    }

    const res = await fetch('https://www.oblio.eu/api/docs/invoice/cancel', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ cif: cui, seriesName, number }),
    })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: 'Eroare Oblio la anulare', details: data }, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Eroare server', details: String(e) }, { status: 500 })
  }
}
