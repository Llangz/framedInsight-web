// 📁 FILE PATH: app/api/poultry/health/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { sanitizeObject } from '@/lib/validation'

// NOTE: PoultryHealthSchema in lib/security.ts has vaccine_name, drug_name,
// and cost fields that do NOT exist on poultry_health_records (confirmed
// against lib/database.types.ts). app/dashboard/poultry/health/
// HealthClient.tsx actually collects those in its form but never persists
// them either — they're currently silently discarded on the frontend side
// (worth a separate look: either add the columns or drop the inputs).
// This schema matches what's actually in the DB today: batch_id,
// record_date, event_type, next_due_date, notes.
const PoultryHealthUpdateSchema = z.object({
  batch_id: z.string().uuid(),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  event_type: z.string().min(1).max(100),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict()

async function guardRecord(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null }

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()
  if (!fm) return { error: 'No farm found', status: 404, supabase: null }

  const { data: record } = await (supabase as any)
    .from('poultry_health_records')
    .select('farm_id')
    .eq('id', id)
    .single()

  if (!record || record.farm_id !== fm.farm_id)
    return { error: 'Forbidden', status: 403, supabase: null }

  return { error: null, status: 200, supabase }
}

// PUT /api/poultry/health/[id]
// Typical use: correct event_type, next_due_date, or notes on a record.
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const rawBody = await req.json()

    const guard = await guardRecord(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const validated = PoultryHealthUpdateSchema.partial().strict().safeParse(rawBody)
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid input', details: validated.error.errors }, { status: 400 })
    }

    const body = sanitizeObject(validated.data)

    const { data, error } = await (guard.supabase as any)
      .from('poultry_health_records')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ record: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}

// DELETE /api/poultry/health/[id]
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const guard = await guardRecord(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const { error } = await (guard.supabase as any)
      .from('poultry_health_records')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}