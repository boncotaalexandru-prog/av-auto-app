import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { oblioEmail, oblioSecret, invoiceData } = await req.json()

    if (!oblioEmail || !oblioSecret) {
      return NextResponse.json({ error: 'Credențiale Oblio lipsă. Configurează în Setări.' }, { status: 400 })
    }

    // 1. Obține token de acces
    const tokenRes = await fetch('https://www.oblio.eu/api/authorize/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: oblioEmail,
        client_secret: oblioSecret,
      }),
    })
    const tokenJson = await tokenRes.json()
    if (!tokenJson.access_token) {
      return NextResponse.json(
        { error: 'Autentificare Oblio eșuată. Verifică email-ul și secretul din Setări.', details: tokenJson },
        { status: 401 }
      )
    }

    // 2. Creează factura în Oblio
    const invoiceRes = await fetch('https://www.oblio.eu/api/docs/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenJson.access_token}`,
      },
      body: JSON.stringify(invoiceData),
    })
    const invoiceJson = await invoiceRes.json()

    if (!invoiceRes.ok) {
      return NextResponse.json(
        { error: 'Eroare Oblio la creare factură', details: invoiceJson },
        { status: invoiceRes.status }
      )
    }

    return NextResponse.json(invoiceJson)
  } catch (e) {
    return NextResponse.json({ error: 'Eroare server', details: String(e) }, { status: 500 })
  }
}
