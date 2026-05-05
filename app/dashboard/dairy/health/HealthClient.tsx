'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordHealthEvent } from './actions'

interface HealthClientProps {
  initialCows: any[]
  initialHistory: any[]
}

export default function HealthClient({ initialCows, initialHistory }: HealthClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab] = useState<'record' | 'history'>('record')

  const [formData, setFormData] = useState({
    animal_id: '',
    record_type: 'treatment',
    health_issue: '',
    medication: '',
    dosage: '',
    dosage_unit: 'ml',
    treatment_date: new Date().toISOString().split('T')[0],
    withdrawal_period_days: '0',
    veterinarian: '',
    cost: '',
    notes: ''
  })

  const recordTypes = [
    { value: 'treatment', label: 'Treatment' },
    { value: 'vaccination', label: 'Vaccination' },
    { value: 'diagnosis', label: 'Diagnosis' },
    { value: 'checkup', label: 'Health Checkup' }
  ]

  const commonIssues = [
    'Mastitis',
    'Foot and Mouth Disease',
    'Brucellosis',
    'Lameness',
    'Bloat',
    'Diarrhea',
    'Anemia',
    'Pregnancy Complications',
    'Other'
  ]

  const vaccinationTypes = [
    'Brucellosis',
    'Foot and Mouth Disease',
    'Anthrax',
    'Lumpy Skin Disease',
    'East Coast Fever',
    'Rinderpest',
    'Other'
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await recordHealthEvent(formData)

      setSuccess(`${formData.record_type === 'vaccination' ? 'Vaccination' : 'Health'} record added successfully!`)
      setFormData({
        animal_id: '',
        record_type: 'treatment',
        health_issue: '',
        medication: '',
        dosage: '',
        dosage_unit: 'ml',
        treatment_date: new Date().toISOString().split('T')[0],
        withdrawal_period_days: '0',
        veterinarian: '',
        cost: '',
        notes: ''
      })

      setTimeout(() => {
        router.refresh()
        setTab('history')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to record health information')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Health & Veterinary</h1>
          <p className="text-gray-600">Track medical treatments, vaccinations, and health records</p>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setTab('record')}
            className={`px-6 py-2 rounded-lg font-semibold transition duration-200 ${
              tab === 'record' ? 'bg-amber-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Record Health Event
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-6 py-2 rounded-lg font-semibold transition duration-200 ${
              tab === 'history' ? 'bg-amber-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Health History
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Cow *</label>
                <select
                  value={formData.animal_id}
                  onChange={(e) => setFormData({ ...formData, animal_id: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                >
                  <option value="">Choose a cow</option>
                  {initialCows.map((cow) => (
                    <option key={cow.id} value={cow.id}>
                      {cow.animal_id || cow.cow_tag}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Record Type *</label>
                <select
                  value={formData.record_type}
                  onChange={(e) => setFormData({ ...formData, record_type: e.target.value, health_issue: '' })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                >
                  {recordTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {formData.record_type === 'vaccination' ? 'Vaccine Type' : 'Health Issue'} *
                </label>
                <select
                  value={formData.health_issue}
                  onChange={(e) => setFormData({ ...formData, health_issue: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                >
                  <option value="">Select an issue</option>
                  {(formData.record_type === 'vaccination' ? vaccinationTypes : commonIssues).map((issue) => (
                    <option key={issue} value={issue}>
                      {issue}
                    </option>
                  ))}
                </select>
              </div>

              {formData.record_type === 'treatment' && (
                <div className="bg-blue-50 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-gray-900">Treatment Details</h3>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Medication Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Amoxicillin"
                      value={formData.medication}
                      onChange={(e) => setFormData({ ...formData, medication: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Dosage</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="100"
                        value={formData.dosage}
                        onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Unit</label>
                      <select
                        value={formData.dosage_unit}
                        onChange={(e) => setFormData({ ...formData, dosage_unit: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="ml">ml</option>
                        <option value="l">L</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="tablet">tablet</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Withdrawal Period (Days)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.withdrawal_period_days}
                      onChange={(e) => setFormData({ ...formData, withdrawal_period_days: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <p className="text-gray-500 text-xs mt-1">Days before milk/meat can be used for sale</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {formData.record_type === 'vaccination' ? 'Vaccination' : 'Treatment'} Date *
                </label>
                <input
                  type="date"
                  value={formData.treatment_date}
                  onChange={(e) => setFormData({ ...formData, treatment_date: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Veterinarian Name</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={formData.veterinarian}
                    onChange={(e) => setFormData({ ...formData, veterinarian: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Cost (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  placeholder="Additional observations or recommendations..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                ></textarea>
              </div>

              <div className="flex gap-4 pt-6 border-t">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition duration-200"
                >
                  {loading ? 'Recording...' : 'Record Health Event'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {tab === 'history' && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {initialHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No health history found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Cow</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Type</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Issue/Vaccine</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Details</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Vet & Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {initialHistory.map((record) => (
                      <tr key={`${record.record_type === 'vaccination' ? 'v' : 't'}-${record.id}`} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm text-gray-900">{new Date(record.treatment_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.cows?.animal_id || record.cows?.cow_tag}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${record.record_type === 'vaccination' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                            {record.record_type ? record.record_type.charAt(0).toUpperCase() + record.record_type.slice(1) : 'Treatment'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{record.disease || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{record.drug_name ? `Med: ${record.drug_name}` : (record.treatment || '-')}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {record.vet_name || 'Unknown'}
                          {record.cost ? <span className="block text-xs text-gray-500">KES {record.cost}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-orange-50 border border-orange-200 rounded-lg p-6">
          <h3 className="font-semibold text-orange-900 mb-3">⚠️ Important Health Protocol</h3>
          <ul className="text-orange-800 space-y-2 text-sm">
            <li>• Always record withdrawal periods for medication to ensure food safety</li>
            <li>• Keep vaccinations up to date according to government guidelines</li>
            <li>• Mastitis (bacterial infection) requires immediate treatment to prevent spread</li>
            <li>• Maintain quarantine for sick animals to prevent disease transmission</li>
            <li>• Consult with veterinarians for proper diagnosis and treatment plans</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
