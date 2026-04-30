'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Role } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: string
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard',        href: '/dashboard',        icon: '⊞' },
  { label: 'Facturare',        href: '/facturare',        icon: '🧾' },
  { label: 'Oferte',           href: '/oferte',           icon: '📋' },
  { label: 'Marfa de ridicat', href: '/marfa-de-ridicat', icon: '🚛' },
  { label: 'Gestiune',         href: '/gestiune',         icon: '🏪' },
  { label: 'Clienti',          href: '/clienti',          icon: '👥' },
  { label: 'Produse',          href: '/produse',          icon: '📦' },
  { label: 'Echivalente',      href: '/echivalente',      icon: '🔄' },
  { label: 'Furnizori',        href: '/furnizori',        icon: '🏭' },
  { label: 'Încasări',         href: '/incasari',         icon: '💰', adminOnly: true },
  { label: 'Rapoarte',         href: '/rapoarte',         icon: '📊', adminOnly: true },
  { label: 'Cheltuieli',       href: '/cheltuieli',       icon: '💸', adminOnly: true },
  { label: 'Parc Auto',        href: '/parc',             icon: '🚛', adminOnly: true },
  { label: 'Salarii',          href: '/salarii',          icon: '👥', adminOnly: true },
  { label: 'Discounturi',      href: '/discounturi',      icon: '🏷️', adminOnly: true },
  { label: 'Rezultate Lunare', href: '/rezultate-lunare', icon: '📈', adminOnly: true },
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
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || role === 'admin'
  )

  return (
    <aside
      className="bg-gray-900 text-white flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out"
      style={{ width: collapsed ? '64px' : '224px' }}
    >
      {/* Header */}
      <div className="px-3 py-4 border-b border-gray-700 flex items-center gap-3 overflow-hidden">
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
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-wide leading-tight whitespace-nowrap">AV Auto</h1>
            <p className="text-xs text-gray-400 whitespace-nowrap">Piese Camioane</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-hidden">
        {visibleItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Toggle button */}
      <div className="px-2 pb-4 border-t border-gray-700 pt-3">
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Extinde meniul' : 'Strânge meniul'}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {!collapsed && <span className="whitespace-nowrap">Strânge</span>}
        </button>
      </div>
    </aside>
  )
}
