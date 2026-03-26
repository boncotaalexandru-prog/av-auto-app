'use client'

import { useState } from 'react'
import ImportFurnizori from '@/components/furnizori/ImportFurnizori'
import TabelFurnizori from '@/components/furnizori/TabelFurnizori'

export default function FurnizoriPage() {
  const [refresh, setRefresh] = useState(0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Furnizori</h2>
        <ImportFurnizori onDone={() => setRefresh(r => r + 1)} />
      </div>
      <TabelFurnizori refresh={refresh} />
    </div>
  )
}
