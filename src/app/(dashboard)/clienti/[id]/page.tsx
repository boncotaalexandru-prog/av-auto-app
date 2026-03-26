'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Client {
  id: string
  denumire: string
  cod_fiscal: string | null
  reg_com: string | null
  cod_client: string | null
  adresa: string | null
  localitate: string | null
  judet: string | null
  banca: string | null
  iban: string | null
  tara: string | null
  email: string | null
  pers_contact: string | null
  telefon: string | null
  are_contract: boolean
  termen_plata: number | null
  observatii: string | null
}

interface Masina {
  id: string
  nr_inmatriculare: string | null
  marca: string | null
  vin: string | null
}

interface PretSpecial {
  id: string
  pret: number
  produse: { cod: string | null; nume: string } | null
}

const FIELD_LABELS: Record<string, string> = {
  cod_fiscal: 'Cod fiscal',
  reg_com: 'Reg. com.',
  cod_client: 'Cod client',
  adresa: 'Adresa',
  localitate: 'Localitate',
  judet: 'Judet',
  banca: 'Banca',
  iban: 'IBAN',
  tara: 'Tara',
  email: 'Email',
  pers_contact: 'Persoana contact',
  telefon: 'Telefon',
}

export default function ClientPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [masini, setMasini] = useState<Masina[]>([])
  const [preturi, setPreturi] = useState<PretSpecial[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Partial<Client>>({})

  // Parc auto state
  const [masinaNoua, setMasinaNoua] = useState({ nr_inmatriculare: '', marca: '', vin: '' })
  const [addingMasina, setAddingMasina] = useState(false)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()

    Promise.all([
      supabase.from('clienti').select('*').eq('id', id).single(),
      supabase.from('clienti_masini').select('*').eq('client_id', id).order('created_at'),
      supabase
        .from('clienti_preturi')
        .select('id, pret, produse(cod, nume)')
        .eq('client_id', id)
        .order('created_at'),
    ]).then(([{ data: c }, { data: m }, { data: p }]) => {
      setClient(c)
      setForm(c ?? {})
      setMasini(m ?? [])
      setPreturi((p as PretSpecial[]) ?? [])
      setLoading(false)
    })
  }, [id])

  async function saveClient() {
    if (!client) return
    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('clienti')
      .update({
        ...form,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)
      .select()
      .single()
    if (data) { setClient(data); setForm(data) }
    setSaving(false)
    setEditMode(false)
  }

  async function addMasina() {
    if (!masinaNoua.nr_inmatriculare.trim() && !masinaNoua.marca.trim()) return
    const supabase = createClient()
    const { data } = await supabase
      .from('clienti_masini')
      .insert({ client_id: id, ...masinaNoua })
      .select()
      .single()
    if (data) setMasini(prev => [...prev, data])
    setMasinaNoua({ nr_inmatriculare: '', marca: '', vin: '' })
    setAddingMasina(false)
  }

  async function deleteMasina(masinaId: string) {
    const supabase = createClient()
    await supabase.from('clienti_masini').delete().eq('id', masinaId)
    setMasini(prev => prev.filter(m => m.id !== masinaId))
  }

  if (loading) return <p className="text-sm text-gray-500 p-6">Se incarca...</p>
  if (!client) return <p className="text-sm text-red-600 p-6">Clientul nu a fost gasit.</p>

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/clienti')} className="text-gray-600 hover:text-gray-600 text-sm">
          ← Inapoi
        </button>
        <h2 className="text-2xl font-bold text-gray-900 flex-1">{client.denumire}</h2>
        {!editMode ? (
          <button
            onClick={() => setEditMode(true)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Editeaza
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setEditMode(false); setForm(client) }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Anuleaza
            </button>
            <button
              onClick={saveClient}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? 'Se salveaza...' : 'Salveaza'}
            </button>
          </div>
        )}
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
                  value={(form[key as keyof Client] as string) ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
                  className="w-full px-2 py-1 border border-blue-400 rounded text-sm text-gray-900"
                />
              ) : (
                <p className="text-sm text-gray-900">{(client[key as keyof Client] as string) || <span className="text-gray-600">—</span>}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Card comercial */}
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
                client.are_contract ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {client.are_contract ? 'Da — contract activ' : 'Nu'}
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
                {client.termen_plata ? `${client.termen_plata} zile` : <span className="text-gray-600">—</span>}
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
                {client.observatii || <span className="text-gray-600">—</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Parc auto */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Parc auto</h3>
          <button
            onClick={() => setAddingMasina(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            + Adauga masina
          </button>
        </div>

        {addingMasina && (
          <div className="mb-4 p-3 border border-blue-200 rounded-lg bg-blue-50 flex gap-3 items-end">
            <div>
              <p className="text-xs text-gray-500 mb-1">Nr. inmatriculare</p>
              <input
                type="text"
                value={masinaNoua.nr_inmatriculare}
                onChange={e => setMasinaNoua(m => ({ ...m, nr_inmatriculare: e.target.value.toUpperCase() }))}
                className="px-2 py-1 border border-gray-300 rounded text-sm w-36"
                placeholder="B 123 ABC"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Marca / Model</p>
              <input
                type="text"
                value={masinaNoua.marca}
                onChange={e => setMasinaNoua(m => ({ ...m, marca: e.target.value }))}
                className="px-2 py-1 border border-gray-300 rounded text-sm w-40"
                placeholder="ex: Dacia Logan"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">VIN (optional)</p>
              <input
                type="text"
                value={masinaNoua.vin}
                onChange={e => setMasinaNoua(m => ({ ...m, vin: e.target.value.toUpperCase() }))}
                className="px-2 py-1 border border-gray-300 rounded text-sm w-48 font-mono"
                placeholder="VIN..."
              />
            </div>
            <button onClick={addMasina} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
              Salveaza
            </button>
            <button onClick={() => setAddingMasina(false)} className="px-3 py-1.5 border border-gray-300 text-sm rounded text-gray-600 hover:bg-gray-50">
              Anuleaza
            </button>
          </div>
        )}

        {masini.length === 0 ? (
          <p className="text-sm text-gray-600">Nicio masina inregistrata.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {masini.map(m => (
              <div key={m.id} className="py-2.5 flex items-center gap-4">
                <span className="font-mono text-sm font-semibold text-gray-900 w-32">{m.nr_inmatriculare || '—'}</span>
                <span className="text-sm text-gray-600 flex-1">{m.marca || '—'}</span>
                {m.vin && <span className="font-mono text-xs text-gray-600">{m.vin}</span>}
                <button
                  onClick={() => deleteMasina(m.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Sterge
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preturi speciale */}
      {preturi.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Preturi speciale</h3>
          <div className="divide-y divide-gray-100">
            {preturi.map(p => (
              <div key={p.id} className="py-2.5 flex items-center gap-4">
                {p.produse && (
                  <>
                    <span className="font-mono text-xs text-gray-600 w-24">{p.produse.cod || '—'}</span>
                    <span className="text-sm text-gray-900 flex-1">{p.produse.nume}</span>
                  </>
                )}
                <span className="text-sm font-semibold text-blue-700">{p.pret} RON</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
