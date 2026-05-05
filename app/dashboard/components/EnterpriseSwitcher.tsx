'use client'

interface EnterpriseSwitcherProps {
  hasDairy: boolean
  hasCoffee: boolean
  hasSheepGoats: boolean
  selected: 'all' | 'dairy' | 'coffee' | 'sheep_goats'
  onSelect: (enterprise: 'all' | 'dairy' | 'coffee' | 'sheep_goats') => void
}

export default function EnterpriseSwitcher({
  hasDairy,
  hasCoffee,
  hasSheepGoats,
  selected,
  onSelect
}: EnterpriseSwitcherProps) {
  const enterprises = [
    { id: 'all' as const, label: 'Overview', icon: '🌾', show: true },
    { id: 'dairy' as const, label: 'Dairy', icon: '🐄', show: hasDairy },
    { id: 'coffee' as const, label: 'Coffee', icon: '☕', show: hasCoffee },
    { id: 'sheep_goats' as const, label: 'Livestock', icon: '🐏', show: hasSheepGoats },
  ].filter(e => e.show)

  return (
    <div className="glass-card p-1.5 rounded-2xl inline-flex gap-1.5 overflow-x-auto max-w-full">
      {enterprises.map((enterprise) => (
        <button
          key={enterprise.id}
          onClick={() => onSelect(enterprise.id)}
          className={`
            px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300
            flex items-center gap-2 whitespace-nowrap
            ${selected === enterprise.id
              ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
            }
          `}
        >
          <span className={`text-xl transition-transform duration-300 ${selected === enterprise.id ? 'scale-110' : 'grayscale opacity-60'}`}>
            {enterprise.icon}
          </span>
          <span className={selected === enterprise.id ? 'translate-x-0' : '-translate-x-1'}>
            {enterprise.label}
          </span>
        </button>
      ))}
    </div>
  )
}
