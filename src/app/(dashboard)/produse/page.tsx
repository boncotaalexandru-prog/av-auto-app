'use client'

import { useState } from 'react'
import ImportProduse from '@/components/produse/ImportProduse'
import TabelProduse from '@/components/produse/TabelProduse'
import ProdusNouModal from '@/components/produse/ProdusNouModal'

export default function ProdusePage() {
  const [refresh, setRefresh] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Produse</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Produs nou
          </button>
          <ImportProduse onDone={() => setRefresh(r => r + 1)} />
        </div>
      </div>
      <TabelProduse refresh={refresh} />
      <ProdusNouModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); setRefresh(r => r + 1) }}
      />
    </div>
  )
}
