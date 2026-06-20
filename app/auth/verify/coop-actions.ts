'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

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

  // Use service role client to write data that bypasses basic RLS.
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // 1. Call the secure RPC function to create cooperative and officer association
    const { data: cooperativeId, error: rpcError } = await supabaseAdmin.rpc(
      'create_cooperative_with_officer',
      {
        p_cooperative_name: params.cooperativeName,
        p_county: params.county,
        p_sub_county: params.subCounty || null,
        p_ward: params.ward || null,
        p_primary_enterprise: params.primaryEnterprise,
        p_user_id: params.userId,
      }
    )

    if (rpcError) {
      console.error('Error creating cooperative via RPC:', rpcError)
      return { success: false, error: rpcError.message }
    }

    if (!cooperativeId) {
      return { success: false, error: 'Cooperative created but no ID returned' }
    }

    // Update user's profile or metadata if needed
    // In this app, we can also update auth.users metadata if relevant
    await supabaseAdmin.auth.admin.updateUserById(params.userId, {
      user_metadata: {
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
      error: error.message || 'Unknown error',
    }
  }
}
