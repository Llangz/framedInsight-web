'use client'

import { useState } from 'react'
import Link from 'next/link'

interface DairyAnimal {
  id: string
  animal_id: string
  breed: string
  date_of_birth: string
  status: string
  purchase_price: number
}

interface HerdClientProps {
  initialAnimals: DairyAnimal[]
  initialStats: {
    total: number
    active: number
    dry: number
    heifers: number
  }
}

export default function HerdClient({ initialAnimals, initialStats }: HerdClientProps) {
  const [animals] = useState<DairyAnimal[]>(initialAnimals)
  const [stats] = useState(initialStats)

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-green-100', text: 'text-green-800' },
      dry: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      heifer: { bg: 'bg-blue-100', text: 'text-blue-800' },
      sold: { bg: 'bg-gray-100', text: 'text-gray-800' },
      dead: { bg: 'bg-red-100', text: 'text-red-800' }
    }
    const style = statusStyles[status] || statusStyles.active
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 'Unknown'
    const birth = new Date(birthDate)
    const today = new Date()
    const age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return age - 1 + ' years'
    }
    return age + ' years'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Herd Management</h1>
            <p className="text-gray-600">Manage and track your dairy animals</p>
          </div>
          <Link
            href="/dashboard/dairy/add-cow"
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition duration-200"
          >
            + Add Cow
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Animals', value: stats.total, color: 'bg-blue-50 text-blue-700' },
            { label: 'Active Cows', value: stats.active, color: 'bg-green-50 text-green-700' },
            { label: 'Dry Cows', value: stats.dry, color: 'bg-yellow-50 text-yellow-700' },
            { label: 'Heifers', value: stats.heifers, color: 'bg-purple-50 text-purple-700' }
          ].map((stat) => (
            <div key={stat.label} className={`${stat.color} rounded-lg p-6 font-semibold`}>
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {animals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-600 mb-4">No animals in your herd yet</p>
            <Link
              href="/dashboard/dairy/add-cow"
              className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition duration-200"
            >
              Add Your First Cow
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Animal ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Breed</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Age</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Purchase Price</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {animals.map((animal) => (
                    <tr key={animal.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-semibold text-gray-900">{animal.animal_id}</td>
                      <td className="px-6 py-4 text-gray-700">{animal.breed}</td>
                      <td className="px-6 py-4 text-gray-700">{calculateAge(animal.date_of_birth)}</td>
                      <td className="px-6 py-4">{getStatusBadge(animal.status)}</td>
                      <td className="px-6 py-4 text-gray-700">
                        {animal.purchase_price ? `KES ${animal.purchase_price.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/dairy/herd/${animal.id}`} className="text-amber-600 hover:text-amber-800 font-medium">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
