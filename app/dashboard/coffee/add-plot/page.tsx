'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EventStore, PlotCreatedEvent } from '@/lib/event-sourcing'
import { KENYA_LOCATIONS, getConstituencies, getWards } from '@/lib/kenya-locations'

interface FormData {
  plotName: string
  variety: string
  plotSize: string
  numPlants: string
  county: string
  constituency: string
  ward: string
  altitude: string
  shadePercentage: string
  lastPruningDate: string
}

export default function AddCoffeePlotPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<FormData>({
    plotName: '',
    variety: 'SL28',
    plotSize: '',
    numPlants: '',
    county: '',
    constituency: '',
    ward: '',
    altitude: '',
    shadePercentage: '30',
    lastPruningDate: '',
  })

  const constituencies = getConstituencies(formData.county)
  const wards = getWards(formData.constituency)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!formData.plotName.trim()) throw new Error('Plot name is required')
      if (!formData.plotSize) throw new Error('Plot size is required')
      if (!formData.numPlants) throw new Error('Number of plants is required')
      if (!formData.county) throw new Error('County is required')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // Get farm ID from user
      const { data: farmManager } = await supabase
        .from('farm_managers')
        .select('farm_id')
        .eq('user_id', session.user.id)
        .single()

      if (!farmManager) throw new Error('No farm found')

      // Insert coffee plot - only schema-valid columns
      const { data, error: insertError } = await supabase
        .from('coffee_plots')
        .insert([{
          farm_id: farmManager.farm_id,
          plot_name: formData.plotName,
          variety: formData.variety || null,
          area_hectares: formData.plotSize
            ? parseFloat(formData.plotSize) * 0.404686
            : null,
          total_trees: formData.numPlants ? parseInt(formData.numPlants) : undefined,
          region_name: formData.ward || formData.constituency || formData.county || null,
          plant_status: 'active',
          notes: [
            formData.altitude ? `Altitude: ${formData.altitude}m` : null,
            formData.shadePercentage ? `Shade: ${formData.shadePercentage}%` : null,
            formData.lastPruningDate ? `Last pruning: ${formData.lastPruningDate}` : null,
          ].filter(Boolean).join(', ') || null,
        }])
        .select()

      if (insertError) throw insertError

      router.push('/dashboard/coffee')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add plot')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add Coffee Plot</h1>
          <p className="text-gray-600 mt-2">Register a new coffee plot on your farm</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plot Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Plot Information</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plot Name *
                </label>
                <input
                  type="text"
                  name="plotName"
                  value={formData.plotName}
                  onChange={handleChange}
                  placeholder="e.g., North Plot, East Field"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coffee Variety *
                  </label>
                  <select
                    name="variety"
                    value={formData.variety}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="SL28">SL28</option>
                    <option value="SL34">SL34</option>
                    <option value="Ruiru 11">Ruiru 11</option>
                    <option value="Batian">Batian</option>
                    <option value="K7">K7</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plot Size (acres) *
                  </label>
                  <input
                    type="number"
                    name="plotSize"
                    value={formData.plotSize}
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    placeholder="0.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Plants *
                  </label>
                  <input
                    type="number"
                    name="numPlants"
                    value={formData.numPlants}
                    onChange={handleChange}
                    min="0"
                    placeholder="1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Altitude (meters)
                  </label>
                  <input
                    type="number"
                    name="altitude"
                    value={formData.altitude}
                    onChange={handleChange}
                    min="0"
                    placeholder="1500"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Location</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  County *
                </label>
                <select
                  name="county"
                  value={formData.county}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Select county</option>
                  {KENYA_LOCATIONS.map(county => (
                    <option key={county.id} value={county.name}>
                      {county.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Constituency
                </label>
                <select
                  name="constituency"
                  value={formData.constituency}
                  onChange={handleChange}
                  disabled={!formData.county}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                >
                  <option value="">Select constituency</option>
                  {constituencies?.map(const_r => (
                    <option key={const_r.id} value={const_r.name}>
                      {const_r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ward
                </label>
                <select
                  name="ward"
                  value={formData.ward}
                  onChange={handleChange}
                  disabled={!formData.constituency}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                >
                  <option value="">Select ward</option>
                  {wards?.map(ward => (
                    <option key={ward.id} value={ward.name}>
                      {ward.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shade Tree Percentage (%)
                </label>
                <input
                  type="number"
                  name="shadePercentage"
                  value={formData.shadePercentage}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Pruning Date
                </label>
                <input
                  type="date"
                  name="lastPruningDate"
                  value={formData.lastPruningDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Adding Plot...' : 'Add Plot'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold py-2 px-4 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
