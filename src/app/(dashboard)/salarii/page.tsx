import AdminGuard from '@/components/auth/AdminGuard'
import SalariiContent from './SalariiContent'

export default function SalariiPage() {
  return (
    <AdminGuard>
      <SalariiContent />
    </AdminGuard>
  )
}
