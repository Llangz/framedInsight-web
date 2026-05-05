'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { recordMilk } from './actions'

interface Cow {
  id: string;
  cow_tag: string;
}

export default function RecordMilkClient({ initialCows }: { initialCows: Cow[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    cow_id: '',
    record_date: new Date().toISOString().split('T')[0],
    morning_milk: '',
    evening_milk: '',
    milk_quality: '',
    lactation_number: '',
    notes: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await recordMilk(formData)
      setSuccess('Milk record added successfully!')
      setFormData({
        cow_id: '',
        record_date: new Date().toISOString().split('T')[0],
        morning_milk: '',
        evening_milk: '',
        milk_quality: '',
        lactation_number: '',
        notes: ''
      })
      setTimeout(() => router.push('/dashboard/dairy'), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to record milk')
    } finally {
      setLoading(false)
    }
  }

  const morningMilk = parseFloat(formData.morning_milk) || 0
  const eveningMilk = parseFloat(formData.evening_milk) || 0
  const totalDaily = morningMilk + eveningMilk

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Record Milk Production</h1>
          <p className="text-gray-600">Log daily milk production for your dairy animals</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}
          {success && <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">✓ {success}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Select Cow *</label>
              <select value={formData.cow_id} onChange={(e) => setFormData({ ...formData, cow_id: e.target.value })} required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none">
                <option value="">Choose an animal</option>
                {initialCows.map((cow) => <option key={cow.id} value={cow.id}>{cow.cow_tag}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Recording Date *</label>
              <input type="date" value={formData.record_date} onChange={(e) => setFormData({ ...formData, record_date: e.target.value })} required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
            </div>

            <div className="bg-blue-50 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Milk Production</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <input type="number" step="0.1" placeholder="Morning (L)" value={formData.morning_milk} onChange={(e) => setFormData({ ...formData, morning_milk: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
                <input type="number" step="0.1" placeholder="Evening (L)" value={formData.evening_milk} onChange={(e) => setFormData({ ...formData, evening_milk: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
              </div>
              <div className="bg-white rounded p-4 border-l-4 border-green-500">
                <p className="text-gray-600 text-sm">Daily Total</p>
                <p className="text-3xl font-bold text-green-600">{totalDaily.toFixed(1)} L</p>
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t">
              <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg">
                {loading ? 'Recording...' : 'Record Production'}
              </button>
              <button type="button" onClick={() => router.back()} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
