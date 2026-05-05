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
  diseaseName: string
  severityLevel: string
  affectedPercentage: string
  detectionDate: string
  treatmentApplied: string
  treatmentDate: string
  resultingLosses: string
  notes: string
  photoUrl: string
}

export default function ReportDiseasePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [aiDiagnosing, setAiDiagnosing] = useState(false)
  const [error, setError] = useState('')
  const [plots, setPlots] = useState<CoffeePlot[]>([])

  const [formData, setFormData] = useState<FormData>({
    plotId: '',
    diseaseName: 'Coffee Leaf Rust',
    severityLevel: 'medium',
    affectedPercentage: '',
    detectionDate: new Date().toISOString().split('T')[0],
    treatmentApplied: '',
    treatmentDate: '',
    resultingLosses: '',
    notes: '',
    photoUrl: '',
  })

  useEffect(() => {
    loadPlots()
  }, [])

  async function loadPlots() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data: farmManager, error: fmError } = await supabase
        .from('farm_managers')
        .select('farm_id')
        .eq('user_id', session.user.id)
        .single()

      if (fmError) throw fmError

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

  const handleAiDiagnose = async () => {
    if (!formData.photoUrl) {
      setError('Please provide a Photo URL first to use AI Diagnosis')
      return
    }

    setAiDiagnosing(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          imageUrl: formData.photoUrl,
          enterpriseType: 'coffee'
        })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to get AI diagnosis')
      }

      const { diagnosis } = await response.json()
      
      // Auto-fill form
      setFormData(prev => ({
        ...prev,
        diseaseName: diagnosis.diseaseName,
        severityLevel: diagnosis.severity.toLowerCase(),
        affectedPercentage: diagnosis.affectedPercentage.toString(),
        treatmentApplied: diagnosis.recommendedTreatment,
        notes: `AI Reasoning: ${diagnosis.aiReasoning}`
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI Diagnosis failed')
    } finally {
      setAiDiagnosing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      if (!formData.plotId) throw new Error('Plot is required')
      if (!formData.diseaseName) throw new Error('Disease name is required')
      if (!formData.affectedPercentage) throw new Error('Affected percentage is required')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data: farmManager } = await supabase
        .from('farm_managers')
        .select('farm_id')
        .eq('user_id', session.user.id)
        .single()

      if (!farmManager) throw new Error('No farm found')

      const { error: insertError } = await supabase
        .from('coffee_diseases')
        .insert([{
          farm_id: farmManager.farm_id,
          plot_id: formData.plotId,
          disease_name: formData.diseaseName,
          severity_level: formData.severityLevel,
          affected_percentage: parseFloat(formData.affectedPercentage),
          detection_date: formData.detectionDate,
          treatment_applied: formData.treatmentApplied || null,
          treatment_date: formData.treatmentDate || null,
          resulting_losses_kg: formData.resultingLosses ? parseFloat(formData.resultingLosses) : null,
          photo_url: formData.photoUrl || null,
          notes: formData.notes || null,
          ai_diagnosis: 'Pending AI analysis',
        }])

      if (insertError) throw insertError

      router.push('/dashboard/coffee')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record disease')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-green-600 animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your plots...</p>
        </div>
      </div>
    )
  }

  const diseases = [
    'Coffee Leaf Rust (CLR)',
    'Coffee Berry Disease (CBD)',
    'Bacterial Blight',
    'Antestia Bugs',
    'Stem Borer',
    'Scale Insects',
    'Mealybugs',
    'Root Rot',
    'Other',
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Report Disease/Pest</h1>
          <p className="text-gray-600 mt-2">Log a disease or pest problem affecting your coffee plot</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Problem Identification */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Problem Identification</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plot *
                </label>
                {plots.length > 0 ? (
                  <select
                    name="plotId"
                    value={formData.plotId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    {plots.map(plot => (
                      <option key={plot.id} value={plot.id}>
                        {plot.plot_name} ({plot.variety})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500">No active plots found.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Disease/Pest Name *
                </label>
                <select
                  name="diseaseName"
                  value={formData.diseaseName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  {diseases.map(disease => (
                    <option key={disease} value={disease}>
                      {disease}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Severity Level *
                  </label>
                  <select
                    name="severityLevel"
                    value={formData.severityLevel}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="low">Low (up to 10%)</option>
                    <option value="medium">Medium (10-30%)</option>
                    <option value="high">High (30-50%)</option>
                    <option value="critical">Critical (above 50%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Affected Percentage (%) *
                  </label>
                  <input
                    type="number"
                    name="affectedPercentage"
                    value={formData.affectedPercentage}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="1"
                    placeholder="25"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Detection Date *
                </label>
                <input
                  type="date"
                  name="detectionDate"
                  value={formData.detectionDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Treatment Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Treatment Information</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Treatment Applied
                </label>
                <textarea
                  name="treatmentApplied"
                  value={formData.treatmentApplied}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Describe the treatment or chemical applied..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Treatment Date
                  </label>
                  <input
                    type="date"
                    name="treatmentDate"
                    value={formData.treatmentDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Losses (kg)
                  </label>
                  <input
                    type="number"
                    name="resultingLosses"
                    value={formData.resultingLosses}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    placeholder="0.0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Photo URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    name="photoUrl"
                    value={formData.photoUrl}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={handleAiDiagnose}
                    disabled={aiDiagnosing || !formData.photoUrl}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition"
                  >
                    {aiDiagnosing ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        AI Diagnose
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Provide a public image URL and click "AI Diagnose" to auto-fill the form.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Any additional observations..."
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
              disabled={submitting}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {submitting ? 'Recording...' : 'Record Disease/Pest'}
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
