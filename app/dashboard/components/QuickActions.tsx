'use client'

import Link from 'next/link'
import { Milk, PlusCircle, Stethoscope, Wheat, MapPin, Rabbit, Bird, Egg, ArrowRight } from 'lucide-react'

interface QuickActionsProps {
  hasDairy: boolean
  hasCoffee: boolean
  hasSheepGoats: boolean
  hasPoultry?: boolean
  selectedEnterprise: 'all' | 'dairy' | 'coffee' | 'sheep_goats' | 'poultry'
}

export default function QuickActions({
  hasDairy, hasCoffee, hasSheepGoats, hasPoultry, selectedEnterprise,
}: QuickActionsProps) {
  const actions = [
    {
      label: 'Record Milk',
      icon: Milk,
      href: '/dashboard/dairy/milk/record',
      show: hasDairy && (selectedEnterprise === 'all' || selectedEnterprise === 'dairy'),
    },
    {
      label: 'Add Cow',
      icon: PlusCircle,
      href: '/dashboard/dairy/add-cow',
      show: hasDairy && (selectedEnterprise === 'all' || selectedEnterprise === 'dairy'),
    },
    {
      label: 'Health Check',
      icon: Stethoscope,
      href: '/dashboard/dairy/health',
      show: hasDairy && (selectedEnterprise === 'all' || selectedEnterprise === 'dairy'),
    },
    {
      label: 'Log Harvest',
      icon: Wheat,
      href: '/dashboard/coffee/harvest',
      show: hasCoffee && (selectedEnterprise === 'all' || selectedEnterprise === 'coffee'),
    },
    {
      label: 'Add Plot',
      icon: MapPin,
      href: '/dashboard/coffee/plots/add',
      show: hasCoffee && (selectedEnterprise === 'all' || selectedEnterprise === 'coffee'),
    },
    {
      label: 'Add Animal',
      icon: Rabbit,
      href: '/dashboard/smallRuminants/add',
      show: hasSheepGoats && (selectedEnterprise === 'all' || selectedEnterprise === 'sheep_goats'),
    },
    {
      label: 'Record Eggs',
      icon: Egg,
      href: '/dashboard/poultry/eggs',
      show: hasPoultry && (selectedEnterprise === 'all' || selectedEnterprise === 'poultry'),
    },
    {
      label: 'Add Batch',
      icon: Bird,
      href: '/dashboard/poultry/add-batch',
      show: hasPoultry && (selectedEnterprise === 'all' || selectedEnterprise === 'poultry'),
    },
    {
      label: 'Poultry Health',
      icon: Stethoscope,
      href: '/dashboard/poultry/health',
      show: hasPoultry && (selectedEnterprise === 'all' || selectedEnterprise === 'poultry'),
    },
  ].filter((a) => a.show)

  if (actions.length === 0) {
    return <p className="text-xs text-zinc-600 italic">No actions available.</p>
  }

  return (
    <div className="space-y-1.5">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700 transition-colors group"
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800">
              <Icon size={13} className="text-zinc-400 group-hover:text-emerald-500 transition-colors" />
            </div>
            <span className="flex-1 text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
              {action.label}
            </span>
            <ArrowRight size={12} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
          </Link>
        )
      })}
    </div>
  )
}
