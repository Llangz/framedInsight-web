'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addCow } from './actions'

const BREEDS = [
  'Holstein Friesian (HF)', 'Jersey', 'Guernsey', 'Ayrshire', 'Sahiwal', 'Boran', 'Crossbreed', 'Other'
]

export default function AddCowClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    animal_id: '', breed: '', date_of_birth: '', purchase_date: '', purchase_price: '', tag_number: '', status: 'active'
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
        <h1 className="text-3xl font-bold mb-6">Add Dairy Animal</h1>
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border shadow-sm space-y-6">
          {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}
          {success && <div className="p-4 bg-green-50 text-green-700 rounded-lg">{success}</div>}
          
          <div>
            <label className="block text-sm font-bold mb-2">Animal ID *</label>
            <input type="text" value={formData.animal_id} onChange={e => setFormData({...formData, animal_id: e.target.value})} required className="w-full p-3 border rounded-xl" />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Breed *</label>
            <select value={formData.breed} onChange={e => setFormData({...formData, breed: e.target.value})} required className="w-full p-3 border rounded-xl">
              <option value="">Select breed</option>
              {BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="flex gap-4">
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold">{loading ? 'Adding...' : 'Add to Herd'}</button>
            <button type="button" onClick={() => router.back()} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
