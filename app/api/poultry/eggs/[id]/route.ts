// 📁 FILE PATH: app/api/poultry/eggs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Egg record schema
const PoultryEggSchema = z.object({
  batch_id: z.string().uuid(),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_eggs: z.number().int().nonnegative().nullable().optional(),
  cracked_eggs: z.number().int().nonnegative().nullable().optional(),
  dirty_eggs: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

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
    .from('poultry_egg_records')
    .select('farm_id')
    .eq('id', id)
    .single()

  if (!record || record.farm_id !== fm.farm_id)
    return { error: 'Forbidden', status: 403, supabase: null }

  return { error: null, status: 200, supabase }
}

// PUT /api/poultry/eggs/[id]
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()

    const guard = await guardRecord(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    // 🔒 SECURITY: Validate input against Zod schema, strip unknown keys
    const validated = PoultryEggSchema.partial().strip().safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: validated.error.errors 
      }, { status: 400 })
    }

    const { data, error } = await (guard.supabase as any)
      .from('poultry_egg_records')
      .update(validated.data)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ record: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}

// DELETE /api/poultry/eggs/[id]
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const guard = await guardRecord(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const { error } = await (guard.supabase as any)
      .from('poultry_egg_records')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
    }
  }