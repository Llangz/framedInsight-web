'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PlusCircle, Bell, Syringe, Baby, ArrowRight } from 'lucide-react'
import { AnimalCard } from '@/components/features/small-ruminants/AnimalCard'
import { FilterBar, type Filters } from '@/components/features/small-ruminants/FilterBar'

interface DashboardAnimal {
  id: string; farm_id: string; animal_tag: string; name: string | null
  species: 'goat' | 'sheep'; breed: string | null; upgrade_level: string | null
  sex: 'male' | 'female'; birth_date: string; status: string; purpose: string | null
  ear_notch_pattern: string | null; qr_code: string | null; notes: string | null
}
interface VaccinationDue {
  id: string; animal_id: string; animal_tag: string; animal_name: string | null
  species: string; vaccine_type: string | null; vaccine_name: string | null
  next_vaccination_due: string; days_until_due: number
}
interface RecentKidding {
  id: string; dam_id: string; dam_tag: string; dam_name: string | null
  delivery_date: string; sex: string | null; birth_weight: number | null
  vigor_score: string | null; colostrum_given: boolean | null; kid_lamb_id: string | null
}
interface LatestWeight { animal_id: string; weight_kg: number; record_date: string; average_daily_gain: number | null; body_condition_score: number | null }
interface FlockSummary { total: number; goats: number; sheep: number; female: number; male: number; active: number; for_meat: number; for_dairy: number; for_breeding: number }

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

const URGENCY = (days: number) =>
  days <= 0  ? 'text-red-400 border-red-900/40 bg-red-950/30' :
  days <= 3  ? 'text-amber-400 border-amber-900/40 bg-amber-950/30' :
               'text-[#9CA3AF] border-[#2A2D35] bg-[#0D0F14]'

const navItems = [
  { label: 'Flock',     href: '/dashboard/smallRuminants'           },
  { label: 'Health',    href: '/dashboard/smallRuminants/health'    },
  { label: 'Breeding',  href: '/dashboard/smallRuminants/breeding'  },
  { label: 'Weights',   href: '/dashboard/smallRuminants/weights'   },
  { label: 'Milk',      href: '/dashboard/smallRuminants/milk'      },
  { label: 'Sales',     href: '/dashboard/smallRuminants/sales'     },
]

interface Props {
  initialAnimals: DashboardAnimal[]; initialVaccinations: VaccinationDue[]
  initialKiddings: RecentKidding[]; initialWeights: LatestWeight[]; flockSummary: FlockSummary | null
}

export default function SmallRuminantsClient({
  initialAnimals, initialVaccinations, initialKiddings, initialWeights, flockSummary,
}: Props) {
  const pathname = usePathname()
  const [filters, setFilters] = useState<Filters>({ species: 'all', sex: 'all', purpose: 'all', search: '' })

  const weightMap = useMemo(
    () => Object.fromEntries(initialWeights.map(w => [w.animal_id, w])),
    [initialWeights]
  )

  const filtered = useMemo(() => {
    return initialAnimals.filter(a => {
      if (filters.species !== 'all' && a.species !== filters.species) return false
      if (filters.sex     !== 'all' && a.sex     !== filters.sex)     return false
      if (filters.purpose !== 'all' && a.purpose !== filters.purpose) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!a.animal_tag.toLowerCase().includes(q) &&
            !(a.name?.toLowerCase().includes(q)) &&
            !(a.breed?.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [initialAnimals, filters])

  const urgentVax = initialVaccinations.filter(v => v.days_until_due <= 7)

  return (
    <div className="min-h-screen bg-obsidian">

      {/* Sub-nav */}
      <div className="border-b border-[#2A2D35] bg-[#0A0C10] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between h-12">
            <nav className="flex items-center gap-1 overflow-x-auto">
              {navItems.map(({ label, href }) => {
                const active = href === '/dashboard/smallRuminants' ? pathname === href : pathname.startsWith(href)
                return (
                  <Link key={href} href={href}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      active ? 'text-white bg-white/10' : 'text-[#6B7280] hover:text-white'
                    }`}>
                    {label}
                  </Link>
                )
              })}
            </nav>
            <Link href="/dashboard/smallRuminants/add"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors flex-shrink-0">
              <PlusCircle size={12} /> Add
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header + summary */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Sheep &amp; Goats</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{flockSummary?.total ?? 0} animals registered</p>
          </div>
          {urgentVax.length > 0 && (
            <Link href="/dashboard/smallRuminants/health"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-400 border border-amber-900/40 bg-amber-950/30 rounded-md">
              <Bell size={12} /> {urgentVax.length} vaccine{urgentVax.length > 1 ? 's' : ''} due
            </Link>
          )}
        </div>

        {/* Stats */}
        {flockSummary && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: 'Total',    value: flockSummary.total    },
              { label: 'Active',   value: flockSummary.active   },
              { label: 'Goats',    value: flockSummary.goats    },
              { label: 'Sheep',    value: flockSummary.sheep    },
              { label: 'Female',   value: flockSummary.female   },
              { label: 'Male',     value: flockSummary.male     },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-3">
                <p className="text-lg font-semibold text-white">{value}</p>
                <p className="text-[11px] text-[#6B7280]">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming vaccinations */}
        {urgentVax.length > 0 && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2D35]">
              <Syringe size={13} className="text-[#6B7280]" />
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Vaccinations due</h2>
            </div>
            <div className="divide-y divide-[#1F2128]">
              {urgentVax.slice(0, 5).map(v => (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{v.animal_tag}</p>
                    <p className="text-xs text-[#6B7280]">{v.vaccine_name || v.vaccine_type || 'Vaccine'}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${URGENCY(v.days_until_due)}`}>
                    {v.days_until_due <= 0 ? 'Overdue' : `${v.days_until_due}d`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent kiddings */}
        {initialKiddings.length > 0 && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2D35]">
              <Baby size={13} className="text-[#6B7280]" />
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Recent kiddings</h2>
            </div>
            <div className="divide-y divide-[#1F2128]">
              {initialKiddings.slice(0, 3).map(k => (
                <Link key={k.id} href={`/dashboard/smallRuminants/animal/${k.dam_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{k.dam_tag}</p>
                    <p className="text-xs text-[#6B7280]">
                      {k.birth_weight ? `${k.birth_weight}kg` : '—'} · {k.sex || '—'} · {fmt(k.delivery_date)}
                    </p>
                  </div>
                  <ArrowRight size={12} className="text-[#4B5563] group-hover:text-emerald-400 transition-colors" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Animal list */}
        {initialAnimals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#2A2D35] p-12 text-center">
            <p className="text-sm text-[#6B7280] mb-4">No animals registered yet</p>
            <Link href="/dashboard/smallRuminants/add"
              className="inline-flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400">
              <PlusCircle size={14} /> Register first animal
            </Link>
          </div>
        ) : (
          <>
            <FilterBar filters={filters} onChange={setFilters} total={initialAnimals.length} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(a => (
                <AnimalCard key={a.id} animal={a as any} latestWeight={weightMap[a.id] ?? null} />
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="text-center text-sm text-[#6B7280] py-8">No animals match your filters</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}