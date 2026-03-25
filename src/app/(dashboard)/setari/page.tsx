import AdminGuard from '@/components/auth/AdminGuard'
import SettingsForm from '@/components/settings/SettingsForm'

export default function SetariPage() {
  return (
    <AdminGuard>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Setari firma</h2>
        <SettingsForm />
      </div>
    </AdminGuard>
  )
}
