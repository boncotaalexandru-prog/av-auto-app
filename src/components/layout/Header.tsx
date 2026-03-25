import { logout } from '@/app/actions/auth'
import type { Profile } from '@/types'

export default function Header({ profile }: { profile: Profile | null }) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">
            {profile?.full_name ?? profile?.email ?? 'Utilizator'}
          </p>
          <p className="text-xs text-gray-500 capitalize">{profile?.role ?? 'user'}</p>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            Deconectare
          </button>
        </form>
      </div>
    </header>
  )
}
