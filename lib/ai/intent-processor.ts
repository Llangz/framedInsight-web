// lib/ai/intent-processor.ts

import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModel } from '@/lib/ai/config'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────
// Supabase — always use service role for server-side writes
// ─────────────────────────────────────────────
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const today = () => new Date().toISOString().split('T')[0]

// ─────────────────────────────────────────────
// Intent Schema
// Every intent the WhatsApp menu can trigger must appear here.
// ─────────────────────────────────────────────
const intentSchema = z.object({
  intent: z.enum([
    // Dairy
    'record_milk',
    'report_cow_health',
    // Coffee
    'record_coffee_harvest',
    'report_coffee_disease',
    'query_eudr_status',
    // Small ruminants
    'record_goat_weight',
    'report_goat_health',
    'record_goat_sale',
    // Cross-enterprise
    'query_ai_warnings',
    'query_farm_stats',
    // Fallback
    'general_query',
    'unknown',
  ]),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    amount:   z.number().optional(),    // litres, kg, KES
    unit:     z.string().optional(),
    target:   z.string().optional(),    // animal tag/name OR plot name
    date:     z.string().optional(),    // ISO date if mentioned
    session:  z.enum(['morning', 'evening', 'afternoon']).optional(),
    issue:    z.string().optional(),    // disease / symptom description
    disease:  z.string().optional(),    // specific disease name
    severity: z.string().optional(),    // mild / moderate / severe
  }),
  response: z.string(),  // AI-generated fallback reply
})

type ParsedIntent = z.infer<typeof intentSchema>

// ─────────────────────────────────────────────
// processFarmerIntent — classify & extract entities
// ─────────────────────────────────────────────
export async function processFarmerIntent(
  message: string,
  farmId: string,
  enterpriseHint?: string,
): Promise<ParsedIntent> {
  const supabase = getSupabaseClient()

  try {
    const [{ data: cows }, { data: plots }, { data: ruminants }] = await Promise.all([
      supabase.from('cows')
        .select('cow_tag, name')
        .eq('farm_id', farmId)
        .eq('status', 'active'),

      supabase.from('coffee_plots')
        .select('id, plot_name, eudr_risk_level')
        .eq('farm_id', farmId),

      supabase.from('small_ruminants')
        .select('animal_tag, name, species')
        .eq('farm_id', farmId)
        .eq('status', 'active'),
    ])

    const contextStr = [
      `Dairy cows: ${cows?.map(c => `${c.cow_tag}${c.name ? ` (${c.name})` : ''}`).join(', ') || 'None'}`,
      `Coffee plots: ${plots?.map(p => `${p.plot_name}${p.eudr_risk_level ? ` [EUDR: ${p.eudr_risk_level}]` : ''}`).join(', ') || 'None'}`,
      `Small ruminants: ${ruminants?.map(r => `${r.animal_tag}${r.name ? ` (${r.name})` : ''} [${r.species}]`).join(', ') || 'None'}`,
    ].join('\n')

    const model = getLanguageModel('openai')

    const { object } = await generateObject({
      model,
      schema: intentSchema,
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant for Kenyan farmers using framedInsight.
Parse WhatsApp messages into structured farm actions.

Today's date: ${today()}
Farm context:
${contextStr}

Intent classification rules:
- Milk amount or litres for a cow → record_milk
- Cow illness, symptoms, limping, not eating → report_cow_health
- Coffee kg or bags picked/harvested from a plot → record_coffee_harvest
- CBD, leaf rust, antestia, disease on coffee trees/plot → report_coffee_disease
- EUDR status, compliance, deforestation risk for a plot → query_eudr_status
- Goat/sheep weight in kg → record_goat_weight
- Goat/sheep illness, diarrhoea, not eating, limping → report_goat_health
- Sold goat/sheep for KES amount → record_goat_sale
- AI warnings, alerts, predictions, health alerts → query_ai_warnings
- Stats, totals, how much milk, harvest summary → query_farm_stats

entity extraction:
- target: animal tag, animal name, or plot name from the context above (fuzzy match)
- amount: any numeric value (litres, kg, KES)
- issue: symptom description in farmer's own words
- disease: specific disease if named
- severity: mild/moderate/severe if mentioned

Keep responses short, friendly, Kenyan farming tone. Sheng/Swahili welcome.`,
        },
        { role: 'user', content: message },
      ],
    })

    return object

  } catch (error) {
    console.error('Intent processing error:', error)
    return {
      intent: 'unknown',
      confidence: 0,
      entities: {},
      response: 'Pole, sijaelewa vizuri. Tafadhali jaribu tena.',
    }
  }
}

// ─────────────────────────────────────────────
// Entity lookup helpers
// ─────────────────────────────────────────────
async function findCow(supabase: ReturnType<typeof getSupabaseClient>, farmId: string, target?: string) {
  if (!target) return null
  const { data } = await supabase
    .from('cows')
    .select('id, cow_tag, name')
    .eq('farm_id', farmId)
    .or(`cow_tag.ilike.%${target}%,name.ilike.%${target}%`)
    .limit(1).maybeSingle()
  return data
}

async function findRuminant(supabase: ReturnType<typeof getSupabaseClient>, farmId: string, target?: string) {
  if (!target) return null
  const { data } = await supabase
    .from('small_ruminants')
    .select('id, animal_tag, name, species')
    .eq('farm_id', farmId)
    .or(`animal_tag.ilike.%${target}%,name.ilike.%${target}%`)
    .limit(1).maybeSingle()
  return data
}

async function findPlot(supabase: ReturnType<typeof getSupabaseClient>, farmId: string, target?: string) {
  if (!target) return null
  const { data } = await supabase
    .from('coffee_plots')
    .select('id, plot_name, eudr_risk_level, total_trees')
    .eq('farm_id', farmId)
    .ilike('plot_name', `%${target}%`)
    .limit(1).maybeSingle()
  return data
}

// ─────────────────────────────────────────────
// executeIntent — write to DB and return reply
// ─────────────────────────────────────────────
export async function executeIntent(farmId: string, parsed: ParsedIntent): Promise<string> {
  const supabase = getSupabaseClient()
  const { intent, entities } = parsed

  try {
    // ── DAIRY: Record milk ────────────────────────────────────────────────
    if (intent === 'record_milk') {
      const cow = await findCow(supabase, farmId, entities.target)

      if (!cow) {
        return entities.target
          ? `Sijaona ng'ombe "${entities.target}" kwa shamba lako. Angalia tag au jina.`
          : `Taja jina au tag ya ng'ombe, e.g. "Daisy ametoa 18L asubuhi".`
      }
      if (!entities.amount) {
        return `Unataka kurekodi maziwa ya ${cow.cow_tag} — ilikuwa lita ngapi?`
      }

      const isMorning = entities.session === 'morning' || !entities.session
      const sessionLabel = entities.session === 'evening' ? 'jioni'
                         : entities.session === 'afternoon' ? 'mchana' : 'asubuhi'

      await supabase.from('milk_records').insert({
        cow_id:       cow.id,
        record_date:  entities.date || today(),
        morning_milk: isMorning ? entities.amount : 0,
        evening_milk: !isMorning ? entities.amount : 0,
        total_milk:   entities.amount,
      })

      return `✓ Nime-record ${entities.amount}L za ${sessionLabel} kwa ${cow.name || cow.cow_tag}. Kazi nzuri!`
    }

    // ── DAIRY: Cow health ─────────────────────────────────────────────────
    if (intent === 'report_cow_health') {
      const cow = await findCow(supabase, farmId, entities.target)

      if (!cow) {
        return entities.target
          ? `Sijaona ng'ombe "${entities.target}". Taja tag sahihi.`
          : `Taja jina au tag ya ng'ombe aliye na tatizo.`
      }
      if (!entities.issue) {
        return `Elezea tatizo la ${cow.name || cow.cow_tag} — dalili ni zipi?`
      }

      await supabase.from('health_records').insert({
        cow_id:         cow.id,
        symptoms:       entities.issue,
        disease:        entities.disease ?? null,
        treatment_date: entities.date || today(),
      })

      return `✓ Nime-record tatizo la "${entities.issue}" kwa ${cow.name || cow.cow_tag}. Fuatilia vizuri — wasiliana na daktari wa mifugo ikibidi.`
    }

    // ── COFFEE: Record harvest ────────────────────────────────────────────
    if (intent === 'record_coffee_harvest') {
      const plot = await findPlot(supabase, farmId, entities.target)

      if (!plot) {
        return entities.target
          ? `Sijaona plot ya kahawa inayoitwa "${entities.target}". Angalia jina.`
          : `Taja jina la plot, e.g. "Niliokota 80kg kutoka Hillside".`
      }
      if (!entities.amount) {
        return `Unataka kurekodi mavuno ya ${plot.plot_name} — ilikuwa kilo ngapi?`
      }

      await supabase.from('coffee_harvests').insert({
        farm_id:      farmId,
        plot_id:      plot.id,
        plot_name:    plot.plot_name,
        harvest_date: entities.date || today(),
        cherry_kg:    entities.amount,
        produce_kg:   entities.amount,
        quality_grade: 'AB',
      })

      return `✓ Nime-record ${entities.amount}kg cherry kwa ${plot.plot_name}. Safi sana — endelea hivyo!`
    }

    // ── COFFEE: Report disease ────────────────────────────────────────────
    if (intent === 'report_coffee_disease') {
      const plot = await findPlot(supabase, farmId, entities.target)

      if (!plot) {
        return entities.target
          ? `Sijaona plot "${entities.target}". Taja jina sahihi.`
          : `Taja plot iliyoathiriwa, e.g. "Hillside ina CBD".`
      }
      if (!entities.issue && !entities.disease) {
        return `Elezea ugonjwa/tatizo kwenye ${plot.plot_name} — dalili ni zipi?`
      }

      const description = [entities.disease, entities.issue].filter(Boolean).join(' — ')

      await supabase.from('coffee_scouting_records').insert({
        farm_id:              farmId,
        plot_id:              plot.id,
        scouting_date:        entities.date || today(),
        observation_type:     'disease',
        symptoms_description: description,
        severity_level:       entities.severity ?? 'unknown',
        alert_level:          entities.severity === 'severe' ? 'high' : 'medium',
      })

      return `✓ Nime-record ripoti ya ugonjwa kwa ${plot.plot_name}: "${description}". Tembelea plot haraka na fikiria dawa sahihi.`
    }

    // ── COFFEE: EUDR status ───────────────────────────────────────────────
    if (intent === 'query_eudr_status') {
      const plot = await findPlot(supabase, farmId, entities.target)

      if (!plot) {
        // No specific plot — return summary for all plots
        const { data: allPlots } = await supabase
          .from('coffee_plots')
          .select('plot_name, eudr_risk_level, total_trees')
          .eq('farm_id', farmId)

        if (!allPlots?.length) return `Bado huna plots zilizosajiliwa.`

        const lines = allPlots.map(p =>
          `• ${p.plot_name}: ${p.eudr_risk_level ? eudrLabel(p.eudr_risk_level) : 'Haijapimwa'}`
        ).join('\n')
        return `📋 EUDR status ya plots zako:\n${lines}\n\nTumia dashboard kuona details zaidi.`
      }

      const { data: compliance } = await supabase
        .from('coffee_eudr_compliance')
        .select('compliance_status, risk_level, deforestation_risk, assessment_date')
        .eq('plot_id', plot.id)
        .order('assessment_date', { ascending: false })
        .limit(1).maybeSingle()

      if (!compliance) {
        return `EUDR ya plot ya ${plot.plot_name} bado haijapimwa. Nenda dashboard → Coffee → EUDR Compliance.`
      }

      const risk = compliance.risk_level ? eudrLabel(compliance.risk_level) : 'Haijulikani'
      const deforest = compliance.deforestation_risk ? '⚠️ Kuna hatari ya deforestation' : '✓ Hakuna hatari ya deforestation'
      const date = compliance.assessment_date
        ? `Tathmini: ${new Date(compliance.assessment_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : ''

      return `📋 EUDR — ${plot.plot_name}\nHali: ${risk}\n${deforest}\n${date}`
    }

    // ── GOATS: Record weight ──────────────────────────────────────────────
    if (intent === 'record_goat_weight') {
      const animal = await findRuminant(supabase, farmId, entities.target)

      if (!animal) {
        return entities.target
          ? `Sijaona mbuzi/kondoo "${entities.target}". Angalia tag.`
          : `Taja tag ya mnyama, e.g. "Nanny 01 ana uzito 38kg".`
      }
      if (!entities.amount) {
        return `${animal.name || animal.animal_tag} ana uzito gani kwa kilo?`
      }

      await supabase.from('weight_records').insert({
        animal_id:   animal.id,
        record_date: entities.date || today(),
        weight_kg:   entities.amount,
      })

      return `✓ Nime-record uzito wa ${entities.amount}kg kwa ${animal.name || animal.animal_tag} (${animal.species}). Endelea kufuatilia ukuaji wake.`
    }

    // ── GOATS: Report health ──────────────────────────────────────────────
    if (intent === 'report_goat_health') {
      const animal = await findRuminant(supabase, farmId, entities.target)

      if (!animal) {
        return entities.target
          ? `Sijaona "${entities.target}" kwenye kundi lako. Angalia tag.`
          : `Taja tag ya mnyama mwenye tatizo.`
      }
      if (!entities.issue) {
        return `Elezea tatizo la ${animal.name || animal.animal_tag} — dalili ni zipi?`
      }

      await supabase.from('small_ruminant_health').insert({
        animal_id:   animal.id,
        event_date:  entities.date || today(),
        event_type:  'illness',
        symptoms:    entities.issue,
        disease:     entities.disease ?? null,
      })

      return `✓ Nime-record tatizo la "${entities.issue}" kwa ${animal.name || animal.animal_tag}. Angalia lishe na maji, na wasiliana na daktari ikihitajika.`
    }

    // ── GOATS: Record sale ────────────────────────────────────────────────
    if (intent === 'record_goat_sale') {
      const animal = await findRuminant(supabase, farmId, entities.target)

      if (!entities.amount) {
        return animal
          ? `Ulimuuza ${animal.name || animal.animal_tag} kwa KES ngapi?`
          : `Taja tag ya mnyama na bei, e.g. "Nilimuuza Nanny 02 kwa KES 9,000".`
      }

      await supabase.from('small_ruminant_sales').insert({
        farm_id:        farmId,
        animal_id:      animal?.id ?? null,
        sale_date:      entities.date || today(),
        sale_type:      'live_animal',
        total_price:    entities.amount,
        payment_status: 'paid',
      })

      const animalLabel = animal ? `${animal.name || animal.animal_tag}` : 'mnyama'
      return `✓ Mauzo ya ${animalLabel} yame-record — KES ${entities.amount.toLocaleString()}. Pesa njema!`
    }

    // ── AI Warnings ───────────────────────────────────────────────────────
    if (intent === 'query_ai_warnings') {
      const [{ data: activeAlerts }, { data: predictions }] = await Promise.all([
        supabase
          .from('alerts')
          .select('alert_type, message, alert_priority, alert_date')
          .eq('farm_id', farmId)
          .eq('status', 'pending')
          .order('alert_date', { ascending: false })
          .limit(5),

        supabase
          .from('ai_predictions')
          .select('prediction_type, prediction_text, confidence_score, valid_until_date')
          .eq('farm_id', farmId)
          .gte('valid_until_date', today())
          .order('prediction_date', { ascending: false })
          .limit(3),
      ])

      const lines: string[] = []

      if (activeAlerts?.length) {
        lines.push('🔔 *Arifa za haraka:*')
        activeAlerts.forEach(a => {
          const priority = a.alert_priority === 'high' ? '🔴' : a.alert_priority === 'medium' ? '🟡' : '⚪'
          lines.push(`${priority} ${a.message}`)
        })
      }

      if (predictions?.length) {
        lines.push('\n🤖 *Utabiri wa AI:*')
        predictions.forEach(p => {
          const conf = p.confidence_score ? ` (${Math.round(p.confidence_score * 100)}%)` : ''
          lines.push(`• ${p.prediction_text}${conf}`)
        })
      }

      if (!lines.length) {
        return '✓ Hakuna arifa wala tahadhari za AI kwa sasa. Shamba lako liko sawa!'
      }

      return lines.join('\n')
    }

    // ── Farm stats query ──────────────────────────────────────────────────
    if (intent === 'query_farm_stats') {
      const { data: summary } = await supabase
        .from('v_farm_summary')
        .select('total_coffee_plots, season_cherry_kg, total_coffee_plants, total_cows, total_active_cows, today_milk_litres, total_small_ruminants')
        .eq('id', farmId)
        .maybeSingle()

      if (!summary) return `Takwimu za shamba hazikupatikana. Jaribu tena.`

      const lines = [
        '📊 *Muhtasari wa shamba lako:*',
        summary.total_coffee_plots   ? `☕ Plots za kahawa: ${summary.total_coffee_plots}` : null,
        summary.season_cherry_kg     ? `🍒 Mavuno ya msimu: ${summary.season_cherry_kg.toLocaleString()} kg` : null,
        summary.total_cows           ? `🐄 Ng'ombe wote: ${summary.total_cows} (${summary.total_active_cows || 0} wanaozalisha)` : null,
        summary.today_milk_litres    ? `🍼 Maziwa leo: ${summary.today_milk_litres}L` : null,
        summary.total_small_ruminants ? `🐏 Mbuzi/kondoo: ${summary.total_small_ruminants}` : null,
      ].filter(Boolean)

      return lines.join('\n')
    }

    // ── Fallback ──────────────────────────────────────────────────────────
    return parsed.response || 'Samahani, sijui jinsi ya kusaidia na hilo. Tuma *menu* kuona chaguo.'

  } catch (error) {
    console.error('Execution error:', error)
    return `Kuna shida kidogo kwa system 😅 Tafadhali jaribu tena.`
  }
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────
function eudrLabel(risk: string): string {
  return {
    low:      '✅ Hatari Ndogo',
    medium:   '🟡 Hatari ya Kati',
    high:     '🔴 Hatari Kubwa',
    compliant: '✅ Inafuata Sheria',
    non_compliant: '❌ Haifuati Sheria',
  }[risk.toLowerCase()] ?? risk
}