'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Milk, Stethoscope, HeartPulse } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface CowDetailClientProps {
  initialCow: any
}

export default function CowDetailClient({ initialCow }: CowDetailClientProps) {
  const router = useRouter()
  const [cow] = useState<any>(initialCow)
  const [isEditing, setIsEditing] = useState(false)

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this cow? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('cows')
        .delete()
        .eq('id', cow.id)

      if (error) throw error

      router.push('/dashboard/dairy/cows')
    } catch (error) {
      console.error('Error deleting cow:', error)
      alert('Failed to delete cow')
    }
  }

  function calculateAge(birthDate: string) {
    if (!birthDate) return 'Unknown'
    const birth = new Date(birthDate)
    const now = new Date()
    const ageMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
    const ageYears = Math.floor(ageMonths / 12)
    const remainingMonths = ageMonths % 12
    
    if (ageYears === 0) return `${remainingMonths} months`
    if (remainingMonths === 0) return `${ageYears} year${ageYears > 1 ? 's' : ''}`
    return `${ageYears} year${ageYears > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/dairy/cows"
              className="text-[#6B7280] hover:text-white"
            >
              ← Back
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="text-2xl font-bold text-white">
              {cow.name || cow.cow_tag}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/dairy/cows/${cow.id}/edit`} className="px-4 py-2 border border-[#2A2D35] text-[#9CA3AF] rounded-lg hover:bg-[#0A0C10]">
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
        <p className="text-[#6B7280] text-sm">Tag: {cow.cow_tag}</p>

        {/* Incomplete profile banner */}
        {(!cow.breed || !cow.name || !cow.source || !cow.purchase_date) && (
          <div className="mt-3 bg-amber-950 border border-amber-700 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="text-amber-400 text-base flex-shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="text-amber-300 text-sm font-bold">Profile incomplete</p>
                <p className="text-amber-400/80 text-xs mt-0.5">
                  {[
                    !cow.name && 'name',
                    !cow.breed && 'breed',
                    !cow.source && 'source',
                    !cow.purchase_date && 'acquisition date',
                  ].filter(Boolean).join(', ')} {' '}
                  missing — complete this for accurate milk projections and herd records.
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/dairy/cows/${cow.id}/edit`}
              className="flex-shrink-0 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition whitespace-nowrap"
            >
              Complete profile
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Basic Information */}
          <div className="bg-[#0D0F14] rounded-lg border border-[#2A2D35] p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-[#6B7280]">Name</span>
                <p className="font-medium text-white">{cow.name || '—'}</p>
              </div>
              <div>
                <span className="text-sm text-[#6B7280]">Tag/ID</span>
                <p className="font-medium text-white">{cow.cow_tag}</p>
              </div>
              <div>
                <span className="text-sm text-[#6B7280]">Breed</span>
                <p className="font-medium text-white">{cow.breed || '—'}</p>
              </div>
              <div>
                <span className="text-sm text-[#6B7280]">Age</span>
                <p className="font-medium text-white">{calculateAge(cow.birth_date)}</p>
              </div>
              <div>
                <span className="text-sm text-[#6B7280]">Sex</span>
                <p className="font-medium text-white capitalize">{cow.sex}</p>
              </div>
              <div>
                <span className="text-sm text-[#6B7280]">Purpose</span>
                <p className="font-medium text-white capitalize">{cow.purpose}</p>
              </div>
              <div>
                <span className="text-sm text-[#6B7280]">Status</span>
                <p className="font-medium text-white capitalize">{cow.status}</p>
              </div>
              <div>
                <span className="text-sm text-[#6B7280]">Birth Date</span>
                <p className="font-medium text-white">
                  {new Date(cow.birth_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Purchase Information */}
          {(cow.purchase_date || cow.purchase_price || cow.source) && (
            <div className="bg-[#0D0F14] rounded-lg border border-[#2A2D35] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Purchase Information</h2>
              <div className="grid grid-cols-2 gap-4">
                {cow.purchase_date && (
                  <div>
                    <span className="text-sm text-[#6B7280]">Purchase Date</span>
                    <p className="font-medium text-white">
                      {new Date(cow.purchase_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {cow.purchase_price && (
                  <div>
                    <span className="text-sm text-[#6B7280]">Purchase Price</span>
                    <p className="font-medium text-white">
                      KES {cow.purchase_price.toLocaleString()}
                    </p>
                  </div>
                )}
                {cow.source && (
                  <div className="col-span-2">
                    <span className="text-sm text-[#6B7280]">Source</span>
                    <p className="font-medium text-white">{cow.source}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {cow.notes && (
            <div className="bg-[#0D0F14] rounded-lg border border-[#2A2D35] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Notes</h2>
              <p className="text-[#9CA3AF]">{cow.notes}</p>
            </div>
          )}

        </div>

        {/* Right Column - Quick Actions & Stats */}
        <div className="space-y-6">
          
          {/* Quick Actions */}
          <div className="bg-[#0D0F14] rounded-lg border border-[#2A2D35] p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href={`/dashboard/dairy/milk/record?cow=${cow.id}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700"
              >
                <Milk size={14} strokeWidth={1.5} /> Record Milk
              </Link>
              <Link
                href="/dashboard/dairy/health"
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-red-600 text-white text-center rounded-lg hover:bg-red-700"
              >
                <Stethoscope size={14} strokeWidth={1.5} /> Add Health Record
              </Link>
              <Link
                href="/dashboard/dairy/breeding"
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-pink-600 text-white text-center rounded-lg hover:bg-pink-700"
              >
                <HeartPulse size={14} strokeWidth={1.5} /> Record Breeding
              </Link>
            </div>
          </div>

          {/* Production Stats Placeholder */}
          <div className="bg-[#0D0F14] rounded-lg border border-[#2A2D35] p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Production</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-[#6B7280]">Last 7 Days</span>
                <p className="text-2xl font-bold text-white">—</p>
                <p className="text-xs text-[#6B7280]">No milk records yet</p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-[#0A0C10] rounded-lg border border-[#2A2D35] p-4">
            <h3 className="text-sm font-semibold text-[#9CA3AF] mb-2">Record Info</h3>
            <p className="text-xs text-[#6B7280]">
              Added: {new Date(cow.created_at).toLocaleString()}
            </p>
            {cow.updated_at && cow.updated_at !== cow.created_at && (
              <p className="text-xs text-[#6B7280] mt-1">
                Updated: {new Date(cow.updated_at).toLocaleString()}
              </p>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}