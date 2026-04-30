import AdminGuard from '@/components/auth/AdminGuard'
import RezultateContent from './RezultateContent'

export default function RezultateLunarePage() {
  return (
    <AdminGuard>
      <RezultateContent />
    </AdminGuard>
  )
}
