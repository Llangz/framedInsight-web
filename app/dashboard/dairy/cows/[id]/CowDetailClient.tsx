'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="text-2xl font-bold text-gray-900">
              {cow.name || cow.cow_tag}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
        <p className="text-gray-600 text-sm">Tag: {cow.cow_tag}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Basic Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Name</span>
                <p className="font-medium text-gray-900">{cow.name || '—'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Tag/ID</span>
                <p className="font-medium text-gray-900">{cow.cow_tag}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Breed</span>
                <p className="font-medium text-gray-900">{cow.breed || '—'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Age</span>
                <p className="font-medium text-gray-900">{calculateAge(cow.birth_date)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Sex</span>
                <p className="font-medium text-gray-900 capitalize">{cow.sex}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Purpose</span>
                <p className="font-medium text-gray-900 capitalize">{cow.purpose}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Status</span>
                <p className="font-medium text-gray-900 capitalize">{cow.status}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Birth Date</span>
                <p className="font-medium text-gray-900">
                  {new Date(cow.birth_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Purchase Information */}
          {(cow.purchase_date || cow.purchase_price || cow.source) && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Purchase Information</h2>
              <div className="grid grid-cols-2 gap-4">
                {cow.purchase_date && (
                  <div>
                    <span className="text-sm text-gray-500">Purchase Date</span>
                    <p className="font-medium text-gray-900">
                      {new Date(cow.purchase_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {cow.purchase_price && (
                  <div>
                    <span className="text-sm text-gray-500">Purchase Price</span>
                    <p className="font-medium text-gray-900">
                      KES {cow.purchase_price.toLocaleString()}
                    </p>
                  </div>
                )}
                {cow.source && (
                  <div className="col-span-2">
                    <span className="text-sm text-gray-500">Source</span>
                    <p className="font-medium text-gray-900">{cow.source}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {cow.notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              <p className="text-gray-700">{cow.notes}</p>
            </div>
          )}

        </div>

        {/* Right Column - Quick Actions & Stats */}
        <div className="space-y-6">
          
          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href={`/dashboard/dairy/milk/record?cow=${cow.id}`}
                className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700"
              >
                🥛 Record Milk
              </Link>
              <Link
                href={`/dashboard/dairy/health/add?cow=${cow.id}`}
                className="block w-full px-4 py-2 bg-red-600 text-white text-center rounded-lg hover:bg-red-700"
              >
                💉 Add Health Record
              </Link>
              <Link
                href={`/dashboard/dairy/breeding/add?cow=${cow.id}`}
                className="block w-full px-4 py-2 bg-pink-600 text-white text-center rounded-lg hover:bg-pink-700"
              >
                🐂 Record Breeding
              </Link>
            </div>
          </div>

          {/* Production Stats Placeholder */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Production</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Last 7 Days</span>
                <p className="text-2xl font-bold text-gray-900">—</p>
                <p className="text-xs text-gray-500">No milk records yet</p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Record Info</h3>
            <p className="text-xs text-gray-600">
              Added: {new Date(cow.created_at).toLocaleString()}
            </p>
            {cow.updated_at && cow.updated_at !== cow.created_at && (
              <p className="text-xs text-gray-600 mt-1">
                Updated: {new Date(cow.updated_at).toLocaleString()}
              </p>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
