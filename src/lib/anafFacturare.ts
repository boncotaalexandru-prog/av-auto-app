// Folosit din browser la emiterea facturii (lib/emitereOblio.ts).
import type { ClientFacturare } from './oblioClient.ts'

export type VerificareFacturare =
  | { ok: true; client: ClientFacturare }
  | { ok: false; mesaj: string }

/** Verifică clientul la ANAF dacă ultima verificare nu e de azi. Se apelează ÎNAINTE de scăderea stocului. */
export async function verificaClientPentruFactura(clientId: string): Promise<VerificareFacturare> {
  try {
    const res = await fetch('/api/anaf/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, mod: 'azi' }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, mesaj: data.error ?? 'Nu am putut încărca clientul.' }

    const nume = data.client?.denumire ?? 'Clientul'
    switch (data.stare) {
      case 'activa':
      case 'neverificabil':
        return { ok: true, client: data.client }
      case 'inactiva':
        return { ok: false, mesaj: `⛔ ${nume} este INACTIVĂ sau radiată la ANAF.\n\nFactura NU a fost emisă.` }
      case 'inexistent':
        return { ok: false, mesaj: `⛔ CUI-ul clientului ${nume} nu există la ANAF.\n\nFactura NU a fost emisă. Verificați CUI-ul în fișa clientului.` }
      case 'invalid':
        return { ok: false, mesaj: `⛔ ${data.mesaj}\n\nFactura NU a fost emisă. Corectați CUI-ul în fișa clientului ${nume}.` }
      default:
        return { ok: false, mesaj: '⚠️ ANAF nu a răspuns, nu pot confirma statutul de TVA de azi al clientului.\n\nÎncercați din nou peste câteva minute. Factura NU a fost emisă.' }
    }
  } catch {
    return { ok: false, mesaj: '⚠️ ANAF nu a răspuns. Încercați din nou peste câteva minute. Factura NU a fost emisă.' }
  }
}

/** După emitere: compară CIF-ul și TVA-ul de pe factura din Oblio cu ce am trimis. Întoarce un avertisment sau null. */
export async function verificaFacturaInOblio(p: {
  oblioEmail: string; oblioSecret: string; cifFirma: string
  seriesName: string | null | undefined; number: number | string | null | undefined
  cifTrimis: string; vatPayerTrimis: number
}): Promise<string | null> {
  try {
    const res = await fetch('/api/oblio/verifica-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    })
    const data = await res.json()
    return data.ok ? null : (data.avertisment ?? 'Nu am putut verifica factura în Oblio.')
  } catch (e) {
    return `Nu am putut verifica factura în Oblio: ${String(e)}`
  }
}
