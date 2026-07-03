'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Milk, Coffee, Rabbit, Bird,
  Settings, User, Bell, Menu, X, LogOut, Leaf,
  CreditCard, AlertTriangle, Lock,
} from 'lucide-react'
import SubscriptionBanner from './SubscriptionBanner'
import PaywallGate from './PaywallGate'
import type { SubscriptionInfo } from '@/lib/subscription'

interface Props {
  children: React.ReactNode
  farmName: string
  farmId: string
  subInfo: SubscriptionInfo
}

const NAV_ITEMS = [
  { label: 'Dashboard',      href: '/dashboard',                icon: LayoutDashboard },
  { label: 'Dairy',          href: '/dashboard/dairy',          icon: Milk            },
  { label: 'Coffee',         href: '/dashboard/coffee',         icon: Coffee          },
  { label: 'SmallRuminants', href: '/dashboard/smallRuminants', icon: Rabbit          },
  { label: 'Poultry',        href: '/dashboard/poultry',        icon: Bird            },
  { label: 'Billing',        href: '/dashboard/billing',        icon: CreditCard      },
  { label: 'Settings',       href: '/dashboard/settings',       icon: Settings        },
]

// Routes that are always accessible regardless of subscription status
const FREE_ROUTES = ['/dashboard/billing', '/dashboard/settings', '/dashboard']

export default function DashboardShell({ children, farmName, farmId, subInfo }: Props) {
  const pathname    = usePathname()
  const router      = useRouter()
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const supabase = createClient()
  const handleLogout = async () => {
    await supabase.auth.signOut()
    // Hard navigation, not router.push(). router.push() is a soft
    // client-side transition that leaves the Next.js Router Cache (and
    // potentially the browser's bfcache) holding the previous, now-stale
    // authenticated render — pressing Back after logout could briefly
    // flash cached dashboard content before a fresh unauthenticated
    // request lands. window.location.href forces a full reload, which
    // discards all client-side cache along with the session.
    window.location.href = '/auth/login'
  }

  const isActive   = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  const isExpired  = subInfo.status === 'expired'
  const isFreeRoute = FREE_ROUTES.some(r => pathname === r || pathname.startsWith(r))

  // Tier badge color
  const tierBadge = {
    active:  'text-emerald-400',
    trial:   'text-amber-400',
    grace:   'text-orange-400',
    expired: 'text-red-400',
    free:    'text-zinc-500',
  }[subInfo.status] ?? 'text-zinc-500'

  const tierLabel = {
    active:  'Pro',
    trial:   `Trial · ${subInfo.trialDaysRemaining}d`,
    grace:   'Grace',
    expired: 'Expired',
    free:    'Free',
  }[subInfo.status] ?? 'Free'

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden font-['Outfit']">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-5 border-b border-zinc-800">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded border border-zinc-700 bg-zinc-900">
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

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Operations</p>
          {NAV_ITEMS.map((item) => {
            const Icon   = item.icon
            const active = isActive(item.href)
            const locked = isExpired && !FREE_ROUTES.some(r => item.href === r || item.href.startsWith(r))
            return (
              <Link
                key={item.href}
                href={locked ? '/dashboard/billing' : item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${active ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}
                  ${locked ? 'opacity-50' : ''}
                `}
              >
                <Icon size={15} className={active ? 'text-emerald-500' : locked ? 'text-zinc-700' : 'text-zinc-600'} />
                {item.label}
                {locked && <Lock size={11} className="ml-auto text-zinc-700" />}
                {active && !locked && <span className="ml-auto h-1 w-1 rounded-full bg-emerald-500" />}
              </Link>
            )
          })}
        </nav>

        {/* User menu */}
        <div className="border-t border-zinc-800 p-3">
          {/* Expired warning strip */}
          {isExpired && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <AlertTriangle size={12} className="text-red-400 shrink-0" />
              <p className="text-[10px] text-red-300 font-medium leading-tight">Subscription expired</p>
            </div>
          )}
          <div className="relative">
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-zinc-900 transition-colors"
              onClick={() => setShowUserMenu(v => !v)}
            >
              <div className="h-7 w-7 shrink-0 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center">
                <User size={13} className="text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{farmName}</p>
                <p className={`text-[10px] font-medium ${tierBadge}`}>{tierLabel}</p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-xl">
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <Settings size={13} /> Account settings
                </Link>
                <Link
                  href="/dashboard/billing"
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <CreditCard size={13} /> Billing
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-950 shrink-0">
          <button className="lg:hidden text-zinc-500 hover:text-white transition-colors" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {isExpired && (
              <Link
                href="/dashboard/billing"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-300 hover:bg-red-500/15 transition-colors"
              >
                <AlertTriangle size={12} /> Renew subscription
              </Link>
            )}
            <button className="relative text-zinc-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-900">
              <Bell size={16} />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
          </div>
        </header>

        {/* Subscription banner (warnings, grace, expiring soon) */}
        <SubscriptionBanner subInfo={subInfo} />

        {/* Page content — gated if expired and not on a free route */}
        <main className="flex-1 overflow-y-auto">
          {isExpired && !isFreeRoute
            ? <PaywallGate farmName={farmName} />
            : children}
        </main>
      </div>
    </div>
  )
}