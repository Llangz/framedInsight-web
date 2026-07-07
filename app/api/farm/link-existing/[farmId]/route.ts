// 📁 FILE PATH: app/api/farm/link-existing/[farmId]/route.ts
//
// Confirms the "is this your farm?" prompt from the unlinked_match state
// in lib/get-farm-status.ts. Deliberately re-runs the SAME identity check
// server-side rather than trusting the farmId in the URL — the farmId is
// visible to the signed-in user (it's in the link they clicked), but
// clicking it only succeeds if THIS account's own phone/email still
// matches that farm and it still has no manager. This closes the obvious
// IDOR shape ("what if I just change the UUID in the address bar") without
// needing the farmId itself to be a secret.

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { NextRequest, NextResponse } from 'next/server'

function normalizePhone(value?: string | null): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.startsWith('254')) return digits
  return null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ farmId: string }> }
) {
  const { farmId } = await params
  const supabaseAuth = await createClient()

  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
  if (userError || !user) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
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
    return NextResponse.redirect(new URL('/onboarding?linkFailed=not_found', req.url))
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
    return NextResponse.redirect(new URL('/onboarding?linkFailed=no_match', req.url))
  }

  // Re-check no manager exists yet — closes the race where two people
  // somehow hit this link for the same farm at once.
  const { data: existingManagers } = await supabaseAdmin
    .from('farm_managers')
    .select('user_id')
    .eq('farm_id', farmId)
    .limit(1)

  if (existingManagers && existingManagers.length > 0) {
    return NextResponse.redirect(new URL('/onboarding?linkFailed=already_claimed', req.url))
  }

  const { error: insertError } = await supabaseAdmin
    .from('farm_managers')
    .insert({ user_id: user.id, farm_id: farmId, role: 'owner' })

  if (insertError) {
    console.error('[link-existing-farm] Failed to link:', insertError.message, '| user:', user.id, '| farm:', farmId)
    return NextResponse.redirect(new URL('/onboarding?linkFailed=insert_error', req.url))
  }

  return NextResponse.redirect(new URL('/dashboard', req.url))
}