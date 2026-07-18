'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { queueSmallRuminantEvent } from '@/lib/offline-db'

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
  const [savedOffline, setSavedOffline] = useState(false)

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
          .maybeSingle()
        
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

  const resetForm = () => setFormData({
    animal_id: '',
    record_date: new Date().toISOString().split('T')[0],
    morning_milk: '',
    evening_milk: '',
    total_milk: '',
    lactation_number: '',
    days_in_milk: '',
    notes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    setSavedOffline(false)

    // total_milk intentionally omitted — it's a GENERATED ALWAYS column on
    // the live goat_milk_records table (confirmed via a live
    // information_schema query), same bug class as
    // coffee_activities.total_cost and milk_records.total_milk elsewhere
    // in this app. formData.total_milk above stays purely as the
    // read-only live preview shown in the form.
    const payload = {
      animal_id: formData.animal_id,
      record_date: formData.record_date,
      morning_milk: parseFloat(formData.morning_milk) || null,
      evening_milk: parseFloat(formData.evening_milk) || null,
      lactation_number: formData.lactation_number ? parseInt(formData.lactation_number) : null,
      days_in_milk: formData.days_in_milk ? parseInt(formData.days_in_milk) : null,
      notes: formData.notes || null,
    }

    // OFFLINE FALLBACK: this form previously called supabase.from(...)
    // .insert() directly with no offline path at all — no other small
    // ruminant entity type covers goat_milk_records, so a lost connection
    // mid-milking meant a raw Supabase network error and a lost record,
    // same bug class as every other form fixed alongside this one. Uses
    // the farmId already loaded on mount rather than re-calling
    // auth.getUser(), which itself needs a network round-trip and would
    // otherwise fail first when fully offline.
    if (!navigator.onLine) {
      if (!farmId) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      try {
        await queueSmallRuminantEvent({
          eventId: crypto.randomUUID(),
          entityType: 'small_ruminant_milk',
          farmId,
          referenceId: formData.animal_id,
          payload,
        })
        setSuccess(true)
        setSavedOffline(true)
        resetForm()
      } catch (err: any) {
        setError(err.message || 'Could not save offline')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('goat_milk_records')
        .insert(payload)

      if (error) throw error

      setSuccess(true)
      resetForm()
    } catch (err: any) {
      // A submit that started online but lost connection mid-request lands
      // here too — fall back to the same offline queue rather than
      // showing a raw network error.
      if (!navigator.onLine && farmId) {
        try {
          await queueSmallRuminantEvent({
            eventId: crypto.randomUUID(),
            entityType: 'small_ruminant_milk',
            farmId,
            referenceId: formData.animal_id,
            payload,
          })
          setSuccess(true)
          setSavedOffline(true)
          resetForm()
          return
        } catch (queueErr: any) {
          setError(queueErr.message || 'Could not save offline')
          return
        }
      }
      setError(err.message || 'Failed to save milk record')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0C10]">
      <div className="p-4 lg:p-8 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Record Milk Production</h1>
          <Link href="/dashboard/smallRuminants/milk" className="text-sm text-[#9CA3AF] hover:text-white">
            ← Back
          </Link>
        </div>

        {success && (
          <div className="mb-6 bg-emerald-950/40 border border-emerald-700 rounded-lg p-4 text-emerald-300 flex items-center gap-1.5">
            <Check size={14} /> {savedOffline ? 'Saved offline — will sync when connected.' : 'Milk record saved successfully!'}
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-950/40 border border-red-700 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Animal *</label>
            <select
              value={formData.animal_id}
                            onChange={(e) => set('animal_id', e.target.value)}
              required
              className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
            <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Date *</label>
            <input
              type="date"
              value={formData.record_date}
              onChange={(e) => set('record_date', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Morning (L)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formData.morning_milk}
                          onChange={(e) => set('morning_milk', e.target.value)}
                          placeholder="0.0"
                          className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Evening (L)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formData.evening_milk}
                          onChange={(e) => set('evening_milk', e.target.value)}
                          placeholder="0.0"
                          className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                    </div>

          <div>
                      <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Total (L)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.total_milk}
                        readOnly
                        className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#1E222B] text-[#9CA3AF]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Lactation #</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.lactation_number}
                          onChange={(e) => set('lactation_number', e.target.value)}
                          placeholder="1"
                          className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Days in Milk</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.days_in_milk}
                          onChange={(e) => set('days_in_milk', e.target.value)}
                          placeholder="e.g. 45"
                          className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => set('notes', e.target.value)}
                        rows={3}
                        placeholder="Any observations about milk quality, animal health, etc."
                        className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !formData.animal_id}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                    >
            {loading ? 'Saving...' : 'Save Milk Record'}
          </button>
        </form>
      </div>
    </div>
  )
}