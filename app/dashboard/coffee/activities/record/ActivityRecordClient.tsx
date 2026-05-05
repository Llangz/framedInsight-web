'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { recordActivity } from '../actions'

// TODO Phase 2: Restore lucide-react icons when dependency is properly resolved
const ChevronLeft = () => <span>←</span>
const ChevronRight = () => <span>→</span>
const Check = ({ size }: { size?: number }) => <span>✓</span>
const Leaf = ({ size, className }: { size?: number; className?: string }) => <span className={className}>🍃</span>
const Droplets = ({ size, className }: { size?: number; className?: string }) => <span className={className}>💧</span>
const Scissors = ({ size, className }: { size?: number; className?: string }) => <span className={className}>✂</span>
const FlaskConical = () => <span>⚗</span>
const Tractor = ({ size, className }: { size?: number; className?: string }) => <span className={className}>🚜</span>
const AlertCircle = ({ size, className }: { size?: number; className?: string }) => <span className={className}>⚠</span>
const Loader2 = ({ size, className }: { size?: number; className?: string }) => <span className={className}>⟳</span>
const Calculator = ({ size, className }: { size?: number; className?: string }) => <span className={className}>🖩</span>
const Users = ({ size, className }: { size?: number; className?: string }) => <span className={className}>👥</span>
const Calendar = ({ size, className }: { size?: number; className?: string }) => <span className={className}>📅</span>
const MapPin = ({ size }: { size?: number }) => <span>📍</span>
const Package = ({ size, className }: { size?: number; className?: string }) => <span className={className}>📦</span>
const X = () => <span>✕</span>

type ActivityType = 'weeding' | 'fertilizer' | 'spraying' | 'pruning' | 'other'

interface Plot {
  id: string;
  plot_name: string;
  area_hectares: number | null;
  total_trees: number | null;
}

interface LabourEntry {
  workers: number
  days: number
  rate: number
  mode: 'daily' | 'piecework' | 'own'
}

interface ActivityFormData {
  activity_type: ActivityType
  activity_date: string
  plot_ids: string[]
  notes: string
  weather_conditions: string
  weeding_method?: 'herbicide' | 'jembe' | 'slashing' | 'mulching'
  fertilizer_type?: 'CAN' | 'NPK' | 'DAP' | 'organic_compost' | 'foliar'
  quantity?: number
  quantity_unit?: string
  application_method?: string
  spray_type?: 'fungicide' | 'pesticide' | 'herbicide' | 'foliar_feed'
  product_name?: string
  spray_reason?: string
  litres_water?: number
  pruning_type?: string
  pruning_intensity?: 'light' | 'moderate' | 'heavy'
  cost_inputs: number
  labour: LabourEntry
}

const ACTIVITY_TYPES = [
    { id: 'weeding', label: 'Weeding', icon: Leaf, color: 'emerald', description: 'Weed control: herbicide, jembe or slashing' },
    { id: 'fertilizer', label: 'Fertilizer', icon: Package, color: 'amber', description: 'CAN, NPK, DAP or organic inputs' },
    { id: 'spraying', label: 'Spraying', icon: Droplets, color: 'sky', description: 'Fungicide, pesticide or foliar feeding' },
    { id: 'pruning', label: 'Pruning', icon: Scissors, color: 'violet', description: 'Frame, de-suckering, stumping, tipping' },
    { id: 'other', label: 'Other', icon: Tractor, color: 'stone', description: 'Any other field activity' },
  ]

const SPRAY_PRODUCTS: Record<string, string[]> = {
  fungicide: ['Copper Oxychloride', 'Mancozeb', 'Carbendazim', 'Bordeaux Mixture', 'Sulfur', 'Other'],
  pesticide: ['Cypermethrin', 'Chlorpyrifos', 'Spinosad', 'Neem Oil', 'Other'],
  herbicide: ['Glyphosate', 'Paraquat', 'Metsulfuron', 'Glufosinate', 'Other'],
  foliar_feed: ['Urea', 'Ammonium Nitrate', 'NPK Foliar', 'Micronutrient Mix', 'Other'],
}

const SPRAY_REASONS: Record<string, string[]> = {
  fungicide: ['CBD prevention', 'CBD treatment', 'CLR (Coffee Leaf Rust)', 'Coffee Wilt Disease', 'Anthracnose'],
  pesticide: ['Antestia Bug', 'Green Scale', 'Coffee Stem Borer', 'Aphids', 'Thrips'],
  herbicide: ['Broad-leaf weeds', 'Grasses', 'Couch grass', 'General weeds'],
  foliar_feed: ['Nutritional boost', 'Zinc deficiency', 'Boron deficiency', 'General foliar'],
}

const STEPS = ['Activity Type', 'Plots', 'Details', 'Labour & Cost', 'Review']

function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {labels.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all
                ${done ? 'bg-emerald-600 border-emerald-600 text-white' : ''}
                ${active ? 'bg-white border-emerald-600 text-emerald-700' : ''}
                ${!done && !active ? 'bg-white border-gray-300 text-gray-400' : ''}
              `}>
                {done ? <Check size={14} /> : step}
              </div>
              <span className={`text-xs mt-1 font-medium hidden sm:block ${active ? 'text-emerald-700' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mt-[-16px] sm:mt-[-28px] ${done ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ActivityRecordForm({ plots }: { plots: Plot[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<ActivityFormData>({
    activity_type: (searchParams.get('type') as ActivityType) || 'weeding',
    activity_date: today,
    plot_ids: [],
    notes: '',
    weather_conditions: '',
    cost_inputs: 0,
    quantity: 0,
    quantity_unit: 'kg',
    labour: { workers: 2, days: 1, rate: 500, mode: 'daily' }
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const cost_labour = (() => {
    const { workers, days, rate, mode } = form.labour
    if (mode === 'own') return 0
    if (mode === 'daily') return workers * days * rate
    if (mode === 'piecework') return workers * rate
    return 0
  })()

  const total_cost = cost_labour + (form.cost_inputs || 0)
  const selectedPlots = plots.filter(p => form.plot_ids.includes(p.id))
  const totalArea = selectedPlots.reduce((s, p) => s + (p.area_hectares ?? 0), 0)
  const totalTrees = selectedPlots.reduce((s, p) => s + (p.total_trees ?? 0), 0)

  function update<K extends keyof ActivityFormData>(key: K, value: ActivityFormData[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function togglePlot(id: string) {
    setForm(f => ({
      ...f,
      plot_ids: f.plot_ids.includes(id)
        ? f.plot_ids.filter(p => p !== id)
        : [...f.plot_ids, id],
    }))
  }

  function updateLabour(key: keyof LabourEntry, value: number | string) {
    setForm(f => ({ ...f, labour: { ...f.labour, [key]: value as any } }))
  }

  function canProceed(): boolean {
    if (step === 1) return !!form.activity_type
    if (step === 2) return form.plot_ids.length > 0
    if (step === 3) {
      if (form.activity_type === 'weeding' && !form.weeding_method) return false
      if (form.activity_type === 'fertilizer' && !form.fertilizer_type) return false
      if (form.activity_type === 'spraying' && !form.spray_type) return false
      if (form.activity_type === 'pruning' && !form.pruning_type) return false
    }
    return true
  }

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const data = {
        activity_type: form.activity_type,
        activity_date: form.activity_date,
        plot_ids: form.plot_ids,
        notes: form.notes || null,
        weather_conditions: form.weather_conditions || null,
        total_cost,
        cost_labour,
        cost_inputs: form.cost_inputs || 0,
        labour_mode: form.labour.mode,
        num_workers: form.labour.mode === 'own' ? 0 : form.labour.workers,
        days_worked: form.labour.mode === 'daily' ? form.labour.days : null,
        rate_per_day: form.labour.mode === 'daily' ? form.labour.rate : null,
        weeding_method: form.activity_type === 'weeding' ? form.weeding_method : null,
        fertilizer_type: form.activity_type === 'fertilizer' ? form.fertilizer_type : null,
        quantity: form.activity_type === 'fertilizer' ? (form.quantity || null) : null,
        quantity_unit: form.activity_type === 'fertilizer' ? (form.quantity_unit || null) : null,
        application_method: form.activity_type === 'fertilizer' ? (form.application_method || null) : null,
        spray_type: form.activity_type === 'spraying' ? form.spray_type : null,
        product_name: form.activity_type === 'spraying' ? form.product_name : null,
        spray_reason: form.activity_type === 'spraying' ? form.spray_reason : null,
        litres_water: form.activity_type === 'spraying' ? (form.litres_water || null) : null,
        pruning_type: form.activity_type === 'pruning' ? form.pruning_type : null,
        pruning_intensity: form.activity_type === 'pruning' ? form.pruning_intensity : null,
      }

      await recordActivity(data)
      setSubmitSuccess(true)
      setTimeout(() => router.push('/dashboard/coffee/activities'), 1800)
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save activity')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100 max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Check size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Activity Recorded!</h2>
          <p className="text-sm text-gray-500">
            {form.plot_ids.length} plot{form.plot_ids.length > 1 ? 's' : ''} updated · KES {total_cost.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-3">Redirecting…</p>
        </div>
      </div>
    )
  }

  const activityInfo = ACTIVITY_TYPES.find(a => a.id === form.activity_type)!

  function renderStep1() {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-1">What activity did you do?</h2>
        <p className="text-sm text-gray-500 mb-5">Choose the type of field work to record</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {ACTIVITY_TYPES.map(({ id, label, icon: Icon, color, description }) => {
            const selected = form.activity_type === id
            const colorMap: Record<string, string> = {
              emerald: 'border-emerald-500 bg-emerald-50 text-emerald-700',
              amber: 'border-amber-500 bg-amber-50 text-amber-700',
              sky: 'border-sky-500 bg-sky-50 text-sky-700',
              violet: 'border-violet-500 bg-violet-50 text-violet-700',
              stone: 'border-stone-500 bg-stone-50 text-stone-700',
            }
            const iconMap: Record<string, string> = {
              emerald: 'text-emerald-600', amber: 'text-amber-600',
              sky: 'text-sky-600', violet: 'text-violet-600', stone: 'text-stone-500',
            }
            return (
              <button
                key={id}
                onClick={() => update('activity_type', id as any)}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all
                  ${selected ? colorMap[color] : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'}`}
              >
                <Icon size={22} className={selected ? iconMap[color] : 'text-gray-400'} />
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{description}</p>
                </div>
                {selected && <Check size={16} />}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Calendar size={14} className="inline mr-1.5 text-gray-400" />
              Activity Date
            </label>
            <input
              type="date"
              value={form.activity_date}
              max={today}
              onChange={e => update('activity_date', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Weather Conditions</label>
            <select
              value={form.weather_conditions}
              onChange={e => update('weather_conditions', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select…</option>
              {['Sunny / Dry', 'Partly cloudy', 'Overcast', 'Light rain', 'Heavy rain', 'Windy'].map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    )
  }

  function renderStep2() {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Which plots?</h2>
        <p className="text-sm text-gray-500 mb-5">Select one or more plots where this activity happened</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {plots.map(plot => {
            const selected = form.plot_ids.includes(plot.id)
            return (
              <button
                key={plot.id}
                onClick={() => togglePlot(plot.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all
                  ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <MapPin size={14} />
                </div>
                <div className="min-w-0">
                  <p className={`font-semibold text-sm ${selected ? 'text-emerald-800' : 'text-gray-700'}`}>
                    {plot.plot_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {plot.area_hectares != null ? plot.area_hectares.toFixed(2) : '—'} ha · {plot.total_trees != null ? plot.total_trees.toLocaleString() : '—'} trees
                  </p>
                </div>
                {selected && <Check size={16} />}
              </button>
            )
          })}
        </div>
        {form.plot_ids.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
            <Check size={14} />
            <span>
              {form.plot_ids.length} plot{form.plot_ids.length > 1 ? 's' : ''} selected —{' '}
              {totalArea.toFixed(2)} ha
              {totalTrees > 0 && `, ${totalTrees.toLocaleString()} trees`}
            </span>
          </div>
        )}
      </div>
    )
  }

  function renderPruningOption(id: string, label: string, desc: string) {
    const selected = form.pruning_type === id
    return (
      <button
        key={id}
        onClick={() => update('pruning_type', id)}
        className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all
          ${selected ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
      >
        <div className={`w-4 h-4 rounded-full border-2 mt-0.5 ${selected ? 'border-violet-600 bg-violet-600' : 'border-gray-300'}`} />
        <div>
          <p className={`text-sm font-semibold ${selected ? 'text-violet-800' : 'text-gray-700'}`}>{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
        </div>
      </button>
    )
  }

  function renderStep3() {
    const type = form.activity_type
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Activity Details</h2>
        <div className="space-y-5 mt-4">
          {type === 'weeding' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weeding Method *</label>
              <div className="grid grid-cols-2 gap-2">
                {(['herbicide', 'jembe', 'slashing', 'mulching'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => update('weeding_method', m)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium capitalize transition-all
                      ${form.weeding_method === m ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
          {type === 'fertilizer' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fertilizer Type *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['CAN', 'NPK', 'DAP', 'organic_compost', 'foliar'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => update('fertilizer_type', t)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all
                        ${form.fertilizer_type === t ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {t === 'organic_compost' ? 'Organic' : t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
                  <input
                    type="number" value={form.quantity || ''}
                    onChange={e => update('quantity', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
                  <select
                    value={form.quantity_unit || 'kg'}
                    onChange={e => update('quantity_unit', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {['kg', 'bags', 'litres', 'tonnes'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
          {type === 'spraying' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Spray Category *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['fungicide', 'pesticide', 'herbicide', 'foliar_feed'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => update('spray_type', t)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium capitalize
                        ${form.spray_type === t ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-600'}`}
                    >
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              {form.spray_type && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Product *</label>
                  <select
                    value={form.product_name || ''}
                    onChange={e => update('product_name', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select product…</option>
                    {SPRAY_PRODUCTS[form.spray_type].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          {type === 'pruning' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Pruning Type *</label>
              {renderPruningOption('frame_pruning', 'Frame Pruning', 'Keep 3–4 main stems')}
              {renderPruningOption('stumping', 'Stumping', 'Rejuvenate old trees')}
              {renderPruningOption('de_suckering', 'De-suckering', 'Remove excess suckers')}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Intensity</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['light', 'moderate', 'heavy'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => update('pruning_intensity', level)}
                      className={`p-2 rounded-lg border text-sm capitalize
                        ${form.pruning_intensity === level ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>
      </div>
    )
  }

  function renderStep4() {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Labour & Cost</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Labour Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['daily', 'piecework', 'own'] as const).map(m => (
              <button
                key={m}
                onClick={() => updateLabour('mode', m)}
                className={`p-3 rounded-xl border-2 text-sm capitalize
                  ${form.labour.mode === m ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {form.labour.mode !== 'own' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Workers</label>
              <input
                type="number" value={form.labour.workers}
                onChange={e => updateLabour('workers', parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Rate</label>
              <input
                type="number" value={form.labour.rate}
                onChange={e => updateLabour('rate', parseInt(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Input Cost (KES)</label>
          <input
            type="number" value={form.cost_inputs || ''}
            onChange={e => update('cost_inputs', parseFloat(e.target.value) || 0)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex justify-between font-bold text-gray-800">
            <span>Total Cost</span>
            <span>KES {total_cost.toLocaleString()}</span>
          </div>
        </div>
      </div>
    )
  }

  function renderStep5() {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Review</h2>
        <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100 text-sm">
          <div className="flex justify-between p-3 bg-gray-50">
            <span className="text-gray-500">Activity</span>
            <span className="font-semibold text-gray-800 capitalize">{form.activity_type}</span>
          </div>
          <div className="flex justify-between p-3 bg-white">
            <span className="text-gray-500">Date</span>
            <span className="font-semibold text-gray-800">{form.activity_date}</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50">
            <span className="text-gray-500">Plots</span>
            <span className="font-semibold text-gray-800">{selectedPlots.length} plot(s)</span>
          </div>
          <div className="flex justify-between p-3 bg-white">
            <span className="text-gray-500">Total Cost</span>
            <span className="font-semibold text-gray-800">KES {total_cost.toLocaleString()}</span>
          </div>
        </div>
        {submitError && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
            {submitError}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : router.back()} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft />
        </button>
        <div>
          <h1 className="text-base font-bold">Record Activity</h1>
          <p className="text-xs text-gray-400">Step {step} of {STEPS.length}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <StepIndicator current={step} total={STEPS.length} labels={STEPS} />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </div>
        <button
          onClick={() => step < STEPS.length ? setStep(s => s + 1) : handleSubmit()}
          disabled={!canProceed() || submitting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : step < STEPS.length ? 'Continue' : 'Save Activity'}
        </button>
      </div>
    </div>
  )
}

export default function ActivityRecordClient({ plots }: { plots: Plot[] }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <ActivityRecordForm plots={plots} />
    </Suspense>
  )
}
