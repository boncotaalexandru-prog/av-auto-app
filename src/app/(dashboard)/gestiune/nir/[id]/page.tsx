'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Nir {
  id: string
  numar: number
  numar_document: string | null
  data_document: string | null
  data_intrare: string
  data_scadenta: string | null
  furnizor_id: string | null
  furnizor_nume: string | null
  total_fara_tva: number
  total_tva: number
  total_cu_tva: number
  valoare_factura_verificare: number | null
  corectie_valoare: number
  note: string | null
  created_at: string
}

interface NirProdus {
  id: string
  produs_cod: string | null
  produs_nume: string
  producator: string | null
  cantitate: number
  unitate: string | null
  pret_achizitie: number
  tva_procent: number
  valoare_fara_tva: number
  valoare_tva: number
  valoare_cu_tva: number
}

interface Settings {
  company_name: string | null
  reg_com: string | null
  cui: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
}

const ORANGE = '#E07020'

export default function NirPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [nir, setNir] = useState<Nir | null>(null)
  const [produse, setProduse] = useState<NirProdus[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    Promise.all([
      supabase.from('nir').select('*').eq('id', id).single(),
      supabase.from('nir_produse').select('*').eq('nir_id', id).order('created_at'),
      supabase.from('settings').select('*').limit(1).single(),
    ]).then(([{ data: n }, { data: p }, { data: s }]) => {
      setNir(n as Nir)
      setProduse((p as NirProdus[]) ?? [])
      setSettings(s as Settings)
      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: '#374151', fontFamily: 'Arial, sans-serif' }}>Se încarcă...</p>
    </div>
  )
  if (!nir) return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <p style={{ color: '#dc2626' }}>NIR nu a fost găsit.</p>
    </div>
  )

  const dataFormatata = new Date(nir.data_intrare).toLocaleDateString('ro-RO', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
  const dataDocFormatata = nir.data_document
    ? new Date(nir.data_document).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null
  const dataScadentaFormatata = nir.data_scadenta
    ? new Date(nir.data_scadenta).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
        }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; background: #f5f5f5; margin: 0; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
      `}</style>

      {/* Butoane print */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#1f2937', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button onClick={() => window.print()} style={{
          background: ORANGE, color: 'white', border: 'none', padding: '8px 20px',
          borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
        }}>🖨 Printează / Salvează PDF</button>
        <button onClick={() => window.close()} style={{
          background: 'transparent', color: '#d1d5db', border: '1px solid #4b5563',
          padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
        }}>✕ Închide</button>
      </div>

      {/* Document */}
      <div style={{
        maxWidth: '210mm', margin: '60px auto 30px', background: 'white',
        padding: '20mm', boxShadow: '0 2px 20px rgba(0,0,0,0.15)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: `3px solid ${ORANGE}`, paddingBottom: '16px' }}>
          <div>
            {settings?.logo_url && (
              <img src={settings.logo_url} alt="Logo" style={{ height: '50px', marginBottom: '8px', objectFit: 'contain' }} />
            )}
            <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.6' }}>
              <strong style={{ fontSize: '13px', color: '#111827' }}>{settings?.company_name || 'AV Auto'}</strong><br />
              {settings?.reg_com && <span>Reg. Com.: {settings.reg_com}<br /></span>}
              {settings?.cui && <span>CUI: {settings.cui}<br /></span>}
              {settings?.address && <span>{settings.address}<br /></span>}
              {settings?.phone && <span>Tel: {settings.phone}<br /></span>}
              {settings?.email && <span>Email: {settings.email}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#111827' }}>NIR #{nir.numar}</div>
            <div style={{ fontSize: '12px', color: '#374151', marginTop: '6px', lineHeight: '1.8' }}>
              <strong>Notă de Intrare-Recepție</strong><br />
              {nir.numar_document && <span>Nr. document: <strong>{nir.numar_document}</strong><br /></span>}
              {dataDocFormatata && <span>Dată document: {dataDocFormatata}<br /></span>}
              Dată intrare stoc: {dataFormatata}<br />
              {dataScadentaFormatata && <span>Scadență: {dataScadentaFormatata}<br /></span>}
              {nir.furnizor_nume && <span>Furnizor: <strong>{nir.furnizor_nume}</strong></span>}
            </div>
          </div>
        </div>

        {/* Tabel produse */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '24px' }}>
          <thead>
            <tr style={{ background: '#111827', color: 'white' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600' }}>Nr.</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600' }}>Denumire produs</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600' }}>Producător</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600' }}>Cod</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600' }}>UM</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600' }}>Cant.</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600' }}>Preț fără TVA</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600' }}>TVA</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600' }}>Valoare cu TVA</th>
            </tr>
          </thead>
          <tbody>
            {produse.map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '7px 10px', color: '#374151' }}>{i + 1}</td>
                <td style={{ padding: '7px 10px', fontWeight: '500', color: '#111827' }}>{p.produs_nume}</td>
                <td style={{ padding: '7px 10px', color: '#374151' }}>{p.producator || '—'}</td>
                <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#374151', fontSize: '10px' }}>{p.produs_cod || '—'}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', color: '#374151' }}>{p.unitate || 'buc'}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#111827' }}>{p.cantitate}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{p.pret_achizitie.toFixed(2)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{p.valoare_tva.toFixed(2)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '600', color: '#111827' }}>{p.valoare_cu_tva.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
              <td colSpan={6} />
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', color: '#374151', fontSize: '11px' }}>Subtotal fără TVA</td>
              <td colSpan={2} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', color: '#111827' }}>{nir.total_fara_tva.toFixed(2)} RON</td>
            </tr>
            <tr style={{ background: '#f9fafb' }}>
              <td colSpan={6} />
              <td style={{ padding: '4px 10px', textAlign: 'right', color: '#6b7280', fontSize: '11px' }}>TVA (21%)</td>
              <td colSpan={2} style={{ padding: '4px 10px', textAlign: 'right', color: '#6b7280' }}>{nir.total_tva.toFixed(2)} RON</td>
            </tr>
            <tr style={{ background: ORANGE + '20', borderTop: `2px solid ${ORANGE}` }}>
              <td colSpan={6} />
              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#111827', fontSize: '13px' }}>TOTAL CU TVA</td>
              <td colSpan={2} style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: ORANGE, fontSize: '15px' }}>{nir.total_cu_tva.toFixed(2)} RON</td>
            </tr>
            {nir.corectie_valoare !== 0 && (
              <tr style={{ background: '#FEF3C7', borderTop: '1px dashed #D97706' }}>
                <td colSpan={6} />
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', color: '#92400E', fontSize: '11px' }}>
                  CORECȚIE VALOARE
                  <div style={{ fontSize: '9px', fontWeight: 'normal', color: '#B45309', marginTop: '2px' }}>
                    (diferență zecimale — nu intră în stoc)
                  </div>
                </td>
                <td colSpan={2} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#92400E', fontSize: '13px' }}>
                  {nir.corectie_valoare > 0 ? '+' : ''}{nir.corectie_valoare.toFixed(2)} RON
                </td>
              </tr>
            )}
            {nir.valoare_factura_verificare && (
              <tr style={{ background: '#F0FDF4', borderTop: '2px solid #16a34a' }}>
                <td colSpan={6} />
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#15803D', fontSize: '13px' }}>TOTAL FACTURĂ</td>
                <td colSpan={2} style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#15803D', fontSize: '15px' }}>
                  {nir.valoare_factura_verificare.toFixed(2)} RON
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        {/* Note + Semnature */}
        {nir.note && (
          <div style={{ marginBottom: '24px', padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: '11px', color: '#374151', margin: 0 }}><strong>Observații:</strong> {nir.note}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '40px' }}>
          {[
            { label: 'Furnizor', sub: nir.furnizor_nume || '...........................' },
            { label: 'Gestionar', sub: '...........................' },
            { label: 'Contabilitate', sub: '...........................' },
          ].map(({ label, sub }) => (
            <div key={label} style={{ textAlign: 'center', fontSize: '11px', color: '#374151' }}>
              <p style={{ fontWeight: '600', marginBottom: '30px' }}>{label}</p>
              <div style={{ borderTop: '1px solid #374151', paddingTop: '4px' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
