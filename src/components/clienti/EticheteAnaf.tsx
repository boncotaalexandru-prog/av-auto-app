import type { AnafStare } from '@/lib/anaf'

const STARE: Record<AnafStare, { text: string; cls: string }> = {
  activa:      { text: 'Activă',             cls: 'bg-green-100 text-green-800' },
  inactiva:    { text: 'INACTIVĂ',           cls: 'bg-red-100 text-red-800' },
  inexistent:  { text: 'CUI inexistent',     cls: 'bg-red-100 text-red-800' },
  eroare:      { text: 'ANAF nu a răspuns',  cls: 'bg-yellow-100 text-yellow-900' },
  neverificat: { text: 'Neverificat',        cls: 'bg-gray-200 text-gray-900' },
}

export default function EticheteAnaf({ stare, platitorTva }: { stare: AnafStare | null | undefined; platitorTva?: boolean | null }) {
  const s = STARE[stare ?? 'neverificat'] ?? STARE.neverificat
  const arataTva = stare === 'activa' || stare === 'inactiva'
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.text}</span>
      {arataTva && platitorTva === true && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Plătitor TVA</span>
      )}
      {arataTva && platitorTva === false && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-900">Neplătitor TVA</span>
      )}
      {arataTva && platitorTva == null && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-900">TVA necunoscut</span>
      )}
    </span>
  )
}
