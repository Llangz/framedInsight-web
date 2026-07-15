'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface CoffeePlot {
  id: string
  plot_name: string
  variety: string | null
}

interface FormData {
  plotId: string
  harvestDate: string
  cherryKg: string
  qualityGrade: string
  processingMethod: string
  pricePerKg: string
  lotNumber: string
  cooperativeName: string
  notes: string
}

export default function RecordHarvestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [plots, setPlots] = useState<CoffeePlot[]>([])

  const [formData, setFormData] = useState<FormData>({
    plotId: '',
    harvestDate: new Date().toISOString().split('T')[0],
    cherryKg: '',
    qualityGrade: 'AA',
    processingMethod: 'washed',
    pricePerKg: '',
    lotNumber: '',
    cooperativeName: '',
    notes: '',
  })

  useEffect(() => {
    loadPlots()
  }, [])

  async function loadPlots() {
    try {
      const { data: { session }, error: _sessionError } = await supabase.auth.refreshSession()
      if (!session) throw new Error('Not authenticated')

      const { data: farmManager, error: fmError } = await supabase
        .from('farm_managers')
        .select('farm_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (fmError) throw fmError
      if (!farmManager) throw new Error('No farm found for this account')

      const { data: coffeePlots, error: cpError } = await supabase
        .from('coffee_plots')
        .select('id, plot_name, variety')
        .eq('farm_id', farmManager.farm_id)
        .eq('plant_status', 'active')

      if (cpError) throw cpError

      setPlots(coffeePlots || [])
      if (coffeePlots && coffeePlots.length > 0) {
        setFormData(prev => ({
          ...prev,
          plotId: coffeePlots[0].id,
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plots')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      if (!formData.plotId) throw new Error('Plot is required')
      if (!formData.cherryKg) throw new Error('Cherry weight is required')
      if (!formData.harvestDate) throw new Error('Harvest date is required')

      const { data: { session }, error: _sessionError } = await supabase.auth.refreshSession()
      if (!session) throw new Error('Not authenticated')

      const { data: farmManager } = await supabase
        .from('farm_managers')
        .select('farm_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!farmManager) throw new Error('No farm found')

      // Get plot name for the selected plot
      const selectedPlot = plots.find(p => p.id === formData.plotId)
      const plotName = selectedPlot?.plot_name || 'Unknown'

      const totalValue = formData.pricePerKg
        ? parseFloat(formData.cherryKg) * parseFloat(formData.pricePerKg)
        : null

      const cherryKg = parseFloat(formData.cherryKg)

      const { error: insertError } = await supabase
        .from('coffee_harvests')
        .insert([{
          farm_id: farmManager.farm_id,
          plot_name: plotName,
          harvest_date: formData.harvestDate,
          cherry_kg: cherryKg,
          produce_kg: cherryKg, // Main produce is cherry
          quality_grade: formData.qualityGrade,
          processing_method: formData.processingMethod,
          price_per_kg: formData.pricePerKg ? parseFloat(formData.pricePerKg) : null,
          total_value: totalValue,
          lot_number: formData.lotNumber || null,
          cooperative_name: formData.cooperativeName || null,
          notes: formData.notes || null,
          payment_status: 'pending',
        }])

      if (insertError) throw insertError

      router.push('/dashboard/coffee')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record harvest')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#2A2D35] border-t-emerald-500 animate-spin mx-auto mb-4"></div>
          <p className="text-[#9CA3AF]">Loading your plots...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0C10]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Record Harvest</h1>
          <p className="text-[#9CA3AF] mt-2">Log a new cherry harvest from your coffee plots</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Harvest Details */}
          <div className="bg-[#0D0F14] rounded-lg border border-[#2A2D35] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Harvest Details</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1">
                  Plot *
                </label>
                {plots.length > 0 ? (
                  <select
                    name="plotId"
                    value={formData.plotId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    {plots.map(plot => (
                      <option key={plot.id} value={plot.id}>
                        {plot.plot_name} ({plot.variety})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-[#6B7280]">No active plots found. <a href="/dashboard/coffee/plots/add" className="text-emerald-400 hover:text-emerald-300 font-semibold">Add a plot first.</a></p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#D1D5DB] mb-1">
                    Harvest Date *
                  </label>
                  <input
                    type="date"
                    name="harvestDate"
                    value={formData.harvestDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#D1D5DB] mb-1">
                    Cherry Weight (kg) *
                  </label>
                  <input
                    type="number"
                    name="cherryKg"
                    value={formData.cherryKg}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    placeholder="0.0"
                    className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#D1D5DB] mb-1">
                    Quality Grade
                  </label>
                  <select
                    name="qualityGrade"
                    value={formData.qualityGrade}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="AA">AA (Premium)</option>
                    <option value="AB">AB (High)</option>
                    <option value="C">C (Standard)</option>
                    <option value="E">E (Export)</option>
                    <option value="PB">PB (Peaberry)</option>
                    <option value="TT">TT (Trade)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#D1D5DB] mb-1">
                    Processing Method
                  </label>
                  <select
                    name="processingMethod"
                    value={formData.processingMethod}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="washed">Washed</option>
                    <option value="natural">Natural</option>
                    <option value="honey">Honey / Pulped Natural</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Payment */}
          <div className="bg-[#0D0F14] rounded-lg border border-[#2A2D35] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Pricing & Payment</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#D1D5DB] mb-1">
                    Price per kg (KES)
                  </label>
                  <input
                    type="number"
                    name="pricePerKg"
                    value={formData.pricePerKg}
                    onChange={handleChange}
                    step="1"
                    min="0"
                    placeholder="140"
                    className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#D1D5DB] mb-1">
                    Estimated Value
                  </label>
                  <div className="px-3 py-2 bg-[#1E222B] border border-[#2A2D35] rounded-lg text-[#D1D5DB]">
                    KES {(parseFloat(formData.cherryKg || '0') * parseFloat(formData.pricePerKg || '0')).toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1">
                  Cooperative/Buyer Name
                </label>
                <input
                  type="text"
                  name="cooperativeName"
                  value={formData.cooperativeName}
                  onChange={handleChange}
                  placeholder="e.g., Kirinyaga Coffee Cooperative"
                  className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1">
                  Lot Number
                </label>
                <input
                  type="text"
                  name="lotNumber"
                  value={formData.lotNumber}
                  onChange={handleChange}
                  placeholder="e.g., LOT-2026-001"
                  className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="bg-[#0D0F14] rounded-lg border border-[#2A2D35] p-6">
            <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
              Additional Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Any additional details about this harvest..."
              className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg bg-[#17191F] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-950/40 border border-red-700 rounded-lg p-4">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {submitting ? 'Recording...' : 'Record Harvest'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 bg-[#17191F] hover:bg-[#2A2D35] text-white font-semibold py-2 px-4 rounded-lg border border-[#2A2D35] transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}