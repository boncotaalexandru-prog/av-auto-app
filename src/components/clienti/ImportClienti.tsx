'use client'

import { useRef, useState } from 'react'
import { read, utils } from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { curataCui } from '@/lib/anaf'

interface ClientImport {
  denumire: string
  cod_fiscal: string
  reg_com: string
  cod_client: string
  adresa: string
  localitate: string
  judet: string
  banca: string
  iban: string
  tara: string
  email: string
  pers_contact: string
  telefon: string
}

// Nr. Reg. Com. în forma nouă (ex: J2005001721136), după refacerea certificatelor
const REG_COM_NOU = /^[JFC]\d{13}$/i

function clean(v: unknown): string {
  const s = String(v ?? '').trim()
  return s === '-' || s === 'undefined' ? '' : s
}

export default function ImportClienti({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'idle' | 'analyzing' | 'preview' | 'importing' | 'done'>('idle')
  const [clienti, setClienti] = useState<ClientImport[]>([])
  const [deActualizat, setDeActualizat] = useState<{ id: string; reg_com: string }[]>([])
  const [stats, setStats] = useState<{ total: number; noi: number; existenti: number; regCom: number } | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStep('analyzing')
    setError(null)

    try {
      const buffer = await file.arrayBuffer()
      const wb = read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: unknown[][] = utils.sheet_to_json(ws, { header: 1, defval: '' })

      const parsed: ClientImport[] = rows
        .slice(1)
        .filter(row => clean(row[0]))
        .map(row => ({
          denumire:     clean(row[0]),
          cod_fiscal:   clean(row[1]),
          reg_com:      clean(row[2]),
          cod_client:   clean(row[3]),
          adresa:       clean(row[4]),
          localitate:   clean(row[5]),
          judet:        clean(row[6]),
          banca:        clean(row[7]),
          iban:         clean(row[8]),
          tara:         clean(row[9]) || 'Romania',
          email:        clean(row[10]),
          pers_contact: clean(row[11]),
          telefon:      clean(row[12]),
        }))

      const supabase = createClient()
      const existenti: { id: string; denumire: string; cod_fiscal: string | null; reg_com: string | null }[] = []
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('clienti').select('id, denumire, cod_fiscal, reg_com').range(from, from + 999)
        existenti.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }

      // Potrivire după CUI (fără „RO"): Oblio poate schimba numele („S.R.L." → „SRL") și nr. Reg. Com.
      // Numele se folosește doar pentru clienții fără cod fiscal.
      const dupaCui = new Map(existenti.filter(c => curataCui(c.cod_fiscal)).map(c => [curataCui(c.cod_fiscal), c]))
      const numeExistente = new Set(existenti.map(c => c.denumire.toLowerCase()))
      const vazute = new Set<string>()
      const noi: ClientImport[] = []
      const actualizari: { id: string; reg_com: string }[] = []
      for (const c of parsed) {
        const cui = curataCui(c.cod_fiscal)
        const cheie = cui || c.denumire.toLowerCase()
        if (vazute.has(cheie)) continue
        vazute.add(cheie)
        const existent = cui ? dupaCui.get(cui) : undefined
        if (existent) {
          if (REG_COM_NOU.test(c.reg_com) && existent.reg_com !== c.reg_com) actualizari.push({ id: existent.id, reg_com: c.reg_com })
        } else if (cui || !numeExistente.has(c.denumire.toLowerCase())) {
          noi.push(c)
        }
      }

      setClienti(noi)
      setDeActualizat(actualizari)
      setStats({ total: parsed.length, noi: noi.length, existenti: parsed.length - noi.length, regCom: actualizari.length })
      setStep('preview')
    } catch (err) {
      setError('Eroare: ' + (err as Error).message)
      setStep('idle')
    }
  }

  async function handleImport() {
    if (!clienti.length && !deActualizat.length) return
    setStep('importing')
    setProgress(0)
    const supabase = createClient()
    const batchSize = 50

    for (let i = 0; i < clienti.length; i += batchSize) {
      await supabase.from('clienti').insert(clienti.slice(i, i + batchSize))
      setProgress(Math.round(((i + batchSize) / clienti.length) * 100))
    }
    for (const u of deActualizat) {
      await supabase.from('clienti').update({ reg_com: u.reg_com, updated_at: new Date().toISOString() }).eq('id', u.id)
    }

    setStep('done')
  }

  if (step === 'idle') return (
    <div>
      <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFile} />
      <button onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
        ⬆ Importa clienti
      </button>
    </div>
  )

  if (step === 'analyzing') return <p className="text-sm text-gray-900">Se analizeaza fisierul...</p>

  if (step === 'preview' && stats) return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">Previzualizare import</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-900 mt-0.5">Total in fisier</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-700">{stats.noi}</p>
          <p className="text-xs text-green-600 mt-0.5">Clienti noi</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-yellow-700">{stats.existenti}</p>
          <p className="text-xs text-yellow-600 mt-0.5">Deja existenti</p>
        </div>
      </div>
      {stats.regCom > 0 && (
        <p className="text-sm text-gray-900">La {stats.regCom} clienți existenți se actualizează Nr. Reg. Com. în forma nouă.</p>
      )}
      {stats.noi > 0 && (
        <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-gray-600">Denumire</th>
                <th className="text-left px-3 py-2 text-gray-600">Cod fiscal</th>
                <th className="text-left px-3 py-2 text-gray-600">Localitate</th>
              </tr>
            </thead>
            <tbody>
              {clienti.slice(0, 50).map((c, i) => (
                <tr key={i} className="border-t border-gray-200">
                  <td className="px-3 py-1.5 text-gray-900">{c.denumire}</td>
                  <td className="px-3 py-1.5 text-gray-900">{c.cod_fiscal || '—'}</td>
                  <td className="px-3 py-1.5 text-gray-900">{c.localitate || '—'}</td>
                </tr>
              ))}
              {clienti.length > 50 && (
                <tr><td colSpan={3} className="px-3 py-2 text-center text-gray-600">... si inca {clienti.length - 50}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-3 justify-end">
        <button onClick={() => { setStep('idle'); setClienti([]); setDeActualizat([]); setStats(null) }}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
          Anuleaza
        </button>
        {(stats.noi > 0 || stats.regCom > 0) && (
          <button onClick={handleImport}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">
            {stats.noi > 0 ? `Importa ${stats.noi} clienti noi` : `Actualizeaza ${stats.regCom} clienti`}
          </button>
        )}
      </div>
    </div>
  )

  if (step === 'importing') return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <p className="text-sm font-medium text-gray-900">Se importa... {Math.min(progress, 100)}%</p>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
    </div>
  )

  if (step === 'done') return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
      <p className="font-semibold text-green-800">Import finalizat!</p>
      <button onClick={() => { setStep('idle'); setClienti([]); setStats(null); onDone() }}
        className="mt-2 text-sm text-green-700 underline">Inchide</button>
    </div>
  )

  return null
}
