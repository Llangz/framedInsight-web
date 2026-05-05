'use client'

import Link from 'next/link'

interface QuickActionsProps {
  hasDairy: boolean
  hasCoffee: boolean
  hasSheepGoats: boolean
  selectedEnterprise: 'all' | 'dairy' | 'coffee' | 'sheep_goats'
}

export default function QuickActions({
  hasDairy,
  hasCoffee,
  hasSheepGoats,
  selectedEnterprise
}: QuickActionsProps) {
  const actions = [
    { label: 'Record Milk', icon: '🥛', href: '/dashboard/dairy/milk/record', show: hasDairy && (selectedEnterprise === 'all' || selectedEnterprise === 'dairy') },
    { label: 'Add Cow', icon: '🐄', href: '/dashboard/dairy/cows/add', show: hasDairy && (selectedEnterprise === 'all' || selectedEnterprise === 'dairy') },
    { label: 'Health Check', icon: '💉', href: '/dashboard/dairy/health', show: hasDairy && (selectedEnterprise === 'all' || selectedEnterprise === 'dairy') },
    { label: 'Harvest', icon: '🍒', href: '/dashboard/coffee/harvest', show: hasCoffee && (selectedEnterprise === 'all' || selectedEnterprise === 'coffee') },
    { label: 'Add Plot', icon: '📍', href: '/dashboard/coffee/plots/add', show: hasCoffee && (selectedEnterprise === 'all' || selectedEnterprise === 'coffee') },
    { label: 'Livestock', icon: '🐏', href: '/dashboard/small-ruminants/add', show: hasSheepGoats && (selectedEnterprise === 'all' || selectedEnterprise === 'sheep_goats') },
  ].filter(a => a.show);

  if (actions.length === 0) {
    return <div className="text-slate-500 text-sm italic">No actions available for this selection.</div>
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {actions.map((action, index) => (
        <Link
          key={index}
          href={action.href}
          className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all duration-300 group"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl grayscale group-hover:grayscale-0 transition-all">
            {action.icon}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{action.label}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tap to Record</p>
          </div>
          <span className="text-slate-700 group-hover:text-emerald-500 transition-colors">→</span>
        </Link>
      ))}
    </div>
  )
}
