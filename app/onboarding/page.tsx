'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createFarmAction } from './actions'
import type { Enterprise } from '@/lib/create-farm'
import { useRouter } from 'next/navigation'
import { getCounties, getConstituencies, getWards } from '@/lib/kenya-locations'

type OnboardingStep = 'farm_info' | 'location' | 'enterprises' | 'creating'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [step, setStep] = useState<OnboardingStep>('farm_info')
  const [formData, setFormData] = useState({
    farmName: '',
    countyId: '',
    countyName: '',
    subCountyId: '',
    subCountyName: '',
    wardId: '',
    wardName: '',
    enterprises: [] as Enterprise[]
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Location data
  const counties = getCounties()
  const constituencies = formData.countyId ? getConstituencies(formData.countyId) : []
  const wards = formData.subCountyId ? getWards(formData.subCountyId) : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (step === 'farm_info') {
      if (!formData.farmName.trim()) {
        setError('Farm name is required')
        return
      }
      setStep('location')
    } else if (step === 'location') {
      if (!formData.countyId || !formData.subCountyId || !formData.wardId) {
        setError('All location fields are required')
        return
      }
      setStep('enterprises')
    } else if (step === 'enterprises') {
      if (formData.enterprises.length === 0) {
        setError('Select at least one enterprise')
        return
      }
      setStep('creating')
      await createFarm()
    }
  }

  const createFarm = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const result = await createFarmAction({
        userId: user.id,
        phone: user.phone || user.user_metadata.phone || '',
        farmName: formData.farmName,
        county: formData.countyName,
        subCounty: formData.subCountyName,
        ward: formData.wardName,
        ownerName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Farmer',
        enterprises: formData.enterprises
      })

      if (result.success) {
        router.push('/dashboard')
      } else {
        setError(result.error || 'Failed to create farm')
        setStep('enterprises')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setStep('enterprises')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-8 overflow-hidden relative">
        {/* Decorative background blur */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-green-900/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-900/10 rounded-full blur-3xl pointer-events-none" />

        {/* Progress Bar */}
        <div className="mb-10 relative z-10">
          <div className="flex justify-between mb-3">
            <span className="text-sm font-medium text-neutral-400">
              {step === 'farm_info' && 'Step 1 of 3: Farm Information'}
              {step === 'location' && 'Step 2 of 3: Location'}
              {step === 'enterprises' && 'Step 3 of 3: Select Enterprises'}
              {step === 'creating' && 'Finalizing Setup...'}
            </span>
            <span className="text-sm font-bold text-green-500">
              {step === 'farm_info' && '33%'}
              {step === 'location' && '67%'}
              {step === 'enterprises' && '100%'}
            </span>
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-green-600 to-emerald-400 h-full transition-all duration-500 ease-out"
              style={{
                width: step === 'farm_info' ? '33%' : step === 'location' ? '67%' : '100%'
              }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          {/* Step 1: Farm Info */}
          {step === 'farm_info' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                  Welcome to framedInsight
                </h2>
                <p className="text-neutral-400">
                  Let's get your digital farm set up. First, what should we call your farm?
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="farmName" className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">
                  Farm Name
                </label>
                <input
                  id="farmName"
                  type="text"
                  value={formData.farmName}
                  onChange={(e) => setFormData({ ...formData, farmName: e.target.value })}
                  placeholder="e.g., Kahawa Valley Estates"
                  className="w-full px-5 py-4 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none transition-all duration-200"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full mt-10 py-4 px-6 bg-white hover:bg-neutral-200 text-neutral-950 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-white/5 active:scale-[0.98]"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 'location' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                  Where is it located?
                </h2>
                <p className="text-neutral-400">
                  This helps us provide hyper-local weather alerts and EUDR compliance data.
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="county" className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">
                    County
                  </label>
                  <select
                    id="county"
                    value={formData.countyId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const name = counties.find(c => c.id === id)?.name || '';
                      setFormData({ ...formData, countyId: id, countyName: name, subCountyId: '', subCountyName: '', wardId: '', wardName: '' });
                    }}
                    className="w-full px-5 py-4 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="">Select County</option>
                    {counties.map(county => (
                      <option key={county.id} value={county.id}>{county.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="subCounty" className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">
                    Sub-County (Constituency)
                  </label>
                  <select
                    id="subCounty"
                    value={formData.subCountyId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const name = constituencies.find(c => c.id === id)?.name || '';
                      setFormData({ ...formData, subCountyId: id, subCountyName: name, wardId: '', wardName: '' });
                    }}
                    className="w-full px-5 py-4 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!formData.countyId}
                  >
                    <option value="">Select Sub-County</option>
                    {constituencies.map(con => (
                      <option key={con.id} value={con.id}>{con.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="ward" className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">
                    Ward
                  </label>
                  <select
                    id="ward"
                    value={formData.wardId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const name = wards.find(w => w.id === id)?.name || '';
                      setFormData({ ...formData, wardId: id, wardName: name });
                    }}
                    className="w-full px-5 py-4 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!formData.subCountyId}
                  >
                    <option value="">Select Ward</option>
                    {wards.map(ward => (
                      <option key={ward.id} value={ward.id}>{ward.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 mt-10">
                <button
                  type="button"
                  onClick={() => setStep('farm_info')}
                  className="flex-1 py-4 px-6 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-all active:scale-[0.98]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-4 px-6 bg-white hover:bg-neutral-200 text-neutral-950 font-bold rounded-xl transition-all shadow-lg shadow-white/5 active:scale-[0.98]"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Enterprises */}
          {step === 'enterprises' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                  What do you farm?
                </h2>
                <p className="text-neutral-400">
                  Select your primary enterprises. We'll tailor your dashboard to these choices.
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  { id: 'coffee' as const, label: 'Coffee', desc: 'Plot mapping, EUDR compliance, & harvest tracking', icon: '☕' },
                  { id: 'dairy' as const, label: 'Dairy Cattle', desc: 'Milk production, breeding cycles, & health monitoring', icon: '🐄' },
                  { id: 'small_ruminants' as const, label: 'Sheep & Goats', desc: 'Weight tracking, kidding, & market sales', icon: '🐐' }
                ].map(item => (
                  <label
                    key={item.id}
                    className={`
                      relative group flex items-center gap-4 p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300
                      ${formData.enterprises.includes(item.id)
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                      }
                    `}
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>
                    <div className="flex-grow">
                      <div className="font-bold text-white">{item.label}</div>
                      <div className="text-xs text-neutral-500 line-clamp-1">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={formData.enterprises.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, enterprises: [...formData.enterprises, item.id] })
                        } else {
                          setFormData({ ...formData, enterprises: formData.enterprises.filter(i => i !== item.id) })
                        }
                      }}
                    />
                    <div className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                      ${formData.enterprises.includes(item.id) ? 'bg-green-500 border-green-500' : 'border-neutral-800'}
                    `}>
                      {formData.enterprises.includes(item.id) && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-neutral-950" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-4 mt-10">
                <button
                  type="button"
                  onClick={() => setStep('location')}
                  className="flex-1 py-4 px-6 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-all active:scale-[0.98]"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] py-4 px-6 bg-white hover:bg-neutral-200 text-neutral-950 font-bold rounded-xl transition-all shadow-lg shadow-white/5 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </div>
                  ) : 'Finish Setup'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Creating */}
          {step === 'creating' && (
            <div className="py-12 text-center animate-in fade-in zoom-in duration-700">
              <div className="relative inline-block mb-8">
                <div className="w-24 h-24 border-4 border-neutral-800 border-t-green-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-3xl">
                  🚜
                </div>
              </div>
              <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">
                Preparing your Dashboard
              </h2>
              <p className="text-neutral-400 max-w-xs mx-auto">
                Setting up your specific farm modules and mapping your local region...
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
