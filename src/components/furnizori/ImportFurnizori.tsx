'use client'

import { useRef, useState } from 'react'
import { read, utils } from 'xlsx'
import { createClient } from '@/lib/supabase/client'

interface FurnizorImport {
  denumire: string
  cod_fiscal: string
  reg_com: string
  cod_furnizor: string
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

function clean(v: unknown): string {
  const s = String(v ?? '').trim()
  return s === '-' || s === 'undefined' ? '' : s
}

export default function ImportFurnizori({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'idle' | 'analyzing' | 'preview' | 'importing' | 'done'>('idle')
  const [furnizori, setFurnizori] = useState<FurnizorImport[]>([])
  const [stats, setStats] = useState<{ total: number; noi: number; existenti: number } | null>(null)
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

      const parsed: FurnizorImport[] = rows
        .slice(1)
        .filter(row => clean(row[0]))
        .map(row => ({
          denumire:     clean(row[0]),
          cod_fiscal:   clean(row[1]),
          reg_com:      clean(row[2]),
          cod_furnizor: clean(row[3]),
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
      const { data: existenti } = await supabase
        .from('furnizori')
        .select('denumire')
        .eq('is_stoc_ct', false)

      const numeExistente = new Set((existenti ?? []).map((f: { denumire: string }) => f.denumire.toLowerCase()))
      const noi = parsed.filter(f => !numeExistente.has(f.denumire.toLowerCase()))

      setFurnizori(noi)
      setStats({ total: parsed.length, noi: noi.length, existenti: parsed.length - noi.length })
      setStep('preview')
    } catch (err) {
      setError('Eroare: ' + (err as Error).message)
      setStep('idle')
    }
  }

  async function handleImport() {
    if (!furnizori.length) return
    setStep('importing')
    setProgress(0)
    const supabase = createClient()
    const batchSize = 50

    for (let i = 0; i < furnizori.length; i += batchSize) {
      await supabase.from('furnizori').insert(furnizori.slice(i, i + batchSize))
      setProgress(Math.round(((i + batchSize) / furnizori.length) * 100))
    }

    setStep('done')
  }

  if (step === 'idle') return (
    <div>
      <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFile} />
      <button onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
        ⬆ Importa furnizori
      </button>
    </div>
  )

  if (step === 'analyzing') return <p className="text-sm text-gray-500">Se analizeaza fisierul...</p>

  if (step === 'preview' && stats) return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">Previzualizare import</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total in fisier</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-700">{stats.noi}</p>
          <p className="text-xs text-green-600 mt-0.5">Furnizori noi</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-yellow-700">{stats.existenti}</p>
          <p className="text-xs text-yellow-600 mt-0.5">Deja existenti</p>
        </div>
      </div>
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
              {furnizori.slice(0, 50).map((f, i) => (
                <tr key={i} className="border-t border-gray-200">
                  <td className="px-3 py-1.5 text-gray-900">{f.denumire}</td>
                  <td className="px-3 py-1.5 text-gray-500">{f.cod_fiscal || '—'}</td>
                  <td className="px-3 py-1.5 text-gray-500">{f.localitate || '—'}</td>
                </tr>
              ))}
              {furnizori.length > 50 && (
                <tr><td colSpan={3} className="px-3 py-2 text-center text-gray-600">... si inca {furnizori.length - 50}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-3 justify-end">
        <button onClick={() => { setStep('idle'); setFurnizori([]); setStats(null) }}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
          Anuleaza
        </button>
        {stats.noi > 0 && (
          <button onClick={handleImport}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">
            Importa {stats.noi} furnizori noi
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
      <button onClick={() => { setStep('idle'); setFurnizori([]); setStats(null); onDone() }}
        className="mt-2 text-sm text-green-700 underline">Inchide</button>
    </div>
  )

  return null
}
