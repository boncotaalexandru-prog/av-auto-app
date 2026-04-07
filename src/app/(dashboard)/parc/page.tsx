import AdminGuard from '@/components/auth/AdminGuard'
import ParcContent from './ParcContent'

export default function ParcPage() {
  return (
    <AdminGuard>
      <ParcContent />
    </AdminGuard>
  )
}
