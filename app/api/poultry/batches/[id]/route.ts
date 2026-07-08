// 📁 FILE PATH: app/api/poultry/batches/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { sanitizeObject } from '@/lib/validation'

// ── Auth + ownership guard ─────────────────────────────────────────────────

async function guardBatch(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null }

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()
  if (!fm) return { error: 'No farm found', status: 404, supabase: null }

  const { data: batch } = await (supabase as any)
    .from('poultry_batches')
    .select('farm_id')
    .eq('id', id)
    .single()

  if (!batch || batch.farm_id !== fm.farm_id)
    return { error: 'Forbidden', status: 403, supabase: null }

  return { error: null, status: 200, supabase }
}

// ⚠️ SCHEMA VERIFICATION NEEDED before relying on this route for `breed`,
// `house_number`, `purchase_price_per_bird`, `housing_system`,
// `expected_laying_date`, or `target_weight_kg`.
//
// lib/database.types.ts (generated from the live schema) only lists these
// columns on poultry_batches: batch_name, bird_type, current_count,
// date_of_placement, farm_id, id, notes, purpose, source, status,
// created_at, updated_at. That's confirmed accurate for every other
// poultry table (feed/health/mortality/sales all cross-checked clean
// against their *Client.tsx insert payloads).
//
// For poultry_batches, NONE of the six extra fields below are confirmed:
// - `breed` and `house_number` are collected in both AddBatchClient.tsx's
//   and EditBatchClient.tsx's forms, and appear in PoultryBatchSchema in
//   lib/security.ts, but AddBatchClient.tsx's actual .insert() call drops
//   both of them before writing — so even the "add" flow doesn't persist
//   them today. That's either a stale database.types.ts (columns exist,
//   add-flow just forgot to include them) or the columns were never
//   created (schema and forms were written ahead of the migration).
// - `purchase_price_per_bird`, `housing_system`, `expected_laying_date`,
//   `target_weight_kg` appear ONLY in EditBatchClient.tsx's form, with no
//   corroboration anywhere else in the codebase.
//
// They're included here so this route doesn't reject data if the columns
// do turn out to exist, but please confirm in the Supabase SQL editor:
//   SELECT column_name FROM information_schema.columns
//   WHERE table_name = 'poultry_batches';
// Any of the six that aren't real columns should be removed from this
// schema, from EditBatchClient.tsx's update payload, and — if you want
// farmers to actually be able to record breed/house number — added as a
// migration plus wired into AddBatchClient.tsx's insert.
const updateBatchSchema = z.object({
  batch_name: z.string().min(1).max(100).optional(),
  bird_type: z.enum(['layer', 'broiler', 'kienyeji', 'dual_purpose']).optional(),
  breed: z.string().max(100).nullable().optional(),
  current_count: z.number().int().min(0).optional(),
  date_of_placement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  house_number: z.string().max(50).nullable().optional(),
  housing_system: z.string().max(100).nullable().optional(),
  expected_laying_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  purchase_price_per_bird: z.number().nonnegative().nullable().optional(),
  target_weight_kg: z.number().positive().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  purpose: z.string().max(100).nullable().optional(),
  source: z.enum(['born on farm', 'purchased', 'donated', 'other']).nullable().optional(),
  status: z.enum(['active', 'sold', 'culled', 'closed']).optional(),
}).strict()

// PUT /api/poultry/batches/[id] — update batch (status, current_count, notes, etc.)
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const rawBody = await req.json()

    const validation = updateBatchSchema.safeParse(rawBody)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid update payload', details: validation.error.format() }, { status: 400 })
    }

    const guard = await guardBatch(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const body = sanitizeObject(validation.data)

    const { data, error } = await (guard.supabase as any)
      .from('poultry_batches')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ batch: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}

// DELETE /api/poultry/batches/[id] — hard-delete a batch
// Note: cascades to all child records (eggs, feed, health, mortality, sales)
// Only allow on non-active batches to prevent accidental data loss.
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const guard = await guardBatch(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    // Safety check: refuse to hard-delete active batches — use PUT status=closed instead
    const { data: batch } = await (guard.supabase as any)
      .from('poultry_batches')
      .select('status')
      .eq('id', id)
      .single()

    if (batch?.status === 'active') {
      return NextResponse.json(
        { error: 'Cannot delete an active batch. Close it first (status: sold/culled/closed).' },
        { status: 409 }
      )
    }

    const { error } = await (guard.supabase as any)
      .from('poultry_batches')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}