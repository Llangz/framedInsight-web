import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

// ---------------------------------------------
// ✅ Factory (core fix — you were right)
// ---------------------------------------------
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  if (typeof window !== 'undefined') {
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)
}

// ---------------------------------------------
// ✅ OPTIONAL (advanced usage)
// ---------------------------------------------
export const createServerClient = () => createClient()

export const createBrowserSupabase = () => createClient()

// Export a default singleton instance for backwards compatibility with existing imports
export const supabase = createClient()

// ---------------------------------------------
// ✅ Helper Functions (HYBRID)
// ---------------------------------------------

// Option A: Pass client (BEST)
export async function getFarmByPhoneWithClient(
  supabase: ReturnType<typeof createClient>,
  phone: string
) {
  const { data, error } = await supabase
    .from('farms')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()

  if (error) throw error
  return data
}

// Option B: Simple usage (YOUR STYLE)
export async function getFarmByPhone(phone: string) {
  const supabase = createClient()
  return getFarmByPhoneWithClient(supabase, phone)
}

// ---------------------------------------------

export async function getFarmSummaryWithClient(
  supabase: ReturnType<typeof createClient>,
  farmId: string
) {
  const { data, error } = await supabase
    .from('v_farm_summary')
    .select('*')
    .eq('id', farmId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getFarmSummary(farmId: string) {
  const supabase = createClient()
  return getFarmSummaryWithClient(supabase, farmId)
}

// ---------------------------------------------

export async function getDailyProductionWithClient(
  supabase: ReturnType<typeof createClient>,
  farmId: string
) {
  const { data, error } = await supabase
    .from('v_daily_production')
    .select('*')
    .eq('farm_id', farmId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getDailyProduction(farmId: string) {
  const supabase = createClient()
  return getDailyProductionWithClient(supabase, farmId)
}

// ---------------------------------------------

export async function getActiveAlertsWithClient(
  supabase: ReturnType<typeof createClient>,
  farmId: string
) {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('farm_id', farmId)
    .eq('status', 'pending')
    .order('alert_priority', { ascending: false })

  if (error) throw error
  return data
}

export async function getActiveAlerts(farmId: string) {
  const supabase = createClient()
  return getActiveAlertsWithClient(supabase, farmId)
}