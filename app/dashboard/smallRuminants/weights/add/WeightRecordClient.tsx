'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { recordWeight } from '../actions'
import { queueSmallRuminantEvent } from '@/lib/offline-db'

interface Animal {
  id: string
  animal_tag: string
  name: string | null
  breed: string | null
}

export default function WeightRecordClient({ animals, farmId }: { animals: Animal[]; farmId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedOffline, setSavedOffline] = useState(false)

  const [formData, setFormData] = useState({
    animal_id: '',
    weight_kg: '',
    record_date: new Date().toISOString().split('T')[0],
    body_condition_score: '3',
    notes: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      ...formData,
      weight_kg: parseFloat(formData.weight_kg),
      body_condition_score: parseInt(formData.body_condition_score)
    }

    // OFFLINE FALLBACK: recordWeight() is a server action — a plain fetch
    // under the hood — so calling it with no connection just throws a raw
    // "Failed to fetch" that setError() would show verbatim to the farmer.
    // average_daily_gain is computed server-side (mirrored in
    // sync-offline-events' small_ruminant_weight case) so it's fine to
    // omit here — the sync handler fills it in from the previous
    // weigh-in once this reaches the database.
    if (!navigator.onLine) {
      try {
        await queueSmallRuminantEvent({
          eventId: crypto.randomUUID(),
          entityType: 'small_ruminant_weight',
          farmId,
          referenceId: formData.animal_id,
          payload,
        })
        setSavedOffline(true)
        setTimeout(() => router.push('/dashboard/smallRuminants/weights'), 1200)
      } catch (err: any) {
        setError(err.message || 'Could not save offline')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const result = await recordWeight(payload)
      if (!result.success) {
        setError(result.error || 'Failed to record weight')
        return
      }
      router.push('/dashboard/smallRuminants/weights')
    } catch (err: any) {
      // A submit that started online but lost connection mid-request lands
      // here too — fall back to the same offline queue rather than showing
      // a raw network error.
      if (!navigator.onLine) {
        try {
          await queueSmallRuminantEvent({
            eventId: crypto.randomUUID(),
            entityType: 'small_ruminant_weight',
            farmId,
            referenceId: formData.animal_id,
            payload,
          })
          setSavedOffline(true)
          setTimeout(() => router.push('/dashboard/smallRuminants/weights'), 1200)
          return
        } catch (queueErr: any) {
          setError(queueErr.message || 'Could not save offline')
          return
        }
      }
      setError(err.message || 'Failed to record weight')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-obsidian p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/smallRuminants/weights" className="w-10 h-10 glass-card rounded-full flex items-center justify-center text-white">←</Link>
          <h1 className="text-3xl font-bold text-white">Record Weight</h1>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-8 rounded-3xl space-y-6">
          {error && <div className="p-4 bg-crimson-alert/10 text-crimson-alert border border-crimson-alert/20 rounded-xl">{error}</div>}
          {savedOffline && <div className="p-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">Saved offline — will sync when connected.</div>}
          
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-2">Select Animal *</label>
            <select 
              value={formData.animal_id} 
              onChange={e => setFormData({...formData, animal_id: e.target.value})} 
              required 
              className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Choose an animal</option>
              {animals.map(a => <option key={a.id} value={a.id}>{a.animal_tag} {a.name ? `(${a.name})` : ''}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Weight (kg) *</label>
              <input 
                type="number" 
                step="0.1" 
                value={formData.weight_kg} 
                onChange={e => setFormData({...formData, weight_kg: e.target.value})} 
                required 
                placeholder="0.0"
                className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Record Date *</label>
              <input 
                type="date" 
                value={formData.record_date} 
                onChange={e => setFormData({...formData, record_date: e.target.value})} 
                required 
                className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-400 mb-2">Body Condition Score (1-5)</label>
            <input 
              type="range" 
              min="1" 
              max="5" 
              step="0.5"
              value={formData.body_condition_score} 
              onChange={e => setFormData({...formData, body_condition_score: e.target.value})} 
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
            />
            <div className="flex justify-between text-xs text-slate-500 font-bold mt-2">
              <span>Thin (1)</span>
              <span className="text-emerald-400">Score: {formData.body_condition_score}</span>
              <span>Fat (5)</span>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 text-white font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            {loading ? 'Recording...' : 'Save Growth Record'}
          </button>
        </form>
      </div>
    </div>
  )
}
