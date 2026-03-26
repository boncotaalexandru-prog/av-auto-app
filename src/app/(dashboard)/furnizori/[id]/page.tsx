'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Furnizor {
  id: string
  denumire: string
  cod_fiscal: string | null
  reg_com: string | null
  cod_furnizor: string | null
  adresa: string | null
  localitate: string | null
  judet: string | null
  banca: string | null
  iban: string | null
  tara: string | null
  email: string | null
  pers_contact: string | null
  telefon: string | null
  ora_ridicare: string | null
  are_contract: boolean
  termen_plata: number | null
  observatii: string | null
}

const FIELD_LABELS: Record<string, string> = {
  cod_fiscal:   'Cod fiscal',
  reg_com:      'Reg. com.',
  cod_furnizor: 'Cod furnizor',
  adresa:       'Adresa',
  localitate:   'Localitate',
  judet:        'Judet',
  banca:        'Banca',
  iban:         'IBAN',
  tara:         'Tara',
  email:        'Email',
  pers_contact: 'Persoana contact',
  telefon:      'Telefon',
}

export default function FurnizorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [furnizor, setFurnizor] = useState<Furnizor | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Partial<Furnizor>>({})

  useEffect(() => {
    if (!id) return
    createClient()
      .from('furnizori')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setFurnizor(data)
        setForm(data ?? {})
        setLoading(false)
      })
  }, [id])

  async function save() {
    if (!furnizor) return
    setSaving(true)
    const { data } = await createClient()
      .from('furnizori')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', furnizor.id)
      .select()
      .single()
    if (data) { setFurnizor(data); setForm(data) }
    setSaving(false)
    setEditMode(false)
  }

  if (loading) return <p className="text-sm text-gray-500 p-6">Se incarca...</p>
  if (!furnizor) return <p className="text-sm text-red-600 p-6">Furnizorul nu a fost gasit.</p>

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/furnizori')} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Inapoi
        </button>
        <h2 className="text-2xl font-bold text-gray-900 flex-1">{furnizor.denumire}</h2>
        {!editMode ? (
          <button onClick={() => setEditMode(true)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
            Editeaza
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { setEditMode(false); setForm(furnizor) }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
              Anuleaza
            </button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50">
              {saving ? 'Se salveaza...' : 'Salveaza'}
            </button>
          </div>
        )}
      </div>

      {/* Ora ridicare — card separat, proeminent */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Ora de ridicare</h3>
        <div className="flex items-center gap-4">
          {editMode ? (
            <input
              type="time"
              value={form.ora_ridicare ?? ''}
              onChange={e => setForm(f => ({ ...f, ora_ridicare: e.target.value || null }))}
              className="px-3 py-2 border border-blue-400 rounded-lg text-lg font-semibold text-gray-900 w-36"
            />
          ) : furnizor.ora_ridicare ? (
            <span className="text-3xl font-bold text-blue-700">
              {furnizor.ora_ridicare.slice(0, 5)}
            </span>
          ) : (
            <span className="text-gray-400 text-sm italic">Ora neselectata — apasa Editeaza pentru a seta</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Aceasta ora apare in lista de ridicari si poate fi modificata per ridicare.
        </p>
      </div>

      {/* Date generale */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Date generale</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {Object.keys(FIELD_LABELS).map(key => (
            <div key={key}>
              <p className="text-xs text-gray-500 mb-0.5">{FIELD_LABELS[key]}</p>
              {editMode ? (
                <input
                  type="text"
                  value={(form[key as keyof Furnizor] as string) ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
                  className="w-full px-2 py-1 border border-blue-400 rounded text-sm text-gray-900"
                />
              ) : (
                <p className="text-sm text-gray-900">
                  {(furnizor[key as keyof Furnizor] as string) || <span className="text-gray-400">—</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Date comerciale */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Date comerciale</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Contract</p>
            {editMode ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.are_contract}
                  onChange={e => setForm(f => ({ ...f, are_contract: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Are contract</span>
              </label>
            ) : (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                furnizor.are_contract ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {furnizor.are_contract ? 'Da — contract activ' : 'Nu'}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Termen plata (zile)</p>
            {editMode ? (
              <input
                type="number"
                value={form.termen_plata ?? ''}
                onChange={e => setForm(f => ({ ...f, termen_plata: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-32 px-2 py-1 border border-blue-400 rounded text-sm text-gray-900"
                placeholder="ex: 30"
              />
            ) : (
              <p className="text-sm text-gray-900">
                {furnizor.termen_plata ? `${furnizor.termen_plata} zile` : <span className="text-gray-400">—</span>}
              </p>
            )}
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-500 mb-1">Observatii</p>
            {editMode ? (
              <textarea
                value={form.observatii ?? ''}
                onChange={e => setForm(f => ({ ...f, observatii: e.target.value || null }))}
                rows={3}
                className="w-full px-2 py-1 border border-blue-400 rounded text-sm text-gray-900 resize-none"
              />
            ) : (
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {furnizor.observatii || <span className="text-gray-400">—</span>}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
