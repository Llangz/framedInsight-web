// 📁 FILE PATH: app/api/poultry/sales/[id]/route.ts
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
    .from('poultry_sales')
    .select('farm_id')
    .eq('id', id)
    .single()

  if (!record || record.farm_id !== fm.farm_id)
    return { error: 'Forbidden', status: 403, supabase: null }

  return { error: null, status: 200, supabase }
}

// PUT /api/poultry/sales/[id]
// Typical use: correct quantity, price_per_unit, total_price, buyer details, payment_method
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()

    const guard = await guardRecord(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    // Recompute total_price if quantity or price changed, to keep it consistent
    const update = { ...body }
    if (update.quantity && update.price_per_unit) {
      update.total_price = parseFloat(update.quantity) * parseFloat(update.price_per_unit)
    }

    const { data, error } = await (guard.supabase as any)
      .from('poultry_sales')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sale: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}

// DELETE /api/poultry/sales/[id]
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const guard = await guardRecord(id)
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const { error } = await (guard.supabase as any)
      .from('poultry_sales')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}