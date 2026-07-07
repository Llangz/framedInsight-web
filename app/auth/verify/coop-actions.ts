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
  registrationNumber?: string   // CS/022/0142/2019
  countyCode?: string           // '022'
  registeredOffice?: string
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
        p_cooperative_name:    params.cooperativeName,
        p_county:              params.county,
        p_sub_county:          params.subCounty || null,
        p_ward:                params.ward || null,
        p_primary_enterprise:  params.primaryEnterprise,
        p_user_id:             params.userId,
        p_email:               params.email || null,
        p_registration_number: params.registrationNumber?.trim().toUpperCase() || null,
        p_county_code:         params.countyCode || null,
        p_registered_office:   params.registeredOffice || null,
      }
    )

    if (rpcError) {
      console.error('Error creating cooperative via RPC:', rpcError)

      // New — see supabase/migrations/20260706_prevent_cross_entity_account_linking.sql.
      // This account already manages an existing farm; one account can't
      // currently be both a farm owner and a cooperative officer.
      if (rpcError.code === 'P0011') {
        return {
          success: false,
          error: 'This account is already linked to an existing farm. A single account can\'t currently be both an individual farm owner and a cooperative officer — contact support if you need this changed.',
        }
      }

      if (rpcError.code === '23505') {
        // Check if it's the registration number unique constraint
        if (rpcError.message?.includes('registration_number')) {
          return {
            success: false,
            error: 'A cooperative with this registration number is already registered on framedInsight.',
          }
        }
        // NOTE: create_cooperative_with_officer has no phone parameter and
        // neither `cooperatives` nor `cooperative_officers` has a phone
        // column, so a 23505 here can only be the registration_number
        // constraint above — this fallback is defensive, not a real
        // "phone already in use" case (that message was previously here
        // but described a collision this function cannot actually produce).
        return {
          success: false,
          error: 'Something went wrong setting up your cooperative. Please try again or contact support.',
        }
      }

      if (rpcError.code === '23514') {
        return {
          success: false,
          error: 'Invalid registration number format. Expected CS/[CountyCode]/[Number]/[Year] e.g. CS/022/0142/2019',
        }
      }

      return {
        success: false,
        error: 'Something went wrong setting up your cooperative. Please try again or contact support.',
      }
    }

    if (!cooperativeId) {
      return { success: false, error: 'Cooperative created but no ID returned' }
    }

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