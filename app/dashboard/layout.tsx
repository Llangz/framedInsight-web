'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard, Milk, Coffee, Rabbit,
  Settings, User, Bell, Menu, X, LogOut, Leaf,
} from 'lucide-react';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase     = createClient(supabaseUrl, supabaseKey);

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard',               icon: LayoutDashboard },
  { label: 'Dairy',     href: '/dashboard/dairy',          icon: Milk            },
  { label: 'Coffee',    href: '/dashboard/coffee',         icon: Coffee          },
  { label: 'Livestock', href: '/dashboard/smallRuminants', icon: Rabbit          },
  { label: 'Settings',  href: '/dashboard/settings',       icon: Settings        },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const isActive = (href: string) => pathname === href;

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden font-['Outfit']">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
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
          <button
            className="lg:hidden text-zinc-500 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Operations
          </p>
          {navItems.map((item) => {
            const Icon   = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}
                `}
              >
                <Icon size={15} className={active ? 'text-emerald-500' : 'text-zinc-600'} />
                {item.label}
                {active && <span className="ml-auto h-1 w-1 rounded-full bg-emerald-500" />}
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="border-t border-zinc-800 p-3">
          <div className="relative">
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-zinc-900 transition-colors group"
              onClick={() => setShowUserMenu((v) => !v)}
            >
              <div className="h-7 w-7 flex-shrink-0 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center">
                <User size={13} className="text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">Main Farm</p>
                <p className="text-[10px] text-emerald-500 font-medium">Pro</p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-xl">
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <Settings size={13} />
                  Account settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-zinc-800 transition-colors"
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-950">
          <button
            className="lg:hidden text-zinc-500 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={18} />
          </button>

          <div className="flex-1" />

          <button className="relative text-zinc-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-900">
            <Bell size={16} />
            <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
