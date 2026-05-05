'use client'

import Link from 'next/link'

interface CowCardProps {
  cow: any
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

  const statusColors = {
    active: 'bg-green-100 text-green-800 border-green-200',
    sold: 'bg-blue-100 text-blue-800 border-blue-200',
    deceased: 'bg-gray-100 text-gray-800 border-gray-200',
  }

  const statusEmoji = {
    active: '✓',
    sold: '💰',
    deceased: '✝',
  }

  return (
    <Link
      href={`/dashboard/dairy/cows/${cow.id}`}
      className="block bg-white rounded-lg border-2 border-gray-200 hover:border-primary-400 hover:shadow-md transition-all p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {cow.name || cow.cow_tag}
          </h3>
          {cow.name && (
            <p className="text-sm text-gray-500">Tag: {cow.cow_tag}</p>
          )}
        </div>
        <div className={`
          px-2 py-1 rounded-full border text-xs font-medium
          ${statusColors[cow.status as keyof typeof statusColors] || statusColors.active}
        `}>
          {statusEmoji[cow.status as keyof typeof statusEmoji]} {cow.status}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-gray-500">Breed:</span>
          <p className="font-medium text-gray-900">{cow.breed || 'Unknown'}</p>
        </div>
        <div>
          <span className="text-gray-500">Age:</span>
          <p className="font-medium text-gray-900">{calculateAge(cow.birth_date)}</p>
        </div>
        <div>
          <span className="text-gray-500">Sex:</span>
          <p className="font-medium text-gray-900 capitalize">{cow.sex || 'Unknown'}</p>
        </div>
        <div>
          <span className="text-gray-500">Purpose:</span>
          <p className="font-medium text-gray-900 capitalize">{cow.purpose || 'Dairy'}</p>
        </div>
      </div>

      {/* Notes Preview */}
      {cow.notes && (
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600 line-clamp-2">{cow.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
        <span>Added {new Date(cow.created_at).toLocaleDateString()}</span>
        <span className="text-primary-600 font-medium">View Details →</span>
      </div>
    </Link>
  )
}
