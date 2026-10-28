import { redirect } from 'next/navigation'
import { getSetariPublice, getUtilizator } from '@/lib/supabase/utilizator'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { UtilizatorProvider } from '@/components/auth/UtilizatorContext'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [utilizator, settings] = await Promise.all([
    getUtilizator(),
    getSetariPublice(),
  ])

  if (!utilizator) {
    redirect('/login')
  }

  const { profile } = utilizator
  const role = profile?.role ?? 'user'

  return (
    <UtilizatorProvider
      utilizator={{ id: utilizator.id, role, full_name: profile?.full_name ?? null }}
    >
      <div className="flex h-screen bg-gray-100">
        <Sidebar role={role} logoUrl={settings?.logo_url} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header profile={profile} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </UtilizatorProvider>
  )
}
