// 📁 FILE PATH: app/api/dairy/cows/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { sanitizeObject } from '@/lib/validation'

// NOTE: keys/enums below are cross-checked against lib/database.types.ts
// (cows.Row) and the actual payload app/dashboard/dairy/cows/[id]/edit/
// EditCowClient.tsx sends via the updateCow() server action. This route
// itself isn't currently called by that client (it updates Supabase
// directly through a server action instead), but is hardened here in case
// a future mobile client or integration calls it directly — the previous
// version passed the raw request body straight into .update(body), which
// is the same "no validation" shape as the farms bug that caused fields to
// silently misbehave. .strict() rejects unknown keys instead of silently
// dropping them, so a schema/payload drift like that surfaces immediately
// as a 400 instead of a quietly-ignored write.
const CowUpdateSchema = z.object({
  cow_tag: z.string().min(1, 'Tag/ID is required').max(50).optional(),
  name: z.string().max(100).nullable().optional(),
  breed: z.string().max(100).nullable().optional(),
  sex: z.enum(['female', 'male']).nullable().optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional(),
  purpose: z.enum(['dairy', 'beef', 'dual', 'breeding', 'calf', 'heifer']).nullable().optional(),
  status: z.enum(['active', 'dry', 'pregnant', 'sold', 'deceased', 'culled']).nullable().optional(),
  source: z.enum(['born on farm', 'purchased', 'donated', 'other']).nullable().optional(),
  purchase_price: z.number().nonnegative().nullable().optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  sire_id: z.string().uuid().nullable().optional(),
  dam_id: z.string().uuid().nullable().optional(),
  exit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  exit_reason: z.string().max(200).nullable().optional(),
  exit_value: z.number().nonnegative().nullable().optional(),
  qr_code: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict()

async function guardCow(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null }

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()
  if (!fm) return { error: 'No farm found', status: 404, supabase: null }

  const { data: cow } = await supabase.from('cows').select('farm_id').eq('id', id).single()
  if (!cow || cow.farm_id !== fm.farm_id) return { error: 'Forbidden', status: 403, supabase: null }

  return { error: null, status: 200, supabase }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const rawBody = await req.json()

    const validation = CowUpdateSchema.safeParse(rawBody)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.format() }, { status: 400 })
    }

    const guard = await guardCow(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const body = sanitizeObject(validation.data)

    const { data, error } = await guard.supabase!
      .from('cows')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ cow: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const guard = await guardCow(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const { error } = await guard.supabase!.from('cows').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}