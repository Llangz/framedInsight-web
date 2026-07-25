// lib/ai/intent-logging.ts
//
// Phase 0 data collection for a future small language model: log every
// WhatsApp intent-parse so we build a real, farmer-language labeled dataset
// before ever training anything. See lib/ai/intent-processor.ts for the
// classifier this instruments.
//
// Deliberately kept out of intent-processor.ts: logging must never be able
// to break or slow down the farmer-facing reply. Every function here is
// wrapped so a failure here only logs a console.error and moves on.

import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export type IntentOutcome =
  | 'recorded'             // executeIntent wrote a row and confirmed it
  | 'needs_clarification'  // classifier got the intent but a required entity was missing
  | 'not_found'            // target (cow/plot/animal/batch) didn't match anything on the farm
  | 'informational'        // a query intent (EUDR status, AI warnings, farm stats) — no write expected
  | 'error'                // executeIntent's catch block fired
  | 'unknown'              // couldn't classify from the reply text — needs manual review

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const QUERY_INTENTS = new Set(['query_eudr_status', 'query_ai_warnings', 'query_farm_stats'])

/**
 * Lightweight, cheap re-fetch of the same farm context processFarmerIntent()
 * builds internally (cow tags/names, plot names, ruminant tags, poultry
 * batch names) — indexed farm_id lookups only, no joins. Kept as a separate
 * query rather than threading the context out of processFarmerIntent() so
 * the hot classification path's return type doesn't change for a logging
 * feature.
 */
export async function getFarmContextSnapshot(farmId: string) {
  const supabase = getSupabaseClient()

  const [{ data: cows }, { data: plots }, { data: ruminants }, { data: poultry }] = await Promise.all([
    supabase.from('cows').select('cow_tag, name').eq('farm_id', farmId).eq('status', 'active'),
    supabase.from('coffee_plots').select('plot_name').eq('farm_id', farmId),
    supabase.from('small_ruminants').select('animal_tag, name, species').eq('farm_id', farmId).eq('status', 'active'),
    supabase.from('poultry_batches').select('batch_name, bird_type').eq('farm_id', farmId).eq('status', 'active'),
  ])

  return { cows: cows ?? [], plots: plots ?? [], ruminants: ruminants ?? [], poultry: poultry ?? [] }
}

/**
 * Heuristic outcome classification from the reply executeIntent() actually
 * sent back. This is a proxy, not ground truth — it exists so logged rows
 * can be filtered/sampled sensibly before the human review pass (see
 * `reviewed` column) that produces real training labels.
 *
 * Convention this leans on (see lib/ai/intent-processor.ts executeIntent):
 * every successful DB write's reply starts with "✓". Clarifying questions
 * end in "?". "Sijaona" / "Bado huna" mark a target that wasn't found.
 */
export function classifyOutcome(intent: string, reply: string): IntentOutcome {
  if (intent === 'unknown') return 'unknown'
  if (!reply) return 'unknown'

  if (reply.startsWith('✓')) return 'recorded'
  if (reply.includes('Sijaona') || reply.includes('Bado huna')) return 'not_found'
  if (reply.trim().endsWith('?')) return 'needs_clarification'
  if (QUERY_INTENTS.has(intent)) return 'informational'
  if (reply.includes('shida kidogo kwa system')) return 'error'

  return 'unknown'
}

interface LogIntentInteractionArgs {
  farmId: string
  rawMessage: string
  language?: string
  farmContext: Awaited<ReturnType<typeof getFarmContextSnapshot>>
  modelProvider: string
  modelName: string
  parsedIntent: string
  parsedEntities: Record<string, unknown>
  confidence: number
  replyText: string
  latencyMs: number
}

/**
 * Fire-and-forget style: callers should not await-block the farmer's reply
 * on this. Never throws — a logging failure is a console.error, nothing more.
 */
export async function logIntentInteraction(args: LogIntentInteractionArgs) {
  try {
    const supabase = getSupabaseClient()
    const outcome = classifyOutcome(args.parsedIntent, args.replyText)

    const { error } = await supabase.from('ai_intent_logs').insert({
      farm_id:         args.farmId,
      raw_message:     args.rawMessage,
      language:        args.language ?? null,
      reply_text:      args.replyText,
      farm_context:    args.farmContext,
      model_provider:  args.modelProvider,
      model_name:      args.modelName,
      parsed_intent:   args.parsedIntent,
      parsed_entities: args.parsedEntities,
      confidence:      args.confidence,
      outcome,
      latency_ms:      args.latencyMs,
    })

    if (error) logger.error('ai_intent_logs insert failed', error)
  } catch (err) {
    logger.error('logIntentInteraction failed', err as Error)
  }
}
