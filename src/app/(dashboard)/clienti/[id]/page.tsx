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
  produs_cod: string | null
  produs_nume: string
  pret_vanzare: number
  updated_at: string
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

  // Preturi speciale — adaugare manuala
  const [addingPret, setAddingPret] = useState(false)
  const [pretForm, setPretForm] = useState({ produs_cod: '', produs_nume: '', pret_vanzare: '' })
  const [prodSearch, setProdSearch] = useState('')
  const [prodResults, setProdResults] = useState<{ id: string; cod: string | null; nume: string }[]>([])
  const [showProdDrop, setShowProdDrop] = useState(false)
  const [savingPret, setSavingPret] = useState(false)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()

    Promise.all([
      supabase.from('clienti').select('*').eq('id', id).single(),
      supabase.from('clienti_masini').select('*').eq('client_id', id).order('created_at'),
      supabase
        .from('clienti_preturi')
        .select('id, produs_cod, produs_nume, pret_vanzare, updated_at')
        .eq('client_id', id)
        .order('produs_nume'),
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

  async function cautaProdus(q: string) {
    setProdSearch(q)
    setPretForm(f => ({ ...f, produs_nume: q, produs_cod: '' }))
    if (q.trim().length < 2) { setProdResults([]); setShowProdDrop(false); return }
    const { data } = await createClient().from('produse')
      .select('id, cod, nume').ilike('nume', `%${q}%`).limit(8)
    setProdResults(data ?? [])
    setShowProdDrop(true)
  }

  function selectProdPret(p: { id: string; cod: string | null; nume: string }) {
    setProdSearch(p.nume)
    setPretForm(f => ({ ...f, produs_cod: p.cod ?? '', produs_nume: p.nume }))
    setProdResults([])
    setShowProdDrop(false)
  }

  async function salvezaPretSpecial() {
    if (!pretForm.produs_nume.trim() || !pretForm.pret_vanzare) return
    setSavingPret(true)
    const supabase = createClient()
    const row = {
      client_id: id,
      produs_cod: pretForm.produs_cod || null,
      produs_nume: pretForm.produs_nume,
      pret_vanzare: parseFloat(pretForm.pret_vanzare),
      updated_at: new Date().toISOString(),
    }
    // delete + insert (upsert cu partial index nu merge in Supabase)
    if (row.produs_cod) {
      await supabase.from('clienti_preturi').delete()
        .eq('client_id', id).eq('produs_cod', row.produs_cod)
    }
    const { data, error } = await supabase.from('clienti_preturi')
      .insert(row)
      .select('id, produs_cod, produs_nume, pret_vanzare, updated_at')
      .single()
    if (error) {
      console.error('[PretSpecial] Eroare save:', error)
      alert('Eroare la salvare: ' + error.message)
      setSavingPret(false)
      return
    }
    if (data) {
      setPreturi(prev => {
        const exists = prev.findIndex(x => data.produs_cod && x.produs_cod === data.produs_cod)
        if (exists >= 0) { const n = [...prev]; n[exists] = data as PretSpecial; return n }
        return [...prev, data as PretSpecial]
      })
    }
    setPretForm({ produs_cod: '', produs_nume: '', pret_vanzare: '' })
    setProdSearch('')
    setAddingPret(false)
    setSavingPret(false)
  }

  if (loading) return <p className="text-sm text-gray-900 p-6">Se incarca...</p>
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
              <p className="text-xs text-gray-900 mb-0.5">{FIELD_LABELS[key]}</p>
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
            <p className="text-xs text-gray-900 mb-1">Contract</p>
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
                client.are_contract ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-900'
              }`}>
                {client.are_contract ? 'Da — contract activ' : 'Nu'}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-900 mb-1">Termen plata (zile)</p>
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
            <p className="text-xs text-gray-900 mb-1">Observatii</p>
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
          <div className="mb-4 p-4 border border-blue-200 rounded-lg bg-blue-50 space-y-3">
            <div className="flex gap-3">
              <div>
                <p className="text-xs font-medium text-gray-800 mb-1">Nr. inmatriculare</p>
                <input
                  type="text"
                  value={masinaNoua.nr_inmatriculare}
                  onChange={e => setMasinaNoua(m => ({ ...m, nr_inmatriculare: e.target.value.toUpperCase() }))}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm w-36 text-gray-900"
                  placeholder="B 123 ABC"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-800 mb-1">Marca / Model</p>
                <input
                  type="text"
                  value={masinaNoua.marca}
                  onChange={e => setMasinaNoua(m => ({ ...m, marca: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm w-44 text-gray-900"
                  placeholder="ex: Dacia Logan"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-800 mb-1">Serie sasiu / VIN (optional)</p>
                <input
                  type="text"
                  value={masinaNoua.vin}
                  onChange={e => setMasinaNoua(m => ({ ...m, vin: e.target.value.toUpperCase() }))}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm w-full font-mono text-gray-900"
                  placeholder="ex: WDB9634031L..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addMasina} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                Salveaza
              </button>
              <button onClick={() => setAddingMasina(false)} className="px-4 py-1.5 border border-gray-300 text-sm rounded text-gray-700 hover:bg-gray-50">
                Anuleaza
              </button>
            </div>
          </div>
        )}

        {masini.length === 0 ? (
          <p className="text-sm text-gray-600">Nicio masina inregistrata.</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {masini.map(m => (
              <div key={m.id} className="py-3 flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-gray-900 w-32 shrink-0">{m.nr_inmatriculare || '—'}</span>
                <span className="text-sm text-gray-900 w-44 shrink-0">{m.marca || '—'}</span>
                {m.vin && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm text-gray-900">{m.vin}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(m.vin!)}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded p-1 transition-colors"
                      title="Copiaza VIN"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                  </div>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => deleteMasina(m.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Sterge
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preturi speciale */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Prețuri speciale</h3>
            {preturi.length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{preturi.length} produse</span>
            )}
          </div>
          <button
            onClick={() => setAddingPret(v => !v)}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg text-white"
            style={{ backgroundColor: addingPret ? '#6b7280' : '#7c3aed' }}
          >
            {addingPret ? '✕ Anulează' : '+ Adaugă preț'}
          </button>
        </div>

        {/* Form adaugare manuala */}
        {addingPret && (
          <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
            <p className="text-xs font-semibold text-purple-800 uppercase tracking-wide">Adaugă preț special manual</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">Produs</label>
                <input
                  type="text"
                  value={prodSearch}
                  onChange={e => cautaProdus(e.target.value)}
                  placeholder="Caută produs..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {showProdDrop && prodResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {prodResults.map(p => (
                      <button key={p.id} onClick={() => selectProdPret(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 border-b border-gray-100 last:border-0">
                        <span className="font-medium text-gray-900">{p.nume}</span>
                        {p.cod && <span className="text-gray-500 ml-2 font-mono text-xs">{p.cod}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Preț vânzare (RON, fără TVA)</label>
                <input
                  type="number" min={0} step={0.01}
                  value={pretForm.pret_vanzare}
                  onChange={e => setPretForm(f => ({ ...f, pret_vanzare: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={salvezaPretSpecial}
                disabled={savingPret || !pretForm.produs_nume.trim() || !pretForm.pret_vanzare}
                className="px-4 py-2 text-white text-sm font-semibold rounded-lg"
                style={{ backgroundColor: (savingPret || !pretForm.produs_nume.trim() || !pretForm.pret_vanzare) ? '#9ca3af' : '#7c3aed' }}
              >
                {savingPret ? 'Se salvează...' : '✓ Salvează preț'}
              </button>
            </div>
          </div>
        )}

        {preturi.length === 0 && !addingPret ? (
          <p className="text-sm text-gray-500 italic">Niciun preț special setat. Folosește butonul <strong className="text-gray-700">+ Adaugă preț</strong> pentru a seta un preț special pentru acest client.</p>
        ) : preturi.length > 0 ? (
          <div className="divide-y divide-gray-200">
            <div className="grid grid-cols-12 gap-2 pb-2 text-xs font-bold text-gray-600 uppercase tracking-wide">
              <span className="col-span-2">Cod</span>
              <span className="col-span-6">Produs</span>
              <span className="col-span-2 text-right">Preț special</span>
              <span className="col-span-1 text-right">Actualizat</span>
              <span className="col-span-1"></span>
            </div>
            {preturi.map(p => (
              <div key={p.id} className="grid grid-cols-12 gap-2 py-3 items-center" style={{ color: '#111827' }}>
                <span className="col-span-2 font-mono text-xs font-semibold" style={{ color: '#374151' }}>{p.produs_cod || '—'}</span>
                <span className="col-span-6 text-sm font-semibold" style={{ color: '#111827' }}>{p.produs_nume}</span>
                <span className="col-span-2 text-right text-sm font-bold" style={{ color: '#6d28d9' }}>{p.pret_vanzare.toFixed(2)} RON</span>
                <span className="col-span-1 text-right text-xs font-medium" style={{ color: '#374151' }}>{new Date(p.updated_at).toLocaleDateString('ro-RO')}</span>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={async () => {
                      await createClient().from('clienti_preturi').delete().eq('id', p.id)
                      setPreturi(prev => prev.filter(x => x.id !== p.id))
                    }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Șterge
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
