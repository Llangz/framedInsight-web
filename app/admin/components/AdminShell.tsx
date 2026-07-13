'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Building2, CreditCard, Users2,
  ActivitySquare, Shield, Menu, X, LogOut, Leaf,
} from 'lucide-react'

interface Props {
  children: React.ReactNode
  role: 'superadmin' | 'support'
}

const NAV_ITEMS = [
  { label: 'Overview',       href: '/admin',               icon: LayoutDashboard },
  { label: 'Farms',          href: '/admin/farms',          icon: Users2         },
  { label: 'Cooperatives',   href: '/admin/cooperatives',   icon: Building2      },
  { label: 'Subscriptions',  href: '/admin/subscriptions',  icon: CreditCard     },
  { label: 'System Health',  href: '/admin/system',         icon: ActivitySquare },
]

// Visual language matches app/dashboard/components/CoopDashboardShell.tsx
// (same #0A0C10 / #0D0F14 / #2A2D35 palette, Outfit font, Lucide icons, same
// sidebar/topbar structure) so admins moving between /dashboard/cooperative
// and /admin don't hit a jarring style seam. This is its own shell rather
// than a mode of DashboardShell/CoopDashboardShell because those two are
// gated by app/dashboard/layout.tsx's coop-officer/farm-status resolver —
// a platform admin is neither, and routing them through that resolver
// would either dead-end at /onboarding or require weakening that layout's
// logic. Living at /admin (not /dashboard/admin) sidesteps that gate
// entirely rather than fighting it.
export default function AdminShell({ children, role }: Props) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const supabase = createClient()
  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const isActive = (href: string) =>
    href === '/admin' ? pathname === href : pathname.startsWith(href)

  return (
    <div className="flex h-screen bg-[#0A0C10] overflow-hidden font-['Outfit'] text-white">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 border-r border-[#2A2D35] bg-[#0D0F14] flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-14 px-5 border-b border-[#2A2D35]">
          <Link href="/admin" className="flex items-center gap-2">
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

        <div className="px-5 py-3.5 border-b border-[#2A2D35] bg-[#0A0C10]/40 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-amber-900/20 border border-amber-800/40 flex items-center justify-center text-amber-400 shrink-0">
            <Shield size={16} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider leading-none">Platform Admin</h4>
            <p className="text-sm font-semibold text-white truncate mt-1 capitalize">{role}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Platform-wide</p>
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
                  ${active ? 'bg-zinc-800/70 text-white border-l-2 border-amber-500' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'}
                `}
              >
                <Icon size={16} className={active ? 'text-amber-500' : 'text-zinc-500'} />
                {item.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-500" />}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-[#2A2D35] p-3 bg-[#0A0C10]/40">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 shrink-0 rounded-full border border-[#2A2D35] bg-zinc-800 flex items-center justify-center">
              <Shield size={14} className="text-zinc-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">Admin session</p>
              <p className="text-[10px] font-medium text-amber-400 capitalize">{role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-zinc-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-900"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0C10]">
        <header
          className="h-14 flex items-center justify-between px-6 border-b border-[#2A2D35] bg-[#0D0F14] shrink-0 transition-[margin-top] duration-200"
          style={{ marginTop: 'var(--connectivity-banner-h, 0px)' }}
        >
          <button className="lg:hidden text-zinc-400 hover:text-white transition-colors" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
          </button>
          <div className="flex-1" />
          <div className="text-xs text-zinc-400 bg-zinc-900 border border-[#2A2D35] px-2.5 py-1 rounded-full font-semibold">
            Internal use only
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#0A0C10]">
          {children}
        </main>
      </div>
    </div>
  )
}
