'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const KENYAN_BREEDS = [
  'Friesian',
  'Ayrshire',
  'Guernsey',
  'Jersey',
  'Crossbreed (Friesian)',
  'Crossbreed (Ayrshire)',
  'Crossbreed (Mixed)',
  'Sahiwal',
  'Boran',
  'Other'
]

export default function AddCowPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<any>({})
  
  const [formData, setFormData] = useState({
    cow_tag: '',
    name: '',
    breed: '',
    birth_date: '',
    sex: 'female',
    purpose: 'dairy',
    status: 'active',
    purchase_date: '',
    purchase_price: '',
    source: '',
    notes: ''
  })

  function validateForm() {
    const newErrors: any = {}

    if (!formData.cow_tag.trim()) {
      newErrors.cow_tag = 'Tag/ID is required'
    }

    if (!formData.birth_date) {
      newErrors.birth_date = 'Birth date is required'
    } else {
      const birthDate = new Date(formData.birth_date)
      const today = new Date()
      if (birthDate > today) {
        newErrors.birth_date = 'Birth date cannot be in the future'
      }
    }

    if (formData.purchase_date) {
      const purchaseDate = new Date(formData.purchase_date)
      const birthDate = new Date(formData.birth_date)
      if (purchaseDate < birthDate) {
        newErrors.purchase_date = 'Purchase date cannot be before birth date'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('Please log in to add cows')
        router.push('/auth/signin')
        return
      }

      // Get farm ID
      const { data: farmManager } = await supabase
        .from('farm_managers')
        .select('farm_id')
        .eq('user_id', user.id)
        .single()

      if (!farmManager) {
        alert('Farm not found')
        return
      }

      // Prepare data
      const cowData = {
        farm_id: farmManager.farm_id,
        cow_tag: formData.cow_tag.trim(),
        name: formData.name.trim() || null,
        breed: formData.breed || null,
        birth_date: formData.birth_date,
        sex: formData.sex,
        purpose: formData.purpose,
        status: formData.status,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        source: formData.source.trim() || null,
        notes: formData.notes.trim() || null
      }

      const { data, error } = await supabase
        .from('cows')
        .insert([cowData])
        .select()
        .single()

      if (error) throw error

      router.push(`/dashboard/dairy/cows/${data.id}`)
    } catch (error: any) {
      console.error('Error adding cow:', error)
      if (error.code === '23505') {
        setErrors({ cow_tag: 'This tag already exists' })
      } else {
        alert('Failed to add cow. Please try again.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Add New Cow</h1>
            <Link
              href="/dashboard/dairy/cows"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Cancel
            </Link>
          </div>
          <p className="text-gray-600 text-sm mt-1">Enter the cow's details below</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Cow Tag (Required) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cow Tag/ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.cow_tag}
                  onChange={(e) => setFormData({...formData, cow_tag: e.target.value})}
                  placeholder="e.g., COW-001, TAG-123"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.cow_tag ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
                {errors.cow_tag && <p className="text-red-600 text-sm mt-1">{errors.cow_tag}</p>}
              </div>

              {/* Name (Optional) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-xs text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Wanjiru, Mwende"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Breed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Breed</label>
                <select
                  value={formData.breed}
                  onChange={(e) => setFormData({...formData, breed: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select breed</option>
                  {KENYAN_BREEDS.map(breed => (
                    <option key={breed} value={breed}>{breed}</option>
                  ))}
                </select>
              </div>

              {/* Birth Date (Required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Birth Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.birth_date ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
                {errors.birth_date && <p className="text-red-600 text-sm mt-1">{errors.birth_date}</p>}
              </div>

              {/* Sex */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
                <select
                  value={formData.sex}
                  onChange={(e) => setFormData({...formData, sex: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                <select
                  value={formData.purpose}
                  onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="dairy">Dairy</option>
                  <option value="beef">Beef</option>
                  <option value="breeding">Breeding</option>
                  <option value="dual">Dual Purpose</option>
                </select>
              </div>

            </div>
          </div>

          {/* Purchase Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Purchase Information <span className="text-xs text-gray-500 font-normal">(Optional)</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Purchase Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.purchase_date ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.purchase_date && <p className="text-red-600 text-sm mt-1">{errors.purchase_date}</p>}
              </div>

              {/* Purchase Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (KES)</label>
                <input
                  type="number"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                  placeholder="e.g., 50000"
                  min="0"
                  step="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Source */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({...formData, source: e.target.value})}
                  placeholder="e.g., Local market, Farm ABC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-xs text-gray-500">(Optional)</span></label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Any additional information..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Link
              href="/dashboard/dairy/cows"
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Cow'}
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}
