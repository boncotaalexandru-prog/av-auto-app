import AdminGuard from '@/components/auth/AdminGuard'
import CheltuieliContent from './CheltuieliContent'

export default function CheltuieliPage() {
  return (
    <AdminGuard>
      <CheltuieliContent />
    </AdminGuard>
  )
}
