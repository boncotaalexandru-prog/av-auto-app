'use client'

import { createContext, useContext } from 'react'
import type { Role } from '@/types'

export interface UtilizatorCurent {
  id: string
  role: Role
  full_name: string | null
}

const UtilizatorContext = createContext<UtilizatorCurent | null>(null)

// Utilizatorul e citit o singura data, pe server, in (dashboard)/layout.tsx.
// Paginile il iau de aici in loc sa mai ceara getUser() + profiles din browser.
export function UtilizatorProvider({
  utilizator,
  children,
}: {
  utilizator: UtilizatorCurent
  children: React.ReactNode
}) {
  return (
    <UtilizatorContext.Provider value={utilizator}>
      {children}
    </UtilizatorContext.Provider>
  )
}

export function useUtilizator() {
  const u = useContext(UtilizatorContext)
  if (!u) throw new Error('useUtilizator() in afara UtilizatorProvider')
  return u
}
