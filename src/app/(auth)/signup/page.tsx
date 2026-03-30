import Link from 'next/link'
import SignupForm from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Creeaza cont</h1>
          <p className="text-sm text-gray-900 mt-1">AV Auto — Piese Camioane</p>
        </div>
        <SignupForm />
        <p className="text-center text-sm text-gray-900 mt-6">
          Ai deja cont?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            Conecteaza-te
          </Link>
        </p>
      </div>
    </div>
  )
}
