// 📁 FILE PATH: app/api/poultry/sales/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PoultrySaleSchema } from '@/lib/security'
import { sanitizeObject } from '@/lib/validation'

// NOTE: PoultrySaleSchema now lives in lib/security.ts with corrected
// field names — it previously had `buyer_phone`, but the real column
// (confirmed against lib/database.types.ts and
// app/dashboard/poultry/sales/SalesClient.tsx's actual insert payload) is
// `buyer_contact`. It also now includes `market`, `unit`, and
// `total_price`, which are real columns this schema previously dropped
// silently on every update. See lib/security.ts for the full diff.

// ── Auth + Ownership Guard ─────────────────────────────────────────────────
async function guardRecord(id: string) {
  const supabase = await createClient()

  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', status: 401, supabase: null }
  }

  // 2. Get user's farm
  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!fm) {
    return { error: 'No farm found', status: 404, supabase: null }
  }

  // 3. Get the specific sales record and verify ownership
  const { data: record } = await supabase
    .from('poultry_sales')
    .select('farm_id')
    .eq('id', id)
    .single()

  if (!record || record.farm_id !== fm.farm_id) {
    return { error: 'Forbidden', status: 403, supabase: null }
  }

  return { error: null, status: 200, supabase }
}

// ── PUT /api/poultry/sales/[id] ────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const rawBody = await req.json()

    // 1. Check auth & ownership
    const guard = await guardRecord(id)
    if (guard.error || !guard.supabase) {
      return NextResponse.json({ error: guard.error || 'Authorization failed' }, { status: guard.status || 500 })
    }

    // 2. Safe parse input (allows partial updates); unknown keys rejected
    const validated = PoultrySaleSchema.partial().strict().safeParse(rawBody)

    if (!validated.success) {
      return NextResponse.json({
        error: 'Invalid input',
        details: validated.error.errors
      }, { status: 400 })
    }

    // 3. Prepare update data (Type-safe casting)
    const update: any = sanitizeObject({ ...validated.data })

    // Remove fields that shouldn't be updated directly
    delete update.batch_id // Usually immutable
    delete update.farm_id  // Set by backend, not client
    delete update.created_at
    delete update.id

    // Recompute total_price if both quantity and price_per_unit are provided
    if (update.quantity !== undefined && update.price_per_unit !== undefined) {
      const qty = typeof update.quantity === 'number' ? update.quantity : parseFloat(update.quantity)
      const price = typeof update.price_per_unit === 'number' ? update.price_per_unit : parseFloat(update.price_per_unit)

      if (!isNaN(qty) && !isNaN(price)) {
        update.total_price = qty * price
      }
    }

    // Handle null vs undefined for payment_method (DB expects string | undefined, not null)
    if (update.payment_method === null) {
      update.payment_method = undefined
    }

    // 4. Execute update
    const { data, error } = await guard.supabase
      .from('poultry_sales')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sale: data })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update sale' }, { status: 500 })
  }
}

// ── DELETE /api/poultry/sales/[id] ───────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // 1. Check auth & ownership
    const guard = await guardRecord(id)
    if (guard.error || !guard.supabase) {
      return NextResponse.json({ error: guard.error || 'Authorization failed' }, { status: guard.status || 500 })
    }

    // 2. Execute delete
    const { error } = await guard.supabase
      .from('poultry_sales')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete sale' }, { status: 500 })
  }
}