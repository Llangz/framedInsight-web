'use client'

import Link from 'next/link'
import { CheckCircle2, Droplet, Sparkles, Banknote, CircleDashed } from 'lucide-react'

interface CowCardProps {
  cow: any
}

const STATUS_META: Record<string, { label: string; Icon: any; color: string; border: string; bg: string }> = {
  active:   { label: 'Active',   Icon: CheckCircle2, color: 'text-emerald-400', border: 'border-emerald-900/40', bg: 'bg-emerald-950/30' },
  dry:      { label: 'Dry',      Icon: Droplet,       color: 'text-amber-400',   border: 'border-amber-900/40',   bg: 'bg-amber-950/30' },
  heifer:   { label: 'Heifer',   Icon: Sparkles,      color: 'text-sky-400',     border: 'border-sky-900/40',     bg: 'bg-sky-950/30' },
  sold:     { label: 'Sold',     Icon: Banknote,      color: 'text-blue-400',    border: 'border-blue-900/40',    bg: 'bg-blue-950/30' },
  deceased: { label: 'Deceased', Icon: CircleDashed,  color: 'text-[#6B7280]',   border: 'border-[#2A2D35]',      bg: 'bg-[#0D0F14]' },
}

export default function CowCard({ cow }: CowCardProps) {
  // Calculate age
  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 'Unknown'
    const birth = new Date(birthDate)
    const now = new Date()
    const ageMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
    const ageYears = Math.floor(ageMonths / 12)
    const remainingMonths = ageMonths % 12

    if (ageYears === 0) return `${remainingMonths}mo`
    if (remainingMonths === 0) return `${ageYears}yr`
    return `${ageYears}yr ${remainingMonths}mo`
  }

  const meta = STATUS_META[cow.status as string] || STATUS_META.active
  const { Icon } = meta

  return (
    <Link
      href={`/dashboard/dairy/cows/${cow.id}`}
      className="block rounded-lg border border-[#2A2D35] bg-[#0D0F14] hover:border-[#3A3D45] transition-colors p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">
            {cow.name || cow.cow_tag}
          </h3>
          {cow.name && (
            <p className="text-xs text-[#6B7280]">Tag: {cow.cow_tag}</p>
          )}
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-medium flex-shrink-0 ${meta.border} ${meta.bg} ${meta.color}`}>
          <Icon size={11} /> {meta.label}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <span className="text-[#6B7280]">Breed:</span>
          <p className="font-medium text-white mt-0.5">{cow.breed || 'Unknown'}</p>
        </div>
        <div>
          <span className="text-[#6B7280]">Age:</span>
          <p className="font-medium text-white mt-0.5">{calculateAge(cow.birth_date)}</p>
        </div>
        <div>
          <span className="text-[#6B7280]">Sex:</span>
          <p className="font-medium text-white mt-0.5 capitalize">{cow.sex || 'Unknown'}</p>
        </div>
        <div>
          <span className="text-[#6B7280]">Purpose:</span>
          <p className="font-medium text-white mt-0.5 capitalize">{cow.purpose || 'Dairy'}</p>
        </div>
      </div>

      {/* Notes Preview */}
      {cow.notes && (
        <div className="pt-3 border-t border-[#1F2128]">
          <p className="text-[11px] text-[#9CA3AF] line-clamp-2">{cow.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-[#1F2128] flex items-center justify-between text-[11px] text-[#4B5563]">
        <span>Added {new Date(cow.created_at).toLocaleDateString()}</span>
        <span className="text-emerald-500 font-medium">View details →</span>
      </div>
    </Link>
  )
}
