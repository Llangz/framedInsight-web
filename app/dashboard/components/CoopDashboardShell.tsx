'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, MapPin, Warehouse, FileCheck,
  Settings, User, Bell, Menu, X, LogOut, Leaf, Building2,
  Coffee, ClipboardList, Scale
} from 'lucide-react'

interface Props {
  children: React.ReactNode
  coopName: string
}

const NAV_ITEMS = [
  { label: 'Overview',         href: '/dashboard/cooperative',                icon: LayoutDashboard },
  { label: 'Member Farms',     href: '/dashboard/cooperative/farmers',        icon: Users           },
  { label: 'Map a Farmer',     href: '/dashboard/cooperative/farmers/new',    icon: MapPin          },
  { label: 'Washing Stations', href: '/dashboard/cooperative/factories',      icon: Warehouse       },
  { label: 'Factory Intake',   href: '/dashboard/cooperative/intake',         icon: ClipboardList   },
  { label: 'EUDR Compliance',  href: '/dashboard/cooperative/eudr',           icon: FileCheck       },
  { label: 'Legal Compliance', href: '/dashboard/cooperative/legality',       icon: Scale           },
  { label: 'Coffee Passports', href: '/dashboard/cooperative/passports',      icon: Coffee          },
]

export default function CoopDashboardShell({ children, coopName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const supabase = createClient()
  const handleLogout = async () => {
    await supabase.auth.signOut()
    // See DashboardShell.tsx for why this is a hard navigation, not
    // router.push() — avoids serving stale cached dashboard content on
    // browser Back after logout.
    window.location.href = '/auth/login'
  }

  const isActive = (href: string) => {
    if (href === '/dashboard/cooperative') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen bg-[#0A0C10] overflow-hidden font-['Outfit'] text-white">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 z-40 lg:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 border-r border-[#2A2D35] bg-[#0D0F14] flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-5 border-b border-[#2A2D35]">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded border border-emerald-800 bg-emerald-950/30">
              <Leaf size={13} className="text-emerald-500" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">
              framed<span className="text-emerald-500">Insight</span>
            </span>
          </Link>
          <button className="lg:hidden text-zinc-500 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* Info header */}
        <div className="px-5 py-3.5 border-b border-[#2A2D35] bg-[#0A0C10]/40 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-900/20 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Building2 size={16} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider leading-none">Cooperative</h4>
            <p className="text-sm font-semibold text-white truncate mt-1">{coopName}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Consolidated Fleet</p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${active ? 'bg-zinc-800/70 text-white border-l-2 border-emerald-500' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'}
                `}
              >
                <Icon size={16} className={active ? 'text-emerald-500' : 'text-zinc-500'} />
                {item.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              </Link>
            )
          })}
        </nav>

        {/* User menu */}
        <div className="border-t border-[#2A2D35] p-3 bg-[#0A0C10]/40">
          <div className="relative">
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-zinc-900/60 transition-colors"
              onClick={() => setShowUserMenu(v => !v)}
            >
              <div className="h-8 w-8 shrink-0 rounded-full border border-[#2A2D35] bg-zinc-800 flex items-center justify-center">
                <User size={14} className="text-zinc-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">Society Manager</p>
                <p className="text-[10px] font-medium text-emerald-400">Institutional Plan</p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-[#2A2D35] bg-[#0D0F14] py-1 shadow-2xl z-[100]">
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <Settings size={13} /> Account settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-zinc-800 transition-colors"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0C10]">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-[#2A2D35] bg-[#0D0F14] shrink-0">
          <button className="lg:hidden text-zinc-400 hover:text-white transition-colors" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-xs text-zinc-400 bg-zinc-900 border border-[#2A2D35] px-2.5 py-1 rounded-full font-semibold">
              EUDR Portal Ready (v1.2)
            </div>
            <button className="relative text-zinc-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-900">
              <Bell size={16} />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#0A0C10]">
          {children}
        </main>
      </div>
    </div>
  )
}