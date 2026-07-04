'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutGrid } from 'lucide-react'

export function NavigationFallback() {
  const pathname = usePathname()

  if (!pathname || pathname === '/' || pathname.startsWith('/dashboard')) {
    return null
  }

  const isAuthRoute = pathname.startsWith('/auth')
  const href = isAuthRoute ? '/dashboard' : '/'
  const label = isAuthRoute ? 'Open dashboard' : 'Back home'
  const icon = isAuthRoute ? <LayoutGrid className="h-4 w-4" /> : <Home className="h-4 w-4" />

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-950/30 backdrop-blur transition hover:bg-emerald-500"
      >
        {icon}
        <span>{label}</span>
      </Link>
    </div>
  )
}
