'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addCow } from './actions'

const BREEDS = [
  'Holstein Friesian (HF)', 'Jersey', 'Guernsey', 'Ayrshire', 'Sahiwal', 'Boran', 'Crossbreed', 'Other'
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'sold', label: 'Sold' },
  { value: 'deceased', label: 'Deceased' }
]

export default function AddCowClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    animal_id: '',
    breed: '',
    date_of_birth: '',
    purchase_date: '',
    purchase_price: '',
    tag_number: '',
    status: 'active'
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await addCow(formData)
      setSuccess('Cow added successfully!')
      setTimeout(() => router.push('/dashboard/dairy/herd'), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to add cow')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Add Dairy Animal</h1>
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border shadow-sm space-y-6">
          {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}
          {success && <div className="p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">{success}</div>}
          
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Animal ID / Name *</label>
                <input
                  type="text"
                  value={formData.animal_id}
                  onChange={e => setFormData({...formData, animal_id: e.target.value})}
                  placeholder="e.g., Bessie, COW-001"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tag Number</label>
                <input
                  type="text"
                  value={formData.tag_number}
                  onChange={e => setFormData({...formData, tag_number: e.target.value})}
                  placeholder="e.g., TAG-123"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Breed *</label>
                <select
                  value={formData.breed}
                  onChange={e => setFormData({...formData, breed: e.target.value})}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                >
                  <option value="">Select breed</option>
                  {BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth *</label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={e => setFormData({...formData, date_of_birth: e.target.value})}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Purchase Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Purchase Information (Optional)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Purchase Date</label>
                <input
                  type="date"
                  value={formData.purchase_date}
                  onChange={e => setFormData({...formData, purchase_date: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Purchase Price (KES)</label>
                <input
                  type="number"
                  value={formData.purchase_price}
                  onChange={e => setFormData({...formData, purchase_price: e.target.value})}
                  placeholder="e.g., 50000"
                  min="0"
                  step="100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
            <select
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white rounded-lg font-bold transition-colors"
            >
              {loading ? 'Adding...' : 'Add to Herd'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
