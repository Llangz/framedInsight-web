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

// Mirrors the Lang type in app/api/webhooks/whatsapp/route.ts — kept as a
// separate local type (not imported) so this module has no dependency on
// the webhook route; the two are just kept in sync by convention.
type Lang = 'en' | 'sw'

/**
 * Human labels + which intents belong to each enterprise, used both to
 * build the classifier's context hint and (previously) nowhere — this is
 * what makes the `enterpriseHint` parameter to processFarmerIntent() do
 * something. Before this, a farmer who tapped "🍼 Record Milk" and then
 * typed something ambiguous got no benefit from having explicitly chosen
 * dairy — the classifier guessed across all 12 intents from a blank slate.
 */
const ENTERPRISE_INTENTS: Record<string, { label: string; intents: string[] }> = {
  MENU_COFFEE:  { label: 'Coffee',        intents: ['record_coffee_harvest', 'report_coffee_disease', 'query_eudr_status'] },
  MENU_DAIRY:   { label: 'Dairy',         intents: ['record_milk', 'report_cow_health'] },
  MENU_GOATS:   { label: 'Goats & Sheep', intents: ['record_goat_weight', 'report_goat_health', 'record_goat_sale'] },
  MENU_POULTRY: { label: 'Poultry',       intents: ['record_egg', 'record_poultry_feed', 'report_poultry_health', 'record_poultry_mortality'] },
}

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
    // Poultry
    'record_egg',
    'record_poultry_feed',
    'report_poultry_health',
    'record_poultry_mortality',
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
  lang: Lang = 'en',
): Promise<ParsedIntent> {
  const supabase = getSupabaseClient()

  try {
    const [{ data: cows }, { data: plots }, { data: ruminants }, { data: poultry }] = await Promise.all([
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
        
      supabase.from('poultry_batches')
        .select('id, batch_name, bird_type')
        .eq('farm_id', farmId)
        .eq('status', 'active'),
    ])

    const contextStr = [
      `Dairy cows: ${cows?.map(c => `${c.cow_tag}${c.name ? ` (${c.name})` : ''}`).join(', ') || 'None'}`,
      `Coffee plots: ${plots?.map(p => `${p.plot_name}${p.eudr_risk_level ? ` [EUDR: ${p.eudr_risk_level}]` : ''}`).join(', ') || 'None'}`,
      `Small ruminants: ${ruminants?.map(r => `${r.animal_tag}${r.name ? ` (${r.name})` : ''} [${r.species}]`).join(', ') || 'None'}`,
      `Poultry batches: ${poultry?.map(b => `${b.batch_name} [${b.bird_type}]`).join(', ') || 'None'}`,
    ].join('\n')

    const model = getLanguageModel('openai')

    const hint = enterpriseHint ? ENTERPRISE_INTENTS[enterpriseHint] : undefined
    const hintLine = hint
      ? `\nThe farmer just tapped into the *${hint.label}* menu on WhatsApp before sending this message. Strongly prefer one of these intents: ${hint.intents.join(', ')} — unless the message clearly and unambiguously describes something else (e.g. asking for AI warnings or farm stats instead).\n`
      : ''

    const languageLine = lang === 'sw'
      ? `The farmer has chosen Kiswahili as their WhatsApp language. Write the "response" field in Kiswahili.`
      : `The farmer has chosen English as their WhatsApp language. Write the "response" field in English.`

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
${hintLine}
${languageLine}

Intent classification rules:
- Milk amount or litres for a cow → record_milk
- Cow illness, symptoms, limping, not eating → report_cow_health
- Coffee kg or bags picked/harvested from a plot → record_coffee_harvest
- CBD, leaf rust, antestia, disease on coffee trees/plot → report_coffee_disease
- EUDR status, compliance, deforestation risk for a plot → query_eudr_status
- Goat/sheep weight in kg → record_goat_weight
- Goat/sheep illness, diarrhoea, not eating, limping → report_goat_health
- Sold goat/sheep for KES amount → record_goat_sale
- Eggs collected or trays from a poultry batch → record_egg
- Feed given to a poultry batch in kg → record_poultry_feed
- Poultry illness, symptoms, sneezing, disease → report_poultry_health
- Dead birds or mortality in a poultry batch → record_poultry_mortality
- AI warnings, alerts, predictions, health alerts → query_ai_warnings
- Stats, totals, how much milk, harvest summary → query_farm_stats

entity extraction:
- target: animal tag, animal name, or plot name from the context above (fuzzy match)
- amount: any numeric value (litres, kg, KES)
- issue: symptom description in farmer's own words
- disease: specific disease if named
- severity: mild/moderate/severe if mentioned

Keep the "response" field short and in a friendly, Kenyan farming tone, in the language specified above. The farmer's own message may be in English, Kiswahili, or Sheng regardless of their chosen reply language — parse it either way, but always reply in the language specified above.`,
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
      response: lang === 'sw'
        ? 'Pole, sijaelewa vizuri. Tafadhali jaribu tena.'
        : "Sorry, I didn't quite understand that. Please try again.",
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

async function findPoultryBatch(supabase: ReturnType<typeof getSupabaseClient>, farmId: string, target?: string) {
  if (!target) return null
  const { data } = await supabase
    .from('poultry_batches')
    .select('id, batch_name, bird_type')
    .eq('farm_id', farmId)
    .ilike('batch_name', `%${target}%`)
    .limit(1).maybeSingle()
  return data
}

// ─────────────────────────────────────────────
// executeIntent — write to DB and return reply
// ─────────────────────────────────────────────
export async function executeIntent(farmId: string, parsed: ParsedIntent, lang: Lang = 'en'): Promise<string> {
  const supabase = getSupabaseClient()
  const { intent, entities } = parsed

  // Every branch below builds its farmer-facing reply through this helper
  // instead of a hardcoded string, so the same confirmation/clarification/
  // error text a farmer gets when recording data matches the language they
  // picked on the menu — previously every reply here was Kiswahili
  // regardless of session language.
  const L = (en: string, sw: string) => (lang === 'sw' ? sw : en)

  try {
    // ── DAIRY: Record milk ────────────────────────────────────────────────
    if (intent === 'record_milk') {
      const cow = await findCow(supabase, farmId, entities.target)

      if (!cow) {
        return entities.target
          ? L(`I couldn't find a cow named "${entities.target}" on your farm. Check the tag or name.`,
              `Sijaona ng'ombe "${entities.target}" kwa shamba lako. Angalia tag au jina.`)
          : L(`Tell me the cow's name or tag, e.g. "Daisy gave 18L this morning".`,
              `Taja jina au tag ya ng'ombe, e.g. "Daisy ametoa 18L asubuhi".`)
      }
      if (!entities.amount) {
        return L(`Recording milk for ${cow.cow_tag} — how many litres?`,
                  `Unataka kurekodi maziwa ya ${cow.cow_tag} — ilikuwa lita ngapi?`)
      }

      const isMorning = entities.session === 'morning' || !entities.session
      const sessionLabel = L(
        entities.session === 'evening' ? 'evening' : entities.session === 'afternoon' ? 'afternoon' : 'morning',
        entities.session === 'evening' ? 'jioni' : entities.session === 'afternoon' ? 'mchana' : 'asubuhi',
      )

      await supabase.from('milk_records').insert({
        cow_id:       cow.id,
        record_date:  entities.date || today(),
        morning_milk: isMorning ? entities.amount : 0,
        evening_milk: !isMorning ? entities.amount : 0,
        total_milk:   entities.amount,
      })

      return L(`✓ Recorded ${entities.amount}L ${sessionLabel} milk for ${cow.name || cow.cow_tag}. Nice work!`,
                `✓ Nime-record ${entities.amount}L za ${sessionLabel} kwa ${cow.name || cow.cow_tag}. Kazi nzuri!`)
    }

    // ── DAIRY: Cow health ─────────────────────────────────────────────────
    if (intent === 'report_cow_health') {
      const cow = await findCow(supabase, farmId, entities.target)

      if (!cow) {
        return entities.target
          ? L(`I couldn't find "${entities.target}". Check the tag.`, `Sijaona ng'ombe "${entities.target}". Taja tag sahihi.`)
          : L(`Tell me the name or tag of the cow with the problem.`, `Taja jina au tag ya ng'ombe aliye na tatizo.`)
      }
      if (!entities.issue) {
        return L(`Describe the problem with ${cow.name || cow.cow_tag} — what are the symptoms?`,
                  `Elezea tatizo la ${cow.name || cow.cow_tag} — dalili ni zipi?`)
      }

      await supabase.from('health_records').insert({
        cow_id:         cow.id,
        symptoms:       entities.issue,
        disease:        entities.disease ?? null,
        treatment_date: entities.date || today(),
      })

      return L(`✓ Recorded "${entities.issue}" for ${cow.name || cow.cow_tag}. Keep monitoring closely — call a vet if it doesn't improve.`,
                `✓ Nime-record tatizo la "${entities.issue}" kwa ${cow.name || cow.cow_tag}. Fuatilia vizuri — wasiliana na daktari wa mifugo ikibidi.`)
    }

    // ── COFFEE: Record harvest ────────────────────────────────────────────
    if (intent === 'record_coffee_harvest') {
      const plot = await findPlot(supabase, farmId, entities.target)

      if (!plot) {
        return entities.target
          ? L(`I couldn't find a coffee plot called "${entities.target}". Check the name.`,
              `Sijaona plot ya kahawa inayoitwa "${entities.target}". Angalia jina.`)
          : L(`Tell me the plot name, e.g. "Picked 80kg from Hillside".`,
              `Taja jina la plot, e.g. "Niliokota 80kg kutoka Hillside".`)
      }
      if (!entities.amount) {
        return L(`Recording the harvest for ${plot.plot_name} — how many kg?`,
                  `Unataka kurekodi mavuno ya ${plot.plot_name} — ilikuwa kilo ngapi?`)
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

      return L(`✓ Recorded ${entities.amount}kg cherry for ${plot.plot_name}. Great work — keep it up!`,
                `✓ Nime-record ${entities.amount}kg cherry kwa ${plot.plot_name}. Safi sana — endelea hivyo!`)
    }

    // ── COFFEE: Report disease ────────────────────────────────────────────
    if (intent === 'report_coffee_disease') {
      const plot = await findPlot(supabase, farmId, entities.target)

      if (!plot) {
        return entities.target
          ? L(`I couldn't find plot "${entities.target}". Check the name.`, `Sijaona plot "${entities.target}". Taja jina sahihi.`)
          : L(`Tell me which plot is affected, e.g. "Hillside has CBD".`, `Taja plot iliyoathiriwa, e.g. "Hillside ina CBD".`)
      }
      if (!entities.issue && !entities.disease) {
        return L(`Describe the disease/problem on ${plot.plot_name} — what are the symptoms?`,
                  `Elezea ugonjwa/tatizo kwenye ${plot.plot_name} — dalili ni zipi?`)
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

      return L(`✓ Recorded a disease report for ${plot.plot_name}: "${description}". Visit the plot soon and consider the right treatment.`,
                `✓ Nime-record ripoti ya ugonjwa kwa ${plot.plot_name}: "${description}". Tembelea plot haraka na fikiria dawa sahihi.`)
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

        if (!allPlots?.length) return L(`You don't have any registered plots yet.`, `Bado huna plots zilizosajiliwa.`)

        const lines = allPlots.map(p =>
          `• ${p.plot_name}: ${p.eudr_risk_level ? eudrLabel(p.eudr_risk_level, lang) : L('Not yet assessed', 'Haijapimwa')}`
        ).join('\n')
        return L(`📋 EUDR status for your plots:\n${lines}\n\nUse the dashboard to see more details.`,
                  `📋 EUDR status ya plots zako:\n${lines}\n\nTumia dashboard kuona details zaidi.`)
      }

      const { data: compliance } = await supabase
        .from('coffee_eudr_compliance')
        .select('compliance_status, risk_level, deforestation_risk, assessment_date')
        .eq('plot_id', plot.id)
        .order('assessment_date', { ascending: false })
        .limit(1).maybeSingle()

      if (!compliance) {
        return L(`EUDR for ${plot.plot_name} hasn't been assessed yet. Go to Dashboard → Coffee → EUDR Compliance.`,
                  `EUDR ya plot ya ${plot.plot_name} bado haijapimwa. Nenda dashboard → Coffee → EUDR Compliance.`)
      }

      const risk = compliance.risk_level ? eudrLabel(compliance.risk_level, lang) : L('Unknown', 'Haijulikani')
      const deforest = compliance.deforestation_risk
        ? L('⚠️ There is deforestation risk', '⚠️ Kuna hatari ya deforestation')
        : L('✓ No deforestation risk', '✓ Hakuna hatari ya deforestation')
      const date = compliance.assessment_date
        ? L(`Assessed: ${new Date(compliance.assessment_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`,
            `Tathmini: ${new Date(compliance.assessment_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`)
        : ''

      return `📋 EUDR — ${plot.plot_name}\n${L('Status', 'Hali')}: ${risk}\n${deforest}\n${date}`
    }

    // ── GOATS: Record weight ──────────────────────────────────────────────
    if (intent === 'record_goat_weight') {
      const animal = await findRuminant(supabase, farmId, entities.target)

      if (!animal) {
        return entities.target
          ? L(`I couldn't find "${entities.target}". Check the tag.`, `Sijaona mbuzi/kondoo "${entities.target}". Angalia tag.`)
          : L(`Tell me the animal's tag, e.g. "Nanny 01 weighs 38kg".`, `Taja tag ya mnyama, e.g. "Nanny 01 ana uzito 38kg".`)
      }
      if (!entities.amount) {
        return L(`What does ${animal.name || animal.animal_tag} weigh, in kg?`,
                  `${animal.name || animal.animal_tag} ana uzito gani kwa kilo?`)
      }

      await supabase.from('weight_records').insert({
        animal_id:   animal.id,
        record_date: entities.date || today(),
        weight_kg:   entities.amount,
      })

      return L(`✓ Recorded ${entities.amount}kg weight for ${animal.name || animal.animal_tag} (${animal.species}). Keep tracking its growth.`,
                `✓ Nime-record uzito wa ${entities.amount}kg kwa ${animal.name || animal.animal_tag} (${animal.species}). Endelea kufuatilia ukuaji wake.`)
    }

    // ── GOATS: Report health ──────────────────────────────────────────────
    if (intent === 'report_goat_health') {
      const animal = await findRuminant(supabase, farmId, entities.target)

      if (!animal) {
        return entities.target
          ? L(`I couldn't find "${entities.target}" in your herd. Check the tag.`, `Sijaona "${entities.target}" kwenye kundi lako. Angalia tag.`)
          : L(`Tell me the tag of the animal with the problem.`, `Taja tag ya mnyama mwenye tatizo.`)
      }
      if (!entities.issue) {
        return L(`Describe the problem with ${animal.name || animal.animal_tag} — what are the symptoms?`,
                  `Elezea tatizo la ${animal.name || animal.animal_tag} — dalili ni zipi?`)
      }

      await supabase.from('small_ruminant_health').insert({
        animal_id:   animal.id,
        event_date:  entities.date || today(),
        event_type:  'illness',
        symptoms:    entities.issue,
        disease:     entities.disease ?? null,
      })

      return L(`✓ Recorded "${entities.issue}" for ${animal.name || animal.animal_tag}. Check its feed and water, and call a vet if needed.`,
                `✓ Nime-record tatizo la "${entities.issue}" kwa ${animal.name || animal.animal_tag}. Angalia lishe na maji, na wasiliana na daktari ikihitajika.`)
    }

    // ── GOATS: Record sale ────────────────────────────────────────────────
    if (intent === 'record_goat_sale') {
      const animal = await findRuminant(supabase, farmId, entities.target)

      if (!entities.amount) {
        return animal
          ? L(`How much did you sell ${animal.name || animal.animal_tag} for, in KES?`,
              `Ulimuuza ${animal.name || animal.animal_tag} kwa KES ngapi?`)
          : L(`Tell me the animal's tag and the price, e.g. "Sold Nanny 02 for KES 9,000".`,
              `Taja tag ya mnyama na bei, e.g. "Nilimuuza Nanny 02 kwa KES 9,000".`)
      }

      await supabase.from('small_ruminant_sales').insert({
        farm_id:        farmId,
        animal_id:      animal?.id ?? null,
        sale_date:      entities.date || today(),
        sale_type:      'live_animal',
        total_price:    entities.amount,
        payment_status: 'paid',
      })

      const animalLabel = animal ? `${animal.name || animal.animal_tag}` : L('the animal', 'mnyama')
      return L(`✓ Recorded the sale of ${animalLabel} — KES ${entities.amount.toLocaleString()}. Good money!`,
                `✓ Mauzo ya ${animalLabel} yame-record — KES ${entities.amount.toLocaleString()}. Pesa njema!`)
    }

    // ── POULTRY: Record eggs ──────────────────────────────────────────────
    if (intent === 'record_egg') {
      const batch = await findPoultryBatch(supabase, farmId, entities.target)
      if (!batch) {
        return entities.target
          ? L(`I couldn't find a batch called "${entities.target}". Check the name.`, `Sijaona batch inayoitwa "${entities.target}". Angalia jina vizuri.`)
          : L(`Tell me the poultry batch, e.g. "Batch A laid 320 eggs".`, `Taja batch ya kuku, e.g. "Batch A wametaga mayai 320".`)
      }
      if (!entities.amount) {
        return L(`How many eggs did batch "${batch.batch_name}" lay today?`, `Batch "${batch.batch_name}" wametaga mayai mangapi leo?`)
      }

      await supabase.from('poultry_egg_records').insert({
        farm_id:     farmId,
        batch_id:    batch.id,
        record_date: entities.date || today(),
        total_eggs:  entities.amount,
      })

      return L(`✓ Recorded ${entities.amount} eggs from ${batch.batch_name}. Nice work!`,
                `✓ Nime-record mayai ${entities.amount} kutoka kwa ${batch.batch_name}. Kazi nzuri!`)
    }

    // ── POULTRY: Record feed ──────────────────────────────────────────────
    if (intent === 'record_poultry_feed') {
      const batch = await findPoultryBatch(supabase, farmId, entities.target)
      if (!batch) {
        return L(`Tell me the poultry batch and the feed amount, e.g. "Batch B ate 50kg".`,
                  `Taja batch ya kuku na kiasi cha chakula, e.g. "Batch B wamekula 50kg".`)
      }
      if (!entities.amount) {
        return L(`How many kg of feed did you give ${batch.batch_name}?`, `Uliwapa ${batch.batch_name} kilo ngapi za chakula?`)
      }

      await supabase.from('poultry_feed_records').insert({
        farm_id:     farmId,
        batch_id:    batch.id,
        record_date: entities.date || today(),
        quantity_kg: entities.amount,
        feed_type:   'unknown', // default type since intent doesn't extract feed type yet
      })

      return L(`✓ Recorded ${entities.amount}kg of feed for ${batch.batch_name}.`,
                `✓ Nime-record ${entities.amount}kg za chakula kwa ${batch.batch_name}.`)
    }

    // ── POULTRY: Report health ────────────────────────────────────────────
    if (intent === 'report_poultry_health') {
      const batch = await findPoultryBatch(supabase, farmId, entities.target)
      if (!batch) {
        return L(`Tell me which poultry batch has the problem, e.g. "Batch C is coughing".`,
                  `Taja batch ya kuku wenye shida, e.g. "Batch C wanakohoa".`)
      }
      if (!entities.issue) {
        return L(`Describe the disease/symptoms for ${batch.batch_name} — what's wrong?`,
                  `Elezea ugonjwa/dalili kwa ${batch.batch_name} — wana shida gani?`)
      }

      await supabase.from('poultry_health_records').insert({
        farm_id:     farmId,
        batch_id:    batch.id,
        event_date:  entities.date || today(),
        event_type:  'illness',
        disease:     entities.disease ?? entities.issue,
        symptoms:    entities.issue,
      })

      return L(`✓ Recorded a health issue for ${batch.batch_name} ("${entities.issue}"). Call a vet if it gets worse.`,
                `✓ Nime-record ugonjwa kwa ${batch.batch_name} ("${entities.issue}"). Wasiliana na daktari ukiona hali inazidi.`)
    }

    // ── POULTRY: Record mortality ─────────────────────────────────────────
    if (intent === 'record_poultry_mortality') {
      const batch = await findPoultryBatch(supabase, farmId, entities.target)
      if (!batch) {
        return L(`Tell me the poultry batch, e.g. "3 birds died in Batch A".`, `Taja batch ya kuku, e.g. "Kuku 3 wamekufa Batch A".`)
      }
      if (!entities.amount) {
        return L(`How many birds died in ${batch.batch_name}?`, `Kuku wangapi wamekufa kwa ${batch.batch_name}?`)
      }

      await supabase.from('poultry_mortality').insert({
        farm_id:     farmId,
        batch_id:    batch.id,
        record_date: entities.date || today(),
        count_dead:  entities.amount,
        cause:       entities.issue ?? 'unknown',
      })

      return L(`✓ Recorded ${entities.amount} deaths for ${batch.batch_name}. Monitor closely to prevent further spread.`,
                `✓ Nime-record vifo ${entities.amount} kwa ${batch.batch_name}. Fuatilia kwa karibu kuzuia maambukizi zaidi.`)
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
        lines.push(L('🔔 *Urgent alerts:*', '🔔 *Arifa za haraka:*'))
        activeAlerts.forEach(a => {
          const priority = a.alert_priority === 'high' ? '🔴' : a.alert_priority === 'medium' ? '🟡' : '⚪'
          lines.push(`${priority} ${a.message}`)
        })
      }

      if (predictions?.length) {
        lines.push(L('\n🤖 *AI predictions:*', '\n🤖 *Utabiri wa AI:*'))
        predictions.forEach(p => {
          const conf = p.confidence_score ? ` (${Math.round(p.confidence_score * 100)}%)` : ''
          lines.push(`• ${p.prediction_text}${conf}`)
        })
      }

      if (!lines.length) {
        return L('✓ No alerts or AI warnings right now. Your farm looks good!', '✓ Hakuna arifa wala tahadhari za AI kwa sasa. Shamba lako liko sawa!')
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

      if (!summary) return L(`Couldn't find your farm's stats. Please try again.`, `Takwimu za shamba hazikupatikana. Jaribu tena.`)

      const lines = [
        L('📊 *Your farm summary:*', '📊 *Muhtasari wa shamba lako:*'),
        summary.total_coffee_plots    ? L(`☕ Coffee plots: ${summary.total_coffee_plots}`, `☕ Plots za kahawa: ${summary.total_coffee_plots}`) : null,
        summary.season_cherry_kg      ? L(`🍒 Season harvest: ${summary.season_cherry_kg.toLocaleString()} kg`, `🍒 Mavuno ya msimu: ${summary.season_cherry_kg.toLocaleString()} kg`) : null,
        summary.total_cows            ? L(`🐄 Cows: ${summary.total_cows} (${summary.total_active_cows || 0} producing)`, `🐄 Ng'ombe wote: ${summary.total_cows} (${summary.total_active_cows || 0} wanaozalisha)`) : null,
        summary.today_milk_litres     ? L(`🍼 Milk today: ${summary.today_milk_litres}L`, `🍼 Maziwa leo: ${summary.today_milk_litres}L`) : null,
        summary.total_small_ruminants ? L(`🐏 Goats/sheep: ${summary.total_small_ruminants}`, `🐏 Mbuzi/kondoo: ${summary.total_small_ruminants}`) : null,
      ].filter(Boolean)

      return lines.join('\n')
    }

    // ── Fallback ──────────────────────────────────────────────────────────
    return parsed.response || L(`Sorry, I'm not sure how to help with that. Send *menu* to see options.`,
                                  `Samahani, sijui jinsi ya kusaidia na hilo. Tuma *menu* kuona chaguo.`)

  } catch (error) {
    console.error('Execution error:', error)
    return L('There was a small system hiccup 😅 Please try again.', `Kuna shida kidogo kwa system 😅 Tafadhali jaribu tena.`)
  }
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────
function eudrLabel(risk: string, lang: Lang): string {
  const en: Record<string, string> = {
    low: '✅ Low Risk', medium: '🟡 Medium Risk', high: '🔴 High Risk',
    compliant: '✅ Compliant', non_compliant: '❌ Not Compliant',
  }
  const sw: Record<string, string> = {
    low: '✅ Hatari Ndogo', medium: '🟡 Hatari ya Kati', high: '🔴 Hatari Kubwa',
    compliant: '✅ Inafuata Sheria', non_compliant: '❌ Haifuati Sheria',
  }
  const table = lang === 'sw' ? sw : en
  return table[risk.toLowerCase()] ?? risk
}