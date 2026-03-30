'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ORANGE = '#E07020'
const TVA_PCT = 0.21

interface Oferta {
  id: string
  numar: number | null
  status: string
  necesar_piese: string | null
  created_at: string
  clienti: {
    denumire: string
    cod_fiscal: string | null
    reg_com: string | null
    adresa: string | null
    localitate: string | null
    judet: string | null
    tara: string | null
    telefon: string | null
  } | null
  clienti_masini: { nr_inmatriculare: string | null; marca: string | null } | null
}

interface Produs {
  id: string
  nume_produs: string
  cod: string | null
  producator: string | null
  cantitate: number
  unitate: string | null
  pret_vanzare: number
}

interface IbanEntry {
  iban: string
  banca: string
}

interface Setari {
  company_name: string | null
  cui: string | null
  reg_com: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  iban1: string | null
  banca1: string | null
  iban2: string | null
  banca2: string | null
  ibans: IbanEntry[] | null
  termen_plata_zile: number | null
}

export default function OfertaPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const [oferta, setOferta] = useState<Oferta | null>(null)
  const [produse, setProduse] = useState<Produs[]>([])
  const [setari, setSetari] = useState<Setari | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    Promise.all([
      supabase.from('oferte')
        .select('id, numar, status, necesar_piese, created_at, clienti(denumire, cod_fiscal, reg_com, adresa, localitate, judet, tara, telefon), clienti_masini(nr_inmatriculare, marca)')
        .eq('id', id).single(),
      supabase.from('oferte_produse')
        .select('id, nume_produs, cod, producator, cantitate, unitate, pret_vanzare')
        .eq('oferta_id', id)
        .order('created_at'),
      supabase.from('settings').select('*').eq('id', 1).single(),
    ]).then(([{ data: o }, { data: p }, { data: s }]) => {
      setOferta(o as unknown as Oferta)
      setProduse((p as Produs[]) ?? [])
      setSetari(s as Setari)
      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <p className="text-gray-900">Se incarca...</p>
    </div>
  )
  if (!oferta) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <p className="text-red-600">Oferta nu a fost gasita.</p>
    </div>
  )

  const dataEmiterii = new Date(oferta.created_at).toLocaleDateString('ro-RO')
  const subtotal = produse.reduce((s, p) => s + p.cantitate * p.pret_vanzare, 0)
  const totalTva = subtotal * TVA_PCT
  const totalPlata = subtotal + totalTva

  const ibanList: IbanEntry[] = Array.isArray(setari?.ibans) && setari.ibans.length > 0
    ? setari.ibans
    : [
        ...(setari?.iban1 ? [{ iban: setari.iban1, banca: setari.banca1 || '' }] : []),
        ...(setari?.iban2 ? [{ iban: setari.iban2, banca: setari.banca2 || '' }] : []),
      ]

  const printCSS = `@media print { @page { size: A4 portrait; margin: 15mm; } body * { visibility: hidden !important; } #oferta-doc, #oferta-doc * { visibility: visible !important; } #oferta-doc { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; box-shadow: none !important; margin: 0 !important; } #oferta-doc thead { display: table-header-group !important; } #oferta-doc tfoot { display: table-footer-group !important; } #oferta-doc tr { page-break-inside: avoid !important; } }`

  return (
    <>
      {/* CSS print */}
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />

    <div className="min-h-screen bg-gray-100 py-6 px-4">
      {/* Butoane — nu se printeaza */}
      <div className="max-w-4xl mx-auto mb-4 flex gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg"
          style={{ backgroundColor: ORANGE }}
        >
          🖨️ Printeaza / Salveaza PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 border border-gray-300 text-sm text-gray-900 rounded-lg hover:bg-gray-50"
        >
          ← Inapoi
        </button>
      </div>

      {/* Document */}
      <div id="oferta-doc" className="max-w-4xl mx-auto bg-white shadow" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#111' }}>
        <div className="px-8 py-5">

          {/* Header: Logo stanga + Titlu dreapta */}
          <div className="flex justify-between items-center mb-3">
            <div>
              {setari?.logo_url ? (
                <img src={setari.logo_url} alt="Logo" style={{ height: '120px', objectFit: 'contain' }} />
              ) : (
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: ORANGE }}>
                  {setari?.company_name || 'AV AUTO'}
                </div>
              )}
            </div>
            <div className="text-right">
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111' }}>
                Ofertă&nbsp;<span style={{ color: ORANGE, fontSize: '18px' }}>{oferta.numar ?? ''}</span>
              </div>
              <div style={{ fontSize: '10px', marginTop: '2px', lineHeight: '1.6', color: '#555' }}>
                <span>Data: {dataEmiterii}</span>
                <span style={{ margin: '0 6px' }}>·</span>
                <span>Valabilitate: 7 zile</span>
                <span style={{ margin: '0 6px' }}>·</span>
                <span>TVA 21%</span>
              </div>
            </div>
          </div>

          {/* Linie separator */}
          <hr style={{ borderColor: '#ddd', marginBottom: '16px' }} />

          {/* Furnizor + Client */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            {/* Furnizor */}
            <div>
              <div style={{ fontSize: '10px', color: '#888', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '4px' }}>FURNIZOR:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{setari?.company_name || '—'}</div>
              {setari?.reg_com && <div><strong>Reg. com.:</strong> {setari.reg_com}</div>}
              {setari?.cui && <div><strong>CIF:</strong> {setari.cui}</div>}
              {setari?.address && <div><strong>Adresa:</strong> {setari.address}</div>}
              {ibanList.map((entry, i) => (
                entry.iban ? (
                  <div key={i}><strong>IBAN (RON):</strong> {entry.iban}{entry.banca ? ' \u2014 ' + entry.banca : ''}</div>
                ) : null
              ))}
              {setari?.phone && <div><strong>Tel.:</strong> {setari.phone}</div>}
              {setari?.email && <div><strong>Email:</strong> {setari.email}</div>}
            </div>

            {/* Client */}
            <div>
              <div style={{ fontSize: '10px', color: '#888', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '4px' }}>CLIENT:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{oferta.clienti?.denumire || '—'}</div>
              {oferta.clienti?.reg_com && <div><strong>Reg. com.:</strong> {oferta.clienti.reg_com}</div>}
              {oferta.clienti?.cod_fiscal && <div><strong>CIF:</strong> {oferta.clienti.cod_fiscal}</div>}
              {oferta.clienti?.adresa && <div><strong>Adresa:</strong> {oferta.clienti.adresa}</div>}
              {oferta.clienti?.localitate && <div><strong>Localitate:</strong> {oferta.clienti.localitate}</div>}
              {oferta.clienti?.judet && <div><strong>Județ:</strong> {oferta.clienti.judet}</div>}
              {oferta.clienti?.tara && <div><strong>Țara:</strong> {oferta.clienti.tara}</div>}
              {oferta.clienti?.telefon && <div><strong>Tel.:</strong> {oferta.clienti.telefon}</div>}
            </div>
          </div>

          {/* Tabel produse */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #111', borderTop: '1px solid #ddd' }}>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: '700', width: '32px' }}>Nr.</th>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: '700' }}>Denumire produs/serviciu</th>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: '700' }}>Producător</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: '700', width: '50px' }}>U.M.</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: '700', width: '50px' }}>Cant.</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '700', width: '110px' }}>Preț unitar<br />(RON fără TVA)</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '700', width: '80px' }}>Valoare<br />(RON)</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '700', width: '70px' }}>TVA<br />(RON)</th>
              </tr>
            </thead>
            <tbody>
              {produse.map((p, i) => {
                const valoare = p.cantitate * p.pret_vanzare
                const tva = valoare * TVA_PCT
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '7px 6px' }}>{i + 1}</td>
                    <td style={{ padding: '7px 6px', fontWeight: '500' }}>{p.nume_produs}</td>
                    <td style={{ padding: '7px 6px' }}>{p.producator || ''}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'center' }}>{p.unitate || 'buc'}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'center' }}>{p.cantitate}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right' }}>{p.pret_vanzare > 0 ? p.pret_vanzare.toFixed(2) : ''}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right' }}>{valoare > 0 ? valoare.toFixed(2) : ''}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right' }}>{tva > 0 ? tva.toFixed(2) : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Subtotal + Total */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0' }}>
            <table style={{ fontSize: '12px', borderTop: '1px solid #ddd', minWidth: '260px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px', color: '#555' }}>Subtotal</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', width: '80px' }}>{subtotal.toFixed(2)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', width: '70px' }}>{totalTva.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ padding: '8px', borderTop: '1px solid #ddd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: ORANGE, fontSize: '14px' }}>Total plată</span>
                      <span style={{ fontWeight: 'bold', color: ORANGE, fontSize: '16px' }}>{totalPlata.toFixed(2)} RON</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '11px', color: '#999', borderTop: '1px solid #eee', paddingTop: '12px' }}>
            Pagina 1 din 1
          </div>

        </div>
      </div>
    </div>
    </>
  )
}
