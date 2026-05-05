'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordBreeding } from './actions'

interface BreedingClientProps {
  initialCows: any[]
  initialHistory: any[]
}

export default function BreedingClient({ initialCows, initialHistory }: BreedingClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab] = useState<'record' | 'history'>('record')

  const [formData, setFormData] = useState({
    dam_id: '',
    service_date: new Date().toISOString().split('T')[0],
    service_type: 'AI',
    sire_id: '',
    sire_name: '',
    notes: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await recordBreeding(formData)
      setSuccess('Breeding record added successfully!')
      setFormData({
        dam_id: '',
        service_date: new Date().toISOString().split('T')[0],
        service_type: 'AI',
        sire_id: '',
        sire_name: '',
        notes: ''
      })

      setTimeout(() => {
        router.refresh()
        setTab('history')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to record breeding event')
    } finally {
      setLoading(false)
    }
  }

  const calculateDueDate = () => {
    if (!formData.service_date) return ''
    const serviceDate = new Date(formData.service_date)
    const dueDate = new Date(serviceDate.getTime() + 283 * 24 * 60 * 60 * 1000)
    return dueDate.toISOString().split('T')[0]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Breeding Management</h1>
          <p className="text-gray-600">Track breeding events and calving dates</p>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setTab('record')}
            className={`px-6 py-2 rounded-lg font-semibold transition duration-200 ${ tab === 'record' ? 'bg-pink-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50' }`}
          >
            Record Service
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-6 py-2 rounded-lg font-semibold transition duration-200 ${ tab === 'history' ? 'bg-pink-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50' }`}
          >
            Breeding History
          </button>
        </div>

        {tab === 'record' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 font-medium">✓ {success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Cow (Dam) *</label>
                <select value={formData.dam_id} onChange={(e) => setFormData({ ...formData, dam_id: e.target.value })} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none">
                  <option value="">Choose a cow</option>
                  {initialCows.map((cow) => ( <option key={cow.id} value={cow.id}>{cow.animal_id}</option> ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Service Date *</label>
                <input type="date" value={formData.service_date} onChange={(e) => setFormData({ ...formData, service_date: e.target.value })} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Service Type *</label>
                <select value={formData.service_type} onChange={(e) => setFormData({ ...formData, service_type: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none">
                  <option value="AI">Artificial Insemination (AI)</option>
                  <option value="natural">Natural Service</option>
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{formData.service_type === 'AI' ? 'Semen Batch/Code' : 'Sire (Bull) ID'}</label>
                  <input type="text" placeholder={formData.service_type === 'AI' ? 'e.g., HF-2024-001' : 'e.g., BULL-001'} value={formData.sire_id} onChange={(e) => setFormData({ ...formData, sire_id: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sire Name/Breed Info</label>
                  <input type="text" placeholder="e.g., Holstein Friesian" value={formData.sire_name} onChange={(e) => setFormData({ ...formData, sire_name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none" />
                </div>
              </div>

              <div className="bg-pink-50 rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-1">Expected Calving Date (283 days post-service)</p>
                <p className="text-2xl font-bold text-pink-700">{calculateDueDate().replace(/-/g, '/')}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                <textarea placeholder="Any additional information..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={4} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"></textarea>
              </div>

              <div className="flex gap-4 pt-6 border-t">
                <button type="submit" disabled={loading} className="flex-1 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition duration-200">{loading ? 'Recording...' : 'Record Service'}</button>
                <button type="button" onClick={() => router.back()} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition duration-200">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {tab === 'history' && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {initialHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No breeding history found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Service Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Cow (Dam)</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Type & Sire</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Expected Calving</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {initialHistory.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm text-gray-900">{new Date(event.service_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{event.cows?.animal_id || event.cows?.cow_tag}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{event.service_type === 'AI' ? 'AI' : 'Natural'} ({event.bull_code || 'Unknown'})</td>
                        <td className="px-6 py-4 text-sm font-semibold text-pink-600">{new Date(event.expected_calving_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${event.pregnancy_result === 'positive' ? 'bg-green-100 text-green-800' : event.pregnancy_result === 'negative' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {event.pregnancy_result || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-rose-50 border border-rose-200 rounded-lg p-6">
          <h3 className="font-semibold text-rose-900 mb-3">Breeding Management</h3>
          <ul className="text-rose-800 space-y-2 text-sm">
            <li>Gestation: 283 days</li>
            <li>Heat cycle: 21 days</li>
            <li>AI success: 60-70%</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
