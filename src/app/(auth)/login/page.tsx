import Link from 'next/link'
import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">AV Auto</h1>
          <p className="text-sm text-gray-900 mt-1">Piese Camioane</p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-gray-900 mt-6">
          Nu ai cont?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline font-medium">
            Creeaza cont
          </Link>
        </p>
      </div>
    </div>
  )
}
