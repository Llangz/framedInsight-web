// 📁 FILE PATH: app/api/poultry/mortality/[id]/route.ts
// 📁 FILE PATH: app/api/poultry/mortality/[id]/route.ts
// Note: DB table is `poultry_mortality` (not poultry_mortality_records — see database.types.ts)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    .from('poultry_mortality')
    .select('farm_id')
    .eq('id', id)
    .single()

  if (!record || record.farm_id !== fm.farm_id)
    return { error: 'Forbidden', status: 403, supabase: null }

  return { error: null, status: 200, supabase }
}

// PUT /api/poultry/mortality/[id]
// Typical use: correct count_dead, cause, notes, record_date
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()

    const guard = await guardRecord(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const { data, error } = await (guard.supabase as any)
      .from('poultry_mortality')
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

// DELETE /api/poultry/mortality/[id]
// Deleting a mortality record does NOT auto-restore current_count on the batch.
// The client must separately PATCH /api/poultry/batches/[id] if needed.
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const guard = await guardRecord(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const { error } = await (guard.supabase as any)
      .from('poultry_mortality')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}