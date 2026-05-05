'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addCoffeePlot } from '../actions'

export default function AddPlotClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    plot_name: '',
    variety: 'SL28',
    total_trees: '',
    productive_trees: '',
    land_size_acres: '',
    establishment_year: new Date().getFullYear().toString(),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await addCoffeePlot({
        plot_name: formData.plot_name,
        variety: formData.variety,
        total_trees: parseInt(formData.total_trees) || 0,
        productive_trees: parseInt(formData.productive_trees) || 0,
        land_size_acres: parseFloat(formData.land_size_acres) || 0,
        establishment_year: parseInt(formData.establishment_year) || new Date().getFullYear()
      })
      router.push('/dashboard/coffee/plots')
    } catch (err: any) {
      setError(err.message || 'Failed to add plot')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-obsidian p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/coffee/plots" className="w-10 h-10 glass-card rounded-full flex items-center justify-center text-white">←</Link>
          <h1 className="text-3xl font-bold text-white">Add Coffee <span className="text-emerald-400">Plot</span></h1>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-8 rounded-3xl space-y-6">
          {error && <div className="p-4 bg-crimson-alert/10 text-crimson-alert border border-crimson-alert/20 rounded-xl">{error}</div>}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Plot Name *</label>
              <input type="text" value={formData.plot_name} onChange={e => setFormData({...formData, plot_name: e.target.value})} required placeholder="e.g. Lower Slope" className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Variety</label>
                <select value={formData.variety} onChange={e => setFormData({...formData, variety: e.target.value})} className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none">
                  <option value="SL28">SL28</option>
                  <option value="SL34">SL34</option>
                  <option value="Ruiru 11">Ruiru 11</option>
                  <option value="Batian">Batian</option>
                  <option value="K7">K7</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Acres *</label>
                <input type="number" step="0.01" value={formData.land_size_acres} onChange={e => setFormData({...formData, land_size_acres: e.target.value})} required className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Total Trees</label>
                <input type="number" value={formData.total_trees} onChange={e => setFormData({...formData, total_trees: e.target.value})} required className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Productive Trees</label>
                <input type="number" value={formData.productive_trees} onChange={e => setFormData({...formData, productive_trees: e.target.value})} required className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Establishment Year</label>
                <input type="number" value={formData.establishment_year} onChange={e => setFormData({...formData, establishment_year: e.target.value})} required className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none" />
              </div>
              {/* Optional: Add acres field back here or keep it where it is. I will keep it where it is and just add the extra field grid. */}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 text-white font-bold rounded-2xl transition-all shadow-lg">
            {loading ? 'Adding Plot...' : 'Register Plot'}
          </button>
        </form>
      </div>
    </div>
  )
}
