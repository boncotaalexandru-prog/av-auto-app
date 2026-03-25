import AdminGuard from '@/components/auth/AdminGuard'

export default function RapoartePage() {
  return (
    <AdminGuard>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Rapoarte</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-gray-500">Rapoarte si statistici — in curand.</p>
        </div>
      </div>
    </AdminGuard>
  )
}
