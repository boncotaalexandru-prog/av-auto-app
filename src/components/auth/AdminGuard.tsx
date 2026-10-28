import { redirect } from 'next/navigation'
import { getUtilizator } from '@/lib/supabase/utilizator'

export default async function AdminGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const utilizator = await getUtilizator()

  if (!utilizator) {
    redirect('/login')
  }

  if (utilizator.profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
