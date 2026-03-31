'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface KPI {
  ridicariActive: number
  valoareStoc: number
  nrClienti: number
  vanzariLuna: number
}

function formatRON(val: number) {
  return val.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' RON'
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const lunaStart = new Date()
      lunaStart.setDate(1)
      lunaStart.setHours(0, 0, 0, 0)
      const lunaStartStr = lunaStart.toISOString().split('T')[0]

      const [
        { count: ridicariActive },
        { data: stocRows },
        { count: nrClienti },
        { data: facturiLuna },
      ] = await Promise.all([
        supabase.from('ridicari').select('id', { count: 'exact', head: true }).eq('ridicat', false),
        supabase.from('stoc').select('cantitate, pret_achizitie'),
        supabase.from('clienti').select('id', { count: 'exact', head: true }),
        supabase.from('facturi_produse').select('cantitate, pret_vanzare, factura_id, facturi!inner(data_emitere)').gte('facturi.data_emitere', lunaStartStr),
      ])

      const valoareStoc = (stocRows ?? []).reduce((s, r) => s + (r.cantitate ?? 0) * (r.pret_achizitie ?? 0), 0)
      const vanzariLuna = (facturiLuna ?? []).reduce((s, r) => s + (r.cantitate ?? 0) * (r.pret_vanzare ?? 0), 0)

      setKpi({
        ridicariActive: ridicariActive ?? 0,
        valoareStoc,
        nrClienti: nrClienti ?? 0,
        vanzariLuna,
      })
      setLoading(false)
    }
    load()
  }, [])

  const cards = kpi ? [
    {
      label: 'Ridicări active',
      value: kpi.ridicariActive.toString(),
      sub: 'piese de ridicat',
      color: kpi.ridicariActive > 0 ? 'text-orange-600' : 'text-gray-900',
      icon: '📦',
    },
    {
      label: 'Valoare stoc',
      value: formatRON(kpi.valoareStoc),
      sub: 'la preț de achiziție',
      color: 'text-blue-700',
      icon: '🏭',
    },
    {
      label: 'Clienți',
      value: kpi.nrClienti.toString(),
      sub: 'în baza de date',
      color: 'text-gray-900',
      icon: '👥',
    },
    {
      label: 'Vânzări luna curentă',
      value: formatRON(kpi.vanzariLuna),
      sub: new Date().toLocaleString('ro-RO', { month: 'long', year: 'numeric' }),
      color: 'text-green-700',
      icon: '📈',
    },
  ] : []

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-1/2" />
            </div>
          ))
        ) : (
          cards.map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">{card.label}</p>
                <span className="text-xl">{card.icon}</span>
              </div>
              <p className={`text-2xl font-bold ${card.color} mt-1`}>{card.value}</p>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
