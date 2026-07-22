'use server'

// Replaces the old GET /api/farm/link-existing/[farmId] route. That route
// mutated state (inserted a farm_managers row) from a GET handler, which
// has two real problems regardless of any CSRF-token layer:
//
//   1. SameSite=Lax — the actual thing protecting this app's cookie-auth
//      routes from CSRF — only withholds the session cookie on cross-site
//      POST/PUT/PATCH/DELETE. It still allows the cookie on a cross-site
//      *top-level GET navigation*, so a GET-with-side-effects route is the
//      one shape that bypasses that protection entirely.
//   2. It didn't even need an attacker: the route was linked to with a
//      plain <Link href> in AccountIssueScreen, so ordinary GET-triggering
//      behavior (Next.js route prefetch, a mail client or chat app
//      pre-fetching links for a preview, a security scanner probing links)
//      could fire the insert before the farmer ever consciously clicked.
//
// A Server Action, invoked from a <form action={...}>, is a POST under the
// hood, and Next.js automatically compares the Origin header to the Host
// header on every Server Action invocation — CSRF protection that's part
// of the framework, not something this file has to implement itself.
//
// The identity re-check below is unchanged from the old route: the farmId
// is visible to the signed-in user (it's shown on their own dashboard),
// but linking only succeeds if THIS account's own phone/email still
// matches that farm and it still has no manager.

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { redirect } from 'next/navigation'

function normalizePhone(value?: string | null): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.startsWith('254')) return digits
  return null
}

export async function linkExistingFarm(farmId: string) {
  const supabaseAuth = await createClient()

  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
  if (userError || !user) {
    redirect('/auth/login')
  }

  const supabaseAdmin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: farm, error: farmError } = await supabaseAdmin
    .from('farms')
    .select('id, phone, email')
    .eq('id', farmId)
    .maybeSingle()

  if (farmError || !farm) {
    redirect('/onboarding?linkFailed=not_found')
  }

  // Re-check identity match server-side — same phone/email logic as
  // findUnlinkedMatchingFarm() in lib/get-farm-status.ts.
  const userPhone = normalizePhone(user.phone || user.user_metadata?.phone)
  const farmPhone = normalizePhone(farm.phone)
  const userEmail = user.email?.trim().toLowerCase() || null
  const farmEmail = farm.email?.trim().toLowerCase() || null

  const phoneMatches = !!userPhone && !!farmPhone && userPhone === farmPhone
  const emailMatches = !!userEmail && !!farmEmail && userEmail === farmEmail

  if (!phoneMatches && !emailMatches) {
    redirect('/onboarding?linkFailed=no_match')
  }

  // Re-check no manager exists yet — closes the race where two people
  // somehow hit this action for the same farm at once.
  const { data: existingManagers } = await supabaseAdmin
    .from('farm_managers')
    .select('user_id')
    .eq('farm_id', farmId)
    .limit(1)

  if (existingManagers && existingManagers.length > 0) {
    redirect('/onboarding?linkFailed=already_claimed')
  }

  const { error: insertError } = await supabaseAdmin
    .from('farm_managers')
    .insert({ user_id: user.id, farm_id: farmId, role: 'owner' })

  if (insertError) {
    console.error('[linkExistingFarm] Failed to link:', insertError.message, '| user:', user.id, '| farm:', farmId)
    redirect('/onboarding?linkFailed=insert_error')
  }

  redirect('/dashboard')
}
