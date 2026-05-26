'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#features',     label: 'Features'     },
  { href: '/#pricing',      label: 'Pricing'      },
  { href: '/about',         label: 'About'        },
]

export function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <nav className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-700 rounded flex items-center justify-center">
            <span className="text-white font-bold text-[10px]">FI</span>
          </div>
          <span className="text-sm font-semibold text-gray-900 tracking-tight">framedInsight</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              {label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-3">
          <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 transition-colors">
            Sign in
          </Link>
          <Link href="/auth/signup" className="text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 rounded-md transition-colors">
            Try free — 14 days
          </Link>
        </div>

        {/* Mobile toggle */}
        <button className="lg:hidden text-gray-600 hover:text-gray-900" onClick={() => setOpen(o => !o)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden border-t border-gray-100 bg-white px-6 py-4 space-y-3">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className="block text-sm text-gray-600 hover:text-gray-900 py-1">
              {label}
            </Link>
          ))}
          <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
            <Link href="/auth/login" onClick={() => setOpen(false)}
              className="text-sm text-gray-600 py-2 text-center border border-gray-200 rounded-md">
              Sign in
            </Link>
            <Link href="/auth/signup" onClick={() => setOpen(false)}
              className="text-sm font-medium text-white bg-emerald-700 py-2 text-center rounded-md">
              Try free — 14 days
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}