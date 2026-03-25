'use client'

import { useState } from 'react'
import ImportProduse from '@/components/produse/ImportProduse'
import TabelProduse from '@/components/produse/TabelProduse'

export default function ProdusePage() {
  const [refresh, setRefresh] = useState(0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Produse</h2>
        <ImportProduse onDone={() => setRefresh(r => r + 1)} />
      </div>
      <TabelProduse refresh={refresh} />
    </div>
  )
}
