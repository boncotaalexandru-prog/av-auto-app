'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cuiAfisat, cuiValid, curataCui, MESAJ_CUI_INCORECT, type AnafStare, type DateAnaf } from '@/lib/anaf'
import EticheteAnaf from './EticheteAnaf'

interface Sugestie { id: string; denumire: string; cod_fiscal: string | null; platitor_tva: boolean | null; localitate: string | null }

const GOL = {
  denumire: '', adresa: '', reg_com: '', judet: '', localitate: '', strada: '', numar: '', cod_postal: '',
  telefon: '', email: '', pers_contact: '',
}
type Form = typeof GOL

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-900 mb-1'

export default function ClientNou({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [deschis, setDeschis] = useState(false)
  const [cui, setCui] = useState('')
  const [form, setForm] = useState<Form>(GOL)
  const [stare, setStare] = useState<AnafStare | null>(null)
  const [platitorTva, setPlatitorTva] = useState<boolean | null>(null)
  const [existent, setExistent] = useState<{ id: string; denumire: string } | null>(null)
  const [verificand, setVerificand] = useState(false)
  const [salvand, setSalvand] = useState(false)
  const [eroare, setEroare] = useState('')
  const [sugestii, setSugestii] = useState<Sugestie[]>([])
  const [focus, setFocus] = useState<'cui' | 'denumire' | null>(null)

  const termen = focus === 'cui' ? curataCui(cui) : focus === 'denumire' ? form.denumire.trim() : ''

  // Sugestii din clienții existenți (max 8) cât timp se scrie CUI-ul sau numele
  useEffect(() => {
    const t = termen.replace(/[,()%*]/g, '')
    if (t.length < 2) return
    const timer = setTimeout(async () => {
      const { data } = await createClient()
        .from('clienti')
        .select('id, denumire, cod_fiscal, platitor_tva, localitate')
        .or(`denumire.ilike.%${t}%,cod_fiscal.ilike.%${t}%`)
        .order('denumire')
        .limit(8)
      setSugestii(data ?? [])
    }, 250)
    return () => clearTimeout(timer)
  }, [termen])

  function reset() {
    setCui(''); setForm(GOL); setStare(null); setPlatitorTva(null); setExistent(null)
    setEroare(''); setSugestii([])
  }

  function umple(d: DateAnaf) {
    setForm(f => ({
      ...f,
      denumire: d.denumire, adresa: d.adresa, reg_com: d.reg_com, judet: d.judet, localitate: d.localitate,
      strada: d.strada, numar: d.numar, cod_postal: d.cod_postal,
    }))
    setPlatitorTva(d.platitor_tva)
  }

  async function verifica() {
    setEroare(''); setStare(null); setExistent(null); setPlatitorTva(null)
    if (!cuiValid(cui)) { setEroare(MESAJ_CUI_INCORECT); return }
    setVerificand(true)
    try {
      const res = await fetch('/api/anaf/verifica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cui }),
      })
      const data = await res.json()
      if (data.stare === 'invalid') { setEroare(data.mesaj); return }
      setStare(data.stare)
      setExistent(data.clientExistent ?? null)
      if (data.date) umple(data.date)
      if (data.stare === 'eroare') setEroare(data.mesaj ?? 'ANAF nu a răspuns.')
    } catch {
      setStare('eroare'); setEroare('ANAF nu a răspuns. Încercați din nou peste câteva minute.')
    } finally {
      setVerificand(false)
    }
  }

  async function salveaza() {
    setEroare('')
    if (!cuiValid(cui)) { setEroare(MESAJ_CUI_INCORECT); return }
    setSalvand(true)
    try {
      const res = await fetch('/api/clienti/salveaza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cui, ...form }),
      })
      const data = await res.json()
      if (!res.ok) { setEroare(data.error ?? 'Salvare eșuată'); return }
      setDeschis(false); reset(); onDone()
      router.push(`/clienti/${data.client.id}`)
    } catch (e) {
      setEroare(`Salvare eșuată: ${String(e)}`)
    } finally {
      setSalvand(false)
    }
  }

  const dinAnaf = stare === 'activa' || stare === 'inactiva'
  const potSalva = stare !== null && stare !== 'inexistent' && (dinAnaf || form.denumire.trim() !== '')
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  if (!deschis) {
    return (
      <button
        onClick={() => setDeschis(true)}
        className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + Client nou
      </button>
    )
  }

  const listaSugestii = focus && termen.length >= 2 && sugestii.length > 0 && (
    <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
      <p className="px-3 py-1.5 text-xs font-medium text-gray-800 bg-gray-50 border-b border-gray-200">Clienți existenți</p>
      {sugestii.map(s => (
        <button
          key={s.id}
          type="button"
          onMouseDown={() => router.push(`/clienti/${s.id}`)}
          className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 flex justify-between gap-3"
        >
          <span className="font-medium truncate">{s.denumire}</span>
          <span className="font-mono text-xs shrink-0">{cuiAfisat(s.cod_fiscal, s.platitor_tva)}{s.localitate ? ` · ${s.localitate}` : ''}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Client nou (firmă)</h3>
          <button
            onClick={() => { setDeschis(false); reset() }}
            className="text-gray-900 hover:bg-gray-100 text-xl w-8 h-8 flex items-center justify-center rounded"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className={labelCls}>CUI firmă</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="flex items-stretch border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                  {platitorTva !== false && (
                    <span className="px-3 flex items-center text-sm font-mono font-semibold text-gray-900 bg-gray-100 border-r border-gray-300 rounded-l-lg">RO</span>
                  )}
                  <input
                    value={cui}
                    onChange={e => { setCui(e.target.value); setStare(null); setPlatitorTva(null); setEroare('') }}
                    onFocus={() => setFocus('cui')}
                    onBlur={() => setTimeout(() => setFocus(null), 150)}
                    onKeyDown={e => { if (e.key === 'Enter') verifica() }}
                    placeholder="ex: 12345678"
                    inputMode="numeric"
                    className="flex-1 px-3 py-2 text-sm text-gray-900 font-mono placeholder:text-gray-500 focus:outline-none rounded-r-lg"
                  />
                </div>
                {focus === 'cui' && listaSugestii}
              </div>
              <button
                onClick={verifica}
                disabled={verificand || !cui.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {verificand ? 'Verific…' : 'Verifică la ANAF'}
              </button>
            </div>
          </div>

          <div className="relative">
            <label className={labelCls}>Denumire</label>
            <input
              value={form.denumire} onChange={set('denumire')} readOnly={dinAnaf}
              onFocus={() => setFocus('denumire')} onBlur={() => setTimeout(() => setFocus(null), 150)}
              placeholder={stare ? '' : 'Se completează de la ANAF (sau scrieți ca să căutați un client existent)'}
              className={`${inputCls} ${dinAnaf ? 'bg-gray-50' : ''}`}
            />
            {focus === 'denumire' && !dinAnaf && listaSugestii}
          </div>

          {eroare && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-line">{eroare}</p>
          )}

          {stare && (
            <div className="flex items-center gap-2 flex-wrap">
              <EticheteAnaf stare={stare} platitorTva={platitorTva} />
              {dinAnaf && <span className="text-xs font-mono text-gray-900">CUI: {cuiAfisat(cui, platitorTva)}</span>}
            </div>
          )}

          {stare === 'inactiva' && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Firma e inactivă sau radiată la ANAF. O puteți salva, dar nu i se pot emite facturi.
            </p>
          )}
          {stare === 'inexistent' && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ANAF nu cunoaște acest CUI. Clientul nu poate fi salvat.
            </p>
          )}

          {existent && (
            <p className="text-sm text-gray-900 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              Clientul există deja: <strong>{existent.denumire}</strong>.{' '}
              <button onClick={() => router.push(`/clienti/${existent.id}`)} className="text-blue-700 underline font-medium">Deschide fișa</button>
              {' '}— la salvare se actualizează.
            </p>
          )}

          {stare && stare !== 'inexistent' && (
            <>
              <div>
                <label className={labelCls}>Adresă</label>
                <input value={form.adresa} onChange={set('adresa')} readOnly={dinAnaf} className={`${inputCls} ${dinAnaf ? 'bg-gray-50' : ''}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['reg_com', 'Nr. Reg. Com.'], ['cod_postal', 'Cod poștal'],
                  ['judet', 'Județ'], ['localitate', 'Localitate'],
                  ['strada', 'Stradă'], ['numar', 'Număr'],
                ] as [keyof Form, string][]).map(([k, l]) => (
                  <div key={k}>
                    <label className={labelCls}>{l}</label>
                    <input value={form[k]} onChange={set(k)} readOnly={dinAnaf} className={`${inputCls} ${dinAnaf ? 'bg-gray-50' : ''}`} />
                  </div>
                ))}
              </div>
              {dinAnaf && <p className="text-xs text-gray-800">Datele firmei vin de la ANAF și nu se modifică manual.</p>}

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                <div>
                  <label className={labelCls}>Telefon</label>
                  <input value={form.telefon} onChange={set('telefon')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input value={form.email} onChange={set('email')} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Persoană de contact</label>
                  <input value={form.pers_contact} onChange={set('pers_contact')} className={inputCls} />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 pb-6 pt-2">
          <button
            onClick={salveaza}
            disabled={!potSalva || salvand}
            className="w-full py-3 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-lg disabled:opacity-40 transition-colors"
          >
            {salvand ? 'Se salvează…' : existent ? 'Actualizează clientul' : 'Salvează clientul'}
          </button>
        </div>
      </div>
    </div>
  )
}
