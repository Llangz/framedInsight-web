// 📁 FILE PATH: app/api/small-ruminants/animals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { sanitizeObject } from '@/lib/validation'

// NOTE: keys/enums cross-checked against lib/database.types.ts
// (small_ruminants.Row) and app/dashboard/smallRuminants/animal/[id]/edit/
// EditAnimalClient.tsx. Same rationale as the dairy cows route: this
// endpoint isn't currently called by the UI (edits go through the
// updateAnimal() server action instead), but the previous version passed
// the raw body straight into .update(body) with zero validation, so it's
// hardened here for any future direct caller. .strict() surfaces
// unexpected keys as a 400 instead of silently dropping them.
const AnimalUpdateSchema = z.object({
  animal_tag: z.string().min(1, 'Animal tag is required').max(50).optional(),
  species: z.enum(['goat', 'sheep']).optional(),
  name: z.string().max(100).nullable().optional(),
  breed: z.string().max(100).nullable().optional(),
  sex: z.enum(['female', 'male']).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  birth_weight: z.number().positive().nullable().optional(),
  upgrade_level: z.string().max(50).nullable().optional(),
  purpose: z.enum(['meat', 'dairy', 'breeding', 'dual']).nullable().optional(),
  status: z.enum(['active', 'sold', 'deceased', 'culled']).nullable().optional(),
  exit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  exit_reason: z.string().max(200).nullable().optional(),
  exit_value: z.number().nonnegative().nullable().optional(),
  source: z.enum(['born on farm', 'purchased', 'donated', 'other']).nullable().optional(),
  purchase_price: z.number().nonnegative().nullable().optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  breeding_type: z.enum(['natural', 'AI', 'unknown']).nullable().optional(),
  sire_id: z.string().uuid().nullable().optional(),
  dam_id: z.string().uuid().nullable().optional(),
  ear_notch_pattern: z.string().max(100).nullable().optional(),
  coat_color: z.string().max(100).nullable().optional(),
  distinguishing_marks: z.string().max(500).nullable().optional(),
  qr_code: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict()

async function guardAnimal(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null }

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()
  if (!fm) return { error: 'No farm found', status: 404, supabase: null }

  const { data: animal } = await supabase.from('small_ruminants').select('farm_id').eq('id', id).single()
  if (!animal || animal.farm_id !== fm.farm_id) return { error: 'Forbidden', status: 403, supabase: null }

  return { error: null, status: 200, supabase }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const rawBody = await req.json()

    const validation = AnimalUpdateSchema.safeParse(rawBody)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.format() }, { status: 400 })
    }

    const guard = await guardAnimal(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const body = sanitizeObject(validation.data)

    const { data, error } = await guard.supabase!
      .from('small_ruminants')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ animal: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const guard = await guardAnimal(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const { error } = await guard.supabase!.from('small_ruminants').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}