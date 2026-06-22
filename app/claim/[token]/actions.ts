'use server'

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { revalidatePath } from 'next/cache'

function adminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface ClaimDetails {
  found: boolean
  alreadyClaimed?: boolean
  farmName?: string
  ownerFirstName?: string
  cooperativeName?: string
  hasPhoneOnFile?: boolean
  phone?: string | null // raw — used only to drive OTP send/verify, never rendered
  maskedPhone?: string | null // safe to render
  error?: string
}

// Public-facing lookup — runs with the service role since an unauthenticated
// visitor following a claim link has no session yet, but only ever returns
// the minimum needed to render a friendly "is this you?" screen. Never
// returns the full phone number, farm id, or cooperative id.
export async function getClaimDetails(token: string): Promise<ClaimDetails> {
  const admin = adminClient()
  if (!admin) return { found: false, error: 'Server misconfiguration.' }

  const cleanToken = token.trim().toUpperCase()

  const { data: farm, error } = await admin
    .from('farms')
    .select(`
      id, farm_name, owner_name, phone, claim_token,
      cooperatives ( cooperative_name )
    `)
    .eq('claim_token', cleanToken)
    .maybeSingle()

  if (error) {
    console.error('Error fetching claim details:', error)
    return { found: false, error: 'Something went wrong looking up this claim code. Please try again.' }
  }

  if (!farm) {
    return {
      found: false,
      error: 'We couldn\u2019t find a farm with that claim code. Double-check it with your cooperative\u2019s field officer.',
    }
  }

  const { data: managerRows } = await admin
    .from('farm_managers')
    .select('user_id')
    .eq('farm_id', farm.id)
    .limit(1)

  const cooperative = farm.cooperatives as unknown as { cooperative_name: string } | null

  return {
    found: true,
    alreadyClaimed: !!(managerRows && managerRows.length > 0),
    farmName: farm.farm_name,
    ownerFirstName: farm.owner_name?.split(' ')[0],
    cooperativeName: cooperative?.cooperative_name,
    hasPhoneOnFile: !!farm.phone,
    phone: farm.phone,
    maskedPhone: farm.phone ? farm.phone.replace(/(\d{6})(\d{4})$/, '$1***') : null,
  }
}

interface ClaimFarmParams {
  token: string
  userId: string
  phone: string
}

export interface ClaimFarmResult {
  success: boolean
  farmId?: string
  error?: string
}

export async function claimFarmAction(params: ClaimFarmParams): Promise<ClaimFarmResult> {
  const admin = adminClient()
  if (!admin) return { success: false, error: 'Server misconfiguration.' }

  const { data: farmId, error: rpcError } = await admin.rpc('claim_cooperative_farm', {
    p_claim_token: params.token.trim().toUpperCase(),
    p_user_id: params.userId,
    p_phone: params.phone,
  })

  if (rpcError) {
    console.error('Error claiming farm via RPC:', rpcError)

    switch (rpcError.code) {
      case 'P0002':
        return { success: false, error: 'This claim code was not found. Double-check it with your cooperative.' }
      case 'P0003':
        return { success: false, error: 'This farm has already been claimed. Try logging in instead.' }
      case 'P0004':
        return {
          success: false,
          error: 'That phone number doesn\u2019t match the one your cooperative has on file for this farm. Contact your cooperative if you believe this is an error.',
        }
      default:
        return { success: false, error: 'Something went wrong claiming your farm. Please try again or contact support.' }
    }
  }

  if (!farmId) {
    return { success: false, error: 'Farm claimed but no ID returned' }
  }

  revalidatePath('/dashboard')
  return { success: true, farmId }
}