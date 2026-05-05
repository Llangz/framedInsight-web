'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import CowCard from '../components/CowCard'

interface CowsClientProps {
  initialCows: any[]
}

export default function CowsClient({ initialCows }: CowsClientProps) {
  const [cows] = useState<any[]>(initialCows)
  const [filteredCows, setFilteredCows] = useState<any[]>(initialCows)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'sold' | 'deceased'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'age' | 'recent'>('recent')

  useEffect(() => {
    let filtered = [...cows]

    // Filter by search term
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(cow => 
        cow.name?.toLowerCase().includes(q) ||
        cow.cow_tag?.toLowerCase().includes(q) ||
        cow.breed?.toLowerCase().includes(q)
      )
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(cow => cow.status === statusFilter)
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || a.cow_tag || '').localeCompare(b.name || b.cow_tag || '')
        case 'age':
          return new Date(a.birth_date || 0).getTime() - new Date(b.birth_date || 0).getTime()
        case 'recent':
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
    })

    setFilteredCows(filtered)
  }, [cows, searchTerm, statusFilter, sortBy])

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Cows</h1>
            <p className="text-gray-600 text-sm mt-1">{cows.length} total cows</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/dairy"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back
            </Link>
            <Link
              href="/dashboard/dairy/cows/add"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <span>+</span>
              <span>Add Cow</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Name, tag, or breed..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="deceased">Deceased</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="recent">Recently Added</option>
              <option value="name">Name (A-Z)</option>
              <option value="age">Age (Youngest First)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Cow List */}
      {filteredCows.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-4">🐄</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || statusFilter !== 'all' ? 'No cows found' : 'No cows yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your filters'
              : 'Add your first cow to get started'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Link
              href="/dashboard/dairy/cows/add"
              className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Add Your First Cow
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCows.map((cow) => (
            <CowCard key={cow.id} cow={cow} />
          ))}
        </div>
      )}
    </div>
  )
}
