'use client'

import { useRef, useState } from 'react'
import { read, utils } from 'xlsx'
import { createClient } from '@/lib/supabase/client'

interface ProdusImport {
  cod: string
  nume: string
  unitate: string
}

interface ImportStats {
  total: number
  noi: number
  existente: number
  erori: number
}

export default function ImportProduse({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'idle' | 'analyzing' | 'preview' | 'importing' | 'done'>('idle')
  const [produse, setProduse] = useState<ProdusImport[]>([])
  const [stats, setStats] = useState<ImportStats | null>(null)
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
      const rows: string[][] = utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Skip header row, map columns B(1), C(2), F(5)
      const parsed: ProdusImport[] = rows
        .slice(1)
        .filter(row => row[1]?.toString().trim())
        .map(row => ({
          nume: row[1]?.toString().trim() ?? '',
          cod: row[2]?.toString().trim() ?? '',
          unitate: row[5]?.toString().trim() ?? '',
        }))

      // Check which codes already exist
      const coduriImport = parsed.map(p => p.cod).filter(Boolean)
      const supabase = createClient()

      const { data: existente } = await supabase
        .from('produse')
        .select('cod')
        .in('cod', coduriImport)

      const codExistente = new Set((existente ?? []).map(p => p.cod))

      const noi = parsed.filter(p => !p.cod || !codExistente.has(p.cod))
      const existenteCount = parsed.length - noi.length

      setProduse(noi)
      setStats({ total: parsed.length, noi: noi.length, existente: existenteCount, erori: 0 })
      setStep('preview')
    } catch (err) {
      setError('Eroare la citirea fisierului: ' + (err as Error).message)
      setStep('idle')
    }
  }

  async function handleImport() {
    if (!produse.length) return
    setStep('importing')
    setProgress(0)

    const supabase = createClient()
    const batchSize = 100
    let erori = 0

    for (let i = 0; i < produse.length; i += batchSize) {
      const batch = produse.slice(i, i + batchSize)
      const { error } = await supabase.from('produse').insert(
        batch.map(p => ({
          cod: p.cod || null,
          nume: p.nume,
          unitate: p.unitate || null,
        }))
      )
      if (error) erori++
      setProgress(Math.round(((i + batch.length) / produse.length) * 100))
    }

    setStats(s => s ? { ...s, erori } : null)
    setStep('done')
  }

  if (step === 'idle') {
    return (
      <div>
        <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span>⬆</span> Importa produse (.xls / .xlsx)
        </button>
      </div>
    )
  }

  if (step === 'analyzing') {
    return <p className="text-sm text-gray-500">Se analizeaza fisierul...</p>
  }

  if (step === 'preview' && stats) {
    return (
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
            <p className="text-xs text-green-600 mt-0.5">Produse noi</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-2xl font-bold text-yellow-700">{stats.existente}</p>
            <p className="text-xs text-yellow-600 mt-0.5">Deja existente</p>
          </div>
        </div>

        {stats.noi === 0 ? (
          <p className="text-sm text-gray-500">Toate produsele exista deja in baza de date.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600">Cod</th>
                  <th className="text-left px-3 py-2 text-gray-600">Nume</th>
                  <th className="text-left px-3 py-2 text-gray-600">UM</th>
                </tr>
              </thead>
              <tbody>
                {produse.slice(0, 50).map((p, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="px-3 py-1.5 text-gray-500">{p.cod || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-900">{p.nume}</td>
                    <td className="px-3 py-1.5 text-gray-500">{p.unitate || '—'}</td>
                  </tr>
                ))}
                {produse.length > 50 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-center text-gray-600 text-xs">
                      ... si inca {produse.length - 50} produse
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => { setStep('idle'); setProduse([]); setStats(null) }}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Anuleaza
          </button>
          {stats.noi > 0 && (
            <button
              onClick={handleImport}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
            >
              Importa {stats.noi} produse noi
            </button>
          )}
        </div>
      </div>
    )
  }

  if (step === 'importing') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <p className="text-sm font-medium text-gray-900">Se importa produsele... {progress}%</p>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  if (step === 'done' && stats) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <p className="font-semibold text-green-800">Import finalizat!</p>
        <p className="text-sm text-green-700 mt-1">
          {stats.noi - stats.erori} produse importate cu succes.
          {stats.erori > 0 && ` ${stats.erori} erori.`}
        </p>
        <button
          onClick={() => { setStep('idle'); setProduse([]); setStats(null); onDone() }}
          className="mt-3 text-sm text-green-700 underline"
        >
          Inchide
        </button>
      </div>
    )
  }

  return null
}
