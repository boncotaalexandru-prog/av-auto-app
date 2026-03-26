'use client'

import { useState } from 'react'
import ImportClienti from '@/components/clienti/ImportClienti'
import TabelClienti from '@/components/clienti/TabelClienti'

export default function ClientiPage() {
  const [refresh, setRefresh] = useState(0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Clienti</h2>
        <ImportClienti onDone={() => setRefresh(r => r + 1)} />
      </div>
      <TabelClienti refresh={refresh} />
    </div>
  )
}
