'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { Database } from '@/lib/database.types'

interface VerifyCooperativeParams {
  userId: string
  phone: string
  email?: string
  cooperativeName: string
  county: string
  subCounty?: string
  ward?: string
  primaryEnterprise: string
}

export interface CooperativeCreationResult {
  success: boolean
  cooperativeId?: string
  error?: string
}

export async function createCooperativeOnVerifyAction(
  params: VerifyCooperativeParams
): Promise<CooperativeCreationResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase environment variables for admin client')
    return { success: false, error: 'Server misconfiguration.' }
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const { data: cooperativeId, error: rpcError } = await supabaseAdmin.rpc(
      'create_cooperative_with_officer',
      {
        p_cooperative_name: params.cooperativeName,
        p_county: params.county,
        p_sub_county: params.subCounty || null,
        p_ward: params.ward || null,
        p_primary_enterprise: params.primaryEnterprise,
        p_user_id: params.userId,
        p_email: params.email || null,
      }
    )

    if (rpcError) {
      console.error('Error creating cooperative via RPC:', rpcError)

      if (rpcError.code === '23505') {
        return {
          success: false,
          error: 'This phone number is already linked to a cooperative account. Try logging in instead, or contact support if you believe this is an error.'
        }
      }

      return {
        success: false,
        error: 'Something went wrong setting up your cooperative. Please try again or contact support.'
      }
    }

    if (!cooperativeId) {
      return { success: false, error: 'Cooperative created but no ID returned' }
    }

    // updateUserById REPLACES user_metadata wholesale rather than merging it —
    // fetch the existing metadata first so we don't wipe out phone_number
    // (set by verify-otp), which would otherwise break future OTP-login
    // matching for this user.
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(params.userId)
    await supabaseAdmin.auth.admin.updateUserById(params.userId, {
      user_metadata: {
        ...(existingUser?.user?.user_metadata || {}),
        role: 'cooperative_officer',
        cooperative_id: cooperativeId,
      },
    })

    revalidatePath('/dashboard')
    return { success: true, cooperativeId: cooperativeId }
  } catch (error: any) {
    console.error('Unexpected error creating cooperative:', error)
    return {
      success: false,
      error: 'Something went wrong setting up your cooperative. Please try again or contact support.',
    }
  }
}