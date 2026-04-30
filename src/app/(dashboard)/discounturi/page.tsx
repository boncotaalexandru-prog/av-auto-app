import AdminGuard from '@/components/auth/AdminGuard'
import DiscounturiContent from './DiscounturiContent'

export default function DiscounturiPage() {
  return (
    <AdminGuard>
      <DiscounturiContent />
    </AdminGuard>
  )
}
