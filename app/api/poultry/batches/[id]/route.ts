// 📁 FILE PATH: app/api/poultry/batches/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateCsrfRequest, getSessionId } from '@/lib/csrf'

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

import { z } from 'zod'

const updateBatchSchema = z.object({
  batch_name: z.string().min(1).optional(),
  bird_type: z.string().optional(),
  current_count: z.number().int().min(0).optional(),
  date_of_placement: z.string().optional(),
  notes: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  status: z.enum(['active', 'sold', 'culled', 'closed']).optional(),
}).strict()

// PUT /api/poultry/batches/[id] — update batch (status, current_count, notes, etc.)
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // ── CSRF Validation ──────────────────────────────────────────────────────
  const sessionId = getSessionId(req);
  const csrfError = validateCsrfRequest(req, sessionId);
  if (csrfError) return csrfError;

  try {
    const { id } = await context.params
    const body = await req.json()

    // Validate and whitelist fields using Zod
    const validation = updateBatchSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid update payload', details: validation.error.format() }, { status: 400 })
    }

    const guard = await guardBatch(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const { data, error } = await (guard.supabase as any)
      .from('poultry_batches')
      .update(validation.data)
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
  // ── CSRF Validation ──────────────────────────────────────────────────────
  const sessionId = getSessionId(req);
  const csrfError = validateCsrfRequest(req, sessionId);
  if (csrfError) return csrfError;

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