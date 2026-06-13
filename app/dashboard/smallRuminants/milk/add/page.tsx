'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function AddMilkRecordPage() {
  const searchParams = useSearchParams()
  const preselectedAnimalId = searchParams.get('animal_id')
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
      animal_id: preselectedAnimalId || '',
      record_date: new Date().toISOString().split('T')[0],
      morning_milk: '',
      evening_milk: '',
      total_milk: '',
      lactation_number: '',
      days_in_milk: '',
      notes: '',
    })
  const [animals, setAnimals] = useState<any[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: fm } = await supabase
          .from('farm_managers')
          .select('farm_id')
          .eq('user_id', user.id)
          .single()
        
        if (fm) {
          setFarmId(fm.farm_id)
                    const { data: animalData } = await supabase
            .from('small_ruminants')
            .select('id, animal_tag, name, breed, status, purpose')
            .eq('farm_id', fm.farm_id)
            .eq('status', 'active')
            .in('purpose', ['dairy', 'dual'])
            .order('animal_tag')
          if (animalData) setAnimals(animalData)
        }
      } catch (err) {
        console.error('Failed to load animals:', err)
      }
    }
    loadData()
  }, [])

    const set = (key: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [key]: value }
      if (key === 'morning_milk' || key === 'evening_milk') {
              const morning = parseFloat(updated.morning_milk) || 0
              const evening = parseFloat(updated.evening_milk) || 0
              updated.total_milk = (morning + evening).toString()
            }
      return updated
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

            const payload = {
                    animal_id: formData.animal_id,
                    record_date: formData.record_date,
                    morning_milk: parseFloat(formData.morning_milk) || null,
                    evening_milk: parseFloat(formData.evening_milk) || null,
                    total_milk: parseFloat(formData.total_milk) || null,
                    lactation_number: formData.lactation_number ? parseInt(formData.lactation_number) : null,
                    days_in_milk: formData.days_in_milk ? parseInt(formData.days_in_milk) : null,
                    notes: formData.notes || null,
                  }

      const { error } = await supabase
        .from('goat_milk_records')
        .insert(payload)

      if (error) throw error

      setSuccess(true)
            setFormData({
                    animal_id: '',
                    record_date: new Date().toISOString().split('T')[0],
                    morning_milk: '',
                    evening_milk: '',
                    total_milk: '',
                    lactation_number: '',
                    days_in_milk: '',
                    notes: '',
                  })
    } catch (err: any) {
      setError(err.message || 'Failed to save milk record')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 lg:p-8 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Record Milk Production</h1>
          <Link href="/dashboard/smallRuminants/milk" className="text-sm text-slate-600 hover:text-slate-900">
            ← Back
          </Link>
        </div>

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
            ✓ Milk record saved successfully!
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Animal *</label>
            <select
              value={formData.animal_id}
                            onChange={(e) => set('animal_id', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a goat/sheep...</option>
                            {animals.map(animal => (
                                            <option key={animal.id} value={animal.id}>
                  {animal.animal_tag} {animal.name ? `(${animal.name})` : ''} - {animal.breed || 'Unknown breed'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
            <input
              type="date"
              value={formData.record_date}
              onChange={(e) => set('record_date', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Morning (L)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formData.morning_milk}
                          onChange={(e) => set('morning_milk', e.target.value)}
                          placeholder="0.0"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Evening (L)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formData.evening_milk}
                          onChange={(e) => set('evening_milk', e.target.value)}
                          placeholder="0.0"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

          <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Total (L)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.total_milk}
                        readOnly
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Lactation #</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.lactation_number}
                          onChange={(e) => set('lactation_number', e.target.value)}
                          placeholder="1"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Days in Milk</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.days_in_milk}
                          onChange={(e) => set('days_in_milk', e.target.value)}
                          placeholder="e.g. 45"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => set('notes', e.target.value)}
                        rows={3}
                        placeholder="Any observations about milk quality, animal health, etc."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !formData.animal_id}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                    >
            {loading ? 'Saving...' : 'Save Milk Record'}
          </button>
        </form>
      </div>
    </div>
  )
}