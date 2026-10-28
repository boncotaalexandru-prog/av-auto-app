import { NextRequest, NextResponse } from 'next/server'
import { curataCui, dataAziBucuresti } from '@/lib/anaf'

// După emitere: citește factura înapoi din Oblio și compară CIF-ul și statutul de TVA
// al clientului cu ce am trimis. Întoarce { ok, avertisment? } — nu blochează nimic.
export async function POST(req: NextRequest) {
  try {
    const { oblioEmail, oblioSecret, cifFirma, seriesName, number, cifTrimis, vatPayerTrimis } = await req.json()
    if (!oblioEmail || !oblioSecret || !cifFirma || !seriesName || number == null) {
      return NextResponse.json({ ok: false, avertisment: 'Date lipsă pentru verificarea facturii în Oblio.' })
    }

    const tokenRes = await fetch('https://www.oblio.eu/api/authorize/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: oblioEmail, client_secret: oblioSecret }),
      signal: AbortSignal.timeout(15_000),
    })
    const token = (await tokenRes.json()).access_token
    if (!token) return NextResponse.json({ ok: false, avertisment: 'Nu m-am putut autentifica la Oblio pentru verificare.' })

    // Vizualizarea unei singure facturi nu conține clientul — îl luăm din listă
    const ieri = dataAziBucuresti(new Date(Date.now() - 24 * 3600 * 1000))
    const params = new URLSearchParams({
      cif: curataCui(cifFirma), seriesName: String(seriesName), number: String(number),
      issuedAfter: ieri, limitPerPage: '100',
    })
    const listRes = await fetch(`https://www.oblio.eu/api/docs/invoice/list?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    })
    const listJson = await listRes.json()
    const lista: Record<string, unknown>[] = Array.isArray(listJson?.data) ? listJson.data : []
    const factura = lista.find(f => String(f.number) === String(number) && String(f.seriesName ?? seriesName) === String(seriesName))
    const client = (factura?.client ?? null) as Record<string, unknown> | null
    if (!client) {
      return NextResponse.json({ ok: false, avertisment: `Nu am putut citi înapoi factura ${seriesName} ${number} din Oblio. Verificați manual CIF-ul clientului.` })
    }

    const cifOblio = String(client.cif ?? '')
    const vatOblio = client.vatPayer != null && client.vatPayer !== ''
      ? Number(client.vatPayer) === 1
      : /^RO/i.test(cifOblio.trim())

    const probleme: string[] = []
    if (curataCui(cifOblio) !== curataCui(cifTrimis)) {
      probleme.push(`CIF pe factură: „${cifOblio || '—'}", trimis: „${cifTrimis}"`)
    }
    if (vatOblio !== (Number(vatPayerTrimis) === 1)) {
      probleme.push(`TVA pe factură: ${vatOblio ? 'plătitor' : 'neplătitor'}, trimis: ${Number(vatPayerTrimis) === 1 ? 'plătitor' : 'neplătitor'}`)
    }
    if (probleme.length) {
      return NextResponse.json({ ok: false, avertisment: `Factura ${seriesName} ${number} are alte date de client în Oblio decât cele trimise:\n• ${probleme.join('\n• ')}` })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, avertisment: `Nu am putut verifica factura în Oblio: ${String(e)}` })
  }
}
