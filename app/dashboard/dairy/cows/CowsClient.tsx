'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PlusCircle, Search } from 'lucide-react'
import CowCard from '../components/CowCard'

type Status = 'all' | 'active' | 'sold' | 'deceased'
type Sort   = 'recent' | 'name' | 'age'

export default function CowsClient({ initialCows }: { initialCows: any[] }) {
  const [query,        setQuery]        = useState('')
  const [statusFilter, setStatusFilter] = useState<Status>('all')
  const [sortBy,       setSortBy]       = useState<Sort>('recent')

  const filtered = useMemo(() => {
    let list = [...initialCows]
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.cow_tag?.toLowerCase().includes(q) ||
        c.breed?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter)
    list.sort((a, b) => {
      if (sortBy === 'name')   return (a.name || a.cow_tag || '').localeCompare(b.name || b.cow_tag || '')
      if (sortBy === 'age')    return new Date(a.birth_date || 0).getTime() - new Date(b.birth_date || 0).getTime()
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
    return list
  }, [initialCows, query, statusFilter, sortBy])

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Cows</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{initialCows.length} registered</p>
        </div>
        <Link href="/dashboard/dairy/add-cow"
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors">
          <PlusCircle size={14} /> Add cow
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or breed…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-[#2A2D35] bg-[#0D0F14] text-white placeholder-[#4B5563] focus:outline-none focus:ring-1 focus:ring-emerald-700"
            style={{ WebkitTextFillColor: 'white', color: 'white' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status)}
          className="px-3 py-2 text-sm rounded-md border border-[#2A2D35] bg-[#0D0F14] text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-emerald-700"
          style={{ WebkitTextFillColor: '#9CA3AF', color: '#9CA3AF' }}>
          {['all', 'active', 'dry', 'heifer', 'sold', 'deceased'].map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as Sort)}
          className="px-3 py-2 text-sm rounded-md border border-[#2A2D35] bg-[#0D0F14] text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-emerald-700"
          style={{ WebkitTextFillColor: '#9CA3AF', color: '#9CA3AF' }}>
          <option value="recent">Most recent</option>
          <option value="name">Name A–Z</option>
          <option value="age">Oldest first</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#2A2D35] p-12 text-center">
          <p className="text-sm text-[#6B7280] mb-4">
            {query ? `No animals match "${query}"` : 'No animals in your herd yet'}
          </p>
          {!query && (
            <Link href="/dashboard/dairy/add-cow"
              className="inline-flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400">
              <PlusCircle size={14} /> Add your first cow
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(cow => <CowCard key={cow.id} cow={cow} />)}
        </div>
      )}
    </div>
  )
}