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
  observatii: string | null
  is_favorit: boolean
}

interface OraRidicare {
  id: string
  ora: string
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
  const [ore, setOre] = useState<OraRidicare[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Partial<Furnizor>>({})
  const [favorit, setFavorit] = useState(false)
  const [oraNoua, setOraNoua] = useState('')
  const [addingOra, setAddingOra] = useState(false)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    Promise.all([
      supabase.from('furnizori').select('*').eq('id', id).single(),
      supabase.from('furnizori_ore').select('id, ora').eq('furnizor_id', id).order('ora'),
    ]).then(([{ data: f }, { data: o }]) => {
      setFurnizor(f)
      setForm(f ?? {})
      setFavorit(f?.is_favorit ?? false)
      setOre(o ?? [])
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

  async function toggleFavorit() {
    const nou = !favorit
    setFavorit(nou)
    await createClient().from('furnizori').update({ is_favorit: nou }).eq('id', id)
  }

  async function addOra() {
    if (!oraNoua) return
    const { data } = await createClient()
      .from('furnizori_ore')
      .insert({ furnizor_id: id, ora: oraNoua })
      .select()
      .single()
    if (data) setOre(prev => [...prev, data].sort((a, b) => a.ora.localeCompare(b.ora)))
    setOraNoua('')
    setAddingOra(false)
  }

  async function deleteOra(oraId: string) {
    await createClient().from('furnizori_ore').delete().eq('id', oraId)
    setOre(prev => prev.filter(o => o.id !== oraId))
  }

  if (loading) return <p className="text-sm text-gray-500 p-6">Se incarca...</p>
  if (!furnizor) return <p className="text-sm text-red-600 p-6">Furnizorul nu a fost gasit.</p>

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/furnizori')} className="text-gray-600 hover:text-gray-600 text-sm">
          ← Inapoi
        </button>
        <h2 className="text-2xl font-bold text-gray-900 flex-1">{furnizor.denumire}</h2>
        <button
          onClick={toggleFavorit}
          className="text-2xl leading-none transition-transform hover:scale-110"
          title={favorit ? 'Elimina din favorite' : 'Adauga la favorite'}
        >
          <span className={favorit ? 'text-amber-400' : 'text-gray-900'}>
            {favorit ? '★' : '☆'}
          </span>
        </button>
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

      {/* Ore de ridicare */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Ore de ridicare</h3>
          <button
            onClick={() => setAddingOra(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            + Adauga ora
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Stoc CT — fix, needitabil */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
            <span className="text-sm font-semibold text-orange-700">Stoc CT</span>
            <span className="text-xs text-orange-400 ml-1">presetat</span>
          </div>

          {/* Orele configurate */}
          {ore.map(o => (
            <div key={o.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-semibold text-blue-800">{o.ora.slice(0, 5)}</span>
              <button
                onClick={() => deleteOra(o.id)}
                className="text-blue-300 hover:text-red-500 transition-colors ml-1 text-xs leading-none"
                title="Sterge ora"
              >
                ✕
              </button>
            </div>
          ))}

          {ore.length === 0 && !addingOra && (
            <span className="text-sm text-gray-600 italic">Nicio ora configurata</span>
          )}

          {/* Input ora noua */}
          {addingOra && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={oraNoua}
                onChange={e => setOraNoua(e.target.value)}
                className="px-2 py-1 border border-blue-400 rounded text-sm font-semibold text-gray-900 w-32"
                autoFocus
              />
              <button
                onClick={addOra}
                disabled={!oraNoua}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-40"
              >
                Adauga
              </button>
              <button
                onClick={() => { setAddingOra(false); setOraNoua('') }}
                className="px-3 py-1 border border-gray-300 text-xs rounded text-gray-600 hover:bg-gray-50"
              >
                Anuleaza
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-600 mt-3">
          La o ridicare poti alege una din orele de mai sus sau Stoc CT.
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
                  {(furnizor[key as keyof Furnizor] as string) || <span className="text-gray-600">—</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Observatii */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Observatii</h3>
        {editMode ? (
          <textarea
            value={form.observatii ?? ''}
            onChange={e => setForm(f => ({ ...f, observatii: e.target.value || null }))}
            rows={4}
            className="w-full px-3 py-2 border border-blue-400 rounded-lg text-sm text-gray-900 resize-none"
          />
        ) : (
          <p className="text-sm text-gray-900 whitespace-pre-wrap">
            {furnizor.observatii || <span className="text-gray-600">—</span>}
          </p>
        )}
      </div>
    </div>
  )
}
