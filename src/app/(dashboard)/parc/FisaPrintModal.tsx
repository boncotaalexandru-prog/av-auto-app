'use client'

import { useEffect } from 'react'

interface Alimentare {
  id: string
  data: string
  km: number
  litri: number
  total_ron: number
  tip_combustibil: string
  statie: string | null
}

interface CheltuialaMasina {
  id: string
  data: string
  km: number | null
  descriere: string
  suma: number
  categorie: string | null
  nr_factura: string | null
  furnizor: string | null
}

interface Masina {
  nr_inmatriculare: string
  marca: string | null
  model: string | null
  an: number | null
  sofer: string | null
}

interface Props {
  masina: Masina
  luna: string
  lunaLabel: string
  alimentari: Alimentare[]
  cheltuieli: CheltuialaMasina[]
  onClose: () => void
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ro-RO')
}

export default function FisaPrintModal({ masina, luna, lunaLabel, alimentari, cheltuieli, onClose }: Props) {
  const alFiltrate = luna === 'toate' ? alimentari : alimentari.filter(a => a.data.startsWith(luna))
  const chFiltrate = luna === 'toate' ? cheltuieli : cheltuieli.filter(c => c.data.startsWith(luna))

  const kms = alFiltrate.map(a => a.km).filter(Boolean)
  const kmMin = kms.length ? Math.min(...kms) : 0
  const kmMax = kms.length ? Math.max(...kms) : 0
  const kmParcursi = kmMax - kmMin
  const totalLitri = alFiltrate.reduce((s, a) => s + a.litri, 0)
  const totalCombustibil = alFiltrate.reduce((s, a) => s + a.total_ron, 0)
  const totalCheltuieli = chFiltrate.reduce((s, c) => s + c.suma, 0)
  const consumMediu = kmParcursi > 0 ? (totalLitri / kmParcursi) * 100 : null
  const dataAzi = new Date().toLocaleDateString('ro-RO')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handlePrint() {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return

    const rowsAlimentari = alFiltrate.map((a, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="border:1px solid #d1d5db;padding:5px 8px;color:#111">${fmtDate(a.data)}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;color:#111">${a.km.toLocaleString('ro-RO')}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;color:#111">${a.litri.toFixed(2)}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;color:#111;font-weight:600">${a.total_ron.toFixed(2)}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;color:#111">${a.litri > 0 ? (a.total_ron / a.litri).toFixed(3) : '—'}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;color:#111">${a.tip_combustibil}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;color:#111">${a.statie ?? '—'}</td>
      </tr>
    `).join('')

    const rowsCheltuieli = chFiltrate.map((c, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="border:1px solid #d1d5db;padding:5px 8px;color:#111">${fmtDate(c.data)}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;color:#111">${c.categorie ?? '—'}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;color:#111">${c.descriere}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;color:#111">${c.furnizor ?? '—'}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;color:#111">${c.km != null ? c.km.toLocaleString('ro-RO') : '—'}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;color:#111;font-weight:600">${c.suma.toFixed(2)}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;color:#111">${c.nr_factura ?? '—'}</td>
      </tr>
    `).join('')

    const detaliiMasina = [masina.marca, masina.model, masina.an ? String(masina.an) : null].filter(Boolean).join(' · ')

    win.document.write(`<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <title>Fisa Auto ${masina.nr_inmatriculare} — ${lunaLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #111; }
    h2 { font-size: 13px; font-weight: 700; color: #111; margin: 20px 0 6px; padding-bottom: 4px; border-bottom: 1.5px solid #374151; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #e5e7eb; color: #111; font-weight: 700; padding: 6px 8px; border: 1px solid #9ca3af; text-align: left; }
    tfoot tr td { background: #d1d5db; font-weight: 700; color: #111; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 14px; }
    .header-left p { color: #374151; margin-top: 3px; font-size: 12px; }
    .header-right { text-align: right; }
    .header-right .period { font-size: 16px; font-weight: 700; color: #111; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 4px; }
    .stat { border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 10px; }
    .stat-label { font-size: 10px; color: #6b7280; }
    .stat-value { font-size: 13px; font-weight: 700; color: #111; margin-top: 2px; }
    .stat-blue { border-color: #93c5fd; background: #eff6ff; }
    .stat-blue .stat-value { color: #1d4ed8; }
    .total-general { text-align: right; border-top: 2px solid #111; margin-top: 16px; padding-top: 8px; }
    .total-general p { color: #374151; margin-bottom: 2px; }
    .total-general .total-big { font-size: 15px; font-weight: 700; color: #111; }
    @media print {
      body { padding: 12px; }
      @page { margin: 12mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>FIȘĂ AUTO — ${masina.nr_inmatriculare}</h1>
      ${detaliiMasina ? `<p>${detaliiMasina}</p>` : ''}
      ${masina.sofer ? `<p>Șofer: <strong>${masina.sofer}</strong></p>` : ''}
    </div>
    <div class="header-right">
      <div style="font-size:11px;color:#6b7280">Perioada</div>
      <div class="period">${lunaLabel}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:3px">Generat: ${dataAzi}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat stat-blue">
      <div class="stat-label">KM parcurși</div>
      <div class="stat-value">${kmParcursi > 0 ? kmParcursi.toLocaleString('ro-RO') + ' km' : 'N/A'}</div>
    </div>
    <div class="stat">
      <div class="stat-label">KM start</div>
      <div class="stat-value">${kmMin > 0 ? kmMin.toLocaleString('ro-RO') : '—'}</div>
    </div>
    <div class="stat">
      <div class="stat-label">KM final</div>
      <div class="stat-value">${kmMax > 0 ? kmMax.toLocaleString('ro-RO') : '—'}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total combustibil</div>
      <div class="stat-value">${totalLitri.toFixed(1)} L / ${totalCombustibil.toFixed(2)} RON</div>
    </div>
    <div class="stat">
      <div class="stat-label">Consum mediu</div>
      <div class="stat-value">${consumMediu != null ? consumMediu.toFixed(1) + ' L/100km' : 'N/A'}</div>
    </div>
  </div>

  <h2>ALIMENTĂRI (${alFiltrate.length})</h2>
  ${alFiltrate.length === 0
    ? '<p style="color:#6b7280;font-style:italic;padding:8px 0">Nicio alimentare în această perioadă.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Data</th><th style="text-align:right">KM</th><th style="text-align:right">Litri</th>
            <th style="text-align:right">Total RON</th><th style="text-align:right">Preț/L</th>
            <th>Tip</th><th>Stație</th>
          </tr>
        </thead>
        <tbody>${rowsAlimentari}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="border:1px solid #9ca3af;padding:5px 8px">TOTAL</td>
            <td style="border:1px solid #9ca3af;padding:5px 8px;text-align:right">${totalLitri.toFixed(2)} L</td>
            <td style="border:1px solid #9ca3af;padding:5px 8px;text-align:right">${totalCombustibil.toFixed(2)} RON</td>
            <td colspan="3" style="border:1px solid #9ca3af;padding:5px 8px"></td>
          </tr>
        </tfoot>
      </table>`
  }

  <h2>CHELTUIELI MAȘINĂ (${chFiltrate.length})</h2>
  ${chFiltrate.length === 0
    ? '<p style="color:#6b7280;font-style:italic;padding:8px 0">Nicio cheltuială în această perioadă.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Data</th><th>Categorie</th><th>Descriere</th><th>Furnizor</th>
            <th style="text-align:right">KM</th><th style="text-align:right">Suma (RON)</th><th>Nr. factură</th>
          </tr>
        </thead>
        <tbody>${rowsCheltuieli}</tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="border:1px solid #9ca3af;padding:5px 8px">TOTAL</td>
            <td style="border:1px solid #9ca3af;padding:5px 8px;text-align:right">${totalCheltuieli.toFixed(2)} RON</td>
            <td style="border:1px solid #9ca3af;padding:5px 8px"></td>
          </tr>
        </tfoot>
      </table>`
  }

  <div class="total-general">
    <p>Total combustibil: <strong>${totalCombustibil.toFixed(2)} RON</strong> &nbsp;|&nbsp; Total cheltuieli mașină: <strong>${totalCheltuieli.toFixed(2)} RON</strong></p>
    <p class="total-big">TOTAL GENERAL: ${(totalCombustibil + totalCheltuieli).toFixed(2)} RON</p>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Fișă {masina.nr_inmatriculare} — {lunaLabel}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {alFiltrate.length} alimentări · {chFiltrate.length} cheltuieli
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              🖨️ Tipareste / PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Inchide
            </button>
          </div>
        </div>

        {/* Preview sumar */}
        <div className="p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'KM parcurși', value: kmParcursi > 0 ? `${kmParcursi.toLocaleString('ro-RO')} km` : 'N/A', blue: true },
              { label: 'KM start', value: kmMin > 0 ? kmMin.toLocaleString('ro-RO') : '—' },
              { label: 'KM final', value: kmMax > 0 ? kmMax.toLocaleString('ro-RO') : '—' },
              { label: 'Total combustibil', value: `${totalLitri.toFixed(1)} L · ${totalCombustibil.toFixed(2)} RON` },
              { label: 'Consum mediu', value: consumMediu != null ? `${consumMediu.toFixed(1)} L/100km` : 'N/A' },
            ].map(s => (
              <div key={s.label} className={`rounded-lg border px-3 py-2 ${s.blue ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className={`text-sm font-bold mt-0.5 ${s.blue ? 'text-blue-700' : 'text-gray-900'}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Alimentari preview */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2">Alimentări ({alFiltrate.length})</h3>
            {alFiltrate.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nicio alimentare în această perioadă.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs text-gray-900">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Data</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">KM</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Litri</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Total RON</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Preț/L</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Tip</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Stație</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alFiltrate.map((a, idx) => (
                      <tr key={a.id} className={`border-t border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <td className="px-3 py-1.5">{fmtDate(a.data)}</td>
                        <td className="px-3 py-1.5 text-right">{a.km.toLocaleString('ro-RO')}</td>
                        <td className="px-3 py-1.5 text-right">{a.litri.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{a.total_ron.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600">{a.litri > 0 ? (a.total_ron / a.litri).toFixed(3) : '—'}</td>
                        <td className="px-3 py-1.5">{a.tip_combustibil}</td>
                        <td className="px-3 py-1.5 text-gray-600">{a.statie ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 border-t border-gray-300 font-semibold">
                      <td className="px-3 py-1.5 text-gray-900" colSpan={2}>Total</td>
                      <td className="px-3 py-1.5 text-right text-gray-900">{totalLitri.toFixed(2)} L</td>
                      <td className="px-3 py-1.5 text-right text-gray-900">{totalCombustibil.toFixed(2)} RON</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Cheltuieli preview */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2">Cheltuieli mașină ({chFiltrate.length})</h3>
            {chFiltrate.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nicio cheltuială în această perioadă.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs text-gray-900">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Data</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Categorie</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Descriere</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Furnizor</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">KM</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Suma (RON)</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Nr. factură</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chFiltrate.map((c, idx) => (
                      <tr key={c.id} className={`border-t border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <td className="px-3 py-1.5">{fmtDate(c.data)}</td>
                        <td className="px-3 py-1.5">{c.categorie ?? '—'}</td>
                        <td className="px-3 py-1.5">{c.descriere}</td>
                        <td className="px-3 py-1.5 text-gray-600">{c.furnizor ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right">{c.km != null ? c.km.toLocaleString('ro-RO') : '—'}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{c.suma.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-gray-600">{c.nr_factura ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 border-t border-gray-300 font-semibold">
                      <td className="px-3 py-1.5 text-gray-900" colSpan={5}>Total</td>
                      <td className="px-3 py-1.5 text-right text-gray-900">{totalCheltuieli.toFixed(2)} RON</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Total general */}
          <div className="border-t-2 border-gray-900 pt-3 flex justify-end">
            <div className="text-right">
              <p className="text-sm text-gray-700">Total combustibil: <strong className="text-gray-900">{totalCombustibil.toFixed(2)} RON</strong></p>
              <p className="text-sm text-gray-700">Total cheltuieli mașină: <strong className="text-gray-900">{totalCheltuieli.toFixed(2)} RON</strong></p>
              <p className="text-base font-bold text-gray-900 mt-1">TOTAL GENERAL: {(totalCombustibil + totalCheltuieli).toFixed(2)} RON</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
