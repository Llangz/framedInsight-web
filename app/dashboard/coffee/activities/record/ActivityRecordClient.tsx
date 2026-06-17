'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, TreePine, FlaskConical, Scissors, Leaf, Package,
  Activity, AlertCircle, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { recordActivity } from '../actions'
import { queueCoffeeEvent } from '@/lib/offline-db'
import { checkChemicalCompliance, getComplianceSeverity } from '@/lib/agrochemical-compliance'

interface Plot {
  id: string
  plot_name: string
  area_hectares: number | null
  total_trees: number | null
}

interface Props {
  farmId: string
  plots: Plot[]
}

type ActivityType = 'weeding' | 'fertilizer' | 'spraying' | 'pruning' | 'mulching' | 'other'

const ACTIVITY_CONFIG: Record<ActivityType, { icon: React.ElementType; label: string }> = {
  weeding:    { icon: Leaf,         label: 'Weeding'    },
  fertilizer: { icon: Package,      label: 'Fertilizer' },
  spraying:   { icon: FlaskConical, label: 'Spraying'   },
  pruning:    { icon: Scissors,     label: 'Pruning'    },
  mulching:   { icon: TreePine,     label: 'Mulching'   },
  other:      { icon: Activity,     label: 'Other'      },
}

const WEEDING_METHODS = [
  { value: 'herbicide',     label: 'Herbicide' },
  { value: 'manual_jembe',  label: 'Jembe (manual)' },
  { value: 'slashing',      label: 'Slashing' },
  { value: 'combined',      label: 'Combined' },
]

const PRUNING_TYPES = [
  { value: 'frame_pruning',     label: 'Frame Pruning' },
  { value: 'de_suckering',      label: 'De-suckering' },
  { value: 'stumping',          label: 'Stumping' },
  { value: 'tipping',           label: 'Tipping' },
  { value: 'selective_pruning', label: 'Selective' },
]

const LABOUR_MODES = [
  { value: 'own_labour', label: 'Own labour' },
  { value: 'piece_work', label: 'Piece work' },
  { value: 'daily_rate', label: 'Daily rate' },
]

const STEPS = ['Type', 'Details', 'Plots & Labour', 'Review'] as const

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-bold text-[#D1D5DB] mb-1'

interface FormState {
  activity_type: ActivityType
  activity_date: string
  plot_ids: string[]
  application_method: string
  area_covered_ha: string
  fertilizer_type: string
  product_name: string
  quantity: string
  quantity_unit: string
  dilution_rate: string
  litres_water: string
  spray_type: string
  spray_reason: string
  weather_conditions: string
  weeding_method: string
  pruning_type: string
  labour_mode: string
  num_workers: string
  days_worked: string
  rate_per_day: string
  cost_labour: string
  cost_inputs: string
  notes: string
}

const INITIAL_FORM: FormState = {
  activity_type: 'weeding',
  activity_date: new Date().toISOString().split('T')[0],
  plot_ids: [],
  application_method: '',
  area_covered_ha: '',
  fertilizer_type: '',
  product_name: '',
  quantity: '',
  quantity_unit: 'kg',
  dilution_rate: '',
  litres_water: '',
  spray_type: '',
  spray_reason: '',
  weather_conditions: '',
  weeding_method: '',
  pruning_type: '',
  labour_mode: 'own_labour',
  num_workers: '',
  days_worked: '',
  rate_per_day: '',
  cost_labour: '',
  cost_inputs: '',
  notes: '',
}

export default function ActivityRecordClient({ farmId, plots }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const togglePlot = (id: string) =>
    setForm(f => ({
      ...f,
      plot_ids: f.plot_ids.includes(id)
        ? f.plot_ids.filter(p => p !== id)
        : [...f.plot_ids, id],
    }))

  // Live compliance check against the product name typed for spraying/fertilizer
  const compliance = useMemo(() => {
    if (!form.product_name || (form.activity_type !== 'spraying' && form.activity_type !== 'fertilizer')) return null
    return checkChemicalCompliance(form.product_name, 'coffee')
  }, [form.product_name, form.activity_type])

  const complianceSeverity = compliance ? getComplianceSeverity(compliance.entry, 'coffee') : null
  const isBlocked = complianceSeverity === 'critical'

  const computedTotalCost = useMemo(() => {
    const labour = parseFloat(form.cost_labour || '0') || 0
    const inputs = parseFloat(form.cost_inputs || '0') || 0
    return labour + inputs
  }, [form.cost_labour, form.cost_inputs])

  function canAdvance(): boolean {
    if (step === 1) return !!form.activity_type
    if (step === 2) {
      if (form.activity_type === 'weeding') return !!form.weeding_method
      if (form.activity_type === 'pruning') return !!form.pruning_type
      if (form.activity_type === 'spraying') return !!form.product_name && !isBlocked
      if (form.activity_type === 'fertilizer') return !!form.product_name || !!form.fertilizer_type
      return true
    }
    if (step === 3) return form.plot_ids.length > 0
    return true
  }

  function next() {
    setError('')
    if (!canAdvance()) {
      setError('Please complete this step before continuing')
      return
    }
    setStep(s => Math.min(s + 1, STEPS.length))
  }

  function back() {
    setError('')
    if (step > 1) setStep(s => s - 1)
    else router.back()
  }

  async function handleSubmit() {
    if (isBlocked) {
      setError('This product cannot be recorded — see the compliance warning above.')
      return
    }
    setError('')
    setLoading(true)

    const payload = {
      plot_ids: form.plot_ids,
      activity_type: form.activity_type,
      activity_date: form.activity_date,
      application_method: form.application_method || null,
      area_covered_ha: form.area_covered_ha ? Number(form.area_covered_ha) : null,
      calendar_triggered: false,
      cost_inputs: form.cost_inputs ? Number(form.cost_inputs) : null,
      cost_labour: form.cost_labour ? Number(form.cost_labour) : null,
      days_worked: form.days_worked ? Number(form.days_worked) : null,
      dilution_rate: form.dilution_rate || null,
      fertilizer_type: form.fertilizer_type || null,
      labour_mode: form.labour_mode || null,
      litres_water: form.litres_water ? Number(form.litres_water) : null,
      notes: form.notes || null,
      num_workers: form.num_workers ? Number(form.num_workers) : null,
      product_name: form.product_name || null,
      pruning_type: form.pruning_type || null,
      quantity: form.quantity ? Number(form.quantity) : null,
      quantity_unit: form.quantity_unit || null,
      rate_per_day: form.rate_per_day ? Number(form.rate_per_day) : null,
      spray_reason: form.spray_reason || null,
      spray_type: form.spray_type || null,
      total_cost: computedTotalCost || null,
      weather_conditions: form.weather_conditions || null,
      weeding_method: form.weeding_method || null,
    }

    // Offline-first support — queue one event per selected plot so each
    // syncs and resolves independently, matching the multi-plot insert
    // shape recordActivity expects.
    if (isOffline) {
      try {
        for (const plot_id of form.plot_ids) {
          await queueCoffeeEvent({
            eventId: crypto.randomUUID(),
            entityType: 'coffee_activity',
            farmId,
            referenceId: plot_id,
            payload: { ...payload, plot_ids: [plot_id] },
          })
        }
        setSuccess('Saved offline — will sync when connected.')
        setForm(INITIAL_FORM)
        setStep(1)
      } catch (err: any) {
        setError(err.message || 'Could not save offline')
      } finally {
        setLoading(false)
        setTimeout(() => setSuccess(''), 4000)
      }
      return
    }

    try {
      await recordActivity(payload)
      setSuccess('Activity recorded!')
      setForm(INITIAL_FORM)
      setStep(1)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to record activity')
    } finally {
      setLoading(false)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-[#0D0F14] border-b border-[#2A2D35] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={back} className="p-1.5 rounded-lg hover:bg-[#1A1D24] text-[#6B7280] hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-bold text-white">Record Activity</h1>
          <p className="text-xs text-[#6B7280]">Step {step} of {STEPS.length} — {STEPS[step - 1]}</p>
        </div>
        {isOffline && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
            <AlertCircle size={12} className="text-amber-600" />
            <span className="font-medium">Offline</span>
          </div>
        )}
      </div>

      <div className="px-4 pt-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30">
            <AlertCircle size={14} className="text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <p className="text-sm text-emerald-300">{success}</p>
          </div>
        )}

        {/* Step 1: Activity type */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-[#D1D5DB] mb-2">What did you do?</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(ACTIVITY_CONFIG) as [ActivityType, typeof ACTIVITY_CONFIG[ActivityType]][]).map(([type, cfg]) => {
                const Icon = cfg.icon
                const selected = form.activity_type === type
                return (
                  <button
                    key={type}
                    onClick={() => set('activity_type', type)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                      selected ? 'border-emerald-600 bg-emerald-950/20' : 'border-[#2A2D35] bg-[#0D0F14] hover:border-[#4B5563]'
                    }`}
                  >
                    <Icon size={20} className={selected ? 'text-emerald-400' : 'text-[#6B7280]'} />
                    <span className={`text-sm font-medium ${selected ? 'text-white' : 'text-[#D1D5DB]'}`}>{cfg.label}</span>
                  </button>
                )
              })}
            </div>

            <div>
              <label className={LABEL}>Date *</label>
              <input type="date" className={FIELD} value={form.activity_date} onChange={e => set('activity_date', e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 2: Type-specific details */}
        {step === 2 && (
          <div className="space-y-4">
            {form.activity_type === 'weeding' && (
              <div>
                <label className={LABEL}>Method *</label>
                <select className={FIELD} value={form.weeding_method} onChange={e => set('weeding_method', e.target.value)}>
                  <option value="">Select method…</option>
                  {WEEDING_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            )}

            {form.activity_type === 'pruning' && (
              <div>
                <label className={LABEL}>Pruning type *</label>
                <select className={FIELD} value={form.pruning_type} onChange={e => set('pruning_type', e.target.value)}>
                  <option value="">Select type…</option>
                  {PRUNING_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            )}

            {form.activity_type === 'fertilizer' && (
              <>
                <div>
                  <label className={LABEL}>Fertilizer type</label>
                  <input className={FIELD} placeholder="e.g. CAN, NPK 17:17:17, manure"
                    value={form.fertilizer_type} onChange={e => set('fertilizer_type', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Product name (brand, if applicable)</label>
                  <input className={FIELD} placeholder="e.g. Mavuno Coffee"
                    value={form.product_name} onChange={e => set('product_name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Quantity</label>
                    <input type="number" step="0.1" min="0" className={FIELD} placeholder="e.g. 50"
                      value={form.quantity} onChange={e => set('quantity', e.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL}>Unit</label>
                    <select className={FIELD} value={form.quantity_unit} onChange={e => set('quantity_unit', e.target.value)}>
                      <option value="kg">kg</option>
                      <option value="bags">bags</option>
                      <option value="litres">litres</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {form.activity_type === 'spraying' && (
              <>
                <div>
                  <label className={LABEL}>Product name *</label>
                  <input className={FIELD} placeholder="e.g. Confidor, Ridomil Gold"
                    value={form.product_name} onChange={e => set('product_name', e.target.value)} />
                </div>

                {compliance && (
                  <div className={`flex items-start gap-2 px-4 py-3 rounded-lg border ${
                    complianceSeverity === 'critical' ? 'border-red-900/40 bg-red-950/30' :
                    complianceSeverity === 'warning' ? 'border-amber-900/40 bg-amber-950/30' :
                    'border-amber-900/30 bg-amber-950/10'
                  }`}>
                    <AlertTriangle size={14} className={`mt-0.5 ${complianceSeverity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                    <div>
                      <p className={`text-sm font-medium ${complianceSeverity === 'critical' ? 'text-red-300' : 'text-amber-300'}`}>
                        {compliance.entry.activeIngredient} — {compliance.entry.kenyaStatus.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-[#9CA3AF] mt-1">{compliance.entry.reason}</p>
                      {complianceSeverity === 'critical' && (
                        <p className="text-xs text-red-400 mt-1 font-medium">This activity cannot be saved with this product.</p>
                      )}
                      {compliance.entry.alternatives && compliance.entry.alternatives.length > 0 && (
                        <p className="text-xs text-[#6B7280] mt-1">Alternatives: {compliance.entry.alternatives.join(', ')}</p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className={LABEL}>Reason for spraying</label>
                  <input className={FIELD} placeholder="e.g. Coffee Berry Disease outbreak"
                    value={form.spray_reason} onChange={e => set('spray_reason', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Application method</label>
                    <select className={FIELD} value={form.application_method} onChange={e => set('application_method', e.target.value)}>
                      <option value="">Select…</option>
                      <option value="knapsack">Knapsack sprayer</option>
                      <option value="motorized">Motorized sprayer</option>
                      <option value="boom">Boom sprayer</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Dilution rate</label>
                    <input className={FIELD} placeholder="e.g. 30ml/20L"
                      value={form.dilution_rate} onChange={e => set('dilution_rate', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Water used (litres)</label>
                    <input type="number" step="0.1" min="0" className={FIELD} placeholder="e.g. 100"
                      value={form.litres_water} onChange={e => set('litres_water', e.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL}>Weather conditions</label>
                    <select className={FIELD} value={form.weather_conditions} onChange={e => set('weather_conditions', e.target.value)}>
                      <option value="">Select…</option>
                      <option value="dry_calm">Dry & calm</option>
                      <option value="windy">Windy</option>
                      <option value="overcast">Overcast</option>
                      <option value="light_rain">Light rain</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {form.activity_type === 'mulching' && (
              <div>
                <label className={LABEL}>Material used</label>
                <input className={FIELD} placeholder="e.g. Banana leaves, grass, coffee husks"
                  value={form.product_name} onChange={e => set('product_name', e.target.value)} />
              </div>
            )}

            {form.activity_type === 'other' && (
              <div>
                <label className={LABEL}>Describe the activity</label>
                <input className={FIELD} placeholder="e.g. Soil testing, fence repair"
                  value={form.product_name} onChange={e => set('product_name', e.target.value)} />
              </div>
            )}

            <div>
              <label className={LABEL}>Area covered (hectares, optional)</label>
              <input type="number" step="0.01" min="0" className={FIELD} placeholder="e.g. 0.5"
                value={form.area_covered_ha} onChange={e => set('area_covered_ha', e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 3: Plots & labour */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Plot(s) affected *</label>
              {plots.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#2A2D35] p-6 text-center">
                  <p className="text-sm text-[#6B7280] mb-2">No plots registered</p>
                  <Link href="/dashboard/coffee/plots/add" className="text-sm text-emerald-500">Add a plot →</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {plots.map(p => {
                    const selected = form.plot_ids.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlot(p.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                          selected ? 'border-emerald-600 bg-emerald-950/20' : 'border-[#2A2D35] bg-[#0D0F14] hover:border-[#4B5563]'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{p.plot_name}</p>
                          <p className="text-xs text-[#6B7280]">
                            {p.area_hectares ? `${p.area_hectares} ha` : 'Area not set'}
                            {p.total_trees ? ` · ${p.total_trees} trees` : ''}
                          </p>
                        </div>
                        {selected && <CheckCircle2 size={16} className="text-emerald-400" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <label className={LABEL}>Labour mode</label>
              <select className={FIELD} value={form.labour_mode} onChange={e => set('labour_mode', e.target.value)}>
                {LABOUR_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            {form.labour_mode === 'daily_rate' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>Workers</label>
                  <input type="number" min="0" className={FIELD} placeholder="e.g. 3"
                    value={form.num_workers} onChange={e => set('num_workers', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Days</label>
                  <input type="number" min="0" className={FIELD} placeholder="e.g. 2"
                    value={form.days_worked} onChange={e => set('days_worked', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Rate/day (KES)</label>
                  <input type="number" min="0" className={FIELD} placeholder="e.g. 400"
                    value={form.rate_per_day} onChange={e => set('rate_per_day', e.target.value)} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Labour cost (KES)</label>
                <input type="number" min="0" className={FIELD} placeholder="e.g. 2400"
                  value={form.cost_labour} onChange={e => set('cost_labour', e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Input cost (KES)</label>
                <input type="number" min="0" className={FIELD} placeholder="e.g. 1500"
                  value={form.cost_inputs} onChange={e => set('cost_inputs', e.target.value)} />
              </div>
            </div>

            {computedTotalCost > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20">
                <p className="text-sm text-white">Total cost: <span className="font-semibold">KES {computedTotalCost.toLocaleString()}</span></p>
              </div>
            )}

            <div>
              <label className={LABEL}>Notes (optional)</label>
              <input className={FIELD} placeholder="Anything else worth recording…"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Activity</span>
                <span className="text-white font-medium">{ACTIVITY_CONFIG[form.activity_type].label}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Date</span>
                <span className="text-white">{form.activity_date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Plots</span>
                <span className="text-white">{form.plot_ids.length} selected</span>
              </div>
              {form.product_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Product</span>
                  <span className="text-white">{form.product_name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Total cost</span>
                <span className="text-white font-medium">KES {computedTotalCost.toLocaleString()}</span>
              </div>
            </div>

            {isBlocked && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30">
                <AlertTriangle size={14} className="text-red-400" />
                <p className="text-sm text-red-300">Cannot save — go back and remove the non-compliant product.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="px-4 mt-6 flex gap-3">
        {step < STEPS.length ? (
          <button
            onClick={next}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-sm font-medium text-white transition-colors"
          >
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || isBlocked}
            className="flex-1 px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors"
          >
            {loading ? 'Saving…' : 'Save activity'}
          </button>
        )}
      </div>
    </div>
  )
}