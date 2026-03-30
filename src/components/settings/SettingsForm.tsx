'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface IbanEntry {
  iban: string
  banca: string
}

interface Settings {
  company_name: string
  address: string
  phone: string
  email: string
  cui: string
  reg_com: string
  logo_url: string
  termen_plata_zile: string
  ibans: IbanEntry[]
  serie_factura: string
  oblio_email: string
  oblio_secret: string
}

const empty: Settings = {
  company_name: '',
  address: '',
  phone: '',
  email: '',
  cui: '',
  reg_com: '',
  logo_url: '',
  termen_plata_zile: '1',
  ibans: [],
  serie_factura: '',
  oblio_email: '',
  oblio_secret: '',
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) {
          // Migreaza iban1/banca1/iban2/banca2 vechi in ibans daca ibans e gol
          let ibans: IbanEntry[] = Array.isArray(data.ibans) ? data.ibans : []
          if (ibans.length === 0) {
            if (data.iban1) ibans.push({ iban: data.iban1, banca: data.banca1 || '' })
            if (data.iban2) ibans.push({ iban: data.iban2, banca: data.banca2 || '' })
          }
          setSettings({
            company_name: data.company_name || '',
            address: data.address || '',
            phone: data.phone || '',
            email: data.email || '',
            cui: data.cui || '',
            reg_com: data.reg_com || '',
            logo_url: data.logo_url || '',
            termen_plata_zile: data.termen_plata_zile?.toString() || '1',
            ibans,
            serie_factura: data.serie_factura || '',
            oblio_email: data.oblio_email || '',
            oblio_secret: data.oblio_secret || '',
          })
        }
        setLoading(false)
      })
  }, [])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage(null)

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setMessage({ type: 'error', text: 'Eroare la upload logo: ' + uploadError.message })
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    const url = `${data.publicUrl}?t=${Date.now()}`
    setSettings((s) => ({ ...s, logo_url: url }))
    setUploading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('settings')
      .update({
        company_name: settings.company_name,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        cui: settings.cui,
        reg_com: settings.reg_com,
        logo_url: settings.logo_url,
        termen_plata_zile: parseInt(settings.termen_plata_zile) || 1,
        ibans: settings.ibans,
        serie_factura: settings.serie_factura,
        oblio_email: settings.oblio_email,
        oblio_secret: settings.oblio_secret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    setSaving(false)
    if (error) {
      setMessage({ type: 'error', text: 'Eroare la salvare: ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'Setarile au fost salvate.' })
      window.location.reload()
    }
  }

  function addIban() {
    setSettings(s => ({ ...s, ibans: [...s.ibans, { iban: '', banca: '' }] }))
  }

  function removeIban(index: number) {
    setSettings(s => ({ ...s, ibans: s.ibans.filter((_, i) => i !== index) }))
  }

  function updateIban(index: number, field: 'iban' | 'banca', value: string) {
    setSettings(s => ({
      ...s,
      ibans: s.ibans.map((entry, i) => i === index ? { ...entry, [field]: value } : entry),
    }))
  }

  if (loading) {
    return <p className="text-gray-900">Se incarca...</p>
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Logo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Logo firma</h3>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt="Logo"
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <span className="text-3xl text-gray-600">🖼</span>
            )}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Se incarca...' : 'Alege logo'}
            </button>
            <p className="text-xs text-gray-600">PNG, JPG sau SVG. Recomandat: fundal transparent.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </div>
      </div>

      {/* Date firma */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Date firma</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'company_name', label: 'Nume firma', placeholder: 'AV Auto SRL' },
            { key: 'cui', label: 'CUI', placeholder: 'RO12345678' },
            { key: 'reg_com', label: 'Nr. Reg. Com.', placeholder: 'J12/123/2020' },
            { key: 'phone', label: 'Telefon', placeholder: '0712 345 678' },
            { key: 'email', label: 'Email firma', placeholder: 'contact@firma.ro' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="text"
                value={settings[key as keyof Omit<Settings, 'ibans'>] as string}
                onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
              />
            </div>
          ))}

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-900 mb-1">Adresa</label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings((s) => ({ ...s, address: e.target.value }))}
              placeholder="Str. Exemplu nr. 1, Cluj-Napoca"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
            />
          </div>

        </div>
      </div>

      {/* IBAN-uri */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Conturi bancare (IBAN)</h3>
          <button
            type="button"
            onClick={addIban}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Adauga IBAN
          </button>
        </div>

        {settings.ibans.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">Niciun cont bancar adaugat. Apasa &quot;+ Adauga IBAN&quot;.</p>
        ) : (
          <div className="space-y-3">
            {settings.ibans.map((entry, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">IBAN</label>
                  <input
                    type="text"
                    value={entry.iban}
                    onChange={e => updateIban(index, 'iban', e.target.value)}
                    placeholder="RO06BTRL..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 font-mono placeholder:text-gray-400"
                  />
                </div>
                <div className="w-48">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Banca</label>
                  <input
                    type="text"
                    value={entry.banca}
                    onChange={e => updateIban(index, 'banca', e.target.value)}
                    placeholder="BANCA TRANSILVANIA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
                  />
                </div>
                <div className="pt-5">
                  <button
                    type="button"
                    onClick={() => removeIban(index)}
                    className="px-2.5 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                    title="Sterge"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Oblio API */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Oblio API</h3>
        <p className="text-xs text-gray-500 mb-4">Credențiale pentru emiterea automată a facturilor în Oblio.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serie factură</label>
            <input
              type="text"
              value={settings.serie_factura}
              onChange={e => setSettings(s => ({ ...s, serie_factura: e.target.value }))}
              placeholder="ex: AVF"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email cont Oblio</label>
            <input
              type="email"
              value={settings.oblio_email}
              onChange={e => setSettings(s => ({ ...s, oblio_email: e.target.value }))}
              placeholder="email@firma.ro"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Secret Oblio</label>
            <input
              type="password"
              value={settings.oblio_secret}
              onChange={e => setSettings(s => ({ ...s, oblio_secret: e.target.value }))}
              placeholder="Cheia API din contul Oblio"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-6 py-2 rounded-lg transition-colors"
        >
          {saving ? 'Se salveaza...' : 'Salveaza setarile'}
        </button>
      </div>
    </form>
  )
}
