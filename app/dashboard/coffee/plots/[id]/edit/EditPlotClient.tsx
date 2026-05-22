'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Database } from '@/lib/database.types'

type CoffeePlot = Database['public']['Tables']['coffee_plots']['Row']

interface EditPlotClientProps {
  plot: CoffeePlot
}

export default function EditPlotClient({ plot }: EditPlotClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    plot_name: plot.plot_name || '',
    variety: plot.variety || '',
    total_trees: plot.total_trees?.toString() || '',
    productive_trees: plot.productive_trees?.toString() || '',
    area_hectares: plot.area_hectares?.toString() || '',
    establishment_year: plot.establishment_year?.toString() || '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/coffee/plots/${plot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update plot')
      }

      setSuccess('Plot updated successfully!')
      setTimeout(() => router.push(`/dashboard/coffee/plots/${plot.id}`), 1500)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/dashboard/coffee/plots/${plot.id}`} className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            ←
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Coffee Plot</h1>
            <p className="text-gray-600 text-sm mt-1">{plot.plot_name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 md:p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Plot Name</label>
              <input
                type="text"
                value={formData.plot_name}
                onChange={e => setFormData({...formData, plot_name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Variety</label>
              <select
                value={formData.variety}
                onChange={e => setFormData({...formData, variety: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">Select variety</option>
                <option value="SL28">SL28</option>
                <option value="SL34">SL34</option>
                <option value="Ruiru 11">Ruiru 11</option>
                <option value="Batian">Batian</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Total Trees</label>
              <input
                type="number"
                value={formData.total_trees}
                onChange={e => setFormData({...formData, total_trees: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Productive Trees</label>
              <input
                type="number"
                value={formData.productive_trees}
                onChange={e => setFormData({...formData, productive_trees: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Area (hectares)</label>
              <input
                type="number"
                step="0.01"
                value={formData.area_hectares}
                onChange={e => setFormData({...formData, area_hectares: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Establishment Year</label>
              <input
                type="number"
                value={formData.establishment_year}
                onChange={e => setFormData({...formData, establishment_year: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href={`/dashboard/coffee/plots/${plot.id}`}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-semibold text-center transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
