'use client'

import { useState, useMemo } from "react"
import Link from "next/link"
import { AnimalCard } from "@/components/features/small-ruminants/AnimalCard"
import { FilterBar, type Filters } from "@/components/features/small-ruminants/FilterBar"

// ─── Types ────────────────────────────────────────────────────────────────────

type Species = "goat" | "sheep"
type Sex     = "male" | "female"
type Status  = "active" | "sold" | "deceased" | "culled"
type Purpose = "meat" | "dairy" | "breeding" | "dual"

interface DashboardAnimal {
  id: string
  farm_id: string
  animal_tag: string
  name: string | null
  species: Species
  breed: string | null
  upgrade_level: string | null
  sex: Sex
  birth_date: string
  status: Status
  purpose: Purpose | null
  ear_notch_pattern: string | null
  qr_code: string | null
  notes: string | null
}

interface VaccinationDue {
  id: string
  animal_id: string
  animal_tag: string
  animal_name: string | null
  species: Species
  vaccine_type: string | null
  vaccine_name: string | null
  next_vaccination_due: string
  days_until_due: number
}

interface RecentKidding {
  id: string
  dam_id: string
  dam_tag: string
  dam_name: string | null
  delivery_date: string
  sex: string | null
  birth_weight: number | null
  vigor_score: string | null
  colostrum_given: boolean | null
  kid_lamb_id: string | null
}

interface LatestWeight {
  animal_id: string
  weight_kg: number
  record_date: string
  average_daily_gain: number | null
  body_condition_score: number | null
}

interface FlockSummary {
  total: number
  goats: number
  sheep: number
  female: number
  male: number
  active: number
  for_meat: number
  for_dairy: number
  for_breeding: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VACCINE_PRIORITY: Record<string, { color: string; bg: string; border: string }> = {
  PPR:        { color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  CCPP:       { color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  "Foot Rot": { color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  Anthrax:    { color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  Deworming:  { color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  default:    { color: "text-slate-700",  bg: "bg-slate-50",  border: "border-slate-200" },
}

function vaccineStyle(name: string | null) {
  if (!name) return VACCINE_PRIORITY.default
  const key = Object.keys(VACCINE_PRIORITY).find(k =>
    name.toLowerCase().includes(k.toLowerCase())
  )
  return VACCINE_PRIORITY[key ?? "default"]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-KE", {
    day: "numeric", month: "short", year: "numeric",
  })
}

function urgencyLabel(days: number): { text: string; color: string } {
  if (days < 0)  return { text: "Overdue",     color: "text-red-600 font-bold" }
  if (days === 0) return { text: "Due today",  color: "text-red-600 font-bold" }
  if (days <= 7)  return { text: `${days}d`,   color: "text-red-500 font-semibold" }
  if (days <= 14) return { text: `${days}d`,   color: "text-orange-500" }
  return              { text: `${days}d`,       color: "text-slate-500" }
}

function speciesEmoji(species: Species) {
  return species === "goat" ? "🐐" : "🐑"
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FlockSummaryBanner({ summary }: { summary: FlockSummary | null }) {
  if (!summary || summary.total === 0) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
        Flock Overview
      </p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { label: "Total",    value: summary.total,    color: "text-slate-900" },
          { label: "Goats",    value: summary.goats,    color: "text-emerald-700", icon: "🐐" },
          { label: "Sheep",    value: summary.sheep,    color: "text-blue-700",    icon: "🐑" },
          { label: "Female",   value: summary.female,   color: "text-pink-700" },
          { label: "Male",     value: summary.male,     color: "text-indigo-700" },
          { label: "Active",   value: summary.active,   color: "text-emerald-600" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="text-center">
            <p className={`text-xl font-bold ${color}`}>
              {icon && <span className="text-base mr-0.5">{icon}</span>}
              {value}
            </p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3 flex-wrap">
        {[
          { label: "Meat",     count: summary.for_meat,     style: "bg-orange-100 text-orange-700" },
          { label: "Dairy",    count: summary.for_dairy,    style: "bg-blue-100 text-blue-700" },
          { label: "Breeding", count: summary.for_breeding, style: "bg-purple-100 text-purple-700" },
        ].filter(p => p.count > 0).map(p => (
          <span key={p.label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.style}`}>
            {p.count} {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function VaccinationAlerts({ vaccinations }: { vaccinations: VaccinationDue[] }) {
  if (vaccinations.length === 0) return null

  const overdueCount = vaccinations.filter(v => v.days_until_due < 0).length

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
            Vaccination Schedule
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            Next 30 days · {vaccinations.length} due
            {overdueCount > 0 && (
              <span className="ml-2 font-semibold text-red-600">
                · {overdueCount} overdue
              </span>
            )}
          </p>
        </div>
        <Link
          href="/dashboard/smallRuminants/health"
          className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors"
        >
          Full Calendar →
        </Link>
      </div>
      <div className="space-y-2">
        {vaccinations.slice(0, 6).map(v => {
          const style   = vaccineStyle(v.vaccine_name ?? v.vaccine_type)
          const urgency = urgencyLabel(v.days_until_due)
          return (
            <div
              key={v.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${style.bg} ${style.border}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{speciesEmoji(v.species)}</span>
                  <p className={`text-xs font-semibold ${style.color} truncate`}>
                    {v.animal_name ?? v.animal_tag}
                  </p>
                  <span className="text-xs text-slate-400 hidden sm:inline">{v.animal_tag}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {v.vaccine_name ?? v.vaccine_type ?? "Vaccination"}
                  {" · "}{formatDate(v.next_vaccination_due)}
                </p>
              </div>
              <span className={`text-xs ml-3 flex-shrink-0 ${urgency.color}`}>
                {urgency.text}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RecentKiddings({ kiddings }: { kiddings: RecentKidding[] }) {
  if (kiddings.length === 0) return null

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
            Recent Births
          </p>
          <p className="text-xs text-emerald-600 mt-0.5">Last 14 days</p>
        </div>
        <Link
          href="/dashboard/smallRuminants/breeding"
          className="text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-200 transition-colors"
        >
          Breeding Records →
        </Link>
      </div>
      <div className="space-y-2">
        {kiddings.map(k => {
          const daysAgo = Math.floor(
            (Date.now() - new Date(k.delivery_date).getTime()) / 86_400_000
          )
          return (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-slate-800">
                    {k.dam_name ?? k.dam_tag}
                  </p>
                  {k.sex && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      k.sex === "female" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {k.sex === "female" ? "♀" : "♂"} {k.sex}
                    </span>
                  )}
                  {k.birth_weight && (
                    <span className="text-xs text-slate-500">{k.birth_weight}kg</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-400">
                    {daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`}
                  </p>
                  {k.colostrum_given === false && (
                    <span className="text-xs text-red-600 font-semibold">· ⚠ No colostrum</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Client Page ─────────────────────────────────────────────────────────

interface SmallRuminantsClientProps {
  initialAnimals: DashboardAnimal[]
  initialVaccinations: VaccinationDue[]
  initialKiddings: RecentKidding[]
  weightMap: Record<string, LatestWeight>
}

export default function SmallRuminantsClient({
  initialAnimals,
  initialVaccinations,
  initialKiddings,
  weightMap
}: SmallRuminantsClientProps) {
  const [filters, setFilters] = useState<Filters>({
    species: "all", sex: "all", purpose: "all", search: "",
  })

  const flockSummary = useMemo<FlockSummary | null>(() => {
    if (initialAnimals.length === 0) return null
    return {
      total:        initialAnimals.length,
      goats:        initialAnimals.filter(a => a.species === "goat").length,
      sheep:        initialAnimals.filter(a => a.species === "sheep").length,
      female:       initialAnimals.filter(a => a.sex === "female").length,
      male:         initialAnimals.filter(a => a.sex === "male").length,
      active:       initialAnimals.length,
      for_meat:     initialAnimals.filter(a => a.purpose === "meat").length,
      for_dairy:    initialAnimals.filter(a => a.purpose === "dairy").length,
      for_breeding: initialAnimals.filter(a => a.purpose === "breeding" || a.purpose === "dual").length,
    }
  }, [initialAnimals])

  const filteredAnimals = useMemo(() => {
    return initialAnimals.filter(a => {
      if (filters.species !== "all" && a.species !== filters.species) return false
      if (filters.sex     !== "all" && a.sex     !== filters.sex)     return false
      if (filters.purpose !== "all" && a.purpose !== filters.purpose) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const match =
          a.animal_tag.toLowerCase().includes(q) ||
          (a.name?.toLowerCase().includes(q) ?? false) ||
          (a.breed?.toLowerCase().includes(q) ?? false)
        if (!match) return false
      }
      return true
    })
  }, [initialAnimals, filters])

  const alertCount = initialVaccinations.filter(v => v.days_until_due <= 7).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">←</Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-none">🐐🐑 Sheep & Goats</h1>
                <p className="text-xs text-slate-500 mt-0.5">{flockSummary?.total || 0} active animals</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {alertCount > 0 && (
                <Link href="/dashboard/smallRuminants/health" className="text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-700 px-2.5 py-1.5 rounded-lg">
                  <span>🔔</span> {alertCount}
                </Link>
              )}
              <Link href="/dashboard/smallRuminants/add" className="text-sm font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white">+ Add</Link>
            </div>
          </div>
          <div className="flex gap-1 mt-3 overflow-x-auto pb-0.5">
            {[
              { label: "🏠 Flock",      href: "/dashboard/smallRuminants" },
              { label: "💉 Health",     href: "/dashboard/smallRuminants/health" },
              { label: "🐣 Breeding",   href: "/dashboard/smallRuminants/breeding" },
              { label: "⚖️ Weights",    href: "/dashboard/smallRuminants/weights" },
              { label: "🍼 Milk",       href: "/dashboard/smallRuminants/milk" },
            ].map(({ label, href }) => (
              <Link key={href} href={href} className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">{label}</Link>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <FlockSummaryBanner summary={flockSummary} />
        <VaccinationAlerts vaccinations={initialVaccinations} />
        <RecentKiddings kiddings={initialKiddings} />

        {initialAnimals.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🐐</p>
            <p className="font-semibold text-slate-700">No animals registered yet</p>
            <Link href="/dashboard/smallRuminants/add" className="mt-5 inline-flex bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-semibold">+ Register First Animal</Link>
          </div>
        ) : (
          <>
            <FilterBar filters={filters} onChange={setFilters} total={initialAnimals.length} />
            <div className="space-y-3">
              {filteredAnimals.map(animal => (
                <AnimalCard key={animal.id} animal={animal as any} latestWeight={weightMap[animal.id] ?? null} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
