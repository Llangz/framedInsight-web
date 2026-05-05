'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navigationItems = [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Dairy', href: '/dashboard/dairy', icon: '🐄' },
    { label: 'Coffee', href: '/dashboard/coffee', icon: '☕' },
    { label: 'Livestock', href: '/dashboard/smallRuminants', icon: '🐑' },
    { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const isActive = (href: string) => pathname === href;

  return (
    <div className="flex h-screen bg-obsidian overflow-hidden font-['Outfit']">
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-all"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 glass-card border-r border-white/5 transform transition-all duration-500 ease-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <span className="text-xl">🌱</span>
              </div>
              <span className="text-xl font-black text-white tracking-tighter">
                framed<span className="text-emerald-500">Insight</span>
              </span>
            </Link>
            <button
              className="lg:hidden text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-6 space-y-2 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 px-4">Enterprise Management</div>
            {navigationItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center px-4 py-3.5 rounded-2xl transition-all duration-300 group
                  ${
                    isActive(item.href)
                      ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <span className={`text-xl mr-4 transition-transform group-hover:scale-110 ${isActive(item.href) ? 'grayscale-0' : 'grayscale opacity-60'}`}>
                  {item.icon}
                </span>
                <span className="text-sm font-bold tracking-tight">{item.label}</span>
                {isActive(item.href) && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </Link>
            ))}
          </nav>

          {/* User Menu */}
          <div className="p-6">
            <div className="relative glass-card rounded-2xl p-4 hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => setShowUserMenu(!showUserMenu)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white border border-white/10 group-hover:border-emerald-500/50 transition-colors">
                  👤
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">Main Farm</p>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Verified Pro</p>
                </div>
              </div>

              {showUserMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-4 glass-card rounded-2xl shadow-2xl py-2 border border-white/10 animate-in fade-in slide-in-from-bottom-2">
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5"
                  >
                    <span>⚙️</span> Account Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-alert hover:bg-crimson-alert/10"
                  >
                    <span>🚪</span> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Decorative Background Blob */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        {/* Top Bar */}
        <header className="h-20 flex items-center justify-between px-8 border-b border-white/5">
          <button
            className="lg:hidden w-10 h-10 glass-card rounded-xl flex items-center justify-center text-white"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="flex-1" />

          {/* Alerts Badge */}
          <div className="flex items-center gap-4">
            <button className="relative w-10 h-10 glass-card rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              🔔
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-crimson-alert rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          {children}
        </main>
      </div>
    </div>
  );
}
