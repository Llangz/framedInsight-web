import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle, Skull, Wheat, Syringe, TrendingDown,
  ArrowLeft, CheckCircle, Bird
} from 'lucide-react'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default async function PoultryWarningsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!fm) redirect('/onboarding')

  const farmId = fm.farm_id
  const todayStr = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]
  const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30)
  const thirtyAgoStr = thirtyAgo.toISOString().split('T')[0]

  // Fetch active batches
  const { data: batches } = await supabase
    .from('poultry_batches' as any)
    .select('id, batch_name, bird_type, current_count, date_of_placement, house_number')
    .eq('farm_id', farmId)
    .eq('status', 'active')
    .order('batch_name')

  const batchIds = (batches as any[] || []).map((b: any) => b.id)
  const batchMap = Object.fromEntries((batches as any[] || []).map((b: any) => [b.id, b]))

  // Fetch mortality last 7 days
  let mortalityRecords: any[] = []
  // Fetch upcoming vaccinations / health events
  let upcomingHealth: any[] = []
  // Fetch egg production (for low production detection)
  let eggRecords: any[] = []
  // Fetch feed records (for low feed stock)
  let feedRecords: any[] = []

  if (batchIds.length > 0) {
    const [
      { data: mort },
      { data: health },
      { data: eggs },
      { data: feed },
    ] = await Promise.all([
      supabase
        .from('poultry_mortality' as any)
        .select('id, batch_id, record_date, count_dead, cause')
        .in('batch_id', batchIds)
        .gte('record_date', weekAgoStr)
        .order('record_date', { ascending: false }),

      supabase
        .from('poultry_health_records' as any)
        .select('id, batch_id, event_type, next_due_date, vaccine_name, drug_name')
        .eq('farm_id', farmId)
        .not('next_due_date', 'is', null)
        .gte('next_due_date', todayStr)
        .order('next_due_date', { ascending: true })
        .limit(10),

      supabase
        .from('poultry_egg_records' as any)
        .select('batch_id, record_date, total_eggs, poultry_batches(current_count, bird_type)')
        .in('batch_id', batchIds)
        .gte('record_date', weekAgoStr)
        .order('record_date', { ascending: false }),

      supabase
        .from('poultry_feed_records' as any)
        .select('batch_id, record_date, days_remaining, feed_type')
        .in('batch_id', batchIds)
        .not('days_remaining', 'is', null)
        .order('record_date', { ascending: false })
        .limit(batchIds.length),
    ])

    mortalityRecords = mort as any[] || []
    upcomingHealth   = health as any[] || []
    eggRecords       = eggs as any[] || []
    feedRecords      = feed as any[] || []
  }

  // ── Build warnings list ──────────────────────────────────────────
  type Warning = {
    id: string
    severity: 'critical' | 'warning' | 'info'
    category: string
    title: string
    detail: string
    date?: string
    action?: { label: string; href: string }
  }

  const warnings: Warning[] = []

  // 1. High mortality alert (>3% in 7 days)
  const totalMortThisWeek = mortalityRecords.reduce((s: number, m: any) => s + m.count_dead, 0)
  const totalBirds = (batches as any[] || []).reduce((s: number, b: any) => s + b.current_count, 0)
  if (totalBirds > 0 && totalMortThisWeek > 0) {
    const mortPct = (totalMortThisWeek / totalBirds) * 100
    const sev: Warning['severity'] = mortPct >= 5 ? 'critical' : 'warning'
    warnings.push({
      id: 'mortality-week',
      severity: sev,
      category: 'Mortality',
      title: `${totalMortThisWeek} bird${totalMortThisWeek !== 1 ? 's' : ''} lost this week (${mortPct.toFixed(1)}%)`,
      detail: mortPct >= 5
        ? 'Critical mortality rate. Isolate affected birds and call your vet immediately.'
        : 'Monitor closely. Review causes and check for disease signs across all birds.',
      action: { label: 'View mortality log', href: '/dashboard/poultry/mortality' },
    })
  }

  // 2. Individual batch mortality spikes
  const batchMortMap: Record<string, number> = {}
  mortalityRecords.forEach((m: any) => {
    batchMortMap[m.batch_id] = (batchMortMap[m.batch_id] || 0) + m.count_dead
  });
  (batches as any[] || []).forEach((b: any) => {
    const dead = batchMortMap[b.id] || 0
    const pct = b.current_count > 0 ? (dead / b.current_count) * 100 : 0
    if (pct >= 5) {
      warnings.push({
        id: `batch-mort-${b.id}`,
        severity: 'critical',
        category: 'Mortality',
        title: `Batch "${b.batch_name}": ${dead} deaths this week (${pct.toFixed(1)}%)`,
        detail: 'Possible disease outbreak. Separate this batch and consult a veterinarian.',
        action: { label: 'View flock', href: `/dashboard/poultry/flock/${b.id}` },
      })
    }
  })

  // 3. Upcoming vaccinations
  upcomingHealth.forEach((h: any) => {
    const batch = batchMap[h.batch_id]
    const dueDate = new Date(h.next_due_date)
    const daysTo = Math.ceil((dueDate.getTime() - Date.now()) / 86400000)
    const sev: Warning['severity'] = daysTo <= 3 ? 'critical' : 'warning'
    warnings.push({
      id: `vax-${h.id}`,
      severity: sev,
      category: 'Health',
      title: `${h.event_type} due in ${daysTo} day${daysTo !== 1 ? 's' : ''} — ${batch?.batch_name || 'Unknown batch'}`,
      detail: `${h.vaccine_name || h.drug_name || 'Event'} scheduled for ${fmt(h.next_due_date)}. Ensure supplies are ready.`,
      date: h.next_due_date,
      action: { label: 'Record health event', href: '/dashboard/poultry/health' },
    })
  })

  // 4. Low feed stock
  const seenBatches = new Set<string>()
  feedRecords.forEach((f: any) => {
    if (!seenBatches.has(f.batch_id)) {
      seenBatches.add(f.batch_id)
      const days = f.days_remaining ?? 0
      if (days <= 7) {
        const batch = batchMap[f.batch_id]
        const sev: Warning['severity'] = days <= 3 ? 'critical' : 'warning'
        warnings.push({
          id: `feed-${f.batch_id}`,
          severity: sev,
          category: 'Feed',
          title: `Low feed stock — ${batch?.batch_name || 'Batch'} (${days} day${days !== 1 ? 's' : ''} left)`,
          detail: days <= 3
            ? 'Emergency: less than 3 days of feed remaining. Order immediately or birds will go hungry.'
            : 'Feed running low. Reorder within the next 2–3 days to avoid disruption.',
          action: { label: 'Update feed record', href: '/dashboard/poultry/feed' },
        })
      }
    }
  })

  // 5. Low egg production (hen-day < 60%)
  const layerBatches = (batches as any[] || []).filter(
    (b: any) => b.bird_type === 'layer' || b.bird_type === 'dual_purpose' || b.bird_type === 'kienyeji'
  )
  if (layerBatches.length > 0 && eggRecords.length > 0) {
    const recentDays = new Set(eggRecords.map((e: any) => e.record_date))
    const dayCount = recentDays.size || 1
    const totalEggs = eggRecords.reduce((s: number, e: any) => s + (e.total_eggs || 0), 0)
    const avgDaily = totalEggs / dayCount
    const layerCount = layerBatches.reduce((s: number, b: any) => s + b.current_count, 0)
    const hdp = layerCount > 0 ? (avgDaily / layerCount) * 100 : 0
    if (hdp > 0 && hdp < 60) {
      warnings.push({
        id: 'low-production',
        severity: hdp < 40 ? 'critical' : 'warning',
        category: 'Production',
        title: `Low egg production: ${hdp.toFixed(0)}% hen-day (target ≥60%)`,
        detail: 'Common causes: inadequate lighting, nutritional deficiencies, disease pressure, or heat stress. Check layer diet and house conditions.',
        action: { label: 'View egg records', href: '/dashboard/poultry/eggs' },
      })
    }
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 }
  const sorted = [...warnings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  const severityStyle: Record<string, string> = {
    critical: 'border-red-800/60 bg-red-950/30',
    warning:  'border-amber-800/60 bg-amber-950/30',
    info:     'border-[#2A2D35] bg-[#0D0F14]',
  }
  const dotStyle: Record<string, string> = {
    critical: 'bg-red-500',
    warning:  'bg-amber-500',
    info:     'bg-sky-500',
  }
  const labelStyle: Record<string, string> = {
    critical: 'text-red-400 bg-red-950/60 border-red-900/60',
    warning:  'text-amber-400 bg-amber-950/60 border-amber-900/60',
    info:     'text-sky-400 bg-sky-950/60 border-sky-900/60',
  }

  return (
    <div className="min-h-screen bg-[#0A0C10]">
      {/* Sub-nav */}
      <div className="border-b border-[#2A2D35] bg-[#0A0C10] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-12 flex items-center gap-4">
          <Link href="/dashboard/poultry" className="text-[#6B7280] hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-sm font-semibold text-white">AI Warnings — Poultry</span>
          {sorted.filter(w => w.severity === 'critical').length > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold bg-red-950/60 text-red-400 border border-red-900/60">
              {sorted.filter(w => w.severity === 'critical').length} critical
            </span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">

        {sorted.length === 0 ? (
          <div className="text-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-950/40 border border-emerald-800/40 mx-auto mb-4">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">All clear</h2>
            <p className="text-sm text-[#6B7280] max-w-xs mx-auto">
              No active warnings for your poultry operation. Keep up the great work!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle size={14} className="text-[#9CA3AF]" />
              <p className="text-xs text-[#9CA3AF]">
                {sorted.length} warning{sorted.length !== 1 ? 's' : ''} detected across your flock
              </p>
            </div>

            {sorted.map(w => (
              <div key={w.id} className={`rounded-xl border p-4 ${severityStyle[w.severity]}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dotStyle[w.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${labelStyle[w.severity]}`}>
                        {w.severity.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-medium">
                        {w.category}
                      </span>
                      {w.date && (
                        <span className="text-[10px] text-[#4B5563] ml-auto">Due {fmt(w.date)}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white mb-1">{w.title}</p>
                    <p className="text-xs text-[#9CA3AF] leading-relaxed">{w.detail}</p>
                    {w.action && (
                      <Link
                        href={w.action.href}
                        className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        {w.action.label} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* If no batches at all */}
        {!batches || (batches as any[]).length === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-[#2A2D35] p-10 text-center">
            <Bird size={28} className="text-[#2A2D35] mx-auto mb-3" />
            <p className="text-sm text-[#6B7280] mb-4">No active batches. Add a batch to start monitoring.</p>
            <Link href="/dashboard/poultry/add-batch"
              className="inline-flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400">
              Add batch →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
