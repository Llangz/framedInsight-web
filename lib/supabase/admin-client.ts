import 'server-only'
import type { Database } from '../database.types'

/**
 * Service-role client for admin pages/actions under app/admin/**.
 *
 * Every caller MUST gate on requireAdminAccess()/validateAdminAccess() from
 * lib/validate-admin-access.ts BEFORE calling this — this client bypasses
 * RLS entirely (same as the service-role clients already used in
 * supabase/functions/fetch-plot-indices, app/api/cron/ews, and
 * lib/security.ts's auditLog()). It exists so cross-farm/cross-cooperative
 * admin reads don't require new "admins can see everything" RLS policies
 * bolted onto farms/cooperatives/alerts/transactions — which would have to
 * be re-reasoned about on every one of those tables and risks weakening
 * farmer- or cooperative-facing policies by mistake. Gating happens once,
 * in application code, instead.
 */
export async function createAdminServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY — admin pages cannot load data without it')
  }

  const { createClient } = await import('@supabase/supabase-js')
  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
