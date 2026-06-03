// 📁 FILE PATH: app/api/ai/livestock-warnings/poultry/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModel } from '@/lib/ai/config'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage } from '@/lib/lipachat'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Warning schema ────────────────────────────────────────────────────────

const warningSchema = z.object({
  warnings: z.array(z.object({
    batchId: z.string(),
    batchName: z.string(),
    birdType: z.enum(['layer', 'broiler', 'kienyeji', 'dual_purpose']),
    warningType: z.enum([
      'mortality_spike',          // ≥3 deaths in 3 days or sudden jump
      'feed_stock_critical',      // ≤5 days of feed remaining
      'feed_stock_low',           // ≤10 days of feed remaining
      'production_drop',          // Hen-day % dropped >10 pp in 7 days
      'vaccination_overdue',      // Scheduled vaccination window missed
      'health_gap_alert',         // No health event logged in 30+ days
      'age_action_due',           // Broilers due for processing / layers for culling
      'disease_pattern',          // Same disease cause recurring in mortality records
      'high_mortality_rate',      // Cumulative mortality >5% of placement count
    ]),
    severity: z.enum(['info', 'warning', 'critical']),
    title: z.string(),
    detail: z.string(),
    actionRequired: z.string(),
    affectedCount: z.number().nullable(),   // Number of birds affected / at risk
    predictedDate: z.string().nullable(),   // ISO date when action is most urgent
    confidence: z.number().min(0).max(100),
  }))
})

// ─── Kenya vaccination schedule (days after placement) ────────────────────

const VACCINATION_WINDOWS: Record<string, number[]> = {
  layer:        [1, 7, 14, 21, 28, 35, 56, 70, 112, 120],
  broiler:      [1, 7, 14, 21],
  kienyeji:     [1, 7, 21, 56, 120],
  dual_purpose: [1, 7, 14, 21, 56, 120],
}

// ─── POST handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer '))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    // ── Farm lookup
    const { data: fm } = await supabase
      .from('farm_managers')
      .select('farm_id, farms(phone)')
      .eq('user_id', user.id)
      .single()
    if (!fm) return NextResponse.json({ error: 'No farm found' }, { status: 404 })

    const farmId   = fm.farm_id
    const farmPhone = (fm.farms as any)?.phone

    // ── Active batches
    const { data: batches } = await supabase
      .from('poultry_batches' as any)
      .select('id, batch_name, bird_type, initial_count, current_count, date_of_placement, status, house_number')
      .eq('farm_id', farmId)
      .eq('status', 'active')

    if (!batches?.length) return NextResponse.json({ warnings: [] })

    const batchIds = batches.map((b: any) => b.id)
    const today    = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const thirtyDaysAgo  = new Date(today.getTime() - 30  * 86400000).toISOString().split('T')[0]
    const ninetyDaysAgo  = new Date(today.getTime() - 90  * 86400000).toISOString().split('T')[0]
    const sevenDaysAgo   = new Date(today.getTime() - 7   * 86400000).toISOString().split('T')[0]

    // ── Parallel data fetch: mortality, feed, egg, health
    const [
      { data: mortalityRecords },
      { data: feedRecords },
      { data: eggRecords },
      { data: healthRecords },
    ] = await Promise.all([
      supabase
        .from('poultry_mortality_records' as any)
        .select('batch_id, record_date, count_dead, cause')
        .in('batch_id', batchIds)
        .gte('record_date', ninetyDaysAgo)
        .order('record_date', { ascending: false }),

      supabase
        .from('poultry_feed_records' as any)
        .select('batch_id, record_date, feed_type, quantity_kg, cost_per_kg, total_cost, days_remaining')
        .in('batch_id', batchIds)
        .gte('record_date', thirtyDaysAgo)
        .order('record_date', { ascending: false }),

      supabase
        .from('poultry_egg_records' as any)
        .select('batch_id, record_date, eggs_collected, broken_eggs')
        .in('batch_id', batchIds)
        .gte('record_date', sevenDaysAgo)
        .order('record_date', { ascending: false }),

      supabase
        .from('poultry_health_records' as any)
        .select('batch_id, record_date, event_type, vaccine_name, disease, drug_name, cost')
        .in('batch_id', batchIds)
        .gte('record_date', ninetyDaysAgo)
        .order('record_date', { ascending: false }),
    ])

    // ── Build per-batch summary for the AI
    const batchSummaries = batches.map((batch: any) => {
      const ageWeeks = Math.floor(
        (today.getTime() - new Date(batch.date_of_placement).getTime()) / (7 * 86400000)
      )
      const ageDays = Math.floor(
        (today.getTime() - new Date(batch.date_of_placement).getTime()) / 86400000
      )

      // --- Mortality ---
      const batchMortality  = (mortalityRecords || []).filter((m: any) => m.batch_id === batch.id)
      const totalDead       = batchMortality.reduce((s: number, m: any) => s + (m.count_dead || 0), 0)
      const mortalityRate   = batch.initial_count > 0 ? (totalDead / batch.initial_count) * 100 : 0
      const last3DaysDead   = batchMortality
        .filter((m: any) => m.record_date >= sevenDaysAgo)
        .reduce((s: number, m: any) => s + (m.count_dead || 0), 0)
      const causeCounts: Record<string, number> = {}
      batchMortality.forEach((m: any) => {
        if (m.cause) causeCounts[m.cause] = (causeCounts[m.cause] || 0) + (m.count_dead || 0)
      })
      const dominantCause = Object.entries(causeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

      // --- Feed ---
      const batchFeed       = (feedRecords || []).filter((f: any) => f.batch_id === batch.id)
      const latestFeed      = batchFeed[0] || null
      const daysRemainingFeed = latestFeed?.days_remaining ?? null

      // --- Eggs ---
      const batchEggs       = (eggRecords || []).filter((e: any) => e.batch_id === batch.id)
      const recentEggs7d    = batchEggs.slice(0, 7)
      const avgEggs7d       = recentEggs7d.length
        ? recentEggs7d.reduce((s: number, e: any) => s + (e.eggs_collected || 0), 0) / recentEggs7d.length
        : null
      // Hen-day% for layers: eggs / current_count * 100
      const henDayPct       = avgEggs7d && batch.current_count > 0
        ? parseFloat(((avgEggs7d / batch.current_count) * 100).toFixed(1))
        : null

      // --- Health ---
      const batchHealth     = (healthRecords || []).filter((h: any) => h.batch_id === batch.id)
      const lastHealthEvent = batchHealth[0] || null
      const daysSinceHealth = lastHealthEvent
        ? Math.floor((today.getTime() - new Date(lastHealthEvent.record_date).getTime()) / 86400000)
        : null
      const vaccinations    = batchHealth.filter((h: any) => h.event_type === 'vaccination')
      const vaccinationNames = vaccinations.map((v: any) => v.vaccine_name).filter(Boolean)

      // --- Vaccination gaps ---
      const schedule        = VACCINATION_WINDOWS[batch.bird_type] || VACCINATION_WINDOWS['layer']
      const nextScheduledDayOffset = schedule.find(d => d > ageDays) ?? null
      const nextVaxDue      = nextScheduledDayOffset
        ? new Date(new Date(batch.date_of_placement).getTime() + nextScheduledDayOffset * 86400000)
            .toISOString().split('T')[0]
        : null
      const daysToNextVax   = nextVaxDue
        ? Math.ceil((new Date(nextVaxDue).getTime() - today.getTime()) / 86400000)
        : null

      // Broiler processing target: typically 6–8 weeks
      const processingDue = batch.bird_type === 'broiler' && ageWeeks >= 6

      return {
        batchId:             batch.id,
        batchName:           batch.batch_name,
        birdType:            batch.bird_type,
        houseNumber:         batch.house_number,
        ageWeeks,
        ageDays,
        initialCount:        batch.initial_count,
        currentCount:        batch.current_count,
        totalMortalityPct:   parseFloat(mortalityRate.toFixed(2)),
        mortalityLast7Days:  last3DaysDead,
        dominantMortalityCause: dominantCause,
        feedDaysRemaining:   daysRemainingFeed,
        avgEggsPerDay7d:     avgEggs7d,
        henDayProductionPct: henDayPct,
        daysSinceLastHealth: daysSinceHealth,
        lastHealthEventType: lastHealthEvent?.event_type || null,
        vaccinationsGiven:   vaccinationNames,
        nextVaxDueDate:      nextVaxDue,
        daysToNextVaccination: daysToNextVax,
        processingDue,
      }
    })

    // ── AI analysis
    const model = getLanguageModel('openai')

    const systemPrompt = `You are an expert poultry veterinarian and farm management AI specialising in Kenyan commercial and smallholder poultry. Today is ${todayStr}.

Analyse each active batch and generate ONLY genuine, evidence-based warnings. Be concise and actionable.

RULES:
1. MORTALITY SPIKE: Flag if ≥3 birds died in the last 7 days OR if the same cause appears 2+ times. Severity = 'warning' if 3–5 deaths, 'critical' if >5 or recurring disease cause.
2. HIGH MORTALITY RATE: Cumulative mortality >5% of initial placement = 'warning'; >10% = 'critical'.
3. FEED STOCK CRITICAL: days_remaining ≤5 = 'critical'; ≤10 = 'warning'. Kienyeji and broilers deplete faster.
4. PRODUCTION DROP: For layers — hen-day% below 65% = 'warning'; below 50% = 'critical'. For batches with no egg data logged, flag as info.
5. VACCINATION OVERDUE: If nextVaxDueDate is within 3 days or already past AND the vaccine isn't in vaccinationsGiven, flag as 'warning'.
6. HEALTH GAP: No health event logged in 30+ days = 'info' reminder.
7. AGE ACTION DUE: Broilers ≥6 weeks = 'info' to plan processing/sale. Layers ≥72 weeks = 'info' for flock replacement planning.
8. DISEASE PATTERN: If the same disease cause dominates mortality (dominantMortalityCause not null) AND mortalityLast7Days > 0, flag as 'critical' — biosecurity breach.

NEVER fabricate data. ONLY flag when there is clear evidence in the numbers provided.
Return an empty warnings array if all batches look healthy.`

    const { object } = await generateObject({
      model,
      schema: warningSchema,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analyse ${batches.length} active poultry batch${batches.length !== 1 ? 'es' : ''}:\n\n${JSON.stringify(batchSummaries, null, 2)}`,
        },
      ],
    })

    // ── Proactive WhatsApp alerts for critical warnings
    const criticals = object.warnings.filter(w => w.severity === 'critical')
    if (criticals.length > 0 && farmPhone) {
      try {
        const alertMsg =
          `🚨 *POULTRY ALERT*\n\n` +
          criticals
            .map(w => `• *${w.batchName}* (${w.birdType}): ${w.title}\n_${w.actionRequired}_`)
            .join('\n\n') +
          `\n\nView full details on your framedInsight dashboard.`

        await sendWhatsAppMessage(farmPhone, alertMsg)
      } catch (err) {
        console.error('[Poultry EWS] WhatsApp alert failed:', err)
      }
    }

    return NextResponse.json({
      success:       true,
      warnings:      object.warnings,
      analyzedCount: batches.length,
    })

  } catch (error: any) {
    console.error('[Poultry EWS] error:', error)
    return NextResponse.json(
      { error: 'Analysis failed', details: error.message },
      { status: 500 }
    )
  }
}