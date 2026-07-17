// 📁 FILE PATH: app/dashboard/components/EnterpriseNavHeader.tsx
'use client'

/**
 * app/dashboard/components/EnterpriseNavHeader.tsx
 *
 * WHY THIS EXISTS
 * ────────────────
 * Before this file, "enterprise selector" + "sub-nav" navigation was
 * reimplemented four separate times — once each in CoffeeClient.tsx,
 * DairyClient.tsx, PoultryClient.tsx and SmallRuminantsClient.tsx — and
 * ONLY rendered on each enterprise's own root/overview page. The moment a
 * farmer drilled one level deeper (e.g. /dashboard/coffee/harvest/record,
 * /dashboard/poultry/health, /dashboard/dairy/breeding) that nav bar
 * disappeared entirely; those leaf pages fall back to a bare "← Back"
 * arrow with no way to jump to a sibling section or another enterprise
 * without going via the sidebar. A fifth, near-identical copy
 * (CoffeeSubNav.tsx) existed for exactly five of Coffee's ~12 leaf pages,
 * making Coffee's own navigation inconsistent with itself.
 *
 * This component is a single, config-driven replacement mounted ONCE in
 * DashboardShell.tsx (see that file), so it persists on every route under
 * /dashboard — including the app/dashboard/error.tsx crash screen, since
 * DashboardShell is the parent layout and keeps rendering around that
 * boundary. A farmer who lands on "This page didn't load" still has full
 * navigation instead of being stranded with only a "Try again" button.
 *
 * Two tiers:
 *   1. Enterprise selector — Overview / Dairy / Coffee / SmallRuminants /
 *      Poultry — always visible, links to each enterprise's root.
 *   2. Contextual sub-nav — the active enterprise's own section list,
 *      shown only while inside that enterprise's route tree. Pulled
 *      1:1 from the nav arrays that used to live inside each *Client.tsx
 *      (labels/hrefs unchanged) so this is a lift-and-share, not a
 *      redesign — existing bookmarks/behavior stay identical.
 *
 * The duplicate in-page copies (and CoffeeSubNav.tsx) have been removed
 * from CoffeeClient.tsx / DairyClient.tsx / PoultryClient.tsx /
 * SmallRuminantsClient.tsx / the 5 coffee leaf pages that imported
 * CoffeeSubNav, so there is exactly one navigation implementation left.
 */

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, Milk, Coffee, Rabbit, Bird,
  PlusCircle, ChevronDown,
  Package, Leaf, FlaskConical, Scissors, TreePine, Activity,
  PawPrint, Stethoscope, HeartPulse, Baby, Scale,
  Egg, Wheat, Syringe, Skull, ShoppingCart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem { label: string; href: string }
interface DropdownOption { label: string; href: string; Icon: LucideIcon }

interface EnterpriseConfig {
  id: string
  label: string
  rootHref: string
  icon: LucideIcon
  navItems: NavItem[]
  primaryAction:
    | { type: 'link'; label: string; href: string }
    | { type: 'dropdown'; label: string; options: DropdownOption[] }
}

const ENTERPRISES: EnterpriseConfig[] = [
  {
    id: 'dairy',
    label: 'Dairy',
    rootHref: '/dashboard/dairy',
    icon: Milk,
    navItems: [
      { label: 'Herd',     href: '/dashboard/dairy' },
      { label: 'Milk',     href: '/dashboard/dairy/milk' },
      { label: 'Health',   href: '/dashboard/dairy/health' },
      { label: 'Breeding', href: '/dashboard/dairy/breeding' },
      { label: 'Warnings', href: '/dashboard/dairy/warnings' },
    ],
    primaryAction: {
      type: 'dropdown',
      label: 'Record Activity',
      options: [
        { label: 'Add cow',        Icon: PawPrint,    href: '/dashboard/dairy/add-cow' },
        { label: 'Record milk',    Icon: Milk,        href: '/dashboard/dairy/milk/record' },
        { label: 'Health check',   Icon: Stethoscope, href: '/dashboard/dairy/health' },
        { label: 'Record breeding', Icon: HeartPulse, href: '/dashboard/dairy/breeding' },
      ],
    },
  },
  {
    id: 'coffee',
    label: 'Coffee',
    rootHref: '/dashboard/coffee',
    icon: Coffee,
    navItems: [
      { label: 'Overview',   href: '/dashboard/coffee' },
      { label: 'Plots',      href: '/dashboard/coffee/plots' },
      { label: 'Activities', href: '/dashboard/coffee/activities' },
      { label: 'Harvest',    href: '/dashboard/coffee/harvest' },
      { label: 'Finance',    href: '/dashboard/coffee/finance' },
      { label: 'EUDR',       href: '/dashboard/coffee/eudr-check' },
      { label: 'Disease',    href: '/dashboard/coffee/disease' },
      { label: 'Satellite',  href: '/dashboard/coffee/satellite' },
    ],
    primaryAction: {
      type: 'dropdown',
      label: 'Record Activity',
      options: [
        { label: 'Record harvest', Icon: Package,      href: '/dashboard/coffee/harvest/record' },
        { label: 'Weeding',        Icon: Leaf,         href: '/dashboard/coffee/activities/record?type=weeding' },
        { label: 'Fertilizer',     Icon: Package,      href: '/dashboard/coffee/activities/record?type=nutrition' },
        { label: 'Spraying',       Icon: FlaskConical, href: '/dashboard/coffee/activities/record?type=crop_protection' },
        { label: 'Pruning',        Icon: Scissors,     href: '/dashboard/coffee/activities/record?type=pruning' },
        { label: 'Mulching',       Icon: TreePine,     href: '/dashboard/coffee/activities/record?type=mulching' },
        { label: 'Other activity', Icon: Activity,     href: '/dashboard/coffee/activities/record?type=other' },
        { label: 'Add plot',       Icon: PlusCircle,   href: '/dashboard/coffee/plots/add' },
      ],
    },
  },
  {
    id: 'smallRuminants',
    label: 'SmallRuminants',
    rootHref: '/dashboard/smallRuminants',
    icon: Rabbit,
    navItems: [
      { label: 'Flock',     href: '/dashboard/smallRuminants' },
      { label: 'Health',    href: '/dashboard/smallRuminants/health' },
      { label: 'Breeding',  href: '/dashboard/smallRuminants/breeding' },
      { label: 'Weights',   href: '/dashboard/smallRuminants/weights' },
      { label: 'Milk',      href: '/dashboard/smallRuminants/milk' },
      { label: 'Sales',     href: '/dashboard/smallRuminants/sales' },
    ],
    primaryAction: {
      type: 'dropdown',
      label: 'Record Activity',
      options: [
        { label: 'Add animal',       Icon: PawPrint,     href: '/dashboard/smallRuminants/add' },
        { label: 'Health check',     Icon: Stethoscope,  href: '/dashboard/smallRuminants/health/add' },
        { label: 'Record service',   Icon: HeartPulse,   href: '/dashboard/smallRuminants/breeding/service' },
        { label: 'Record kidding',   Icon: Baby,         href: '/dashboard/smallRuminants/breeding/kidding' },
        { label: 'Record weight',    Icon: Scale,        href: '/dashboard/smallRuminants/weights/add' },
        { label: 'Record milk',      Icon: Milk,         href: '/dashboard/smallRuminants/milk/add' },
        { label: 'Record sale',      Icon: ShoppingCart, href: '/dashboard/smallRuminants/sales/add' },
      ],
    },
  },
  {
    id: 'poultry',
    label: 'Poultry',
    rootHref: '/dashboard/poultry',
    icon: Bird,
    navItems: [
      { label: 'Overview',    href: '/dashboard/poultry' },
      { label: 'Flock',       href: '/dashboard/poultry/flock' },
      { label: 'Eggs',        href: '/dashboard/poultry/eggs' },
      { label: 'Feed',        href: '/dashboard/poultry/feed' },
      { label: 'Health',      href: '/dashboard/poultry/health' },
      { label: 'Mortality',   href: '/dashboard/poultry/mortality' },
      { label: 'Sales',       href: '/dashboard/poultry/sales' },
      { label: 'Finance',     href: '/dashboard/poultry/finance' },
      { label: 'AI Warnings', href: '/dashboard/poultry/warnings' },
    ],
    primaryAction: {
      type: 'dropdown',
      label: 'Record Activity',
      options: [
        { label: 'Add batch',        Icon: PlusCircle,   href: '/dashboard/poultry/add-batch' },
        { label: 'Record eggs',      Icon: Egg,          href: '/dashboard/poultry/eggs' },
        { label: 'Record feed',      Icon: Wheat,        href: '/dashboard/poultry/feed' },
        { label: 'Health / vaccine', Icon: Syringe,      href: '/dashboard/poultry/health' },
        { label: 'Record mortality', Icon: Skull,        href: '/dashboard/poultry/mortality' },
        { label: 'Record sale',      Icon: ShoppingCart, href: '/dashboard/poultry/sales' },
      ],
    },
  },
]

const isWithin = (pathname: string, href: string) =>
  href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(href + '/')

function PrimaryAction({ action }: { action: EnterpriseConfig['primaryAction'] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (action.type === 'link') {
    return (
      <Link
        href={action.href}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors flex-shrink-0"
      >
        <PlusCircle size={12} /> {action.label}
      </Link>
    )
  }

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors"
      >
        <PlusCircle size={12} />
        {action.label}
        <ChevronDown size={11} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border border-[#2A2D35] bg-[#0D0F14] shadow-xl z-50 py-1">
          <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-[#4B5563] uppercase tracking-widest">
            Select activity
          </p>
          {action.options.map(({ label, href, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors group"
            >
              <Icon size={13} className="text-[#4B5563] group-hover:text-emerald-500 transition-colors flex-shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EnterpriseNavHeader() {
  const pathname = usePathname()
  const active = ENTERPRISES.find(e => isWithin(pathname, e.rootHref))

  return (
    <div className="border-b border-[#2A2D35] bg-[#0A0C10] shrink-0">
      {/* Tier 1 — enterprise selector, always visible, always a real link */}
      <div className="px-4 lg:px-6">
        <div className="max-w-6xl mx-auto flex items-center h-11 gap-1 overflow-x-auto scrollbar-hide">
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
              pathname === '/dashboard'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            <LayoutGrid size={13} className={pathname === '/dashboard' ? 'text-emerald-500' : 'text-zinc-600'} />
            Overview
          </Link>
          {ENTERPRISES.map(e => {
            const Icon = e.icon
            const isActive = active?.id === e.id
            return (
              <Link
                key={e.id}
                href={e.rootHref}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Icon size={13} className={isActive ? 'text-emerald-500' : 'text-zinc-600'} />
                {e.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Tier 2 — contextual sub-nav for the active enterprise, only shown
          once you're inside that enterprise's route tree. */}
      {active && (
        <div className="border-t border-[#2A2D35] px-4 lg:px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between h-11 gap-2">
            <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
              {active.navItems.map(({ label, href }) => {
                const isActive = href === active.rootHref ? pathname === href : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      isActive ? 'text-white bg-white/10' : 'text-[#6B7280] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>
            <PrimaryAction action={active.primaryAction} />
          </div>
        </div>
      )}
    </div>
  )
}
