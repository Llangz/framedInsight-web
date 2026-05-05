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
    animalId: z.string(),
    animalTag: z.string(),
    species: z.enum(['goat', 'sheep']),
    warningType: z.enum([
      'estrus_predicted',
      'weight_loss_alert',
      'kidding_due',
      'health_gap_alert',
      'pregnancy_check_due',
      'disease_risk',
      'parasite_risk',
    ]),
    severity: z.enum(['info', 'warning', 'critical']),
    title: z.string(),
    detail: z.string(),
    actionRequired: z.string(),
    predictedDate: z.string().nullable(),
    confidence: z.number().min(0).max(100),
  }))
})

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer '))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const { data: fm } = await supabase
      .from('farm_managers').select('farm_id, farms(phone)')
      .eq('user_id', user.id).single()
    if (!fm) return NextResponse.json({ error: 'No farm found' }, { status: 404 })

    const farmId = fm.farm_id
    const farmPhone = (fm.farms as any)?.phone

    const { data: animals } = await supabase
      .from('small_ruminants')
      .select('id, animal_tag, name, species, sex, birth_date, status')
      .eq('farm_id', fm.farm_id)
      .eq('status', 'active')
    if (!animals?.length) return NextResponse.json({ warnings: [] })

    const femaleIds = animals.filter(a => a.sex === 'female').map(a => a.id)
    const allIds = animals.map(a => a.id)
    const today = new Date().toISOString().split('T')[0]
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]

    // Weight records (last 90 days)
    const { data: weightRecords } = await supabase
      .from('weight_records')
      .select('animal_id, record_date, weight_kg')
      .in('animal_id', allIds)
      .gte('record_date', ninetyDaysAgo)
      .order('record_date', { ascending: false })

    // Breeding/kidding records
    const { data: breedingRecords } = await supabase
      .from('kidding_lambing_records')
      .select('dam_id, delivery_date, number_of_offspring')
      .in('dam_id', femaleIds)
      .order('delivery_date', { ascending: false })

    // Health events
    const { data: healthEvents } = await supabase
      .from('small_ruminant_health')
      .select('animal_id, event_date, event_type, disease')
      .in('animal_id', allIds)
      .order('event_date', { ascending: false })

    // Milk records for does/ewes
    const { data: milkRecords } = await supabase
      .from('goat_milk_records')
      .select('animal_id, record_date, morning_milk, evening_milk')
      .in('animal_id', femaleIds)
      .gte('record_date', ninetyDaysAgo)
      .order('record_date', { ascending: false })

    // Build per-animal summary
    const animalSummary = animals.map(animal => {
      const weights = (weightRecords || []).filter(w => w.animal_id === animal.id)
      const latestWeight = weights[0]?.weight_kg ?? null
      const oldestWeight = weights[weights.length - 1]?.weight_kg ?? null
      const weightChangePct = latestWeight && oldestWeight && oldestWeight > 0
        ? parseFloat((((latestWeight - oldestWeight) / oldestWeight) * 100).toFixed(1)) : null

      const lastBreeding = (breedingRecords || []).find(b => b.dam_id === animal.id)
      const lastHealth = (healthEvents || []).find(h => h.animal_id === animal.id)
      const recentMilk = (milkRecords || []).filter(m => m.animal_id === animal.id).slice(0, 7)
      const avgMilk = recentMilk.length
        ? (recentMilk.reduce((s, m) => s + (m.morning_milk || 0) + (m.evening_milk || 0), 0) / recentMilk.length).toFixed(2)
        : null

      // Estrus cycle: goats 17-21 days, sheep 16-17 days
      const cycleDays = animal.species === 'sheep' ? 17 : 19
      const lastMatingDate = lastBreeding?.delivery_date || null
      const predictedHeatDate = lastMatingDate
        ? new Date(new Date(lastMatingDate).getTime() + cycleDays * 86400000).toISOString().split('T')[0]
        : null

      return {
        animalId: animal.id,
        animalTag: animal.animal_tag,
        animalName: animal.name,
        species: animal.species,
        sex: animal.sex,
        ageMonths: animal.birth_date
          ? Math.floor((Date.now() - new Date(animal.birth_date).getTime()) / (30.44 * 86400000))
          : null,
        latestWeightKg: latestWeight,
        weightChangePct90Days: weightChangePct,
        lastKiddingDate: lastBreeding?.delivery_date || null,
        expectedKiddingDate: null,
        lastMatingDate,
        predictedNextHeatDate: predictedHeatDate,
        daysSinceLastHealth: lastHealth?.event_date
          ? Math.floor((Date.now() - new Date(lastHealth.event_date).getTime()) / 86400000)
          : null,
        lastHealthEvent: lastHealth?.event_type || null,
        recentDisease: lastHealth?.disease || null,
        avgDailyMilkLiters: avgMilk,
      }
    })

    const model = getLanguageModel('openai')
    const systemPrompt = `You are an expert veterinarian and farm management AI specialising in small ruminants (goats and sheep) in East Africa. Today is ${today}.

Analyse each animal and generate ONLY genuine, evidence-based warnings. Be concise and practical.

Rules:
1. ESTRUS: Goats cycle every 17-21 days, sheep 16-17 days. Predict heat window based on last mating date. Only for females.
2. WEIGHT LOSS: A drop of >10% in 30-90 days is a disease/parasite risk signal. Flag as 'warning' if 10-15%, 'critical' if >15%.
3. KIDDING DUE: Flag 14 days before expected kidding date.
4. HEALTH GAP: No health event in 90+ days → routine checkup overdue.
5. PREGNANCY CHECK: Female mated 45+ days ago with no kidding record → pregnancy check needed.
6. DISEASE RISK: If animal had recent disease + weight loss combination → flag.
7. PARASITE RISK: Weight loss + no recent deworming event in last 90 days → parasite risk.

Do NOT flag animals with no real data signals. Return only genuine alerts.`

    const { object } = await generateObject({
      model,
      schema: warningSchema,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyse ${animals.length} small ruminants:\n\n${JSON.stringify(animalSummary, null, 2)}` }
      ],
    })

    // --- WhatsApp Proactive Alerts ---
    const criticals = object.warnings.filter(w => w.severity === 'critical')
    if (criticals.length > 0 && farmPhone) {
      try {
        const alertMsg = `🚨 *SMALL RUMINANT ALERT*\n\n` + 
          criticals.map(w => `• *${w.animalTag}* (${w.species}): ${w.title}\n_${w.actionRequired}_`).join('\n\n') +
          `\n\nView details on your dashboard.`
        
        await sendWhatsAppMessage(farmPhone, alertMsg)
      } catch (err) {
        console.error('Failed to send WhatsApp alert:', err)
      }
    }

    return NextResponse.json({ success: true, warnings: object.warnings, analyzedCount: animals.length })

  } catch (error: any) {
    console.error('Small ruminant EWS error:', error)
    return NextResponse.json({ error: 'Analysis failed', details: error.message }, { status: 500 })
  }
}
