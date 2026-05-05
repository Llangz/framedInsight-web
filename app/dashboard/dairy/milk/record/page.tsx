'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type MilkingSession = 'morning' | 'midday' | 'evening'

interface CowMilkRecord {
  cowId: string
  cowName: string
  cowTag: string
  morning: string
  midday: string
  evening: string
}

function RecordMilkContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCowId = searchParams?.get('cow')

  const [loading, setLoading] = useState(false)
  const [cows, setCows] = useState<any[]>([])
  const [currentSession, setCurrentSession] = useState<MilkingSession>('morning')
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0])
  const [milkRecords, setMilkRecords] = useState<CowMilkRecord[]>([])
  const [errors, setErrors] = useState<any>({})

  useEffect(() => {
    loadCows()
    detectCurrentSession()
  }, [])

  useEffect(() => {
    if (preselectedCowId && cows.length > 0) {
      const cow = cows.find(c => c.id === preselectedCowId)
      if (cow && !milkRecords.find(r => r.cowId === cow.id)) {
        addCowToRecords(cow)
      }
    }
  }, [preselectedCowId, cows])

  function detectCurrentSession() {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 11) setCurrentSession('morning')
    else if (hour >= 11 && hour < 15) setCurrentSession('midday')
    else setCurrentSession('evening')
  }

  async function loadCows() {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Mock data
        setCows([
          { id: '1', name: 'Wanjiru', cow_tag: 'COW-001', status: 'active' },
          { id: '2', name: 'Mwende', cow_tag: 'COW-002', status: 'active' },
          { id: '3', name: 'Njeri', cow_tag: 'COW-003', status: 'active' },
        ])
        return
      }

      const { data: farmManager } = await supabase
        .from('farm_managers')
        .select('farm_id')
        .eq('user_id', user.id)
        .single()

      if (!farmManager) return

      const { data, error } = await supabase
        .from('cows')
        .select('id, name, cow_tag, status')
        .eq('farm_id', farmManager.farm_id)
        .eq('status', 'active')
        .order('name')

      if (!error) setCows((data as any) || [])
    } catch (error) {
      console.error('Error loading cows:', error)
    }
  }

  function addCowToRecords(cow: any) {
    if (milkRecords.find(r => r.cowId === cow.id)) return

    setMilkRecords([...milkRecords, {
      cowId: cow.id,
      cowName: cow.name || cow.cow_tag,
      cowTag: cow.cow_tag,
      morning: '',
      midday: '',
      evening: ''
    }])
  }

  function removeCowFromRecords(cowId: string) {
    setMilkRecords(milkRecords.filter(r => r.cowId !== cowId))
  }

  function updateMilkRecord(cowId: string, session: MilkingSession, value: string) {
    setMilkRecords(milkRecords.map(record => 
      record.cowId === cowId 
        ? { ...record, [session]: value }
        : record
    ))
  }

  function calculateTotal(record: CowMilkRecord): number {
    const morning = parseFloat(record.morning) || 0
    const midday = parseFloat(record.midday) || 0
    const evening = parseFloat(record.evening) || 0
    return morning + midday + evening
  }

  function validateRecords(): boolean {
    const newErrors: any = {}

    if (milkRecords.length === 0) {
      newErrors.general = 'Please add at least one cow'
      setErrors(newErrors)
      return false
    }

    let hasData = false
    milkRecords.forEach(record => {
      const total = calculateTotal(record)
      if (total > 0) hasData = true

      // Check for unreasonably high values
      if (parseFloat(record.morning) > 50) {
        newErrors[`${record.cowId}_morning`] = 'Unusually high value'
      }
      if (parseFloat(record.midday) > 50) {
        newErrors[`${record.cowId}_midday`] = 'Unusually high value'
      }
      if (parseFloat(record.evening) > 50) {
        newErrors[`${record.cowId}_evening`] = 'Unusually high value'
      }
    })

    if (!hasData) {
      newErrors.general = 'Please enter milk quantities for at least one cow'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!validateRecords()) return

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('Please log in to record milk')
        router.push('/auth/signin')
        return
      }

      // Prepare records for insertion
      const recordsToInsert = milkRecords
        .filter(record => calculateTotal(record) > 0)
        .map(record => ({
          cow_id: record.cowId,
          record_date: recordDate,
          morning_milk: parseFloat(record.morning) || 0,
          midday_milk: parseFloat(record.midday) || 0,
          evening_milk: parseFloat(record.evening) || 0,
        }))

      const { error } = await supabase
        .from('milk_records')
        .upsert(recordsToInsert, {
          onConflict: 'cow_id,record_date',
          ignoreDuplicates: false
        })

      if (error) throw error

      router.push('/dashboard/dairy/milk')
    } catch (error: any) {
      console.error('Error saving milk records:', error)
      alert('Failed to save milk records. Please try again.')
      setLoading(false)
    }
  }

  const sessionInfo = {
    morning: { emoji: '🌅', label: 'Morning', time: '6am-11am', color: 'bg-orange-50 border-orange-200' },
    midday: { emoji: '☀️', label: 'Midday', time: '11am-3pm', color: 'bg-yellow-50 border-yellow-200' },
    evening: { emoji: '🌆', label: 'Evening', time: '3pm-8pm', color: 'bg-blue-50 border-blue-200' },
  }

  const grandTotal = milkRecords.reduce((sum, record) => sum + calculateTotal(record), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Record Milk Production</h1>
            <Link href="/dashboard/dairy/milk" className="text-sm text-gray-600 hover:text-gray-900">
              ← Cancel
            </Link>
          </div>
          <p className="text-gray-600 text-sm">Record milk for morning, midday, and evening sessions</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Date & Session Selector */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Current Session Indicator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Session</label>
                <div className={`px-4 py-2 rounded-lg border-2 ${sessionInfo[currentSession].color}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{sessionInfo[currentSession].emoji}</span>
                    <div>
                      <p className="font-medium text-gray-900">{sessionInfo[currentSession].label}</p>
                      <p className="text-xs text-gray-600">{sessionInfo[currentSession].time}</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Session Quick Buttons */}
            <div className="flex gap-2">
              {(['morning', 'midday', 'evening'] as MilkingSession[]).map(session => (
                <button
                  key={session}
                  type="button"
                  onClick={() => setCurrentSession(session)}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                    currentSession === session
                      ? 'border-primary-600 bg-primary-50 text-primary-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {sessionInfo[session].emoji} {sessionInfo[session].label}
                </button>
              ))}
            </div>
          </div>

          {/* Cow Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Cows to Record</h2>
            
            {cows.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No active cows found</p>
                <Link
                  href="/dashboard/dairy/cows/add"
                  className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Add Your First Cow
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {cows.map(cow => (
                  <button
                    key={cow.id}
                    type="button"
                    onClick={() => addCowToRecords(cow)}
                    disabled={!!milkRecords.find(r => r.cowId === cow.id)}
                    className={`px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                      milkRecords.find(r => r.cowId === cow.id)
                        ? 'border-green-300 bg-green-50 text-green-700 cursor-not-allowed'
                        : 'border-gray-200 hover:border-primary-400 hover:bg-primary-50'
                    }`}
                  >
                    <div className="font-medium">{cow.name || cow.cow_tag}</div>
                    <div className="text-xs text-gray-500">{cow.cow_tag}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Milk Records Table */}
          {milkRecords.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Milk Records</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Cow</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">🌅 Morning (L)</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">☀️ Midday (L)</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">🌆 Evening (L)</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Total</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {milkRecords.map(record => (
                      <tr key={record.cowId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{record.cowName}</div>
                          <div className="text-xs text-gray-500">{record.cowTag}</div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={record.morning}
                            onChange={(e) => updateMilkRecord(record.cowId, 'morning', e.target.value)}
                            placeholder="0"
                            min="0"
                            step="0.1"
                            className={`w-20 px-2 py-1 text-center border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                              errors[`${record.cowId}_morning`] ? 'border-red-300' : 'border-gray-300'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={record.midday}
                            onChange={(e) => updateMilkRecord(record.cowId, 'midday', e.target.value)}
                            placeholder="0"
                            min="0"
                            step="0.1"
                            className={`w-20 px-2 py-1 text-center border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                              errors[`${record.cowId}_midday`] ? 'border-red-300' : 'border-gray-300'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={record.evening}
                            onChange={(e) => updateMilkRecord(record.cowId, 'evening', e.target.value)}
                            placeholder="0"
                            min="0"
                            step="0.1"
                            className={`w-20 px-2 py-1 text-center border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                              errors[`${record.cowId}_evening`] ? 'border-red-300' : 'border-gray-300'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-gray-900">{calculateTotal(record).toFixed(1)}L</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => removeCowFromRecords(record.cowId)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-900">
                        Grand Total:
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xl font-bold text-primary-600">{grandTotal.toFixed(1)}L</span>
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Submit Buttons */}
          {milkRecords.length > 0 && (
            <div className="flex items-center justify-end gap-3 pt-4">
              <Link
                href="/dashboard/dairy/milk"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : `Save ${milkRecords.length} Record${milkRecords.length > 1 ? 's' : ''}`}
              </button>
            </div>
          )}

        </form>

      </div>
    </div>
  )
}

export default function RecordMilkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    }>
      <RecordMilkContent />
    </Suspense>
  )
}
