// 📁 FILE PATH: app/dashboard/coffee/activities/record/ActivityRecordClient.tsx
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, TreePine, FlaskConical, Scissors, Leaf, Package,
  Activity, AlertCircle, CheckCircle2, AlertTriangle, Info,
} from 'lucide-react'
import { recordActivity } from '../actions'
import { queueCoffeeEvent } from '@/lib/offline-db'
import { checkChemicalCompliance, getComplianceSeverity } from '@/lib/agrochemical-compliance'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACRES_TO_HA = 0.404686

interface Plot {
  id: string
  plot_name: string
  area_hectares: number | null
  total_trees: number | null
}

interface Props {
  farmId: string
  plots: Plot[]
  // Populated from the ?type=&plot=/&plot_id= query string. CoffeeClient's
  // quick-action tiles ("Weeding", "Fertilizer", "Spraying", ...),
  // PlotDetailClient's "Log first activity" and DiseaseClient's
  // "Record spray" links all send these — previously page.tsx never read
  // searchParams at all, so every one of those buttons silently landed on
  // the same default (Weeding, Step 1) and the farmer had to reselect the
  // activity type by hand every time.
  initialType?: string
  initialPlotId?: string
  // 'disease' when reached from DiseaseClient's "Record spray" link off a
  // pest/disease scouting alert — used to default spray_reason_code to
  // 'scouting_detected' instead of the generic 'preventive'.
  initialTrigger?: string
}

type ActivityType = 'weeding' | 'nutrition' | 'crop_protection' | 'pruning' | 'mulching' | 'other'

// The quick-action links use a mix of UI-level and DB-level vocabulary
// ('fertilizer' from CoffeeClient's tile, 'spraying' from DiseaseClient's
// disease-triggered link) — normalize both onto the ActivityType this
// component actually keys its step-2 form on.
const QUERY_TYPE_TO_ACTIVITY_TYPE: Record<string, ActivityType> = {
  weeding: 'weeding',
  nutrition: 'nutrition',
  fertilizer: 'nutrition',
  crop_protection: 'crop_protection',
  spraying: 'crop_protection',
  pruning: 'pruning',
  mulching: 'mulching',
  other: 'other',
}

// ── Activity top-level config ─────────────────────────────────────────────────
const ACTIVITY_CONFIG: Record<ActivityType, { icon: React.ElementType; label: string; description: string }> = {
  weeding:          { icon: Leaf,         label: 'Weeding',           description: 'Weed control — manual, slashing or herbicide' },
  nutrition:        { icon: Package,      label: 'Nutrition',         description: 'Fertilizer application — basal, top-dress or foliar' },
  crop_protection:  { icon: FlaskConical, label: 'Crop protection',   description: 'Pesticide, fungicide or insecticide spray' },
  pruning:          { icon: Scissors,     label: 'Pruning',           description: 'Canopy management — de-suckering, stumping, tipping' },
  mulching:         { icon: TreePine,     label: 'Mulching',          description: 'Soil cover with organic material' },
  other:            { icon: Activity,     label: 'Other',             description: 'Any other farm activity' },
}

// ── Weeding ───────────────────────────────────────────────────────────────────
const WEEDING_METHODS = [
  { value: 'manual_jembe', label: 'Jembe (manual hoe)' },
  { value: 'slashing',     label: 'Slashing / machete' },
  { value: 'herbicide',    label: 'Herbicide' },
  { value: 'combined',     label: 'Combined (manual + herbicide)' },
]

// ── Nutrition: application method determines sub-fields ───────────────────────
//   BASAL   — soil-applied granular/solid (DAP, CAN, NPK, manure)
//   TOP DRESS — additional soil application during growth
//   FOLIAR  — liquid sprayed on leaves (micronutrients, stress relief)
const NUTRITION_METHODS = [
  {
    value: 'basal',
    label: 'Basal application',
    description: 'Soil-applied at start of season. DAP, NPK, manure — root uptake.',
  },
  {
    value: 'top_dressing',
    label: 'Top-dressing',
    description: 'Additional soil application during the season. CAN, urea, potassium.',
  },
  {
    value: 'foliar',
    label: 'Foliar feed',
    description: 'Sprayed on leaves. Micronutrients (Zn, B, Ca), stress recovery. Absorbed through foliage.',
  },
]

const BASAL_PRODUCTS = [
  'DAP (Diammonium Phosphate)', 'CAN (Calcium Ammonium Nitrate)',
  'NPK 17:17:17', 'NPK 23:23:0', 'Mavuno Coffee', 'Urea (46% N)',
  'Muriate of Potash (MOP)', 'Farm Yard Manure (FYM)', 'Compost',
  'Single Super Phosphate (SSP)', 'Other',
]

// coffee_activities_fertilizer_type_check only allows this coarse taxonomy:
// NPK / CAN / DSP / foliar / organic_manure / other (confirmed live 2026-07-18).
// The product picker above is intentionally more specific for record-keeping
// (exact product goes in product_name), so basal/top-dress selections need to
// be bucketed down to a category the constraint accepts. DAP and SSP are both
// phosphate-based straights and are mapped to the DSP bucket, which is the
// closest available slot in this enum — if "DSP" was actually meant to mean
// something narrower than "phosphate fertilizer" on the DB side, that's worth
// confirming and, if so, renaming/expanding the constraint rather than the
// mapping here.
const FERTILIZER_CATEGORY_MAP: Record<string, string> = {
  'DAP (Diammonium Phosphate)':    'DSP',
  'CAN (Calcium Ammonium Nitrate)': 'CAN',
  'NPK 17:17:17':                  'NPK',
  'NPK 23:23:0':                   'NPK',
  'Mavuno Coffee':                 'NPK',
  'Urea (46% N)':                  'other',
  'Muriate of Potash (MOP)':       'other',
  'Farm Yard Manure (FYM)':        'organic_manure',
  'Compost':                       'organic_manure',
  'Single Super Phosphate (SSP)':  'DSP',
  'Other':                         'other',
}

function fertilizerCategory(nutritionMethod: string, product: string | null): string | null {
  if (nutritionMethod === 'foliar') return 'foliar'
  if (!product) return null
  return FERTILIZER_CATEGORY_MAP[product] ?? 'other'
}

const FOLIAR_PRODUCTS = [
  'Optimizer', 'Goldchance Bloom', 'Legendary', 'Lavender', 'Dimiphite',
  'Bio-Distinction', 'Multi-K (Potassium Nitrate)', 'Calcium Boron foliar',
  'Zinc sulphate spray', 'Boron foliar', 'Other',
]

// ── Crop protection: spray PURPOSE drives product type ────────────────────────
//   FUNGICIDE — CBD, CLR, damping off, brown eye spot
//   INSECTICIDE / PESTICIDE — Antestia, coffee leaf miner, scale insects, white stem borer
//   HERBICIDE — weed kill via spray (knapsack)
// dbSprayType maps each UI option onto coffee_activities_spray_type_check's
// actual allowed values (fungicide/pesticide/herbicide/foliar_fertilizer/
// combined) — the UI's own `value`s ('insecticide', 'herbicide_spray') don't
// match that enum and were being sent straight through, which is why every
// non-fungicide spray record was failing to save.
const PROTECTION_TYPES = [
  {
    value: 'fungicide',
    dbSprayType: 'fungicide',
    label: 'Fungicide',
    description: 'Controls CBD, CLR, brown eye spot, damping-off.',
    products: ['Ridomil Gold', 'Comet (Pyraclostrobin)', 'Copper Oxychloride', 'Mancozeb', 'Score (Difenoconazole)', 'Dithianon', 'Thiophanate-Methyl', 'Other'],
    targetPests: ['Coffee Berry Disease (CBD)', 'Coffee Leaf Rust (CLR)', 'Brown Eye Spot', 'Damping Off', 'Other fungal'],
  },
  {
    value: 'insecticide',
    dbSprayType: 'pesticide',
    label: 'Insecticide / Pesticide',
    description: 'Controls Antestia bug, leaf miner, scale insects, stem borer, mealybugs.',
    products: ['Confidor (Imidacloprid)', 'Kingcode Elite', 'Ampligo', 'Profile (Chlorpyrifos)', 'Duduthrin', 'Neem-based (organic)', 'Other'],
    targetPests: ['Antestia bug', 'Coffee leaf miner', 'Scale insects', 'White stem borer', 'Mealybugs', 'Thrips', 'Other insects'],
  },
  {
    value: 'herbicide_spray',
    dbSprayType: 'herbicide',
    label: 'Herbicide (spray)',
    description: 'Knapsack-applied weed control. Knockdown or selective.',
    products: ['Clampdown 480SL (Glyphosate)', 'Touchdown (Glyphosate)', 'Gramoxone (Paraquat)', 'Basta (Glufosinate)', 'Other'],
    targetPests: ['Broadleaf weeds', 'Grass weeds', 'General vegetation knockdown'],
  },
]

// ── Pruning ───────────────────────────────────────────────────────────────────
const PRUNING_TYPES = [
  { value: 'de_suckering',      label: 'De-suckering',       description: 'Remove excess shoots from the base' },
  { value: 'frame_pruning',     label: 'Frame pruning',      description: 'Shape the canopy framework' },
  { value: 'tipping',           label: 'Tipping',            description: 'Remove growing tips to encourage laterals' },
  { value: 'stumping',          label: 'Stumping',           description: 'Severe rejuvenation cut to the stump' },
  { value: 'selective_pruning', label: 'Selective pruning',  description: 'Remove dead / diseased wood' },
]

// ── Application equipment ─────────────────────────────────────────────────────
const SPRAY_EQUIPMENT = [
  { value: 'knapsack',   label: 'Knapsack sprayer (manual)' },
  { value: 'motorized',  label: 'Motorized / power sprayer' },
  { value: 'boom',       label: 'Boom sprayer' },
]

// Values match coffee_activities_weather_conditions_check exactly
// (dry_sunny/cloudy_no_rain/before_rain/after_rain — confirmed live
// 2026-07-18). The previous set ('dry_calm','overcast','windy','light_rain')
// didn't match any allowed value, so saving a spray/foliar record with a
// weather condition selected always failed.
const WEATHER_OPTIONS = [
  { value: 'dry_sunny',      label: 'Dry & sunny (ideal)' },
  { value: 'cloudy_no_rain', label: 'Cloudy, no rain expected' },
  { value: 'before_rain',    label: 'Rain expected soon (avoid — will wash off)' },
  { value: 'after_rain',     label: 'Just after rain' },
]

// Matches coffee_activities_spray_reason_check exactly. The form previously
// sent the free-text target pest/disease name (e.g. "Antestia bug") into
// this column instead — that's a completely different piece of information
// (what pest, not why the spray happened) and never matched this enum, so
// every crop-protection save with a pest selected failed. The pest/disease
// name itself is preserved in notes instead (see handleSubmit) so it isn't
// lost, and this now captures the actual spray trigger/reason.
const SPRAY_REASONS = [
  { value: 'preventive',            label: 'Preventive / routine' },
  { value: 'scouting_detected',     label: 'Found during scouting' },
  { value: 'calendar_recommended',  label: 'Calendar-recommended spray' },
  { value: 'emergency',             label: 'Emergency (severe outbreak)' },
]

const LABOUR_MODES = [
  { value: 'own_labour', label: 'Own labour' },
  { value: 'piece_work', label: 'Piece work' },
  { value: 'daily_rate', label: 'Daily rate (CBA)' },
]

const STEPS = ['Type', 'Details', 'Plots & Cost', 'Review'] as const

// ─── Styling helpers ──────────────────────────────────────────────────────────
const FIELD  = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL  = 'block text-xs font-bold text-[#D1D5DB] mb-1'
const HINT   = 'text-[11px] text-[#4B5563] mt-1'

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormState {
  activity_type:      ActivityType
  activity_date:      string
  plot_ids:           string[]
  // weeding
  weeding_method:     string
  // nutrition
  nutrition_method:   string   // basal | top_dressing | foliar
  fertilizer_type:    string   // product name (basal/top dress)
  foliar_product:     string   // product name (foliar)
  quantity:           string
  quantity_unit:      string
  // crop protection
  protection_type:    string   // fungicide | insecticide | herbicide_spray
  target_pest:        string
  spray_reason_code:  string   // preventive | scouting_detected | calendar_recommended | emergency
  product_name:       string
  dilution_rate:      string
  litres_water:       string
  spray_equipment:    string
  weather_conditions: string
  // pruning
  pruning_type:       string
  // mulching / other
  material_or_desc:   string
  // area
  area_covered_acres: string   // UI in acres → convert to ha before save
  // labour & cost
  labour_mode:        string
  num_workers:        string
  days_worked:        string
  rate_per_day:       string
  cost_labour:        string
  cost_inputs:        string
  notes:              string
}

const INITIAL: FormState = {
  activity_type:      'weeding',
  activity_date:      new Date().toISOString().split('T')[0],
  plot_ids:           [],
  weeding_method:     '',
  nutrition_method:   '',
  fertilizer_type:    '',
  foliar_product:     '',
  quantity:           '',
  quantity_unit:      'kg',
  protection_type:    '',
  target_pest:        '',
  spray_reason_code:  'preventive',
  product_name:       '',
  dilution_rate:      '',
  litres_water:       '',
  spray_equipment:    '',
  weather_conditions: '',
  pruning_type:       '',
  material_or_desc:   '',
  area_covered_acres: '',
  labour_mode:        'own_labour',
  num_workers:        '',
  days_worked:        '',
  rate_per_day:       '',
  cost_labour:        '',
  cost_inputs:        '',
  notes:              '',
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ActivityRecordClient({ farmId, plots, initialType, initialPlotId, initialTrigger }: Props) {
  const router = useRouter()
  const [step, setStep]     = useState(1)
  const [form, setForm]     = useState<FormState>(() => ({
    ...INITIAL,
    activity_type: (initialType && QUERY_TYPE_TO_ACTIVITY_TYPE[initialType]) || INITIAL.activity_type,
    plot_ids: initialPlotId && plots.some(p => p.id === initialPlotId) ? [initialPlotId] : INITIAL.plot_ids,
    spray_reason_code: initialTrigger === 'disease' ? 'scouting_detected' : INITIAL.spray_reason_code,
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
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

  // ── Compliance check (product name for crop_protection / nutrition foliar) ──
  const complianceProductName = useMemo(() => {
    if (form.activity_type === 'crop_protection') return form.product_name
    if (form.activity_type === 'nutrition' && form.nutrition_method === 'foliar') return form.foliar_product
    return ''
  }, [form.activity_type, form.nutrition_method, form.product_name, form.foliar_product])

  const compliance = useMemo(() => {
    if (!complianceProductName) return null
    return checkChemicalCompliance(complianceProductName, 'coffee')
  }, [complianceProductName])

  const complianceSeverity = compliance ? getComplianceSeverity(compliance.entry, 'coffee') : null
  const isBlocked = complianceSeverity === 'critical'

  // ── Derived protection config ─────────────────────────────────────────────
  const protConfig = PROTECTION_TYPES.find(p => p.value === form.protection_type)

  // ── Cost totals ──────────────────────────────────────────────────────────
  const totalCost = useMemo(() => {
    const labour = parseFloat(form.cost_labour || '0') || 0
    const inputs = parseFloat(form.cost_inputs || '0') || 0
    return labour + inputs
  }, [form.cost_labour, form.cost_inputs])

  // ── Validation per step ──────────────────────────────────────────────────
  function canAdvance() {
    if (step === 1) return !!form.activity_type
    if (step === 2) {
      if (form.activity_type === 'weeding')         return !!form.weeding_method
      if (form.activity_type === 'pruning')         return !!form.pruning_type
      if (form.activity_type === 'nutrition')       return !!form.nutrition_method
      if (form.activity_type === 'crop_protection') return !!form.protection_type && !!form.product_name && !isBlocked
      return true
    }
    if (step === 3) return form.plot_ids.length > 0
    return true
  }

  function next() {
    setError('')
    if (!canAdvance()) { setError('Please complete required fields before continuing'); return }
    setStep(s => Math.min(s + 1, STEPS.length))
  }

  function back() {
    setError('')
    if (step > 1) setStep(s => s - 1)
    else router.back()
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (isBlocked) { setError('Remove the non-compliant product before saving.'); return }
    setError('')
    setLoading(true)

    // Determine the effective product_name to store
    let effectiveProduct = form.product_name || null
    if (form.activity_type === 'nutrition') {
      if (form.nutrition_method === 'foliar') effectiveProduct = form.foliar_product || null
      else effectiveProduct = form.fertilizer_type || null
    } else if (form.activity_type === 'mulching' || form.activity_type === 'other') {
      effectiveProduct = form.material_or_desc || null
    }

    // Derive application_method for the DB
    let applicationMethod: string | null = null
    if (form.activity_type === 'nutrition')       applicationMethod = form.nutrition_method || null
    if (form.activity_type === 'crop_protection') applicationMethod = form.spray_equipment || null
    if (form.activity_type === 'weeding')         applicationMethod = form.weeding_method || null

    // Convert acres → ha for storage (DB is hectares)
    const areaCoveredHa = form.area_covered_acres
      ? parseFloat((parseFloat(form.area_covered_acres) * ACRES_TO_HA).toFixed(4))
      : null

    // Map new activity types back to DB values (spray_type used for protection subtype)
    const dbActivityType = form.activity_type === 'nutrition'       ? 'fertilizer'
                         : form.activity_type === 'crop_protection' ? 'spraying'
                         : form.activity_type

    const protConfig = PROTECTION_TYPES.find(p => p.value === form.protection_type)

    // The pest/disease name (form.target_pest) has nowhere else to live —
    // coffee_activities has no dedicated pest/target column — so fold it
    // into notes rather than silently drop it now that it's no longer
    // (mis)used as spray_reason below.
    const notesWithPest = form.activity_type === 'crop_protection' && form.target_pest
      ? [`Target: ${form.target_pest}`, form.notes].filter(Boolean).join(' — ')
      : form.notes || null

    const payload = {
      plot_ids:           form.plot_ids,
      activity_type:      dbActivityType,
      activity_date:      form.activity_date,
      application_method: applicationMethod,
      area_covered_ha:    areaCoveredHa,
      calendar_triggered: initialTrigger === 'calendar',
      cost_inputs:        form.cost_inputs  ? Number(form.cost_inputs)  : null,
      cost_labour:        form.cost_labour  ? Number(form.cost_labour)  : null,
      days_worked:        form.days_worked  ? Number(form.days_worked)  : null,
      dilution_rate:      form.dilution_rate || null,
      // BUG FIX: coffee_activities_fertilizer_type_check only allows
      // ['NPK','CAN','DSP','foliar','organic_manure','other'] — a coarse
      // category, not a free-text product name. The old code sent
      // form.nutrition_method/form.protection_type ('basal', 'fungicide',
      // ...) here, which never matched either, and fell through to `null`
      // for pruning (the constraint doesn't accept null — no "IS NULL OR"
      // clause), which is why pruning hit this same constraint. Now bucketed
      // via fertilizerCategory()/FERTILIZER_CATEGORY_MAP; null for every
      // activity type other than nutrition.
      fertilizer_type:    form.activity_type === 'nutrition'
                             ? fertilizerCategory(form.nutrition_method, form.fertilizer_type)
                             : null,
      labour_mode:        form.labour_mode || null,
      litres_water:       form.litres_water ? Number(form.litres_water) : null,
      notes:              notesWithPest,
      num_workers:        form.num_workers  ? Number(form.num_workers)  : null,
      product_name:       effectiveProduct,
      pruning_type:       form.pruning_type || null,
      quantity:           form.quantity     ? Number(form.quantity)     : null,
      quantity_unit:      form.quantity_unit || null,
      rate_per_day:       form.rate_per_day ? Number(form.rate_per_day) : null,
      // BUG FIX: coffee_activities_spray_reason_check only allows
      // ['preventive','scouting_detected','calendar_recommended',
      // 'emergency'] — this previously received form.target_pest (e.g.
      // "Antestia bug"), a pest name, which never matched and failed every
      // crop-protection save that had a pest selected. Now uses the
      // dedicated spray_reason_code field (see SPRAY_REASONS); the pest
      // name itself is preserved in notes above instead.
      spray_reason:       form.activity_type === 'crop_protection' ? form.spray_reason_code : null,
      // BUG FIX: coffee_activities_spray_type_check only allows
      // ['fungicide','pesticide','herbicide','foliar_fertilizer','combined']
      // — form.protection_type uses UI values ('insecticide',
      // 'herbicide_spray') that don't match ('fungicide' was the only one
      // that happened to line up), so every insecticide/herbicide spray
      // failed to save. Now goes through PROTECTION_TYPES[].dbSprayType.
      spray_type:         protConfig?.dbSprayType || null,
      total_cost:         totalCost || null,
      weather_conditions: form.weather_conditions || null,
      weeding_method:     form.weeding_method || null,
    }

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
        setForm(INITIAL)
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
      const result = await recordActivity(payload)
      if (!result.success) {
        setError(result.error || 'Failed to record activity')
        return
      }
      setSuccess('Activity recorded!')
      setForm(INITIAL)
      setStep(1)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to record activity')
    } finally {
      setLoading(false)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  // ─── Plot display helpers ─────────────────────────────────────────────────
  function plotAreaDisplay(p: Plot) {
    if (!p.area_hectares) return 'Area not set'
    const acres = (p.area_hectares / ACRES_TO_HA).toFixed(2)
    return `${acres} acres`
  }

  return (
    <div className="max-w-2xl mx-auto pb-10">

      {/* Header */}
      <div className="bg-[#0D0F14] border-b border-[#2A2D35] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={back} className="p-1.5 rounded-lg hover:bg-[#1A1D24] text-[#6B7280] hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-white">Record activity</h1>
          <p className="text-xs text-[#6B7280]">Step {step} of {STEPS.length} — {STEPS[step - 1]}</p>
        </div>
        {isOffline && (
          <span className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900/40 px-2 py-1 rounded-md">Offline</span>
        )}
      </div>

      <div className="px-4 pt-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30">
            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">{success}</p>
          </div>
        )}

        {/* ── STEP 1: Activity type ── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-[#9CA3AF]">What type of activity are you recording?</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(ACTIVITY_CONFIG) as [ActivityType, typeof ACTIVITY_CONFIG[ActivityType]][]).map(([type, cfg]) => {
                const Icon = cfg.icon
                const selected = form.activity_type === type
                return (
                  <button
                    key={type}
                    onClick={() => set('activity_type', type)}
                    className={`flex flex-col items-start gap-2 p-4 rounded-lg border text-left transition-colors ${
                      selected ? 'border-emerald-600 bg-emerald-950/20' : 'border-[#2A2D35] bg-[#0D0F14] hover:border-[#4B5563]'
                    }`}
                  >
                    <Icon size={18} className={selected ? 'text-emerald-400' : 'text-[#6B7280]'} />
                    <div>
                      <p className={`text-sm font-semibold ${selected ? 'text-white' : 'text-[#D1D5DB]'}`}>{cfg.label}</p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5 leading-tight">{cfg.description}</p>
                    </div>
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

        {/* ── STEP 2: Details ── */}
        {step === 2 && (
          <div className="space-y-4">

            {/* WEEDING */}
            {form.activity_type === 'weeding' && (
              <div>
                <label className={LABEL}>Weeding method *</label>
                <div className="space-y-2">
                  {WEEDING_METHODS.map(m => (
                    <button key={m.value} type="button" onClick={() => set('weeding_method', m.value)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                        form.weeding_method === m.value ? 'border-emerald-600 bg-emerald-950/20 text-white' : 'border-[#2A2D35] bg-[#0D0F14] text-[#9CA3AF] hover:border-[#4B5563]'
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {form.weeding_method === 'herbicide' || form.weeding_method === 'combined' ? (
                  <div className="mt-4">
                    <label className={LABEL}>Herbicide product</label>
                    <input className={FIELD} placeholder="e.g. Clampdown 480SL, Touchdown"
                      value={form.product_name} onChange={e => set('product_name', e.target.value)} />
                  </div>
                ) : null}
              </div>
            )}

            {/* NUTRITION */}
            {form.activity_type === 'nutrition' && (
              <div className="space-y-4">
                <div>
                  <label className={LABEL}>Application method *</label>
                  <p className={HINT}>Choose how the fertilizer is applied — this determines which products are appropriate.</p>
                  <div className="space-y-2 mt-2">
                    {NUTRITION_METHODS.map(m => (
                      <button key={m.value} type="button" onClick={() => set('nutrition_method', m.value)}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          form.nutrition_method === m.value ? 'border-emerald-600 bg-emerald-950/20' : 'border-[#2A2D35] bg-[#0D0F14] hover:border-[#4B5563]'
                        }`}>
                        <p className={`text-sm font-semibold ${form.nutrition_method === m.value ? 'text-white' : 'text-[#D1D5DB]'}`}>{m.label}</p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">{m.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* BASAL / TOP DRESS */}
                {(form.nutrition_method === 'basal' || form.nutrition_method === 'top_dressing') && (
                  <>
                    <div>
                      <label className={LABEL}>Product / fertilizer *</label>
                      <select className={FIELD} value={form.fertilizer_type} onChange={e => set('fertilizer_type', e.target.value)}>
                        <option value="">Select fertilizer…</option>
                        {BASAL_PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
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
                          <option value="bags">bags (50 kg)</option>
                          <option value="debe">debe</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                      <Info size={12} className="text-[#4B5563] mt-0.5 flex-shrink-0" />
                      <p className={HINT + ' mt-0'}>
                        Mix basal fertilizers with Humipower (1 kg per 50 kg bag) to improve nutrient uptake and soil health.
                      </p>
                    </div>
                  </>
                )}

                {/* FOLIAR */}
                {form.nutrition_method === 'foliar' && (
                  <>
                    <div>
                      <label className={LABEL}>Foliar product *</label>
                      <select className={FIELD} value={form.foliar_product} onChange={e => set('foliar_product', e.target.value)}>
                        <option value="">Select product…</option>
                        {FOLIAR_PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    {compliance && (
                      <div className={`flex items-start gap-2 px-4 py-3 rounded-lg border ${
                        complianceSeverity === 'critical' ? 'border-red-900/40 bg-red-950/30' : 'border-amber-900/40 bg-amber-950/30'
                      }`}>
                        <AlertTriangle size={13} className={`mt-0.5 flex-shrink-0 ${complianceSeverity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                        <div>
                          <p className={`text-sm font-medium ${complianceSeverity === 'critical' ? 'text-red-300' : 'text-amber-300'}`}>
                            {compliance.entry.activeIngredient} — {compliance.entry.kenyaStatus.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-[#9CA3AF] mt-1">{compliance.entry.reason}</p>
                          {compliance.entry.alternatives?.length ? (
                            <p className="text-xs text-[#6B7280] mt-1">Alternatives: {compliance.entry.alternatives.join(', ')}</p>
                          ) : null}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LABEL}>Dilution rate</label>
                        <input className={FIELD} placeholder="e.g. 20ml / 20L water"
                          value={form.dilution_rate} onChange={e => set('dilution_rate', e.target.value)} />
                      </div>
                      <div>
                        <label className={LABEL}>Water used (litres)</label>
                        <input type="number" step="1" min="0" className={FIELD} placeholder="e.g. 60"
                          value={form.litres_water} onChange={e => set('litres_water', e.target.value)} />
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                      <Info size={12} className="text-[#4B5563] mt-0.5 flex-shrink-0" />
                      <p className={HINT + ' mt-0'}>
                        Always add Integra (3ml/20L) as sticker/spreader when spraying foliar feeds. Each 20L covers ~30 trees. Apply ~4 times per season during fruit expansion and ripening.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* CROP PROTECTION */}
            {form.activity_type === 'crop_protection' && (
              <div className="space-y-4">
                <div>
                  <label className={LABEL}>Protection type *</label>
                  <p className={HINT}>What problem are you targeting?</p>
                  <div className="space-y-2 mt-2">
                    {PROTECTION_TYPES.map(pt => (
                      <button key={pt.value} type="button"
                        onClick={() => { set('protection_type', pt.value); set('product_name', ''); set('target_pest', '') }}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          form.protection_type === pt.value ? 'border-emerald-600 bg-emerald-950/20' : 'border-[#2A2D35] bg-[#0D0F14] hover:border-[#4B5563]'
                        }`}>
                        <p className={`text-sm font-semibold ${form.protection_type === pt.value ? 'text-white' : 'text-[#D1D5DB]'}`}>{pt.label}</p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">{pt.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {protConfig && (
                  <>
                    <div>
                      <label className={LABEL}>Target pest / disease</label>
                      <select className={FIELD} value={form.target_pest} onChange={e => set('target_pest', e.target.value)}>
                        <option value="">Select…</option>
                        {protConfig.targetPests.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className={LABEL}>Reason for spray</label>
                      <select className={FIELD} value={form.spray_reason_code} onChange={e => set('spray_reason_code', e.target.value)}>
                        {SPRAY_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className={LABEL}>Product name *</label>
                      <select className={FIELD} value={form.product_name} onChange={e => set('product_name', e.target.value)}>
                        <option value="">Select product…</option>
                        {protConfig.products.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    {compliance && (
                      <div className={`flex items-start gap-2 px-4 py-3 rounded-lg border ${
                        complianceSeverity === 'critical' ? 'border-red-900/40 bg-red-950/30' : 'border-amber-900/40 bg-amber-950/30'
                      }`}>
                        <AlertTriangle size={13} className={`mt-0.5 flex-shrink-0 ${complianceSeverity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                        <div>
                          <p className={`text-sm font-medium ${complianceSeverity === 'critical' ? 'text-red-300' : 'text-amber-300'}`}>
                            {compliance.entry.activeIngredient} — {compliance.entry.kenyaStatus.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-[#9CA3AF] mt-1">{compliance.entry.reason}</p>
                          {complianceSeverity === 'critical' && (
                            <p className="text-xs text-red-400 mt-1 font-medium">Cannot save — product is banned.</p>
                          )}
                          {compliance.entry.alternatives?.length ? (
                            <p className="text-xs text-[#6B7280] mt-1">Alternatives: {compliance.entry.alternatives.join(', ')}</p>
                          ) : null}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LABEL}>Equipment</label>
                        <select className={FIELD} value={form.spray_equipment} onChange={e => set('spray_equipment', e.target.value)}>
                          <option value="">Select…</option>
                          {SPRAY_EQUIPMENT.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL}>Weather</label>
                        <select className={FIELD} value={form.weather_conditions} onChange={e => set('weather_conditions', e.target.value)}>
                          <option value="">Select…</option>
                          {WEATHER_OPTIONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LABEL}>Dilution rate</label>
                        <input className={FIELD} placeholder="e.g. 30ml / 20L"
                          value={form.dilution_rate} onChange={e => set('dilution_rate', e.target.value)} />
                      </div>
                      <div>
                        <label className={LABEL}>Water used (litres)</label>
                        <input type="number" step="1" min="0" className={FIELD} placeholder="e.g. 100"
                          value={form.litres_water} onChange={e => set('litres_water', e.target.value)} />
                      </div>
                    </div>

                    {form.protection_type === 'fungicide' && (
                      <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                        <Info size={12} className="text-[#4B5563] mt-0.5 flex-shrink-0" />
                        <p className={HINT + ' mt-0'}>
                          SL28/SL34 may need CBD sprays up to 12×/season. Batian/Ruiru 11 need ~2 preventative copper sprays. Rotate fungicides to prevent resistance build-up.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* PRUNING */}
            {form.activity_type === 'pruning' && (
              <div className="space-y-2">
                <label className={LABEL}>Pruning type *</label>
                {PRUNING_TYPES.map(pt => (
                  <button key={pt.value} type="button" onClick={() => set('pruning_type', pt.value)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      form.pruning_type === pt.value ? 'border-emerald-600 bg-emerald-950/20' : 'border-[#2A2D35] bg-[#0D0F14] hover:border-[#4B5563]'
                    }`}>
                    <p className={`text-sm font-semibold ${form.pruning_type === pt.value ? 'text-white' : 'text-[#D1D5DB]'}`}>{pt.label}</p>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">{pt.description}</p>
                  </button>
                ))}
              </div>
            )}

            {/* MULCHING / OTHER */}
            {(form.activity_type === 'mulching' || form.activity_type === 'other') && (
              <div>
                <label className={LABEL}>{form.activity_type === 'mulching' ? 'Material used' : 'Describe the activity'}</label>
                <input className={FIELD}
                  placeholder={form.activity_type === 'mulching' ? 'e.g. Banana leaves, grass clippings, coffee husks' : 'e.g. Soil testing, fence repair, irrigation work'}
                  value={form.material_or_desc} onChange={e => set('material_or_desc', e.target.value)} />
              </div>
            )}

            {/* Area covered — always in acres */}
            <div>
              <label className={LABEL}>Area covered (acres)</label>
              <div className="relative">
                <input type="number" step="0.01" min="0" className={FIELD + ' pr-14'}
                  placeholder="e.g. 1.5"
                  value={form.area_covered_acres} onChange={e => set('area_covered_acres', e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#4B5563]">acres</span>
              </div>
              {form.area_covered_acres && (
                <p className={HINT}>
                  ≈ {(parseFloat(form.area_covered_acres) * ACRES_TO_HA).toFixed(3)} hectares
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 3: Plots & Cost ── */}
        {step === 3 && (
          <div className="space-y-5">

            {/* Plot selector */}
            <div>
              <label className={LABEL}>Plot(s) *</label>
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
                      <button key={p.id} type="button" onClick={() => togglePlot(p.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                          selected ? 'border-emerald-600 bg-emerald-950/20' : 'border-[#2A2D35] bg-[#0D0F14] hover:border-[#4B5563]'
                        }`}>
                        <div>
                          <p className="text-sm font-medium text-white">{p.plot_name}</p>
                          <p className="text-xs text-[#6B7280]">
                            {plotAreaDisplay(p)}
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

            {/* Labour */}
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
                  <label className={LABEL}>Rate / day (KES)</label>
                  <input type="number" min="0" className={FIELD} placeholder="e.g. 500"
                    value={form.rate_per_day} onChange={e => set('rate_per_day', e.target.value)} />
                </div>
              </div>
            )}

            {/* Cost — connected to Finance */}
            <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
              <div className="px-4 py-3 border-b border-[#2A2D35] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Cost breakdown</h3>
                <span className="text-[10px] text-[#4B5563]">Feeds into Coffee Financials</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Labour cost (KES)</label>
                    <input type="number" min="0" className={FIELD} placeholder="e.g. 2 400"
                      value={form.cost_labour} onChange={e => set('cost_labour', e.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL}>Input cost (KES)</label>
                    <input type="number" min="0" className={FIELD} placeholder="e.g. 3 500"
                      value={form.cost_inputs} onChange={e => set('cost_inputs', e.target.value)} />
                    <p className={HINT}>Fertilizer, chemicals, materials</p>
                  </div>
                </div>
                {totalCost > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-md bg-emerald-950/20 border border-emerald-900/30">
                    <span className="text-xs text-[#9CA3AF]">Total activity cost</span>
                    <span className="text-sm font-semibold text-white">KES {totalCost.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </section>

            <div>
              <label className={LABEL}>Notes (optional)</label>
              <input className={FIELD} placeholder="Anything else worth recording…"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        )}

        {/* ── STEP 4: Review ── */}
        {step === 4 && (
          <div className="space-y-3">
            <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
              <div className="px-4 py-3 border-b border-[#2A2D35]">
                <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Summary</h3>
              </div>
              <div className="p-4 space-y-2">
                {[
                  ['Activity', ACTIVITY_CONFIG[form.activity_type].label],
                  ['Date', form.activity_date],
                  ['Plots', `${form.plot_ids.length} selected`],
                  form.area_covered_acres ? ['Area', `${form.area_covered_acres} acres`] : null,
                  form.product_name ? ['Product', form.product_name] : null,
                  form.fertilizer_type ? ['Fertilizer', form.fertilizer_type] : null,
                  form.foliar_product ? ['Foliar product', form.foliar_product] : null,
                  form.protection_type ? ['Protection type', PROTECTION_TYPES.find(p => p.value === form.protection_type)?.label ?? form.protection_type] : null,
                  totalCost > 0 ? ['Total cost', `KES ${totalCost.toLocaleString()}`] : null,
                ].filter((x): x is [string, string] => Array.isArray(x)).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">{k}</span>
                    <span className="text-white font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </section>

            {totalCost > 0 && (
              <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                <Info size={12} className="text-[#4B5563] mt-0.5 flex-shrink-0" />
                <p className={HINT + ' mt-0'}>
                  KES {totalCost.toLocaleString()} will be added to your Coffee Financials expense ledger for this season.
                </p>
              </div>
            )}

            {isBlocked && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30">
                <AlertTriangle size={14} className="text-red-400" />
                <p className="text-sm text-red-300">Cannot save — go back and remove the banned product.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="px-4 mt-6 flex gap-3">
        {step < STEPS.length ? (
          <button onClick={next}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-sm font-medium text-white transition-colors">
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading || isBlocked}
            className="flex-1 px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
            {loading ? 'Saving…' : 'Save activity'}
          </button>
        )}
      </div>
    </div>
  )
}