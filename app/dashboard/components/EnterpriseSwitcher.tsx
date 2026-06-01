// 📁 FILE PATH: app/dashboard/components/EnterpriseSwitcher.tsx
'use client'

import { LayoutGrid, Milk, Coffee, Rabbit, Bird } from 'lucide-react'

interface EnterpriseSwitcherProps {
  hasDairy: boolean
  hasCoffee: boolean
  hasSheepGoats: boolean
  hasPoultry: boolean
  selected: 'all' | 'dairy' | 'coffee' | 'sheep_goats' | 'poultry'
  onSelect: (enterprise: 'all' | 'dairy' | 'coffee' | 'sheep_goats' | 'poultry') => void
}

const enterprises = [
  { id: 'all'         as const, label: 'Overview',       icon: LayoutGrid },
  { id: 'dairy'       as const, label: 'Dairy',          icon: Milk       },
  { id: 'coffee'      as const, label: 'Coffee',         icon: Coffee     },
  { id: 'sheep_goats' as const, label: 'SmallRuminants', icon: Rabbit     },
  { id: 'poultry'     as const, label: 'Poultry',        icon: Bird       },
]

export default function EnterpriseSwitcher({
  hasDairy, hasCoffee, hasSheepGoats, hasPoultry, selected, onSelect,
}: EnterpriseSwitcherProps) {
  const shows: Record<string, boolean> = {
    all: true,
    dairy:       hasDairy,
    coffee:      hasCoffee,
    sheep_goats: hasSheepGoats,
    poultry:     hasPoultry,
  }

  const visible = enterprises.filter((e) => shows[e.id])

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1 overflow-x-auto max-w-full">
      {visible.map((e) => {
        const Icon   = e.icon
        const active = selected === e.id
        return (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold
              whitespace-nowrap transition-colors
              ${active
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'}
            `}
          >
            <Icon size={13} className={active ? 'text-emerald-500' : 'text-zinc-600'} />
            {e.label}
          </button>
        )
      })}
    </div>
  )
}