// lib/ai/intent-processor.ts

import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModel } from '@/lib/ai/config'
import { createClient } from '@supabase/supabase-js'

// ✅ Lazy Supabase client (server-safe)
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// -----------------------------
// ✅ Intent Schema
// -----------------------------
const intentSchema = z.object({
  intent: z.enum([
    'record_milk',
    'record_coffee_harvest',
    'report_livestock_health',
    'query_farm_stats',
    'general_query',
    'unknown'
  ]),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    amount: z.number().optional(),
    unit: z.string().optional(),
    target: z.string().optional(),
    date: z.string().optional(),
    session: z.enum(['morning', 'evening', 'afternoon']).optional(),
    issue: z.string().optional(),
  }),
  response: z.string()
})

// -----------------------------
// ✅ Intent Parsing (AI)
// -----------------------------
export async function processFarmerIntent(message: string, farmId: string) {
  const supabase = getSupabaseClient()

  try {
    // 🔹 Fetch context
    const [{ data: cows }, { data: plots }, { data: goats }] =
      await Promise.all([
        supabase
          .from('cows')
          .select('cow_tag, name')
          .eq('farm_id', farmId)
          .eq('status', 'active'),

        supabase
          .from('coffee_plots')
          .select('plot_name')
          .eq('farm_id', farmId),

        supabase
          .from('small_ruminants')
          .select('animal_tag, name')
          .eq('farm_id', farmId)
      ])

    const contextStr = `
Cows: ${cows?.map(c => `${c.cow_tag} (${c.name || ''})`).join(', ') || 'None'}
Coffee Plots: ${plots?.map(p => p.plot_name).join(', ') || 'None'}
Small Ruminants: ${goats?.map(g => `${g.animal_tag} (${g.name || ''})`).join(', ') || 'None'}
`

    const model = getLanguageModel('openai')

    const { object } = await generateObject({
      model,
      schema: intentSchema,
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant for Kenyan farmers using framedInsight.

Parse WhatsApp messages into structured actions.

Context:
${contextStr}

Rules:
- "50kg from Hillside" → record_coffee_harvest
- "Cow 01 gave 12L" → record_milk
- "Goat 4 is limping" → report_livestock_health
- Keep responses short, friendly, Kenyan tone (Sheng allowed)
`
        },
        { role: 'user', content: message }
      ]
    })

    return object

  } catch (error) {
    console.error('Intent processing error:', error)

    return {
      intent: 'unknown' as const,
      confidence: 0,
      entities: {},
      response: "Pole, sijaelewa vizuri. Tafadhali rudia."
    }
  }
}

// -----------------------------
// ✅ Helpers (Matching Engine)
// -----------------------------

async function findPlot(supabase: any, farmId: string, target?: string) {
  if (!target) return null

  const { data } = await supabase
    .from('coffee_plots')
    .select('id, plot_name')
    .eq('farm_id', farmId)
    .ilike('plot_name', `%${target}%`)
    .limit(1)
    .maybeSingle()

  return data
}

async function findCow(supabase: any, farmId: string, target?: string) {
  if (!target) return null

  const { data } = await supabase
    .from('cows')
    .select('id, cow_tag, name')
    .eq('farm_id', farmId)
    .or(`cow_tag.ilike.%${target}%,name.ilike.%${target}%`)
    .limit(1)
    .maybeSingle()

  return data
}

// -----------------------------
// ✅ Execution Engine
// -----------------------------
export async function executeIntent(
  farmId: string,
  parsed: z.infer<typeof intentSchema>
) {
  const supabase = getSupabaseClient()

  const { intent, entities } = parsed

  try {
    // ---------------------------------
    // 🟢 Coffee Harvest
    // ---------------------------------
    if (intent === 'record_coffee_harvest') {
      const plot = await findPlot(supabase, farmId, entities.target)

      if (!plot) {
        return `Sijaona plot "${entities.target}". Tafadhali angalia jina.`
      }

      if (!entities.amount) {
        return `Umesema harvest, lakini kiasi hakiko wazi. Ilikuwa kilo ngapi?`
      }

      await supabase.from('coffee_harvests').insert({
        farm_id: farmId,
        plot_name: plot.plot_name,
        harvest_date: new Date().toISOString().split('T')[0],
        cherry_kg: entities.amount,
        produce_kg: entities.amount,
        quality_grade: 'AB'
      })

      return `Nime-record ${entities.amount}kg kwa plot ya ${plot.plot_name}. Kazi safi!`
    }

    // ---------------------------------
    // 🟢 Milk Recording
    // ---------------------------------
    if (intent === 'record_milk') {
      const cow = await findCow(supabase, farmId, entities.target)

      if (!cow) {
        return `Sijaona ng'ombe "${entities.target}". Tafadhali angalia tag au jina.`
      }

      if (!entities.amount) {
        return `Umesema maziwa lakini kiasi haiko wazi. Ilikuwa lita ngapi?`
      }

      const isMorning =
        entities.session === 'morning' || !entities.session

      await supabase.from('milk_records').insert({
        cow_id: cow.id,
        record_date: new Date().toISOString().split('T')[0],
        morning_milk: isMorning ? entities.amount : 0,
        evening_milk: !isMorning ? entities.amount : 0,
        total_milk: entities.amount
      })

      return `Sawa! Nime-record ${entities.amount}L za ${
        isMorning ? 'asubuhi' : 'jioni'
      } kwa ${cow.cow_tag}.`
    }

    // ---------------------------------
    // 🟡 Livestock Health
    // ---------------------------------
    if (intent === 'report_livestock_health') {
      const cow = await findCow(supabase, farmId, entities.target)

      if (cow && entities.issue) {
        await supabase.from('health_records').insert({
          cow_id: cow.id,
          symptoms: entities.issue,
          treatment_date: new Date().toISOString().split('T')[0]
        })

        return `Nime-record issue ya "${entities.issue}" kwa ${cow.cow_tag}. Tafadhali fuatilia afya yake.`
      }

      return `Sawa, nimepata taarifa ya afya. Unaweza elezea vizuri kidogo?`
    }

    // ---------------------------------
    // 🔵 Query (basic)
    // ---------------------------------
    if (intent === 'query_farm_stats') {
      return `Naweza kusaidia na stats. Ulitaka kujua nini haswa? (milk, harvest, etc)`
    }

    // ---------------------------------
    // ⚪ Fallback
    // ---------------------------------
    return parsed.response

  } catch (error) {
    console.error('Execution error:', error)
    return `Kuna shida kidogo kwa system 😅 Jaribu tena tafadhali.`
  }
}