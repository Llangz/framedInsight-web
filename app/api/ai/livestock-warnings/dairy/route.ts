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

const warningSchema = z.object({
  warnings: z.array(z.object({
    cowId: z.string(),
    cowTag: z.string(),
    warningType: z.enum([
      'heat_predicted',
      'milk_decline_anomaly',
      'calving_due',
      'health_check_overdue',
      'pregnancy_check_due',
      'mastitis_risk',
    ]),
    severity: z.enum(['info', 'warning', 'critical']),
    title: z.string().describe('Short 4-6 word title, plain language'),
    detail: z.string().describe('One sentence explanation a farmer can understand'),
    actionRequired: z.string().describe('One clear action step'),
    predictedDate: z.string().nullable().describe('ISO date if relevant, e.g. predicted heat date'),
    confidence: z.number().min(0).max(100),
  }))
})

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer '))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    // Get farm and phone
    const { data: fm } = await supabase
      .from('farm_managers').select('farm_id, farms(phone)')
      .eq('user_id', user.id).single()
    if (!fm) return NextResponse.json({ error: 'No farm found' }, { status: 404 })

    const farmId = fm.farm_id
    const farmPhone = (fm.farms as any)?.phone

    // Fetch cows
    const { data: cows } = await supabase
      .from('cows')
      .select('id, cow_tag, name, status, birth_date, purpose')
      .eq('farm_id', fm.farm_id)
      .eq('status', 'active')
    if (!cows?.length) return NextResponse.json({ warnings: [] })

    const cowIds = cows.map(c => c.id)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    // Fetch last 90 days of milk records
    const { data: milkRecords } = await supabase
      .from('milk_records')
      .select('cow_id, record_date, total_milk, morning_milk, evening_milk')
      .in('cow_id', cowIds)
      .gte('record_date', ninetyDaysAgo)
      .order('record_date', { ascending: false })

    // Fetch breeding records (last service dates)
    const { data: breedingRecords } = await supabase
      .from('breeding_events')
      .select('cow_id, service_date, service_type, expected_calving_date, pregnancy_result')
      .in('cow_id', cowIds)
      .order('service_date', { ascending: false })

    // Fetch health events
    const { data: healthEvents } = await supabase
      .from('health_records')
      .select('cow_id, treatment_date, disease')
      .in('cow_id', cowIds)
      .order('treatment_date', { ascending: false })

    // Build per-cow data summary for AI
    const cowDataSummary = cows.map(cow => {
      const milkHistory = (milkRecords || [])
        .filter(r => r.cow_id === cow.id)
        .slice(0, 30)
        .map(r => ({ date: r.record_date, liters: r.total_milk }))

      const last7Days = milkHistory.slice(0, 7)
      const prev7Days = milkHistory.slice(7, 14)
      const avg7 = last7Days.length ? last7Days.reduce((s, r) => s + (r.liters || 0), 0) / last7Days.length : null
      const avg7prev = prev7Days.length ? prev7Days.reduce((s, r) => s + (r.liters || 0), 0) / prev7Days.length : null

      const lastBreeding = (breedingRecords || []).find(b => b.cow_id === cow.id)
      const lastHealth = (healthEvents || []).find(h => h.cow_id === cow.id)

      return {
        cowId: cow.id,
        cowTag: cow.cow_tag || cow.name || 'Unknown',
        cowName: cow.name,
        dryOffDate: lastBreeding?.expected_calving_date || null,
        expectedCalvingDate: lastBreeding?.expected_calving_date || null,
        lastCalvingDate: lastBreeding?.service_date || null,
        isInDryPeriod: false,
        last7DayAvgMilk: avg7 ? parseFloat(avg7.toFixed(2)) : null,
        prev7DayAvgMilk: avg7prev ? parseFloat(avg7prev.toFixed(2)) : null,
        milkChangePct: avg7 && avg7prev ? parseFloat((((avg7 - avg7prev) / avg7prev) * 100).toFixed(1)) : null,
        milkTrend: milkHistory.slice(0, 14).map(r => `${r.date}: ${r.liters}L`).join(', '),
        lastServiceDate: lastBreeding?.service_date || null,
        lastServiceType: lastBreeding?.service_type || null,
        expectedDueDate: lastBreeding?.expected_calving_date || null,
        lastBreedingOutcome: lastBreeding?.pregnancy_result || null,
        lastHealthEventDate: lastHealth?.treatment_date || null,
        daysSinceLastHealth: lastHealth?.treatment_date
          ? Math.floor((Date.now() - new Date(lastHealth.treatment_date).getTime()) / 86400000)
          : null,
      }
    })

    // Call AI
    const model = getLanguageModel('openai')
    const systemPrompt = `You are an expert dairy veterinarian and farm management AI with deep knowledge of East African dairy cattle (Friesian, Ayrshire, Guernsey crossbreeds). Today's date is ${today}.

Analyse the provided per-cow data and generate ONLY genuinely actionable warnings. Be conservative — do NOT generate warnings unless there is real evidence. 

Key rules:
1. HEAT (estrus) prediction: Cows cycle every 18-24 days. If last service date known, predict next heat window (Day 18-24 after service). A single-day milk drop then recovery often signals heat, not illness.
2. MILK DECLINE ANOMALY: A sustained drop of >15% over 3+ consecutive days when the cow is NOT in a recorded dry-off period is a health concern (mastitis, illness). Distinguish from heat (single day drop).
3. CALVING DUE: If expected_calving_date is within 14 days, raise a calving_due warning.
4. HEALTH OVERDUE: If no health event in 90+ days, flag for routine check.
5. PREGNANCY CHECK: If last service was 45+ days ago with no recorded outcome, pregnancy check is due.
6. MASTITIS RISK: If morning:evening ratio is very uneven AND total is declining, flag mastitis risk.

Return JSON matching the schema. If a cow has no real alerts, do not include it. Generate warnings only in English.`

    const { object } = await generateObject({
      model,
      schema: warningSchema,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyse these ${cows.length} dairy cows and generate early warnings:\n\n${JSON.stringify(cowDataSummary, null, 2)}` }
      ],
    })

    // --- WhatsApp Proactive Alerts ---
    const criticals = object.warnings.filter(w => w.severity === 'critical')
    if (criticals.length > 0 && farmPhone) {
      try {
        const alertMsg = `🚨 *URGENT: Dairy Alert*\n\n` + 
          criticals.map(w => `• *${w.cowTag}*: ${w.title}\n_${w.actionRequired}_`).join('\n\n') +
          `\n\nCheck your dashboard for details.`
        
        await sendWhatsAppMessage(farmPhone, alertMsg)
      } catch (err) {
        console.error('Failed to send WhatsApp alert:', err)
      }
    }

    return NextResponse.json({ success: true, warnings: object.warnings, analyzedCount: cows.length })

  } catch (error: any) {
    console.error('Dairy EWS error:', error)
    return NextResponse.json({ error: 'Analysis failed', details: error.message }, { status: 500 })
  }
}
