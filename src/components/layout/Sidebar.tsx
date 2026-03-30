'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Role } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: string
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard',        href: '/dashboard',        icon: '⊞' },
  { label: 'Produse',          href: '/produse',          icon: '📦' },
  { label: 'Furnizori',        href: '/furnizori',        icon: '🏭' },
  { label: 'Oferte',           href: '/oferte',           icon: '📋' },
  { label: 'Facturare',        href: '/facturare',        icon: '🧾' },
  { label: 'Marfa de ridicat', href: '/marfa-de-ridicat', icon: '🚛' },
  { label: 'Gestiune',         href: '/gestiune',         icon: '🏪' },
  { label: 'Clienti',          href: '/clienti',          icon: '👥' },
  { label: 'Rapoarte',         href: '/rapoarte',         icon: '📊', adminOnly: true },
  { label: 'Setari',           href: '/setari',           icon: '⚙️', adminOnly: true },
]

export default function Sidebar({
  role,
  logoUrl,
}: {
  role: Role
  logoUrl?: string | null
}) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || role === 'admin'
  )

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="px-5 py-4 border-b border-gray-700 flex items-center gap-3">
        {logoUrl && (
          <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-white/10 flex items-center justify-center">
            <Image
              src={logoUrl}
              alt="Logo"
              width={32}
              height={32}
              className="object-contain w-full h-full"
              unoptimized
            />
          </div>
        )}
        <div>
          <h1 className="text-base font-bold tracking-wide leading-tight">AV Auto</h1>
          <p className="text-xs text-gray-400">Piese Camioane</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
